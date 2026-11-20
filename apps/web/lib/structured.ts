/* schema.org JSON-LD for the promise and councillor pages (search engines and AI search read it). */
import { DATA, companyPage, type PaymentSupplier, type PaymentsIndex, type RegisteredCompany } from "@borough-ledger/schema";
import type { CouncillorModel, PromiseModel } from "@/lib/model";
import type { WardModel } from "@/lib/wards";
import { SITE, SITE_URL } from "@/lib/site";

const CONTEXT = "https://schema.org";

function short(s: string, n = 80): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}

export function breadcrumbs(items: [name: string, path: string][]) {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE_URL}${path}` })),
  };
}

export function promisesJsonLd(promises: readonly PromiseModel[]) {
  return [
    {
      "@context": CONTEXT,
      "@type": "CollectionPage",
      name: "Promises",
      url: `${SITE_URL}/promises`,
      inLanguage: "en-GB",
      isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE_URL },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: promises.length,
        itemListElement: promises.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/promise/${p.id}`, name: short(p.text) })),
      },
    },
    breadcrumbs([["Home", "/"], ["Promises", "/promises"]]),
  ] as const;
}

/** Who publishes every page: the independent project, never the council. */
export const PUBLISHER = {
  "@type": "Organization",
  name: SITE.name,
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
} as const;

/**
 * A pledge's page: an article about the quotation, with its status, sources and dates, plus the questions it answers.
 * The status is stated in words (abstract), not as a rating: a pledge is tracked, not fact-checked.
 */
export function promiseJsonLd(p: PromiseModel, summary: string, modified: string, qa: readonly { q: string; a: string }[], council: string) {
  const url = `${SITE_URL}/promise/${p.id}`;
  return [
    {
      "@context": CONTEXT,
      "@type": "Article",
      headline: `${p.partyShort} pledge: ${short(p.text, 90)}`,
      abstract: summary,
      url,
      mainEntityOfPage: url,
      inLanguage: "en-GB",
      datePublished: p.versions[0]!.recorded_on,
      dateModified: modified,
      author: PUBLISHER,
      publisher: PUBLISHER,
      isAccessibleForFree: true,
      spatialCoverage: { "@type": "AdministrativeArea", name: council },
      keywords: [p.partyShort, p.area, "manifesto pledge", "promise tracker", council].join(", "),
      about: {
        "@type": "Quotation",
        text: p.text,
        dateCreated: p.made_on,
        creator: p.party ? { "@type": "Person", name: p.actor, affiliation: { "@type": "Organization", name: p.party } } : { "@type": "Organization", name: p.actor },
        ...(p.sources[0] ? { isBasedOn: p.sources[0].url } : {}),
      },
      citation: [...new Set([...p.sources.map((x) => x.url), ...p.timeline.flatMap((e) => (e.evidence_url ? [e.evidence_url] : []))])],
    },
    {
      "@context": CONTEXT,
      "@type": "FAQPage",
      url,
      mainEntity: qa.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
    breadcrumbs([["Home", "/"], ["Promises", "/promises"], [short(p.text), `/promise/${p.id}`]]),
  ] as const;
}

/** A page about a councillor, not their own profile: "about", never "ProfilePage". */
export function councillorJsonLd(c: CouncillorModel) {
  return [
    {
      "@context": CONTEXT,
      "@type": "WebPage",
      name: c.name,
      url: `${SITE_URL}/councillor/${c.id}`,
      inLanguage: "en-GB",
      about: {
        "@type": "Person",
        name: c.name,
        jobTitle: `Councillor for ${c.ward} ward`,
        affiliation: { "@type": "Organization", name: c.party },
        sameAs: [c.democracy_url],
      },
    },
    breadcrumbs([["Home", "/"], ["Your ward", "/wards"], [c.ward, `/ward/${c.wardId}`], [c.name, `/councillor/${c.id}`]]),
  ] as const;
}

export function wardsJsonLd(wards: readonly WardModel[]) {
  return [
    {
      "@context": CONTEXT,
      "@type": "CollectionPage",
      name: "Wards and councillors",
      url: `${SITE_URL}/wards`,
      inLanguage: "en-GB",
      isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE_URL },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: wards.length,
        itemListElement: wards.map((w, i) => ({ "@type": "ListItem", position: i + 1, name: `${w.name} ward`, url: `${SITE_URL}/ward/${w.id}` })),
      },
    },
    breadcrumbs([["Home", "/"], ["Your ward", "/wards"]]),
  ] as const;
}

