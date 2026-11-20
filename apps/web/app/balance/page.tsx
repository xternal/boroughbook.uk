import { COUNCIL_UPDATED } from "@/lib/updated";
import type { Metadata } from "next";
import { encodeScenario } from "@borough-ledger/engine";
import { BalancePart } from "@/components/LedgerSections";
import { SectionPage } from "@/components/SectionPage";
import { scenarioFromQuery, type PledgeTry } from "@/lib/balanceLink";
import { buildModel, type PageModel } from "@/lib/model";
import { shareSummary } from "@/lib/shareText";
import { SITE } from "@/lib/site";
import { share } from "@/lib/share";
import { sectionJsonLd } from "@/lib/structured";

type Props = { searchParams: Promise<{ s?: string | string[]; promise?: string | string[] }> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The pledge named in ?promise=, when it has a choice in Balance it; any other value is ignored. */
function pledgeOf(m: PageModel, id: string | undefined): (PledgeTry & { text: string; partyShort: string }) | null {
  const p = id ? m.promises.find((x) => x.id === id) : undefined;
  const toggle = p && m.balance.toggles.find((t) => t.id === p.lever_or_toggle_id);
  return p && toggle ? { id: p.id, toggleId: toggle.id, text: p.text, partyShort: p.partyShort } : null;
}

/** The choices the address opens on: ?s= when given, else the council's forecast with the ?promise= pledge's choice switched. */
async function opened(searchParams: Props["searchParams"]) {
  const q = await searchParams;
  const m = buildModel();
  const pledge = pledgeOf(m, first(q.promise));
  const scenario = scenarioFromQuery(m.balance.input, first(q.s), pledge);
  return { m, pledge, scenario };
}

const NAME = "Balance next year's budget";
const ABOUT = "Next year's gap in the council's budget, with the real choices a council has: council tax and the referendum limit, fees, savings, services and pledges, and reserves, which close it only once.";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { m, scenario } = await opened(searchParams);
  const code = encodeScenario(m.balance.input, scenario);
  const sum = shareSummary(m, scenario);
  const description = `${sum.status}. ${sum.choices.join(". ")}.${sum.later ? ` ${sum.later}.` : ""} An independent tool, not run by the council.`;
  const image = `/balance/og${code ? `?s=${encodeURIComponent(code)}` : ""}`;
  return {
    title: `${sum.title} | ${SITE.name}`,
    description,
    alternates: { canonical: "/balance" },
    ...share("/balance", sum.title, description, { image: { url: image, alt: `${sum.title}: ${sum.status}` } }),
  };
}

/** Balance it on its own page: opened on a shared set of choices (?s=), or with a pledge to try (?promise=). */
export default async function Balance({ searchParams }: Props) {
  const { m, pledge, scenario } = await opened(searchParams);
  return (
    <SectionPage m={m} section="balance" updated={COUNCIL_UPDATED} initialScenario={scenario} jsonLd={sectionJsonLd("/balance", NAME, ABOUT)}>
      <BalancePart m={m} view="own" pledge={pledge ?? undefined} />
    </SectionPage>
  );
}
