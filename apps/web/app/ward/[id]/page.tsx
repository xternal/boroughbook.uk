import { peopleUpdated } from "@/lib/updated";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DATA } from "@borough-ledger/schema";
import { JsonLd } from "@/components/JsonLd";
import { FollowLink } from "@/components/FollowLink";
import { PageShell } from "@/components/PageShell";
import { WardMap } from "@/components/WardMap";
import { WardSchemes } from "@/components/WardSchemes";
import { WardElection } from "@/components/WardElection";
import { formatDay } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { feedAlternate } from "@/lib/rss";
import { CONTACT, SITE } from "@/lib/site";
import { wardJsonLd } from "@/lib/structured";
import { NUMBER, WARD_MAP, electionOf, partyMix, wardsOf } from "@/lib/wards";
import { share } from "@/lib/share";

type Props = { params: Promise<{ id: string }> };

export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return DATA.content.wards.wards.map((w) => ({ id: w.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const w = DATA.content.wards.wards.find((x) => x.id === id);
  if (!w) return {};
  const names = DATA.content.councillors.filter((c) => c.ward_id === id).map((c) => c.name);
  const title = `${w.name} ward, Hammersmith & Fulham: councillors and pledges | ${SITE.name}`;
  const description = `${w.name} ward in Hammersmith & Fulham: your councillors (${names.join(", ")}), their party and posts, how the ward voted in May 2026, pledges about the area, and where to report street problems.`;
  return { title, description, alternates: { canonical: `/ward/${id}`, types: feedAlternate(`/ward/${id}/feed.xml`, `${w.name} ward`) }, ...share(`/ward/${id}`, title, description, { own: true }) };
}

export default async function WardPage({ params }: Props) {
  const { id } = await params;
  const m = buildModel();
  const wards = wardsOf(m);
  const w = wards.find((x) => x.id === id);
  if (!w) notFound();
  const byId = new Map(wards.map((x) => [x.id, x]));
  const boroughWide = m.promises.filter((p) => !p.wardId).length;
  const n = w.councillors.length;
  const vote = electionOf(w.id);

  return (
    <PageShell m={m} updated={peopleUpdated(m.people.retrievedOn)}>
      <div className="hero">
        <p className="small">
          <a href="/wards">All wards</a>
        </p>
        <h1>{w.name}</h1>
        <p className="lede">
          One of {wards.length} wards in {m.place.short}. It elects {NUMBER[n] ?? n} councillors, {partyMix(w.councillors.map((c) => c.party))}.
        </p>
      </div>

      <div className="ward-page">
        <div>
          <section aria-labelledby="cllr-h" className="ward-sec">
            <h2 id="cllr-h">Your councillors</h2>
            <ul className="cllrs">
              {w.councillors.map((c) => (
                <li key={c.id}>
                  <a href={`/councillor/${c.id}`}>{c.name}</a>
                  <span className="muted">
                    {c.party}, {c.side === "administration" ? "the party running the council" : "opposition"}
                  </span>
                  {c.roles.length ? <span className="small muted block">{c.roles.join(", ")}</span> : null}
                </li>
              ))}
            </ul>
            <p className="small muted">From the council&rsquo;s own records on {formatDay(m.people.retrievedOn)}. Each page links to the councillor&rsquo;s profile and contact details on the council&rsquo;s website.</p>
          </section>

          {vote ? <WardElection name={w.name} e={vote} /> : null}

          <section aria-labelledby="pledges-h" className="ward-sec">
            <h2 id="pledges-h">Pledges about {w.name}</h2>
            {w.promises.length ? (
              <ul className="pledges">
                {w.promises.map((p) => (
                  <li key={p.id}>
                    <a href={`/promise/${p.id}`}>&ldquo;{p.text}&rdquo;</a> <span className="muted small">{p.actor}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No pledge on the site is about {w.name} alone yet. The <a href="/promises">{boroughWide} borough-wide pledges</a> cover every ward. Got a ward
                leaflet with a pledge on it? Send a photo to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
              </p>
            )}
          </section>

          <WardSchemes w={w} names={new Map(wards.map((x) => [x.id, x.name]))} />

          <section aria-labelledby="street-h" className="ward-sec">
            <h2 id="street-h">Street problems</h2>
            <p>
              See and report potholes, fly-tipping, graffiti and broken street lights in {w.name} on{" "}
              <a href={w.fixMyStreet} rel="noopener">
                FixMyStreet
              </a>
              , run by the charity mySociety. Reports go to the council.
            </p>
          </section>

          <section aria-labelledby="tax-h" className="ward-sec">
            <h2 id="tax-h">Council tax</h2>
            <p>
              Council tax is the same in every ward of {m.place.short}: only your home&rsquo;s band changes it. <a href="/bill">See your bill by band</a>.
            </p>
          </section>
        </div>

        <aside aria-labelledby="map-h" className="ward-aside">
          <h2 id="map-h" className="sr-only">
            Where {w.name} is
          </h2>
          <WardMap wards={wards} current={w} label={`Map of ${m.place.short} with ${w.name} ward highlighted`} />
          {w.neighbours.length ? (
            <>
              <h3 className="small">Next to {w.name}</h3>
              <ul className="nearby">
                {w.neighbours.map((nid) => (
                  <li key={nid}>
                    <a className="chip" href={`/ward/${nid}`}>
                      {byId.get(nid)!.name}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <FollowLink href={`/ward/${w.id}/feed.xml`} label={`Follow ${w.name} by RSS`} />
          <p className="small muted">{WARD_MAP.source.attribution}</p>
        </aside>
      </div>
      <JsonLd data={wardJsonLd(w, m.place.council)} modified={peopleUpdated(m.people.retrievedOn)} />
    </PageShell>
  );
}
