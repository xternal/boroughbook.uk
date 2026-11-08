import { describe, expect, it } from "vitest";
import type { PromiseCard } from "./content";
import { addedEvents, addedVersions, checkQuote, quotedPassages, textOfHtml, waybackRaw } from "./promise-quotes";

const card = (id: string, texts: string[]): PromiseCard => ({
  id,
  actor: { kind: "party", id: "labour" },
  made_on: "2026-05-01",
  venue: "manifesto",
  area: "Parks",
  versions: texts.map((text) => ({ text, recorded_on: "2026-10-07", source_url: "https://example.org/m.pdf", page: 2 })),
  status: "promised",
  deadline: null,
  events: [],
  replies: [],
});

describe("pledge quotes against their sources", () => {
  it("checks only what is new: a new card's versions and versions appended to a published card", () => {
    const before = [card("a", ["one"]), card("b", ["two"])];
    const after = [card("a", ["one", "one, reworded"]), card("b", ["two"]), card("c", ["three"])];
    expect(addedVersions(before, after).map((v) => `${v.id} v${v.n}`)).toEqual(["a v2", "c v1"]);
  });

  it("finds a quote on its cited page whatever the line breaks, quote marks, ligatures or split words", () => {
    const pages = ["Contents", "KEY COMMITMENT\nCombine new technology with old-\nfashioned high standards", "Keep the borough’s ﬁnest parks open, devel-\nopments and all"];
    expect(checkQuote("Combine new technology with old-fashioned high standards", pages, 2)).toEqual({ ok: true, where: "page 2" });
    expect(checkQuote("Keep the borough's finest parks open, developments and all", pages, 3).ok).toBe(true);
  });

  it("refuses a paraphrase, a wrong page and a PDF quote with no page", () => {
    const pages = ["Contents", "Deliver over £8m new investment in playgrounds and parks"];
    expect(checkQuote("Deliver £8m of new investment in parks", pages, 2)).toEqual({ ok: false, why: "not found word for word on page 2" });
    expect(checkQuote("Deliver over £8m new investment in playgrounds and parks", pages, 1)).toEqual({ ok: false, why: "not on page 1; found on page 2" });
    expect(checkQuote("Deliver over £8m new investment in playgrounds and parks", pages, 9).ok).toBe(false);
    expect(checkQuote("Deliver over £8m new investment in playgrounds and parks", pages).ok).toBe(false);
  });

  it("reads a web page as a reader sees it", () => {
    const html = `<html><head><script>var x = "We will freeze council tax";</script></head><body><p>We will build&nbsp;<b>500</b> council homes by 2030 &amp; more</p></body></html>`;
    expect(checkQuote("We will build 500 council homes by 2030 & more", [textOfHtml(html)]).ok).toBe(true);
    expect(checkQuote("We will freeze council tax", [textOfHtml(html)]).ok).toBe(false);
  });

  it("asks the Wayback Machine for the page itself, without its toolbar", () => {
    expect(waybackRaw("https://web.archive.org/web/20260617065909/https://hflabour.com/m.pdf")).toBe("https://web.archive.org/web/20260617065909id_/https://hflabour.com/m.pdf");
    expect(waybackRaw("https://web.archive.org/web/20260617065909if_/https://hflabour.com/")).toBe("https://web.archive.org/web/20260617065909id_/https://hflabour.com/");
    expect(waybackRaw("https://example.org/a")).toBe("https://example.org/a");
  });

  it("checks the events added since the ref, not the automatic ones or those already published", () => {
    const old = { date: "2026-09-14", type: "in_plan" as const, text: "Cabinet decision: “39 new affordable homes”" };
    const news = { date: "2026-09-10", type: "delivering" as const, text: "Council news, 10 September 2026: “our first playground transformation is complete”" };
    const auto = { date: "2026-10-31", type: "deadline_missed" as const, text: "The deadline passed.", auto: true };
    const before = [{ ...card("a", ["one"]), events: [old] }];
    const after = [{ ...card("a", ["one"]), events: [old, news, auto] }];
    expect(addedEvents(before, after)).toEqual([{ id: "a", event: news }]);
  });

  it("finds each passage an event quotes", () => {
    // c2f6bc3 (18 Oct 2026): two passages, one of them with a straight quote inside it.
    const text = "Council news, 15 July 2026 (being delivered): “A new, unique tariff from Octopus Energy is set to slash energy bills”; the council's “programme to improve energy efficiency”";
    expect(quotedPassages(text)).toEqual(["A new, unique tariff from Octopus Energy is set to slash energy bills", "programme to improve energy efficiency"]);
    expect(quotedPassages("No quotation here.")).toEqual([]);
  });
});
