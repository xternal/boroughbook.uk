import type { MetadataRoute } from "next";
import { DATA, bandsOf } from "@borough-ledger/schema";
import { buildModel } from "@/lib/model";
import { MONTHS, suppliersById } from "@/lib/payments";
import { dateModified } from "@/lib/promiseText";
import { SITE_URL } from "@/lib/site";
import { OTHER_BOROUGHS } from "@/lib/boroughList";
import { decodedCouncils } from "@/lib/decoder";
import { partiesOf, topicsOf } from "@/lib/topics";
import { DECISIONS_UPDATED, homeUpdated, peopleUpdated, promisesUpdated } from "@/lib/updated";

/** lastModified only where we know when a page's content last changed; search engines ignore a date they cannot trust. */
export default function sitemap(): MetadataRoute.Sitemap {
  const m = buildModel();
  const changed = new Map(m.promises.map((p) => [p.id, dateModified(p)]));
  const promisesChanged = promisesUpdated(m.promises);
  const decisionsChanged = DECISIONS_UPDATED;
  const peopleChanged = peopleUpdated(m.people.retrievedOn);
  return [
    { url: `${SITE_URL}/`, lastModified: homeUpdated(m.promises), changeFrequency: "weekly", priority: 1 },
    // Each section of the home page, on a page of its own.
    { url: `${SITE_URL}/bill`, lastModified: DATA.council.meta.vintage, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/budget`, lastModified: DATA.council.meta.vintage, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/gap`, lastModified: DATA.council.meta.vintage, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/balance`, lastModified: DATA.council.meta.vintage, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/method`, changeFrequency: "monthly", priority: 0.5 },
    ...(DATA.council.next_year.ct_options
      ? [
          { url: `${SITE_URL}/council-tax-rise`, lastModified: DATA.council.meta.vintage, changeFrequency: "weekly" as const, priority: 0.9 },
          ...bandsOf(DATA.rules).map((b) => ({ url: `${SITE_URL}/council-tax-rise/band-${b.toLowerCase()}`, lastModified: DATA.council.meta.vintage, changeFrequency: "weekly" as const, priority: 0.6 })),
        ]
      : []),
    ...OTHER_BOROUGHS.map((b) => ({ url: `${SITE_URL}${b.href}`, lastModified: DATA.council.meta.vintage, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${SITE_URL}/council-tax`, changeFrequency: "monthly", priority: 0.9 },
    ...decodedCouncils().map((c) => ({ url: `${SITE_URL}/council-tax/${c.slug}`, changeFrequency: "yearly" as const, priority: 0.6 })),
    { url: `${SITE_URL}/building`, lastModified: DATA.council.meta.vintage, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/council-homes`, lastModified: DATA.council.meta.vintage, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/promises`, lastModified: promisesChanged, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/decisions`, lastModified: decisionsChanged, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/wards`, lastModified: peopleChanged, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...DATA.content.wards.wards.map((w) => ({ url: `${SITE_URL}/ward/${w.id}`, lastModified: peopleChanged, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...partiesOf(m).map((pt) => ({ url: `${SITE_URL}/party/${pt.id}`, lastModified: pt.changed, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...topicsOf(m).map((t) => ({ url: `${SITE_URL}/topic/${t.slug}`, lastModified: t.changed, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...DATA.content.promises.map((p) => ({ url: `${SITE_URL}/promise/${p.id}`, lastModified: changed.get(p.id), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...DATA.content.councillors.map((c) => ({ url: `${SITE_URL}/councillor/${c.id}`, lastModified: m.people.retrievedOn, changeFrequency: "monthly" as const, priority: 0.4 })),
    { url: `${SITE_URL}/sources`, changeFrequency: "monthly", priority: 0.5 },
    // Its counts change every ten minutes; the page itself changes with the site.
    { url: `${SITE_URL}/most-read`, changeFrequency: "daily", priority: 0.2 },
    { url: `${SITE_URL}/follow`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/payments`, changeFrequency: "monthly", priority: 0.7 },
    ...MONTHS.map((mo) => ({ url: `${SITE_URL}/payments/${mo}`, changeFrequency: "yearly" as const, priority: 0.4 })),
    ...[...suppliersById().values()]
      .filter((s) => s.page)
      .map((s) => ({ url: `${SITE_URL}/supplier/${s.id}`, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
