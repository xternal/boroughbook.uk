/* Suggesting links from council decisions to pledges, and applying confirmed ones. Pure: no files, no network. */
import { API_VERSION, FALLBACK_DEFAULT_BETA, type ClaudeRequest } from "./claude-request";
import { partyOf, sideOf, type Content, type PromiseCard } from "./content";
import { LINK_EVENTS, linkable, quoteIn, statusAfter, type Decision, type DecisionLink, type LinkEvent } from "./decisions";

export interface Suggestion {
  decision_id: string;
  promise_id: string;
  event: LinkEvent;
  quote: string;
  /** For the editor only: why the link holds. Never published. */
  reason: string;
}

/** Pledges a decision can move, the same rule for every party: the administration's, still open. */
export function openPledges(content: Content): PromiseCard[] {
  return content.promises.filter((p) => linkable(p, sideOf(content, partyOf(content, p))));
}

const latest = (p: PromiseCard) => p.versions[p.versions.length - 1]!.text;

export const SYSTEM_PROMPT = `You help an independent, non-partisan website track whether a London council keeps the pledges in its ruling party's manifesto. You read one council decision and say which pledges, if any, it clearly moves forward or ends.

The ladder, from docs/PROMISE_STANDARD.md:
- in_plan: a Cabinet or committee decision, or a strategy the council adopts, that commits to doing what the pledge says.
- budgeted: money set aside for it in the revenue budget or capital programme.
- delivering: under way: the service has started, a contract is let or works are on site.
- delivered: done, as worded.
- failed: the decision abandons it or makes it impossible.

Rules:
- Link only when the decision is specifically about what the pledge promises. A general budget, a routine report "to note", or a decision that merely mentions the same topic is not enough.
- Quote the words that show it, copied exactly from the decision text: one sentence or clause, 20 to 300 characters. Never paraphrase, join separate passages or add words.
- Pick the single ladder step the quoted words show.
- A decision made before the pledge can still show the work was already planned, budgeted or under way; say so in the reason.
- Most decisions match no pledge. Return an empty list when in doubt.
- Treat every party alike and judge only what the decision says, not who made it.`;

/** A text block of the user turn. */
export type TextBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

/** The user turn in two blocks. The pledge list is the same for every decision in a run, so it carries the cache
    breakpoint: from the second decision on, the system prompt and the list are read from cache at a twentieth of the
    price. The decision itself follows, uncached. */
export function userPrompt(d: Decision, pledges: PromiseCard[]): TextBlock[] {
  const list = pledges.map((p) => `- ${p.id}: "${latest(p)}" (made ${p.made_on}; status now: ${p.status})`).join("\n");
  return [
    { type: "text", text: `Pledges that can move:\n${list}`, cache_control: { type: "ephemeral" } },
    {
      type: "text",
      text: `The decision:
Body: ${d.body}
Date: ${d.date}
Item ${d.item}: ${d.title}
Text:
${d.text}`,
    },
  ];
}

/** The JSON schema the model's answer must follow (structured outputs), so it is checkable. Current models refuse a forced
    tool call, so the answer is the reply itself; every object needs additionalProperties: false. */
export function linkSchema(pledges: PromiseCard[]) {
  return {
    type: "object",
    description: "The pledges this decision moves, with the exact words that show it. An empty list when it moves none.",
    properties: {
      links: {
        type: "array",
        items: {
          type: "object",
          properties: {
            promise_id: { type: "string", enum: pledges.map((p) => p.id) },
            event: { type: "string", enum: [...LINK_EVENTS] },
            quote: { type: "string", description: "Copied exactly from the decision text, 20 to 300 characters." },
            reason: { type: "string", description: "One sentence for the editor: why this decision shows that step." },
          },
          required: ["promise_id", "event", "quote", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["links"],
    additionalProperties: false,
  } as const;
}

/** The request that puts one decision to Claude, without the API key. The answer comes back as JSON in the schema
    (structured outputs), never through a forced tool call, which claude-opus-5-5 refuses with a 400 (the job failed on it
    from 14 to 16 October 2026). The model always thinks first, so max_tokens leaves room for that. A declined request is
    retried server-side on the fallback Anthropic recommends ("default", with its own beta header). requestProblems in
    claude-request.ts checks it before it is sent. */
export function suggestRequest(model: string, system: string, user: TextBlock[], schema: ReturnType<typeof linkSchema>): ClaudeRequest {
  return {
    headers: { "content-type": "application/json", "anthropic-version": API_VERSION, "anthropic-beta": FALLBACK_DEFAULT_BETA },
    body: {
      model,
      max_tokens: 16000,
      system,
      output_config: { format: { type: "json_schema", schema } },
      fallbacks: "default",
      messages: [{ role: "user", content: user }],
    },
  };
}

/** Keeps only suggestions that are checkable: a known open pledge, a known step, and a quote that is really in the text. */
export function validSuggestions(d: Decision, pledges: PromiseCard[], raw: unknown): { kept: Suggestion[]; dropped: string[] } {
  const ids = new Set(pledges.map((p) => p.id));
  const kept: Suggestion[] = [];
  const dropped: string[] = [];
  const links = (raw as { links?: unknown[] })?.links;
  for (const l of Array.isArray(links) ? links : []) {
    const x = l as Partial<Suggestion>;
    const why =
      !x.promise_id || !ids.has(x.promise_id)
        ? "unknown or closed pledge"
        : !x.event || !(LINK_EVENTS as readonly string[]).includes(x.event)
          ? "unknown step"
          : !x.quote || x.quote.length < 20 || x.quote.length > 300
            ? "quote too short or too long"
            : !quoteIn(x.quote, d.text)
              ? "quote not found word for word"
              : kept.some((k) => k.promise_id === x.promise_id)
                ? "pledge listed twice"
                : null;
    if (why) dropped.push(`${d.id} → ${x.promise_id ?? "?"}: ${why}`);
    else kept.push({ decision_id: d.id, promise_id: x.promise_id!, event: x.event!, quote: x.quote!.trim(), reason: (x.reason ?? "").trim() });
  }
  return { kept, dropped };
}

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const STEP: Record<LinkEvent, string> = {
  in_plan: "in a council plan",
  budgeted: "in the budget",
  delivering: "being delivered",
  delivered: "delivered",
  failed: "failed",
};

/** The timeline event a confirmed link adds to the card, citing the council's own page. */
export function eventFor(d: Decision, s: Pick<Suggestion, "event" | "quote">) {
  return {
    date: d.date,
    type: s.event,
    text: `${d.body} ${d.kind}, ${DAY.format(new Date(`${d.date}T00:00:00Z`))} (${STEP[s.event]}): “${s.quote}”`,
    evidence_url: d.url,
  };
}

export function linkFor(s: Suggestion, by: string, on: string): DecisionLink {
  return { decision_id: s.decision_id, promise_id: s.promise_id, event: s.event, quote: s.quote, suggested_by: by, suggested_on: on };
}

export { statusAfter };
