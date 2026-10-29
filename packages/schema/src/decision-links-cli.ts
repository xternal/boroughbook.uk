/* Council decisions to pledges, in two steps (docs/PROMISE_STANDARD.md):

     tsx src/decision-links-cli.ts suggest <out.json>   ask Claude about each decision not yet assessed; write suggestions
     tsx src/decision-links-cli.ts apply <in.json> [summary.md]   append the events to the cards and the links to content/

   The daily workflow opens a pull request with the applied suggestions: merging it is the editor's confirmation, closing
   it rejects them. Assessed decisions are recorded in data/build/decision_assessments.json so none is asked about twice.
   Needs ANTHROPIC_API_KEY; without it, suggest records nothing and says so. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isSeq, parseDocument } from "yaml";
import { compileContent } from "./content-compile";
import { requestProblems } from "./claude-request";
import { SYSTEM_PROMPT, eventFor, linkFor, linkSchema, openPledges, statusAfter, suggestRequest, userPrompt, validSuggestions, type Suggestion, type TextBlock } from "./decision-links";
import type { PromiseCard } from "./content";
import { DecisionsFile } from "./decisions";

const root = join(import.meta.dirname, "..", "..", "..");
const ASSESSED = join(root, "data", "build", "decision_assessments.json");
const LINKS = join(root, "content", "decision_links.yaml");
const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

type Assessed = Record<string, { on: string; by: string; links: number }>;
const readAssessed = (): Assessed => (existsSync(ASSESSED) ? JSON.parse(readFileSync(ASSESSED, "utf8")).assessed : {});
const writeAssessed = (a: Assessed) =>
  writeFileSync(
    ASSESSED,
    `${JSON.stringify({ note: "Decisions already put to the suggester (decision-links-cli.ts), so none is asked about twice.", assessed: Object.fromEntries(Object.entries(a).sort()) }, null, 1)}\n`,
  );
const decisions = () => DecisionsFile.parse(JSON.parse(readFileSync(join(root, "data", "build", "decisions.json"), "utf8"))).decisions;

/** Puts one decision to Claude, with the request suggestRequest builds (structured outputs, never a forced tool call). A
    declined request is retried server-side on the fallback Anthropic recommends, so `model` is whichever model answered.
    Null when there is no usable answer (refused or cut off): the decision then stays unassessed and is asked about again
    on the next run. A request the API would refuse is not sent: the run fails with the reason, and the workflow opens a
    job-failed issue. */
async function ask(system: string, user: TextBlock[], schema: ReturnType<typeof linkSchema>): Promise<{ answer: unknown; model: string; stop: string } | null> {
  const req = suggestRequest(MODEL, system, user, schema);
  const problems = requestProblems(req);
  if (problems.length) throw new Error(`Not sent: the Claude API would refuse this request for ${MODEL}: ${problems.join("; ")}`);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { ...req.headers, "x-api-key": process.env.ANTHROPIC_API_KEY! },
    body: JSON.stringify(req.body),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status} for ${MODEL}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { model: string; stop_reason: string; content: { type: string; text?: string }[] };
  const text = body.content.filter((c) => c.type === "text").at(-1)?.text;
  if (body.stop_reason !== "end_turn" || !text) {
    console.log(`no answer from ${body.model}: stop_reason ${body.stop_reason}`);
    return null;
  }
  return { answer: JSON.parse(text), model: body.model, stop: body.stop_reason };
}

