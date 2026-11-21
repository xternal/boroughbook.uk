import { peopleUpdated } from "@/lib/updated";
import type { Metadata } from "next";
import { COVERED } from "@/lib/places";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { WardFinder } from "@/components/WardFinder";
import { WardMap } from "@/components/WardMap";
import { formatDay } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { SITE } from "@/lib/site";
import { wardsJsonLd } from "@/lib/structured";
import { WARD_MAP, wardsOf } from "@/lib/wards";
import { share } from "@/lib/share";

export const revalidate = 86400;

const title = `Your ward: wards and councillors in Hammersmith & Fulham | ${SITE.name}`;
const description =
  "Find your Hammersmith & Fulham ward by postcode or on the map: who your councillors are, their party and posts, pledges about your area and where to report street problems.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/wards" },
  ...share("/wards", title, description),
};

export default function WardsPage() {
  const m = buildModel();
  const wards = wardsOf(m);
  return (
    <PageShell m={m} updated={peopleUpdated(m.people.retrievedOn)}>
      <div className="hero">
        <h1>Your ward</h1>
        <p className="lede">
          {m.place.short} has {wards.length} wards and {m.people.councillors.length} councillors, from the council&rsquo;s own records on{" "}
          {formatDay(m.people.retrievedOn)}. Find your ward by postcode, or pick it on the map or the list.
        </p>
      </div>
      <WardFinder covered={COVERED} />
      <section aria-labelledby="wards-h" className="pay-section">
        <h2 id="wards-h" className="sr-only">
          Every ward and its councillors
        </h2>
        <div className="wards-layout">
          <WardMap wards={wards} label={`Map of the ${wards.length} wards in ${m.place.short}`} names />
          <div className="wards">
            {wards.map((w) => (
              <div className="ward" key={w.id}>
                <h3>
                  <a href={`/ward/${w.id}`}>{w.name}</a>
                </h3>
                <ul>
                  {w.councillors.map((c) => (
                    <li key={c.id}>
                      <a href={`/councillor/${c.id}`}>{c.name}</a> <span className="muted">{c.party}</span>
                      {c.roles.length ? <span className="muted small block">{c.roles.join(", ")}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <p className="muted small">
          Councillors and posts: the council&rsquo;s ModernGov records. Boundaries: {WARD_MAP.source.attribution}
        </p>
      </section>
      <JsonLd data={wardsJsonLd(wards)} modified={peopleUpdated(m.people.retrievedOn)} />
    </PageShell>
  );
}
