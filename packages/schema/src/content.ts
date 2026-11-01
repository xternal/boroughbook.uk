import { z } from "zod";
import { DecisionLink } from "./decisions";
import { Quality } from "./quality";
import { Status } from "./seed";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const sha = z.string().regex(/^[0-9a-f]{64}$/);

export const Party = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
  manifesto: z.object({
    title: z.string(),
    url: z.url(),
    archive_url: z.url().nullable(),
    archive_todo: z.string().optional(),
    published_on: isoDate,
    published_note: z.string().optional(),
    sha256: sha,
  }),
});
export type Party = z.infer<typeof Party>;

export const Councillor = z.object({
  id: z.string(),
  name: z.string(),
  party: z.string(),
  party_name: z.string(),
  ward_id: z.string(),
  roles: z.array(z.object({ title: z.string(), from: isoDate.optional(), to: isoDate.optional() })),
  democracy_url: z.url(),
  source: z.object({ title: z.string(), url: z.url(), retrieved_on: isoDate }),
});
export type Councillor = z.infer<typeof Councillor>;

export const Ward = z.object({ id: z.string(), ons_code: z.string().regex(/^E05\d{6}$/), name: z.string(), councillor_ids: z.array(z.string()).min(1) });
export type Ward = z.infer<typeof Ward>;

export const WardsFile = z.object({
  note: z.string(),
  sources: z.array(z.object({ title: z.string(), url: z.url(), retrieved_on: isoDate, sha256: sha, licence: z.string().optional() })),
  wards: z.array(Ward).min(1),
});

const Cost = z.object({
  range: z.tuple([z.number(), z.number(), z.number()]).refine(([lo, mid, hi]) => lo <= mid && mid <= hi, "range must be low <= central <= high"),
  quality: Quality,
  note: z.string().optional(),
});

export const EVENT_TYPES = [
  "promised",
  "in_plan",
  "budgeted",
  "delivering",
  "delivered",
  "failed",
  "deadline",
  "deadline_missed",
  "quietly_dropped",
  "reworded",
  "reply",
] as const;

export const PromiseCard = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  actor: z.object({ kind: z.enum(["party", "councillor", "administration"]), id: z.string() }),
  made_on: isoDate,
  venue: z.enum(["manifesto", "leaflet", "hustings", "council_meeting", "press", "social"]),
  area: z.string(),
  ward_id: z.string().optional(),
  /** Append-only: rewording adds a version, it never edits one (CLAUDE.md invariant 8). */
  versions: z
    .array(z.object({ text: z.string().min(1), recorded_on: isoDate, source_url: z.url(), page: z.number().int().positive().optional(), archive_url: z.url().optional() }))
    .min(1, "a promise needs at least one version with its source"),
  cost_m: Cost.nullable().optional(),
  capital_cost_m: Cost.nullable().optional(),
  funded_by: z.string().nullable().optional(),
  status: Status,
  deadline: isoDate.nullable(),
  lever_or_toggle_id: z.string().optional(),
  /** Append-only, like versions. */
  events: z.array(z.object({ date: isoDate, type: z.enum(EVENT_TYPES), text: z.string(), evidence_url: z.url().optional(), archive_url: z.url().optional(), auto: z.boolean().optional() })),
  replies: z.array(z.object({ from: z.string(), date: isoDate, text: z.string(), url: z.url().optional() })),
  editor_check_required: z.boolean().optional(),
  editor_note: z.string().optional(),
});
export type PromiseCard = z.infer<typeof PromiseCard>;

export const ContentFile = z.object({
  parties: z.array(Party),
  councillors: z.array(Councillor),
  wards: WardsFile,
  promises: z.array(PromiseCard),
  /** Council decisions linked to pledges, each confirmed by an editor (content/decision_links.yaml). */
  decision_links: z.array(DecisionLink).default([]),
  /** Party with more than half the seats, or null under no overall control. */
  control: z.string().nullable(),
});
export type Content = z.infer<typeof ContentFile>;

/** Which side a party is on, from the seats it holds. Never from its name (CLAUDE.md invariant 7). */
export function sideOf(content: Pick<Content, "control">, partyId: string): "administration" | "opposition" {
  return content.control === partyId ? "administration" : "opposition";
}

/** The party a promise belongs to: the party itself, or the councillor's party. */
export function partyOf(content: Pick<Content, "councillors">, p: PromiseCard): string {
  if (p.actor.kind === "councillor") return content.councillors.find((c) => c.id === p.actor.id)?.party ?? "";
  return p.actor.id;
}

/** Cross-checks that Zod cannot express on one file. Returns every problem found. */
export function checkContent(c: Content): string[] {
  const problems: string[] = [];
  const parties = new Set(c.parties.map((p) => p.id));
  const wards = new Map(c.wards.wards.map((w) => [w.id, w]));
  const councillors = new Map(c.councillors.map((x) => [x.id, x]));
  for (const x of c.councillors) {
    if (!wards.has(x.ward_id)) problems.push(`councillor ${x.id}: unknown ward ${x.ward_id}`);
    if (!wards.get(x.ward_id)?.councillor_ids.includes(x.id)) problems.push(`councillor ${x.id}: not listed in ward ${x.ward_id}`);
  }
  for (const w of c.wards.wards) for (const id of w.councillor_ids) if (!councillors.has(id)) problems.push(`ward ${w.id}: unknown councillor ${id}`);
  for (const p of c.promises) {
    if (p.actor.kind === "party" && !parties.has(p.actor.id)) problems.push(`promise ${p.id}: unknown party ${p.actor.id}`);
    if (p.actor.kind === "councillor" && !councillors.has(p.actor.id)) problems.push(`promise ${p.id}: unknown councillor ${p.actor.id}`);
    if (p.ward_id && !wards.has(p.ward_id)) problems.push(`promise ${p.id}: unknown ward ${p.ward_id}`);
    const side = sideOf(c, partyOf(c, p));
    // One rule for every party: a party not in control cannot be delivering; one in control is never an 'opposition pledge'.
    if (side === "opposition" && !["not_in_power", "unscoreable"].includes(p.status))
      problems.push(`promise ${p.id}: an opposition pledge must be not_in_power or unscoreable, not ${p.status}`);
    if (side === "administration" && p.status === "not_in_power") problems.push(`promise ${p.id}: the administration's pledge cannot be not_in_power`);
  }
  const ids = c.promises.map((p) => p.id);
  if (new Set(ids).size !== ids.length) problems.push("duplicate promise ids");
  return problems;
}
