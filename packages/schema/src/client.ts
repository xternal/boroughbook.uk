/**
 * The browser-safe part of the schema: pure helpers with no zod and no data. Client components and the engine import
 * from `@borough-ledger/schema/client`, never from the package root, whose index pulls in every data file and its zod
 * checks (data.ts parses them at import). Importing the root from a client component would ship all of that to every
 * reader and parse it again in their browser.
 */
import type { GapLine, GapValueLine } from "./seed";

/** How much to trust a value. `test` is invented and must never reach production. */
export const QUALITIES = ["sourced", "approx", "modelled", "test"] as const;
export type Quality = (typeof QUALITIES)[number];

const RANK: Record<Quality, number> = { sourced: 0, approx: 1, modelled: 2, test: 3 };

/** A value derived from several inputs is only as good as its weakest input. */
export function worst(...qs: Quality[]): Quality {
  let out: Quality = "sourced";
  for (const q of qs) if (RANK[q] > RANK[out]) out = q;
  return out;
}

/**
 * A number ready to render: the value plus the provenance it inherits.
 * Every number the app shows is a Figure; components never format bare numbers.
 */
export interface Figure {
  value: number;
  quality: Quality;
  sources: readonly string[];
}

export function fig(value: number, quality: Quality, ...sources: string[]): Figure {
  return { value, quality, sources: [...new Set(sources)] };
}

/** A Figure computed from other Figures: worst quality, union of sources. */
export function derive(value: number, first: Figure, ...rest: Figure[]): Figure {
  const inputs = [first, ...rest];
  return {
    value,
    quality: worst(...inputs.map((f) => f.quality)),
    sources: [...new Set(inputs.flatMap((f) => f.sources))],
  };
}

/** Council tax bands: A to H in England and Scotland; Wales adds I (its 2005 revaluation). */
export const BANDS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"] as const;

/** The bands a nation's rules define, in order: A to H, and I in Wales. */
export const bandsOf = (rules: { band_ratios: { value: Partial<Record<(typeof BANDS)[number], unknown>> } }) =>
  BANDS.filter((b) => rules.band_ratios.value[b] !== undefined);

export function isGapValueLine(l: GapLine): l is GapValueLine {
  return l.kind !== "subtotal" && l.kind !== "total";
}
