# Data model

Zod in `packages/schema`; Pydantic mirrors in `etl/`.

```ts
type Quality = "sourced" | "approx" | "modelled" | "test";
type Range = [low: number, central: number, high: number];

interface Source { id: string; title: string; publisher: string; url: string; published_on: string; page?: string; licence?: string }

interface Observation {
  series_id: string;        // "funding.council_tax", "service.adult_care.net", "bill.band_d.council"
  council: string;          // ONS code, e.g. "E09000013" for H&F (verify)
  year: string;             // "2026-27"
  kind: "budget" | "outturn" | "forecast";
  value: number; unit: "gbp_m" | "gbp" | "pct" | "count";
  source_id: string; vintage: string; quality: Quality; method_note?: string;
}

/* Bill */
interface BillYear {
  year: string;
  band_d: { council: number; gla: number; total: number };
  band_ratios: Record<"A"|"B"|"C"|"D"|"E"|"F"|"G"|"H", number>;
  single_person_discount: 0.25;
  referendum_limit_pct: number;          // set by government each year
  tax_base_band_d_eq: number; collection_rate: number;
  gla_components?: { label: string; band_d: number }[];   // police, fire, transport…
}

/* Budget */
interface BudgetLine {
  id: string; label: string; resident_label: string;
  side: "funding" | "service";
  parent_id?: string;
  ro_code?: string;          // government revenue return line, for cross-council comparison
  gross?: number; income?: number; net: number;   // £m
  quality: Quality; source_id: string; page?: string;
}
interface GapLine { label: string; m: number; kind: "pressure" | "funding" | "close" | "close_saving" | "close_oneoff"; recurring: boolean; source_id: string; quality: Quality }
interface Saving { id: string; label: string; service_id: string; m: number; recurring: boolean; year: string; source_id: string }

/* Balance it */
interface Lever { id: string; label: string; unit: "%" | "£m"; base: number; min: number; max: number; step: number; m_per_unit: number; controlled_by: "council" | "government"; limit?: number; one_off?: boolean; source_id?: string; quality: Quality }
interface Toggle { id: string; label: string; on: boolean; cost_m: number; promise_id?: string; quality: Quality }
interface Scenario { id: string; year: string; levers: Record<string, number>; toggles: Record<string, boolean> }

/* Politics */
interface Councillor { id: string; name: string; party: string; ward_id: string; roles: { title: string; from: string; to?: string }[]; democracy_url: string }
interface Ward { id: string; ons_code: string; name: string; councillor_ids: string[] }
interface Decision { id: string; date: string; body: "Cabinet" | "Council" | string; title: string; url: string; promise_ids?: string[] }

/* Promises */
type Status = "promised" | "in_plan" | "budgeted" | "delivering" | "delivered" | "failed" | "quietly_dropped" | "not_in_power" | "unscoreable";
interface Promise {
  id: string; actor: { kind: "party" | "councillor" | "administration"; id: string };
  made_on: string; venue: "manifesto" | "leaflet" | "hustings" | "council_meeting" | "press" | "social";
  area: string; ward_id?: string;
  versions: { text: string; recorded_on: string; source_url: string }[];   // append-only
  cost_m?: Range | null; capital_cost_m?: Range | null; funded_by?: string | null;
  status: Status; deadline?: string;
  lever_or_toggle_id?: string;
  events: { date: string; type: string; text: string; evidence_url?: string; archive_url?: string; auto?: boolean }[];  // append-only; an event that quotes its evidence needs archive_url unless the evidence is a decision in data/build/decisions.json (promises:quotes)
  replies: { from: string; date: string; text: string }[];
}

/* Payments over £500 */
interface Payment {
  id: string; date: string; amount: number;
  supplier_raw: string; supplier_id?: string;     // null when redacted/personal
  cost_centre_raw: string; service_id: string;    // mapped
  expense_type_raw?: string;
  redacted: boolean;
  file_source_id: string; row_number: number;
}
interface Supplier { id: string; name: string; companies_house_no?: string; kind: "company" | "public_body" | "charity" | "other" }
```

Rules:
- Payments where `redacted = true` or the payee looks like a private individual are aggregated per month and service; the raw row is not stored in `data/build/`.
- `Supplier.companies_house_no` only when matched with high confidence; never guess.
- Promise `versions` and `events` are append-only (CI compares with `main`).
