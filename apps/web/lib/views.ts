/**
 * Page views (/most-read): one number per page per day, kept in Upstash Redis, and nothing about the reader. Ported
 * from LedgerGov.UK, with the same public format at /views.json.
 *
 * The proxy (proxy.ts) adds one to today's count for a page a reader opens, after the page is on its way, from the
 * request's path alone. It reads the user agent and the fetch headers only to skip crawlers, link previews, scripts
 * (including scripts that borrow a browser's name) and prefetches, and stores neither: not the IP address, country,
 * device, browser, referrer or time of day. Only the site's own reading pages count. What a reader types (a postcode, a band, a capital value, a Balance it choice) never
 * reaches a page's path: it stays in the browser, goes in an API request's body, or rides in the query string, which is
 * never stored. Pages that carry a token (/follow/confirm, /follow/manage) are steps in a flow and never count. Without
 * the Upstash variables (a preview, a laptop) nothing is counted and /most-read says so.
 *
 * No "server-only" here: the proxy imports this file, and it holds nothing secret.
 */
import { OTHER_BOROUGHS } from "./boroughList";

export const VIEWS_PATH = "/views.json";
export const MOST_READ_PATH = "/most-read";
/** How many days /views.json returns. */
export const VIEWS_DAYS = 30;
/** The windows /most-read shows (days), and how many pages each lists. */
export const MOST_READ_WINDOWS = [7, 30] as const;
export const MOST_READ_TOP = 30;
/** How long /views.json and /most-read keep an answer before asking the counter again. */
export const VIEWS_CACHE_SECONDS = 600;
/** The longest a count may take before it is dropped, and a read before /views.json gives up. */
const COUNT_TIMEOUT_MS = 2_000;
const READ_TIMEOUT_MS = 5_000;

/**
 * The site's reading pages, as app/sitemap.ts lists them; anything else (the API, files, share images, forms with
 * tokens, scanners' guesses) is not counted. Each address below a page has the shape its own pages have: a month is
 * 2026-06, a band is band-c, the rest are lower-case ids. Every council's page is one of the councils on the site.
 */
const PAGES = new RegExp(
  "^/(?:" +
    [
      "bill",
      "budget",
      "gap",
      "balance",
      "method",
      "building",
      "council-homes",
      "promises",
      "decisions",
      "wards",
      "privacy",
      "sources",
      "follow",
      "most-read",
      "payments(?:/\\d{4}-\\d{2})?",
      "council-tax(?:/[a-z0-9-]+)?",
      "council-tax-rise(?:/band-[a-z])?",
      "(?:ward|party|topic|promise|councillor|supplier)/[a-z0-9-]+",
      ...OTHER_BOROUGHS.map((b) => b.slug),
    ].join("|") +
    ")?$",
);
/** A part of an address shaped like a postcode (sw6-1ab, w127rq, n1) or a bare number (a salary, a value): never counted. */
const TYPED = /^(?:[a-z]{1,2}\d[a-z\d]?(?:-?\d[a-z]{2})?|\d+)$/;
const LONGEST_PATH = 120;
export const isCountedPage = (path: string) =>
  path.length <= LONGEST_PATH && PAGES.test(path) && !path.split("/").slice(2).some((part) => TYPED.test(part));

const NOT_A_READER =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|facebookcatalog|meta-external|embedly|whatsapp|telegram|skype|discord|slack|curl|wget|python|httpx|go-http|java\/|okhttp|axios|node-fetch|undici|^node|deno|ruby|php|libwww|postman|insomnia|headless|lighthouse|pagespeed|inspectiontool|pingdom|uptime|monitor|feed|rss|scan|archive|chatgpt|claude|perplexity|anthropic|openai|boroughbook|borough-ledger|vercel|https?:\/\//i;
/** A crawler, a link preview, an AI fetcher or a script (browsers never put a web address in their name); a request with no user agent is not counted either. */
export const isNotAReader = (userAgent: string | null) => !userAgent || NOT_A_READER.test(userAgent);

/**
 * Whether a user agent claims a browser that sends Fetch Metadata (Sec-Fetch-Dest and the rest) with every request:
 * Chrome and every browser built on it (Edge, Opera, Samsung Internet, Brave, Android's in-app views) from version 80,
 * Firefox from 90, Safari from 16.4. On an iPhone or iPad every browser uses Safari's engine (Chrome for iOS, Firefox
 * for iOS, in-app views), so the system's version decides. Anything else, or an older version, may be a genuinely old
 * browser that never sent the headers, and is given the benefit of the doubt.
 */
const atLeast = (major: string | undefined, minor: string | undefined, wantMajor: number, wantMinor = 0) =>
  major !== undefined && (Number(major) > wantMajor || (Number(major) === wantMajor && Number(minor ?? 0) >= wantMinor));
export function claimsFetchMetadataBrowser(userAgent: string): boolean {
  const ios = /\b(?:iPhone|iPad|iPod)\b.*?\bOS (\d+)_(\d+)/.exec(userAgent);
  if (ios) return atLeast(ios[1], ios[2], 16, 4);
  const firefox = /\bFirefox\/(\d+)/.exec(userAgent);
  if (firefox) return atLeast(firefox[1], undefined, 90);
  const chrome = /\bChrome\/(\d+)/.exec(userAgent);
  if (chrome) return atLeast(chrome[1], undefined, 80);
  const safari = /\bVersion\/(\d+)(?:\.(\d+))?.*\bSafari\//.exec(userAgent);
  if (safari) return atLeast(safari[1], safari[2], 16, 4);
  return false;
}

