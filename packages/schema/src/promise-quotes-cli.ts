/*
 * Every version added to content/promises since a git ref (default origin/main) must quote its source word for word,
 * with an archived copy. Reads the Wayback Machine copy first, then the live page; a PDF is read page by page.
 * Every timeline event added since the ref that quotes its evidence (text in curly quotes) is checked the same way:
 * against the decision's text in data/build/decisions.json when its evidence is a council decision we hold, otherwise
 * against its archived copy (`archive_url`), which it must have.
 *
 *   pnpm --filter @borough-ledger/schema promises:quotes [ref]
 *
 * Prints a table for the pull request and exits 1 if any quote is missing from its source.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { Party, PromiseCard } from "./content";
import { addedEvents, addedVersions, checkQuote, quotedPassages, waybackRaw } from "./promise-quotes";
import { readSource } from "./source-text";

const root = join(import.meta.dirname, "..", "..", "..");
const ref = process.argv[2] ?? "origin/main";
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });

let names: string[] = [];
try {
  names = git("ls-tree", "--name-only", `${ref}:content/promises`).split("\n").filter((f) => f.endsWith(".yaml"));
} catch {
  names = [];
}
const before = names.map((f) => PromiseCard.parse(parse(git("show", `${ref}:content/promises/${f}`))));
const dir = join(root, "content", "promises");
const after = readdirSync(dir)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => PromiseCard.parse(parse(readFileSync(join(dir, f), "utf8"))));

// A manifesto pledge is archived once, with its manifesto (content/parties.yaml), not on every card.
const parties = Party.array().parse((parse(readFileSync(join(root, "content", "parties.yaml"), "utf8")) as { parties: unknown }).parties);
const manifestoArchive = new Map(parties.flatMap((p) => (p.manifesto.archive_url ? [[p.manifesto.url, p.manifesto.archive_url] as const] : [])));

const added = addedVersions(before, after);
const events = addedEvents(before, after).filter((e) => quotedPassages(e.event.text).length);
if (!added.length && !events.length) {
  console.log(`promises:quotes: no new versions or quoting events since ${ref}; nothing to check.`);
  process.exit(0);
}

// Council decisions the ETL already holds, by their page on the democracy site.
const decisionsFile = (parse(readFileSync(join(root, "data", "build", "decisions.json"), "utf8")) ?? {}) as { decisions?: { url: string; text: string }[] };
// A meeting's page holds several decisions and resolutions under one address: read them together.
const decisionText = new Map<string, string>();
for (const d of decisionsFile.decisions ?? []) decisionText.set(d.url, [decisionText.get(d.url), d.text].filter(Boolean).join("\n\n"));

// Several cards quote the same manifesto: read each source once.
const sources = new Map<string, ReturnType<typeof readSource>>();
const readOnce = (url: string) => sources.get(url) ?? sources.set(url, readSource(url)).get(url)!;

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s+/g, " ");
const rows: string[] = [];
let failed = 0;
let byEye = 0;
for (const v of added) {
  const { text, source_url, page } = v.version;
  const archive_url = v.version.archive_url ?? manifestoArchive.get(source_url);
  let verdict = archive_url ? "" : "**No**: no archived copy (archive_url)";
  if (archive_url) {
    for (const url of [waybackRaw(archive_url), source_url]) {
      const got = await readOnce(url);
      const used = url === source_url ? "live page" : "archived copy";
      if ("picture" in got) {
        // A photo of a leaflet cannot be read by code; the editor reads it, and the table says so.
        verdict = `**By eye**: the ${used} is a picture, for the editor to read`;
        byEye++;
        break;
      }
      const r = "pages" in got ? checkQuote(text, got.pages, page) : ({ ok: false, why: got.error } as const);
      verdict = r.ok ? `Yes, ${r.where} of the ${used}` : `**No**: ${used}, ${cell(r.why)}`;
      if (r.ok) break;
    }
  }
  if (verdict.startsWith("**No**")) failed++;
  rows.push(`| ${v.id} v${v.n} | ${cell(text.length > 90 ? `${text.slice(0, 87)}...` : text)} | ${verdict} |`);
}

// Events (October 2026 backtest: two news-based status events of 18 Oct went live with no check of their quotes).
const eventRows: string[] = [];
let eventFailed = 0;
for (const { id, event } of events) {
  for (const passage of quotedPassages(event.text)) {
    const held = event.evidence_url ? decisionText.get(event.evidence_url) : undefined;
    let verdict: string;
    if (held !== undefined) {
      const r = checkQuote(passage, [held]);
      verdict = r.ok ? "Yes, in the decision's text (data/build/decisions.json)" : `**No**: decision's text, ${cell(r.why)}`;
    } else if (!event.archive_url) {
      verdict = "**No**: no archived copy of the evidence (archive_url)";
    } else {
      const got = await readOnce(waybackRaw(event.archive_url));
      const r = "pages" in got ? checkQuote(passage, got.pages) : ({ ok: false, why: "picture" in got ? "the copy is a picture" : got.error } as const);
      verdict = r.ok ? "Yes, the archived copy" : `**No**: archived copy, ${cell(r.why)}`;
    }
    if (verdict.startsWith("**No**")) eventFailed++;
    eventRows.push(`| ${id} ${event.date} ${event.type} | ${cell(passage.length > 90 ? `${passage.slice(0, 87)}...` : passage)} | ${verdict} |`);
  }
}
if (eventRows.length) {
  console.log(`Quotes in timeline events added since ${ref}, checked word for word against their evidence:\n`);
  console.log("| Event | Quote | In the evidence? |\n|---|---|---|");
  console.log(eventRows.join("\n") + "\n");
}
if (!added.length) {
  if (eventFailed) {
    console.error(`${eventFailed} of ${eventRows.length} event quotes are not in their evidence word for word. Add the archived copy, fix the quote, or drop the event.`);
    process.exit(1);
  }
  console.log(`All ${eventRows.length} event quotes are in their evidence word for word.`);
  process.exit(0);
}

console.log(`Quotes added since ${ref}, checked word for word against their sources:\n`);
console.log("| Card | Quote | In the source? |\n|---|---|---|");
console.log(rows.join("\n"));
if (eventFailed) {
  console.error(`\n${eventFailed} of ${eventRows.length} event quotes are not in their evidence word for word. Add the archived copy, fix the quote, or drop the event.`);
}
if (failed || eventFailed) {
  if (!failed) process.exit(1);
  console.error(`\n${failed} of ${added.length} quotes are not in their sources word for word. Fix the quote or the page, or drop the card.`);
  process.exit(1);
}
console.log(
  byEye
    ? `\n${added.length - byEye} of ${added.length} quotes are in their sources word for word; ${byEye} ${byEye === 1 ? "is a picture" : "are pictures"} for the editor to read.`
    : `\nAll ${added.length} quotes are in their sources word for word.`,
);