/** A page about the ward as a place, with its councillors as the people it elects; not an official ward page. */
export function wardJsonLd(w: WardModel, council: string) {
  return [
    {
      "@context": CONTEXT,
      "@type": "WebPage",
      name: `${w.name} ward`,
      url: `${SITE_URL}/ward/${w.id}`,
      inLanguage: "en-GB",
      about: {
        "@type": "AdministrativeArea",
        name: `${w.name} ward`,
        identifier: w.ons_code,
        containedInPlace: { "@type": "AdministrativeArea", name: council },
      },
      mentions: w.councillors.map((c) => ({ "@type": "Person", name: c.name, jobTitle: `Councillor for ${w.name} ward`, url: `${SITE_URL}/councillor/${c.id}` })),
    },
    breadcrumbs([["Home", "/"], ["Your ward", "/wards"], [w.name, `/ward/${w.id}`]]),
  ] as const;
}

/** The payments ledger as a dataset built from the council's files, with its questions. */
export function paymentsJsonLd(p: PaymentsIndex, month: string, faq: readonly { q: string; a: string }[]) {
  const first = p.months[0]!.month;
  const last = p.months[p.months.length - 1]!.month;
  return [
    {
      "@context": CONTEXT,
      "@type": "Dataset",
      name: "Hammersmith & Fulham Council payments over £500",
      description:
        "Every payment in Hammersmith & Fulham Council's quarterly spend files, by month, organisation and service, reconciled to each file. Payments to people are shown only as totals.",
      url: `${SITE_URL}/payments`,
      inLanguage: "en-GB",
      temporalCoverage: `${first}/${last}`,
      license: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
      isAccessibleForFree: true,
      creator: { "@type": "Organization", name: SITE.name, url: SITE_URL },
      isBasedOn: p.sources.map((s) => s.url),
      distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE_URL}/payments/suppliers.json` }],
    },
    {
      "@context": CONTEXT,
      "@type": "FAQPage",
      mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
    breadcrumbs([["Home", "/"], ["Payments", "/payments"], ...(month === last ? [] : ([[month, `/payments/${month}`]] as [string, string][]))]),
  ] as const;
}

/** An organisation the council pays, described from the council's own files. */
export function supplierJsonLd(s: PaymentSupplier, co: RegisteredCompany | null = null) {
  return [
    {
      "@context": CONTEXT,
      "@type": "WebPage",
      name: s.name,
      url: `${SITE_URL}/supplier/${s.id}`,
      inLanguage: "en-GB",
      about: {
        "@type": s.kind === "public_body" ? "GovernmentOrganization" : "Organization",
        name: s.name,
        ...(co
          ? {
              legalName: co.name,
              identifier: { "@type": "PropertyValue", propertyID: "Companies House company number", value: co.number },
              sameAs: companyPage(co.number),
              ...(co.incorporated ? { foundingDate: co.incorporated } : {}),
            }
          : {}),
      },
    },
    breadcrumbs([["Home", "/"], ["Payments", "/payments"], [s.name, `/supplier/${s.id}`]]),
  ] as const;
}

/** /building and /council-homes: a page about the council's own plan, based on its report. */
export function capitalJsonLd(path: string, title: string, description: string, sourceId: string) {
  const name = title.split(" | ")[0]!;
  const source = DATA.sources.get(sourceId);
  return [
    {
      "@context": CONTEXT,
      "@type": "WebPage",
      name,
      description,
      url: `${SITE_URL}/${path}`,
      inLanguage: "en-GB",
      publisher: PUBLISHER,
      about: { "@type": "GovernmentOrganization", name: DATA.council.meta.council },
      ...(source?.url ? { isBasedOn: { "@type": "Report", name: source.title, url: source.url, ...(source.published_on ? { datePublished: source.published_on } : {}) } } : {}),
    },
    breadcrumbs([["Home", "/"], ["Budget", "/budget"], [name, `/${path}`]]),
  ] as const;
}

/** A section's own page (/bill, /budget, /gap, /balance, /method): part of the site, about the council's money. */
export function sectionJsonLd(path: string, name: string, description: string) {
  return [
    {
      "@context": CONTEXT,
      "@type": "WebPage",
      name,
      description,
      url: `${SITE_URL}${path}`,
      inLanguage: "en-GB",
      isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE_URL },
      publisher: PUBLISHER,
      about: { "@type": "GovernmentOrganization", name: DATA.council.meta.council },
    },
    breadcrumbs([["Home", "/"], [name, path]]),
  ] as const;
}

