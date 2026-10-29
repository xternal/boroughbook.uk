import { describe, expect, it } from "vitest";
import { DATA } from "./data";
import { eventFor, linkSchema, openPledges, userPrompt, validSuggestions } from "./decision-links";
import { checkDecisionLinks, normaliseText, quoteIn, statusAfter, type Decision } from "./decisions";

const d: Decision = {
  id: "mg-1",
  date: "2026-01-19",
  body: "Cabinet",
  meeting_id: 1,
  item: "6",
  kind: "decision",
  title: "Future Resident Facing Energy Proposals",
  text: "To approve a new H&F service, as part of the H&F ‘Healthy Homes’ programme, to help residents\ninstall insulation, solar PV and heat pumps.",
  url: "https://democracy.lbhf.gov.uk/ieDecisionDetails.aspx?AIId=1",
  meeting_url: "https://democracy.lbhf.gov.uk/ieListDocuments.aspx?CId=116&MId=1",
  documents: [],
};

describe("council decisions and pledges", () => {
  it("matches a quote only when it is the decision's own words, whatever the spacing or quote marks", () => {
    expect(quoteIn("as part of the H&F 'Healthy Homes' programme, to help residents install insulation", d.text)).toBe(true);
    expect(quoteIn("as part of the H&F Healthy Homes programme", d.text)).toBe(false);
    expect(normaliseText("A – b\n c")).toBe("a - b c");
  });

  it("moves a status up the ladder only, and lets a decision end a pledge", () => {
    expect(statusAfter("promised", "in_plan")).toBe("in_plan");
    expect(statusAfter("delivering", "in_plan")).toBe("delivering");
    expect(statusAfter("budgeted", "delivered")).toBe("delivered");
    expect(statusAfter("in_plan", "failed")).toBe("failed");
  });

  it("offers a decision only the open pledges of the party running the council, and drops anything uncheckable", () => {
    const open = openPledges(DATA.content);
    expect(open.length).toBeGreaterThan(0);
    for (const p of open) expect(["promised", "in_plan", "budgeted", "delivering"]).toContain(p.status);
    expect(open.some((p) => p.status === "not_in_power")).toBe(false);
    const green = open.find((p) => p.id === "lab-2026-green-schemes")!;
    const { kept, dropped } = validSuggestions(d, open, {
      links: [
        { promise_id: green.id, event: "in_plan", quote: "To approve a new H&F service, as part of the H&F 'Healthy Homes' programme", reason: "r" },
        { promise_id: green.id, event: "budgeted", quote: "To approve a new H&F service, as part of the programme", reason: "invented words" },
        { promise_id: "con-2026-police", event: "in_plan", quote: "To approve a new H&F service, as part of the H&F", reason: "opposition" },
        { promise_id: green.id, event: "unknown", quote: "To approve a new H&F service", reason: "bad step" },
      ],
    });
    expect(kept.map((k) => k.event)).toEqual(["in_plan"]);
    expect(dropped.length).toBe(3);
    expect(userPrompt(d, open)[0]!.text).toContain(green.id);
    // The pledge list, the same for every decision in a run, is cached; the decision is not.
    expect(userPrompt(d, open)[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect(userPrompt(d, open)[1]).not.toHaveProperty("cache_control");
    expect(userPrompt(d, open)[1]!.text).toContain(d.text);
  });

  it("asks for an answer in a schema the API accepts for structured outputs", () => {
    const open = openPledges(DATA.content);
    const schema = linkSchema(open);
    const item = schema.properties.links.items;
    for (const o of [schema, item]) {
      expect(o.additionalProperties).toBe(false);
      expect([...o.required].sort()).toEqual(Object.keys(o.properties).sort());
    }
    expect(item.properties.promise_id.enum).toEqual(open.map((p) => p.id));
    expect(JSON.stringify(schema)).not.toMatch(/minLength|maxLength|minimum|maximum/);
  });

  it("writes a timeline event that quotes the decision and cites the council's page", () => {
    const e = eventFor(d, { event: "in_plan", quote: "To approve a new H&F service" });
    expect(e).toMatchObject({ date: "2026-01-19", type: "in_plan", evidence_url: d.url });
    expect(e.text).toContain("Cabinet decision, 19 Jan 2026");
    expect(e.text).toContain("“To approve a new H&F service”");
  });

  it("accepts a confirmed link only with the decision's exact words and a matching event on the card", () => {
    const decisions = { ...DATA.decisions, decisions: [d] };
    const card = DATA.content.promises.find((p) => p.id === "lab-2026-green-schemes")!;
    const link = { decision_id: "mg-1", promise_id: card.id, event: "in_plan" as const, quote: "To approve a new H&F service", suggested_by: "test", suggested_on: "2026-10-08" };
    expect(checkDecisionLinks({ ...DATA.content, decision_links: [link] }, decisions)).toEqual([`decision link mg-1:${card.id}: no matching event on the card`]);
    const withEvent = { ...card, events: [...card.events, eventFor(d, link)] };
    const content = { ...DATA.content, promises: DATA.content.promises.map((p) => (p.id === card.id ? withEvent : p)), decision_links: [link] };
    expect(checkDecisionLinks(content, decisions)).toEqual([]);
    expect(checkDecisionLinks({ ...content, decision_links: [{ ...link, quote: "To approve a whole new service" }] }, decisions)[0]).toMatch(/quote is not in/);
  });
});
