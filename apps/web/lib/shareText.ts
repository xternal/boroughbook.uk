import { worst, type Quality } from "@borough-ledger/schema/client";
import { defaultScenario, leverValue, mediumTerm, type Scenario } from "@borough-ledger/engine";
import { format, formatLever } from "./format";
import type { PageModel } from "./model";
import { assertRenderable } from "./quality";

export interface ShareSummary {
  title: string;
  status: string;
  choices: string[];
  later: string | null;
  quality: Quality;
}

const money = (m: number) => format("mAuto", Math.abs(m));

function statusLine(remaining: number, status: string): string {
  if (status === "balanced") return "Balanced";
  return status === "short" ? `${money(remaining)} still to find` : `${money(remaining)} spare`;
}

/** Plain-language summary of a balance-it scenario, for the share image and the page's link preview. */
export function shareSummary(m: Pick<PageModel, "balance" | "place">, s: Scenario): ShareSummary {
  const { balance, place } = m;
  const base = defaultScenario(balance.input);
  const years = mediumTerm(
    balance.input,
    balance.strip.filter((y) => y.gap).map((y) => ({ year: y.year, gapM: y.gap!.value })),
    s,
  );
  const choices: string[] = [];
  for (const l of balance.levers) {
    const v = leverValue(s, l);
    if (Math.abs(v - leverValue(base, l)) < 1e-9) continue;
    if (l.id === "ct_rise") choices.push(`Council tax up ${formatLever("%", v, false)}${l.assumed !== undefined ? ` (forecast ${formatLever("%", l.assumed, false)})` : ""}`);
    if (l.id === "savings") choices.push(`${format("m1", v * l.m_per_unit)} more savings`);
    if (l.id === "reserves") choices.push(`${format("m1", v * l.m_per_unit)} from reserves, once`);
    if (l.id === "fees") choices.push(`Fees and parking up ${formatLever("%", v, false)}`);
    if (l.id === "settlement") choices.push(`Government settlement ${formatLever("%", v, true)}`);
  }
  const changed = balance.toggles.filter((t) => (s.toggles[t.id] ?? t.on) !== t.on);
  for (const t of changed) choices.push(t.on ? (t.label.startsWith("Keep ") ? `Stop ${t.label.slice(5)}` : `Drop: ${t.label}`) : t.label);

  const quality = worst(balance.computed.quality, ...changed.map((t) => t.quality));
  assertRenderable(quality, "balance-it share summary");
  const [y1, y2] = years;
  return {
    title: `Balancing ${place.short}'s ${place.nextYearLabel} budget`,
    status: y1 ? statusLine(y1.remainingM, y1.status) : "",
    choices: choices.length ? choices : [`The council's own forecast: ${format("m1", balance.gap.value)} gap`],
    later: y2
      ? `${y2.year.replace("-", "/")}: ${statusLine(y2.remainingM, y2.status).toLowerCase()} if nothing else changes${
          y2.comesBackM > 0 ? `, including ${money(y2.comesBackM)} of reserves coming back` : ""
        }`
      : null,
    quality,
  };
}
