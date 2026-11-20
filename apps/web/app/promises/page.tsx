import { promisesUpdated } from "@/lib/updated";
import type { Metadata } from "next";
import { DATA } from "@borough-ledger/schema";
import { FollowLink } from "@/components/FollowLink";
import { JsonLd } from "@/components/JsonLd";
import { Num } from "@/components/Num";
import { PageShell } from "@/components/PageShell";
import { PromisesIndex } from "@/components/PromisesIndex";
import { buildModel } from "@/lib/model";
import { filtersFromQuery } from "@/lib/promiseFilters";
import { feedAlternate } from "@/lib/rss";
import { partiesOf, topicsOf } from "@/lib/topics";
import { STATUS_LABEL, STATUS_MEANS, STATUS_ORDER, sides, standing } from "@/lib/promises";
import { SITE } from "@/lib/site";
import { promisesJsonLd } from "@/lib/structured";
import { share } from "@/lib/share";

/**
 * Made on request: the filters in the address (?side=, ?status=, ?topic=) are applied on the server, so a shared
 * filtered link opens filtered, before any script runs. The canonical address stays /promises.
 */
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The parties with pledges on the site, from the data, so the title never favours or forgets one. */
const PARTIES = DATA.content.parties
  .filter((pt) => DATA.content.promises.some((p) => p.actor.kind === "party" && p.actor.id === pt.id))
  .map((pt) => pt.short)
  .join(" and ");
const title = `${PARTIES} pledges in Hammersmith & Fulham: where each stands | ${SITE.name}`;
const description =
  `${PARTIES} pledges for Hammersmith & Fulham, from the 2026 manifestos and since, each quoted word for word with its source, its status and its cost to the council, tracked to the same rules for every party.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/promises", types: feedAlternate("/promises/feed.xml", "Every pledge") },
  ...share("/promises", title, description),
};

export default async function PromisesPage({ searchParams }: Props) {
  const m = buildModel();
  const initial = filtersFromQuery(m.promises, await searchParams);
  const groups = sides(m.promises);
  const used = STATUS_ORDER.filter((s) => m.promises.some((p) => p.status === s));
  const fromManifestos = m.promises.filter((p) => p.venue === "manifesto").length;
  const seatsOf = (party: string) => m.people.councillors.filter((c) => c.party === party).length;
  return (
    <PageShell m={m} updated={promisesUpdated(m.promises)}>
      <div className="hero">
        <h1>Promises</h1>
        <p className="lede">
          What each party has promised {m.place.short}, in its 2026 manifesto and since, quoted word for word, and where each pledge stands now. Every party is held to the
          same rules.
        </p>
        <p className="lede">{standing(m.promises).join(" ")}</p>
        <p className="small">
          <a href="/decisions">Council decisions</a> that move a pledge are added to its timeline once an editor confirms them. Every two weeks the AI
          Journalist (Claude, an AI) looks for new pledges from every party in the same places and checks each quote word for word against its
          source; a pledge appears only after the editor, Pavel Guzhikov, has read its quote against the source and approved it.
        </p>
        <p className="small">
          By party:{" "}
          {partiesOf(m).map((pt, i) => (
            <span key={pt.id}>
              {i ? ", " : ""}
              <a href={`/party/${pt.id}`}>{pt.name}</a>
            </span>
          ))}
          . By topic:{" "}
          {topicsOf(m).map((t, i) => (
            <span key={t.slug}>
              {i ? ", " : ""}
              <a href={`/topic/${t.slug}`}>{t.area}</a>
            </span>
          ))}
          .
        </p>
        <FollowLink href="/promises/feed.xml" label="Follow every pledge by RSS" />
      </div>

      <div className="kpis kpis-3">
        <div className="kpi">
          <span className="l">Pledges tracked</span>
          <span className="v">{m.promises.length}</span>
          <span className="s">
            {`${fromManifestos} from ${groups.reduce((a, g) => a + g.parties.length, 0)} manifestos, May 2026`}
            {m.promises.length > fromManifestos ? `, and ${m.promises.length - fromManifestos} made since` : null}
          </span>
        </div>
        {groups.map((g) => (
          <div className="kpi" key={g.id}>
            <span className="l">{g.label}</span>
            <span className="v">{g.count}</span>
            <span className="s">
              pledges;{" "}
              {g.id === "administration" ? (
                <>
                  <Num f={m.politics.seats} fmt="int" /> of <Num f={m.politics.totalSeats} fmt="int" /> seats
                </>
              ) : (
                g.parties.map((p, i) => (
                  <span key={p}>
                    {i ? ", " : ""}
                    <Num f={{ ...m.politics.seats, value: seatsOf(p) }} fmt="int" /> seats
                  </span>
                ))
              )}
            </span>
          </div>
        ))}
      </div>

      <section aria-labelledby="list-h" className="plist-section">
        <h2 id="list-h" className="sr-only">
          All pledges
        </h2>
        <PromisesIndex promises={m.promises} today={m.today} initial={initial} />
      </section>

      <section aria-labelledby="how-h" className="pay-section">
        <div className="sec-head">
          <h2 id="how-h">How pledges are tracked</h2>
          <p>
            Each party&rsquo;s own headline pledges got a card first. The rest of each manifesto follows in page order, the same number from every party at
            a time, and so do pledges made since the election. Each is quoted exactly, with its page and an archived copy. The party with more than half
            the seats runs the council; the same rules apply to every party.
          </p>
        </div>
        <dl className="statuses">
          {used.map((s) => (
            <div key={s}>
              <dt>
                <span className={`pill st-${s}`}>{STATUS_LABEL[s]}</span>
              </dt>
              <dd>{STATUS_MEANS[s]}</dd>
            </div>
          ))}
        </dl>
        <p className="muted small">
          A pledge moves up only on evidence from council papers. Any councillor or party named on a card can reply, and replies are published. Who
          represents you: <a href="/wards">your ward&rsquo;s councillors</a>.
        </p>
      </section>
      <JsonLd data={promisesJsonLd(m.promises)} modified={promisesUpdated(m.promises)} />
    </PageShell>
  );
}