async function suggest(out: string) {
  const assessed = readAssessed();
  const todo = decisions().filter((d) => !assessed[d.id]);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(`No ANTHROPIC_API_KEY: ${todo.length} decisions wait to be assessed.`);
    writeFileSync(out, "[]\n");
    return;
  }
  const pledges = openPledges(compileContent(join(root, "content")));
  const all: (Suggestion & { suggested_by: string })[] = [];
  let unanswered = 0;
  for (const d of todo) {
    const reply = await ask(SYSTEM_PROMPT, userPrompt(d, pledges), linkSchema(pledges));
    if (!reply) {
      console.log(`${d.id} left for the next run`);
      unanswered++;
      continue;
    }
    const { kept, dropped } = validSuggestions(d, pledges, reply.answer);
    for (const x of dropped) console.log(`dropped ${x}`);
    all.push(...kept.map((k) => ({ ...k, suggested_by: reply.model })));
    assessed[d.id] = { on: today, by: reply.model, links: kept.length };
  }
  writeAssessed(assessed);
  writeFileSync(out, `${JSON.stringify(all, null, 1)}\n`);
  console.log(`${todo.length - unanswered} decisions assessed, ${all.length} links suggested${unanswered ? `, ${unanswered} left for the next run` : ""}.`);
}

function apply(input: string, summaryPath?: string) {
  const suggestions = JSON.parse(readFileSync(input, "utf8")) as (Suggestion & { suggested_by?: string })[];
  const byId = new Map(decisions().map((d) => [d.id, d]));
  const content = compileContent(join(root, "content"));
  const open = new Set(openPledges(content).map((p) => p.id));
  const linksDoc = parseDocument(
    existsSync(LINKS) ? readFileSync(LINKS, "utf8") : "# Council decisions linked to pledges. Added by pull request; merging it is the editor's confirmation.\nlinks: []\n",
  );
  // One field a line, like every other content file, so a link reads (and is reviewed) easily.
  const seq = linksDoc.get("links", true);
  if (isSeq(seq)) seq.flow = false;
  const existing = new Set(content.decision_links.map((l) => `${l.decision_id}:${l.promise_id}`));
  const lines: string[] = [];
  for (const s of suggestions) {
    const d = byId.get(s.decision_id);
    if (!d || !open.has(s.promise_id) || existing.has(`${s.decision_id}:${s.promise_id}`)) continue;
    const path = join(root, "content", "promises", `${s.promise_id}.yaml`);
    const card = parseDocument(readFileSync(path, "utf8"));
    // Append-only: a new event at the end; the status moves up the ladder, never down.
    card.addIn(["events"], card.createNode(eventFor(d, s)));
    const before = card.get("status") as PromiseCard["status"];
    const after = statusAfter(before, s.event);
    card.set("status", after);
    writeFileSync(path, card.toString());
    linksDoc.addIn(["links"], linksDoc.createNode(linkFor(s, s.suggested_by ?? MODEL, today)));
    existing.add(`${s.decision_id}:${s.promise_id}`);
    lines.push(
      `### ${s.promise_id}: ${before}${after !== before ? ` → **${after}**` : " (status unchanged)"}\n\n` +
        `${d.body}, ${d.date}, item ${d.item}: [${d.title}](${d.url})\n\n> ${s.quote}\n\nWhy: ${s.reason}\n`,
    );
  }
  writeFileSync(LINKS, linksDoc.toString());
  if (summaryPath) writeFileSync(summaryPath, lines.join("\n"));
  console.log(`${lines.length} links applied.`);
}

/** The suggester's own request for one short decision already assessed, recording nothing: is the key accepted, does the
    model exist, and does it take the request as sent? Costs about a penny. */
async function probe() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("No ANTHROPIC_API_KEY.");
  const pledges = openPledges(compileContent(join(root, "content")));
  const d = decisions().reduce((a, b) => (b.text.length < a.text.length ? b : a));
  const reply = await ask(SYSTEM_PROMPT, userPrompt(d, pledges), linkSchema(pledges));
  if (!reply) throw new Error(`${MODEL} gave no usable answer for ${d.id}.`);
  const { kept, dropped } = validSuggestions(d, pledges, reply.answer);
  console.log(`Claude API key accepted; ${reply.model} answered for ${d.id} (stop_reason ${reply.stop}): ${kept.length} links kept, ${dropped.length} dropped.`);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "probe") await probe();
else if (cmd === "suggest" && a) await suggest(a);
else if (cmd === "apply" && a) apply(a, b);
else {
  console.error("usage: decision-links-cli.ts probe | suggest <out.json> | apply <in.json> [summary.md]");
  process.exit(2);
}
