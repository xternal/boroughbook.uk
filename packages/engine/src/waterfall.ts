import type { GapLine } from "@borough-ledger/schema";
import { isGapValueLine } from "@borough-ledger/schema/client";

export interface WaterfallRow {
  label: string;
  kind: GapLine["kind"];
  /** Signed change for value rows; the running total for subtotal and total rows. */
  value: number;
  /** Bar extent in £m along the running total. */
  from: number;
  to: number;
  line: GapLine;
}

export interface Waterfall {
  rows: WaterfallRow[];
  /** The gap: pressures net of the change in government funding (the subtotal). */
  gapM: number;
  /** What is left after the closing lines. Must be zero for a balanced budget. */
  residualM: number;
  /** Largest running total, for scaling bars. */
  maxM: number;
  closes: boolean;
}

/**
 * docs/MODEL.md §3:
 *   gap = Σ pressures − Δ government funding
 *   0   = gap − council_tax_increase − savings − reserves_used
 */
export function buildWaterfall(lines: readonly GapLine[], toleranceM: number): Waterfall {
  let run = 0;
  let max = 0;
  let gapM = Number.NaN;
  const rows: WaterfallRow[] = [];
  for (const line of lines) {
    if (isGapValueLine(line)) {
      const a = run;
      run += line.m;
      rows.push({ label: line.label, kind: line.kind, value: line.m, from: Math.min(a, run), to: Math.max(a, run), line });
    } else {
      if (line.kind === "subtotal") gapM = run;
      rows.push({ label: line.label, kind: line.kind, value: run, from: 0, to: run, line });
    }
    max = Math.max(max, run);
  }
  return { rows, gapM, residualM: run, maxM: max, closes: Math.abs(run) <= toleranceM };
}