/**
 * Not a page being opened: a browser fetching ahead of a click, a request for part of a page, or a script dressed as a
 * browser. Most links are plain <a>, so most reads are whole-document navigations (Sec-Fetch-Dest: document,
 * Sec-Fetch-Mode: navigate). A request whose user agent claims a current browser but carries no Sec-Fetch-Dest is a
 * script borrowing a browser's name, because every such browser sends it: one walked thousands of supplier pages a day
 * from 8 November 2026. Old browsers that never sent the header still count. The postcode finders and the council tax
 * decoder's links move within the app instead, as a request with an RSC header for the page they open; that counts
 * too, unless it is Next.js fetching ahead.
 */
export function isNotARead(headers: Headers): boolean {
  if (/prefetch|prerender/i.test(headers.get("sec-purpose") ?? headers.get("purpose") ?? "")) return true;
  if (headers.has("next-router-prefetch") || headers.has("next-router-segment-prefetch")) return true;
  if (headers.has("rsc")) return headers.get("rsc") !== "1";
  const dest = headers.get("sec-fetch-dest");
  if (dest === null) return claimsFetchMetadataBrowser(headers.get("user-agent") ?? "");
  // A browser opening a page always sends both; a document fetched any other way is not someone opening it.
  return dest !== "document" || headers.get("sec-fetch-mode") !== "navigate";
}

/** Whether a request adds one to its page's count today. */
export const counts = (method: string, path: string, headers: Headers) =>
  method === "GET" && isCountedPage(path) && !isNotAReader(headers.get("user-agent")) && !isNotARead(headers);

/** The day's counter, by UTC date: one hash per day, a field per page. The prefix keeps it apart in a shared database. */
export const dayKey = (date: Date) => `boroughbook:views:${date.toISOString().slice(0, 10)}`;

export interface ViewsDay {
  date: string;
  pages: Record<string, number>;
}
export interface ViewsFile {
  generated_at: string;
  days: ViewsDay[];
}

const DAY_MS = 86_400_000;

/**
 * Pages by views over the last `days` UTC days up to the file's own date (today and the days before it), most read
 * first. By calendar date, not the newest days in the file: a day nobody read anything is not in the file at all.
 */
export function topPages(file: ViewsFile, days: number): { path: string; views: number }[] {
  const from = new Date(new Date(file.generated_at).getTime() - (days - 1) * DAY_MS).toISOString().slice(0, 10);
  const totals = new Map<string, number>();
  for (const d of file.days.filter((x) => x.date >= from)) {
    for (const [path, n] of Object.entries(d.pages)) totals.set(path, (totals.get(path) ?? 0) + n);
  }
  return [...totals.entries()].map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views || a.path.localeCompare(b.path));
}

/** All views over the last `days` UTC days. */
export const totalViews = (file: ViewsFile, days: number) => topPages(file, days).reduce((s, p) => s + p.views, 0);

/** The Upstash REST address and tokens, as the Vercel integration names them; null when the counter is not connected. */
export interface Counter {
  url: string;
  writeToken: string;
  readToken: string;
}
export function counterFromEnv(env: Record<string, string | undefined> = process.env): Counter | null {
  const url = env.KV_REST_API_URL;
  const writeToken = env.KV_REST_API_TOKEN;
  if (!url || !writeToken) return null;
  return { url: url.replace(/\/$/, ""), writeToken, readToken: env.KV_REST_API_READ_ONLY_TOKEN || writeToken };
}

type Fetch = typeof fetch;

async function pipeline(counter: Counter, commands: string[][], token: string, timeoutMs: number, f: Fetch): Promise<{ result?: unknown }[]> {
  const r = await f(`${counter.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(commands),
    // No `cache: "no-store"`: on /most-read it would stop Next.js refreshing the page every ten minutes (it calls that
    // turning static to dynamic, and keeps the old page). A POST is never cached anyway.
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`counter answered ${r.status}`);
  return (await r.json()) as { result?: unknown }[];
}

/** Adds one to today's count for a page: the path and the date are all that is sent. */
export async function countView(counter: Counter, path: string, now = new Date(), f: Fetch = fetch): Promise<void> {
  await pipeline(counter, [["HINCRBY", dayKey(now), path, "1"]], counter.writeToken, COUNT_TIMEOUT_MS, f);
}

/** The last VIEWS_DAYS days' totals, newest first; days with no views are left out. */
export async function readViews(counter: Counter, now = new Date(), f: Fetch = fetch): Promise<ViewsFile> {
  const dates = Array.from({ length: VIEWS_DAYS }, (_, i) => new Date(now.getTime() - i * DAY_MS));
  const answers = await pipeline(
    counter,
    dates.map((d) => ["HGETALL", dayKey(d)]),
    counter.readToken,
    READ_TIMEOUT_MS,
    f,
  );
  if (!Array.isArray(answers) || answers.length !== dates.length) throw new Error("counter answered something else");
  const file: ViewsFile = { generated_at: now.toISOString(), days: [] };
  answers.forEach((a, i) => {
    const flat = Array.isArray(a.result) ? (a.result as string[]) : [];
    const pages: Record<string, number> = {};
    for (let k = 0; k + 1 < flat.length; k += 2) pages[flat[k]!] = Number(flat[k + 1]);
    if (flat.length) file.days.push({ date: dates[i]!.toISOString().slice(0, 10), pages });
  });
  return file;
}
