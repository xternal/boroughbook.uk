/* Checking that a pledge's words are really in its source: the guard on every new version of a card. Pure: no files, no network. */
import type { PromiseCard } from "./content";
import { normaliseText } from "./decisions";

export interface NewVersion {
  id: string;
  /** 1-based, as a reader counts versions. */
  n: number;
  version: PromiseCard["versions"][number];
}

/** Versions added since `before`: a new card's every version, or the versions appended to a card already published. */
export function addedVersions(before: readonly PromiseCard[], after: readonly PromiseCard[]): NewVersion[] {
  const had = new Map(before.map((p) => [p.id, p.versions.length]));
  return after.flatMap((p) => p.versions.map((version, i) => ({ id: p.id, n: i + 1, version })).filter(({ n }) => n > (had.get(p.id) ?? 0)));
}

export interface NewEvent {
  id: string;
  event: PromiseCard["events"][number];
}

const eventKey = (e: PromiseCard["events"][number]) => `${e.date}|${e.type}|${e.text}`;

/**
 * Timeline events added since `before` and written by a person or a model (not `auto`). Events are append-only, so an
 * event is new when no event of the card on `before` has the same date, type and text.
 */
export function addedEvents(before: readonly PromiseCard[], after: readonly PromiseCard[]): NewEvent[] {
  const had = new Map(before.map((p) => [p.id, new Set(p.events.map(eventKey))]));
  return after.flatMap((p) => p.events.filter((e) => !e.auto && !had.get(p.id)?.has(eventKey(e))).map((event) => ({ id: p.id, event })));
}

/** The passages an event quotes from its evidence: each run of text inside curly double quotes. */
export function quotedPassages(text: string): string[] {
  return [...text.matchAll(/“([^”]+)”/g)].map((m) => (m[1] ?? "").trim()).filter(Boolean);
}

/** PDF text adds ligatures and soft hyphens that a faithful copy never has; even them out on top of the decisions rule. */
const even = (s: string) => normaliseText(s.normalize("NFKC").replace(/­/g, ""));

/** The Wayback Machine's own copy of the page, without its toolbar: `id_` after the timestamp. */
export function waybackRaw(url: string): string {
  return url.replace(/^(https?:\/\/web\.archive\.org\/web\/\d+)(?:[a-z]{2}_)?\//, "$1id_/");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", pound: "£", hellip: "…" };

/** The words a reader sees on an HTML page: no scripts, styles or tags, entities decoded. */
export function textOfHtml(html: string): string {
  return html
    .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|td|th|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

export type QuoteResult = { ok: true; where: string } | { ok: false; why: string };

/** A word split over two lines of a PDF ("old-" then "fashioned") reads either way: hyphen kept, or a word joined back. */
const readings = (t: string) => [t, t.replace(/-[ \t]*\n\s*/g, "-"), t.replace(/-[ \t]*\n\s*/g, "")].map(even);

/**
 * Is the quote in the source word for word? `pages` is one string per PDF page, or a single string for a web page.
 * A cited page must hold the quote itself: finding it elsewhere in the document is reported, never accepted.
 */
export function checkQuote(quote: string, pages: readonly string[], page?: number): QuoteResult {
  const q = even(quote);
  if (!q) return { ok: false, why: "the quote is empty" };
  const on = pages.flatMap((t, i) => (readings(t).some((r) => r.includes(q)) ? [i + 1] : []));
  if (page !== undefined) {
    if (page > pages.length) return { ok: false, why: `page ${page} cited, but the document has ${pages.length}` };
    if (on.includes(page)) return { ok: true, where: `page ${page}` };
    return { ok: false, why: on.length ? `not on page ${page}; found on page ${on.join(", ")}` : `not found word for word on page ${page}` };
  }
  if (pages.length > 1) return { ok: false, why: `a PDF needs a page; the quote is on page ${on.join(", ") || "none"}` };
  return on.length ? { ok: true, where: "the page" } : { ok: false, why: "not found word for word on the page" };
}
