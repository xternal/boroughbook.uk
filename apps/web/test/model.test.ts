import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildModel } from "@/lib/model";

/** One card per file in content/promises: the pledge finder adds cards, so the count comes from the files, not a fixed number. */
const CARD_FILES = readdirSync(new URL("../../../content/promises/", import.meta.url)).filter((f) => f.endsWith(".yaml")).length;

describe("page model", () => {
  const m = buildModel();

  it("takes every headline number from data", () => {
    expect(m.netBudget.value).toBeCloseTo(398.009, 6);
    expect(m.generalBudget.value).toBeCloseTo(255.333, 6);
    expect(m.savingsThisYear.value).toBeCloseTo(9.5, 9);
    expect(m.waterfall.gap.value).toBeCloseTo(17.2, 9);
    expect(m.balance.gap.value).toBe(31.4);
    expect(m.place.nextYearLabel).toBe("2027/28");
    expect(m.place.yearAfterLabel).toBe("2028/29");
  });

  it("derived values inherit the worst quality of their inputs", () => {
    expect(m.bill.total.quality).toBe("sourced");
    expect(m.netBudget.quality).toBe("sourced");
    expect(m.ctShare.quality).toBe("sourced");
    expect(m.savingsThisYear.quality).toBe("sourced");
    expect(m.balance.gap.quality).toBe("sourced");
    expect(m.balance.gap.value).toBe(31.4);
    expect(m.balance.ctAssumed?.value).toBe(4.99);
    expect(m.balance.referendumLimit).toBeNull();
    expect(m.balance.referendumNote?.text).toMatch(/Hammersmith and Fulham/);
    expect(m.referendumLimitNow.quality).toBe("sourced");
    expect(m.referendumLimitNow.value).toBe(5);
  });

  it("splits the budget by kind of funding, adding up to the whole", () => {
    expect(m.ctShare.value).toBeCloseTo(92.552 / 398.009, 6);
    expect(m.ctShareGeneral.value).toBeCloseTo(92.552 / 255.333, 6);
    expect(m.ctShare.value + m.grantsShare.value + m.ratesShare.value).toBeLessThan(1);
  });

  it("holds both parties' manifesto pledges to the same rules", () => {
    expect(CARD_FILES).toBeGreaterThanOrEqual(18);
    expect(m.promises).toHaveLength(CARD_FILES);
    const by = (side: string) => m.promises.filter((p) => p.side === side);
    expect(by("administration").every((p) => p.partyId === "labour")).toBe(true); // 38 of 50 seats
    expect(by("opposition").every((p) => p.partyId === "conservative" && ["not_in_power", "unscoreable"].includes(p.status))).toBe(true);
    expect(m.promises.every((p) => p.sources.length > 0 && p.sources.every((s) => s.url.startsWith("https://")))).toBe(true);
    expect(m.promises.every((p) => !p.test)).toBe(true);
  });

  it("orders cards neutrally: newest first, then by id", () => {
    const dates = m.promises.map((p) => p.made_on);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("costs a capital pledge per Band D home, once", () => {
    const parks = m.promises.find((p) => p.id === "lab-2026-parks")!;
    expect(parks.cost).toBeNull();
    expect(parks.capital?.central.value).toBe(8);
    expect(parks.capital?.perBandD.value).toBeCloseTo((8 * 1e6) / 93597.96, 6);
  });

  it("takes party control and councillors from the council's records", () => {
    expect(m.politics.control).toBe("Labour");
    expect(m.politics.seats.value).toBe(38);
    expect(m.politics.totalSeats.value).toBe(50);
    expect(m.people.wards).toHaveLength(21);
    expect(m.people.councillors.find((c) => c.roles.includes("Leader of the Council"))?.name).toBe("Stephen Cowan");
  });

  it("lists the savings with their totals and the one-off part", () => {
    expect(m.savings.serviceTotal?.value).toBeCloseTo(9.524, 9);
    expect(m.savings.collectionTotal?.value).toBeCloseTo(8.375, 9);
    expect(m.savings.oneOffTotal?.value).toBeCloseTo(5.75, 9);
  });

  it("carries no test data, so production can build", () => {
    expect(m.hasTestData).toBe(false);
    expect(m.balance.pendingToggles).toEqual(["Keep free home care for older residents", "Keep library opening hours"]);
  });
});
