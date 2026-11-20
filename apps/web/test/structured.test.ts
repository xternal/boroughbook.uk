import { describe, expect, it } from "vitest";
import { buildModel } from "@/lib/model";
import { dateModified, promiseMarkdown, promiseQA, promiseSummary } from "@/lib/promiseText";
import { councillorJsonLd, promiseJsonLd, promisesJsonLd } from "@/lib/structured";

describe("structured data", () => {
  const m = buildModel();

  it("describes each pledge as an article about the quotation, with its status in words, dates and sources", () => {
    const p = m.promises.find((x) => x.id === "lab-2026-green-schemes")!;
    const summary = promiseSummary(p, m);
    const [article, faq, crumbs] = promiseJsonLd(p, summary, dateModified(p), promiseQA(p, m), m.place.council);
    expect(article).toMatchObject({ "@type": "Article", abstract: summary, datePublished: p.versions[0]!.recorded_on, dateModified: dateModified(p) });
    expect(article.about).toMatchObject({ "@type": "Quotation", text: p.text, dateCreated: p.made_on, creator: { "@type": "Organization", name: p.actor } });
    expect(article.about).toHaveProperty("isBasedOn", p.sources[0]!.url);
    // A confirmed council decision is cited as a source.
    expect(article.citation.some((u) => u.includes("democracy.lbhf.gov.uk"))).toBe(true);
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(4);
    expect(crumbs.itemListElement).toHaveLength(3);
  });

  it("answers the status question the same way for every party", () => {
    for (const p of m.promises) {
      const s = promiseSummary(p, m);
      expect(s).toContain(p.text);
      expect(s).toContain("Status on BoroughBook.UK");
      expect(s).not.toContain("\u00b7");
      expect(promiseMarkdown(p, m)).toContain(`/promise/${p.id}`);
    }
  });

  it("says who checked and who approved each signed-off card: the AI Journalist, then the editor (17 October 2026)", () => {
    const approved = m.promises.filter((p) => p.approvedMark);
    expect(approved.length).toBeGreaterThan(0);
    for (const p of approved) {
      expect(p.editorCheck).toBe(false);
      expect(p.approvedMark).toBe("Checked by the AI Journalist and approved by Pavel Guzhikov");
      expect(promiseMarkdown(p, m)).toContain(`- Checks: ${p.approvedMark}`);
    }
    for (const p of m.promises.filter((x) => x.editorCheck)) expect(p.approvedMark).toBeNull();
  });

  it("lists every card on the promises page", () => {
    const [page] = promisesJsonLd(m.promises);
    expect(page.mainEntity.numberOfItems).toBe(m.promises.length);
  });

  it("describes a councillor in their public role only", () => {
    const c = m.people.councillors[0]!;
    const about = councillorJsonLd(c)[0].about;
    expect(Object.keys(about).sort()).toEqual(["@type", "affiliation", "jobTitle", "name", "sameAs"]);
    expect(about.sameAs).toEqual([c.democracy_url]);
  });
});

describe("sources", () => {
  it("puts every source in exactly one group", async () => {
    const { groupSources } = await import("@/lib/sources");
    const m = buildModel();
    const groups = groupSources(m.sources);
    expect(groups.reduce((a, g) => a + g.items.length, 0)).toBe(m.sources.length);
    expect(groups.map((g) => g.id)).not.toContain("other");
    expect(groups.find((g) => g.id === "spend")?.items.length).toBe(15);
  });
});

describe("dateModified from the page's own date", () => {
  it("goes on the first page node, never a breadcrumb, and never overwrites one", async () => {
    const { withModified } = await import("@/components/JsonLd");
    const out = withModified([{ "@type": "WebPage", name: "x" }, { "@type": "BreadcrumbList" }], "2026-11-17") as object[];
    expect(out[0]).toMatchObject({ dateModified: "2026-11-17" });
    expect(out[1]).not.toHaveProperty("dateModified");
    expect(withModified({ "@type": "Article", dateModified: "2026-01-01" }, "2026-11-17")).toMatchObject({ dateModified: "2026-01-01" });
    expect(withModified({ "@type": "FAQPage" }, "2026-11-17")).not.toHaveProperty("dateModified");
    expect(withModified({ "@type": "WebPage" }, undefined)).not.toHaveProperty("dateModified");
  });

  it("the home page date is the newest of the money, the promises and the decisions", async () => {
    const { buildModel } = await import("@/lib/model");
    const { COUNCIL_UPDATED, DECISIONS_UPDATED, homeUpdated, promisesUpdated } = await import("@/lib/updated");
    const m = buildModel();
    const d = homeUpdated(m.promises);
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const other of [COUNCIL_UPDATED, DECISIONS_UPDATED, promisesUpdated(m.promises)]) if (other) expect(d >= other).toBe(true);
  });
});
