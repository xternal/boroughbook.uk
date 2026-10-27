import { describe, expect, it } from "vitest";
import hfRaw from "../../../data/build/hf_2026-27.json";
import seedRaw from "../../../data/seed/hf_2026-27.json";
import contentRaw from "../../../data/build/content.json";
import paymentsRaw from "../../../data/build/payments/index.json";
import wardMapRaw from "../../../data/build/ward_map.json";
import wardSpendRaw from "../../../data/build/ward_spend.json";
import decisionsRaw from "../../../data/build/decisions.json";
import electionsRaw from "../../../data/build/elections.json";
import capitalRaw from "../../../data/build/capital.json";
import rulesRaw from "../../../data/config/rules.json";
import { DATA, parseDataset } from "./data";
import { appendOnlyProblems } from "./append-only";
import { deadlinesMissed } from "./deadlines";
import { checkContent, sideOf, type PromiseCard } from "./content";
import { derive, fig, worst } from "./quality";
import { listTestValues } from "./testValues";

const raw = () => structuredClone({ council: hfRaw, content: contentRaw, payments: paymentsRaw, rules: rulesRaw, wardMap: wardMapRaw, wardSpend: wardSpendRaw, decisions: decisionsRaw, elections: electionsRaw, capital: capitalRaw });

describe("seed parses and cross-checks", () => {
  it("loads the committed seed", () => {
    expect(DATA.council.meta.year).toBe("2026-27");
    expect(DATA.sources.get("prototype_test")?.url).toBeUndefined();
  });

  it("rejects a value without a quality", () => {
    const r = raw();
    delete (r.council.funding[0] as { quality?: string }).quality;
    expect(() => parseDataset(r)).toThrow();
  });

  it("names nobody in election results but councillors, through their councillor record", () => {
    const r = raw();
    (r.elections.wards.addison!.candidates[2] as Record<string, unknown>).name = "A Candidate";
    expect(() => parseDataset(r)).toThrow();
    const r2 = raw();
    const loser = r2.elections.wards.addison!.candidates.find((c) => !c.elected)! as { councillor_id?: string };
    loser.councillor_id = "jacolyn-daly";
    expect(() => parseDataset(r2)).toThrow(/only elected candidates link to a councillor/);
  });

  it("rejects an election result whose winner had fewer votes than a loser", () => {
    const r = raw();
    r.elections.wards.addison!.candidates[0]!.votes = 1;
    expect(() => parseDataset(r)).toThrow(/fewer votes was elected/);
  });

  it("rejects a building scheme linked to a pledge that does not exist, and a council homes budget that does not balance", () => {
    const r = raw();
    (r.capital.programme.sections[0]!.groups[0]!.lines[0] as { pledges?: string[] }).pledges = ["nope"];
    expect(() => parseDataset(r)).toThrow(/unknown pledge nope/);
    const r2 = raw();
    r2.capital.council_homes.budget[0]!.now -= 5;
    expect(() => parseDataset(r2)).toThrow(/does not balance/);
  });

  it("rejects an unknown source id", () => {
    const r = raw();
    r.council.services[0]!.source_id = "nope";
    expect(() => parseDataset(r)).toThrow(/unknown source_id "nope"/);
  });

  it("rejects a sourced value that cites a source without a URL", () => {
    const r = raw();
    r.council.meta.sources.push({ id: "no_url", title: "A source without a link", publisher: "Nobody" } as (typeof r.council.meta.sources)[number]);
    r.council.services[0]!.source_id = "no_url";
    expect(() => parseDataset(r)).toThrow(/has no URL/);
  });

  it("rejects a promise card without a sourced version", () => {
    const r = raw();
    r.content.promises[0]!.versions = [];
    expect(() => parseDataset(r)).toThrow(/at least one version/);
  });

  it("rejects a promise linked to a toggle that does not exist", () => {
    const r = raw();
    (r.content.promises[0] as { lever_or_toggle_id?: string }).lever_or_toggle_id = "nope";
    expect(() => parseDataset(r)).toThrow(/unknown lever or toggle/);
  });

  it("keeps the prototype's copies of the rules in step with the rules config", () => {
    const ratios = seedRaw.bill.band_ratios as Record<string, number>;
    for (const [band, [num, den]] of Object.entries(DATA.rules.band_ratios.value)) expect(ratios[band]).toBeCloseTo(num / den, 12);
    // The prototype shows the highest rise allowed without a referendum: just under the threshold.
    const ct = seedRaw.next_year.levers.find((l) => l.id === "ct_rise");
    expect(ct?.limit).toBeCloseTo((DATA.rules.referendum_limit_pct[DATA.council.meta.year]?.threshold_pct ?? 0) - 0.01, 9);
  });

  it("carries what was actually spent in 2024/25, by the same service groups", () => {
    const o = DATA.council.history.outturn.find((h) => h.year === "2024-25");
    expect(o?.revenue_expenditure_m).toBe(372.129);
    expect(Object.keys(o?.services_m ?? {}).sort()).toEqual(DATA.council.services.map((s) => s.id).sort());
    expect(o?.reserves_m.unallocated_end).toBe(22.066);
  });

  it("checks every saving against its directorate total and flags one-off savings", () => {
    const service = DATA.council.savings.filter((s) => s.kind === "service").reduce((a, s) => a + s.m, 0);
    expect(service).toBeCloseTo(9.524, 9); // Appendix C; Table 2 rounds it to £9.5m
    expect(DATA.council.savings.filter((s) => s.one_off).map((s) => s.id).sort()).toEqual(["asc-stretch", "ct-arrears-release", "nndr-bad-debt-release"]);
  });

  it("rejects a ring-fenced grant pointing at a service that does not exist", () => {
    const r = raw();
    (r.council.funding.find((f) => "ring_fenced_to" in f) as { ring_fenced_to?: string }).ring_fenced_to = "nope";
    expect(() => parseDataset(r)).toThrow(/ring-fenced to unknown service/);
  });

  it("decides administration or opposition from seats, never from a party name", () => {
    expect(DATA.content.control).toBe("labour"); // 38 of 50 seats in the council's own records
    expect(sideOf(DATA.content, "labour")).toBe("administration");
    expect(sideOf(DATA.content, "conservative")).toBe("opposition");
    expect(sideOf({ control: null }, "labour")).toBe("opposition"); // no overall control: nobody is the administration
  });

  it("holds every party to the same status rules", () => {
    const c = structuredClone(DATA.content);
    c.promises.find((p) => p.actor.id === "conservative")!.status = "delivering";
    c.promises.find((p) => p.actor.id === "labour")!.status = "not_in_power";
    const problems = checkContent(c);
    expect(problems.some((x) => /opposition pledge must be not_in_power/.test(x))).toBe(true);
    expect(problems.some((x) => /administration's pledge cannot be not_in_power/.test(x))).toBe(true);
  });

  it("flags a passed deadline once, and only for the administration's open pledges", () => {
    const base = structuredClone(DATA.content.promises.find((p) => p.status === "promised")!);
    const p = { ...base, deadline: "2026-09-30" };
    expect(deadlinesMissed([p], "2026-10-07").map((x) => x.id)).toEqual([p.id]);
    expect(deadlinesMissed([p], "2026-09-30")).toEqual([]); // not yet passed
    expect(deadlinesMissed([{ ...p, status: "delivered" as const }], "2026-10-07")).toEqual([]);
    expect(deadlinesMissed([{ ...p, status: "not_in_power" as const }], "2026-10-07")).toEqual([]);
    const flagged = { ...p, events: [...p.events, { date: "2026-10-01", type: "deadline_missed" as const, text: "x", auto: true }] };
    expect(deadlinesMissed([flagged], "2026-10-07")).toEqual([]); // already flagged
  });

  it("reconciles every payments file: each month adds back up to its file, and older files to the council's own total", () => {
    expect(DATA.payments.sources.length).toBeGreaterThanOrEqual(8);
    for (const s of DATA.payments.sources) {
      const months = DATA.payments.months.filter((m) => m.files.includes(s.id));
      expect(months.reduce((a, m) => a + m.rows, 0)).toBe(s.rows);
      expect(months.reduce((a, m) => a + m.total, 0)).toBeCloseTo(s.total, 2);
    }
    expect(DATA.payments.sources.filter((s) => s.own_total !== null).length).toBeGreaterThanOrEqual(3);
    const r = raw();
    r.payments.months[0]!.total += 1;
    expect(() => parseDataset(r)).toThrow(/published plus withheld|do not add up/);
  });

  it("has one map shape for every ward, from the ONS, with neighbours both ways", () => {
    expect(DATA.wardMap.wards.length).toBe(DATA.content.wards.wards.length);
    expect(DATA.sources.get("ons_wards_2024")?.sha256).toBe(DATA.wardMap.source.sha256);
    const missing = raw();
    missing.wardMap.wards.pop();
    expect(() => parseDataset(missing)).toThrow(/no shape for/);
    const oneWay = raw();
    oneWay.wardMap.wards[0]!.neighbours = [...oneWay.wardMap.wards[0]!.neighbours, oneWay.wardMap.wards[20]!.ons_code];
    expect(() => parseDataset(oneWay)).toThrow(/not the other way/);
  });

  it("adds up council building schemes by ward, and keeps them approx until every line is signed off", () => {
    const s = DATA.wardSpend;
    expect(Object.keys(s.wards).length).toBeGreaterThan(10);
    expect(s.quality).toBe(s.mapping.unreviewed + s.mapping.checked > 0 ? "approx" : "sourced");
    const off = raw();
    const first = Object.values(off.wardSpend.wards)[0]!;
    first.total += 1000;
    expect(() => parseDataset(off)).toThrow(/do not add up/);
    const early = raw();
    early.wardSpend.quality = "sourced";
    early.wardSpend.mapping.checked = 1; // one line checked by Claude, not yet signed off by a person
    expect(() => parseDataset(early)).toThrow(/signed off/);
  });

    it("cites every payments file as a source with its hash", () => {
    for (const s of DATA.payments.sources) expect(DATA.sources.get(s.id)?.sha256).toBe(s.sha256);
  });

  it("keeps promise history append-only", () => {
    const before = DATA.content.promises;
    const grown = structuredClone(before);
    grown[0]!.events.push({ date: "2026-11-01", type: "in_plan", text: "Cabinet decision" });
    expect(appendOnlyProblems(before, grown)).toEqual([]);
    const edited = structuredClone(before);
    edited[0]!.versions[0]!.text = "Something else";
    expect(appendOnlyProblems(before, edited)).toEqual([`${before[0]!.id}: versions[0] was edited; add a new entry instead`]);
    const deleted = before.slice(1) as PromiseCard[];
    expect(appendOnlyProblems(before, deleted)[0]).toMatch(/deleted/);
  });
});

describe("quality", () => {
  it("derived values take the worst input quality", () => {
    expect(worst("sourced", "approx")).toBe("approx");
    expect(worst("approx", "test", "sourced")).toBe("test");
    const d = derive(3, fig(1, "sourced", "a"), fig(2, "test", "b"));
    expect(d).toEqual({ value: 3, quality: "test", sources: ["a", "b"] });
  });

  it("lists every test value in the seed", () => {
    const list = listTestValues(DATA);
    expect(list).toEqual([]); // switches without a sourced cost are held back, not shown (next_year.pending_toggles)
    expect(DATA.council.next_year.pending_toggles.map((t) => t.id)).toEqual(["free_home_care", "library_hours"]);
    expect(list).not.toContain("next_year.levers.fees");
    expect(list).not.toContain("next_year.reserves.minimum_safe");
    expect(list.some((x) => x.startsWith("promises."))).toBe(false); // test cards are gone
    expect(list.some((x) => x.startsWith("payments"))).toBe(false); // the council's own spend files since M4
    expect(list).not.toContain("funding.council_tax");
    expect(list).not.toContain("bill");
  });
});
