import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FollowLink } from "@/components/FollowLink";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { PledgeRows } from "@/components/PledgeRows";
import { STEP_LABEL } from "@/lib/decisions";
import { formatDay } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { standing } from "@/lib/promises";
import { feedAlternate } from "@/lib/rss";
import { SITE, SITE_URL } from "@/lib/site";
import { partiesOf, topicSlug } from "@/lib/topics";
import { DATA } from "@borough-ledger/schema";
import { share } from "@/lib/share";

type Props = { params: Promise<{ id: string }> };

export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return DATA.content.parties.filter((pt) => DATA.content.promises.some((p) => p.actor.kind === "party" && p.actor.id === pt.id)).map((pt) => ({ id: pt.id }));
}

const partyOf = (id: string) => {
  const m = buildModel();
  return { m, party: partiesOf(m).find((x) => x.id === id) };
};

/** What people ask about a party's pledges, answered from the data the same way for every party. */
function questions(party: NonNullable<ReturnType<typeof partyOf>["party"]>, m: ReturnType<typeof buildModel>) {
  const kept = party.promises.filter((p) => ["delivered", "delivering"].includes(p.status)).length;
  return [
    {
      q: `Does ${party.short} run ${m.place.short} Council?`,
      a:
        party.side === "administration"
          ? `Yes. ${party.short} holds ${party.seats} of the council's ${m.people.councillors.length} seats, more than half, so it runs the council and its pledges are tracked against council decisions and budgets.`
          : `No. ${party.short} holds ${party.seats} of the council's ${m.people.councillors.length} seats and is in opposition, so its pledges are tracked as opposition pledges: costed so voters can compare, but they cannot be delivered from opposition.`,
    },
    {
      q: `How many of its 2026 pledges has ${party.short} kept?`,
      a:
        party.side === "administration"
          ? `${standing(party.promises).join(" ")} ${kept} of ${party.promises.length} are delivered or being delivered.`
          : standing(party.promises).join(" "),
    },
    {
      q: `Where can I read the ${party.short} manifesto?`,
      a: `${party.manifesto.title}${party.manifesto.date ? `, published ${formatDay(party.manifesto.date)}` : ""}: ${party.manifesto.url}. Every pledge on this page is quoted from it word for word, with the page.`,
    },
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { m, party } = partyOf(id);
  if (!party) return {};
  const title = `${party.name}: pledges and where they stand | ${SITE.name}`;
  const description = `${standing(party.promises).join(" ")} Each pledge quoted word for word from the ${party.short} manifesto and since, for ${m.place.short}, with its status, cost and sources.`;
  return {
    title,
    description,
    alternates: { canonical: `/party/${id}`, types: feedAlternate(`/party/${id}/feed.xml`, `${party.short} pledges`) },
    ...share(`/party/${id}`, title, description, { own: true }),
  };
}

export default async function PartyPage({ params }: Props) {
  const { id } = await params;
  const { m, party } = partyOf(id);
  if (!party) notFound();
  const qa = questions(party, m);
  const wards = [...new Set(party.councillors.map((c) => c.wardId))];
  return (
    <PageShell m={m} updated={party.changed}>
      <div className="hero">
        <p className="small">
          <a href="/promises">Promises</a>
        </p>
        <h1>{party.name}: pledges</h1>
        <p className="lede">{standing(party.promises).join(" ")}</p>
        <p className="small">
          {party.short} holds {party.seats} of {m.people.councillors.length} seats
          {party.side === "administration" ? " and runs the council" : " and is in opposition"}. Manifesto:{" "}
          <a href={party.manifesto.url}>{party.manifesto.title}</a>.
        </p>
        <FollowLink href={`/party/${party.id}/feed.xml`} label={`Follow ${party.short}'s pledges by RSS`} />
      </div>

      <section aria-labelledby="pledges-h" className="pay-section">
        <div className="sec-head">
          <h2 id="pledges-h">The pledges</h2>
          <p>Pledges from the party&rsquo;s 2026 manifesto and since, quoted word for word. Open one for its timeline, sources and the right of reply.</p>
        </div>
        <PledgeRows promises={party.promises} show="area" />
        <p className="small muted">
          By topic:{" "}
          {[...new Set(party.promises.map((p) => p.area))].map((a, i) => (
            <span key={a}>
              {i ? ", " : ""}
              <a href={`/topic/${topicSlug(a)}`}>{a}</a>
            </span>
          ))}
          .
        </p>
      </section>

      {party.decisions.length ? (
        <section aria-labelledby="decisions-h" className="pay-section">
          <div className="sec-head">
            <h2 id="decisions-h">Council decisions that moved them</h2>
          </div>
          <ul className="pledges">
            {party.decisions.map(({ decision: d, promise: p }) => (
              <li key={`${d.id}-${p.id}`}>
                {formatDay(d.date)}, {d.body}: <a href={`/decisions#${d.id}`}>{d.title}</a>{" "}
                <span className="muted small">
                  ({STEP_LABEL[DATA.content.decision_links.find((l) => l.decision_id === d.id && l.promise_id === p.id)!.event].toLowerCase()}:{" "}
                  <a href={`/promise/${p.id}`}>&ldquo;{p.text}&rdquo;</a>)
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="cllrs-h" className="pay-section">
        <div className="sec-head">
          <h2 id="cllrs-h">
            {party.short} councillors ({party.seats})
          </h2>
          <p>In {wards.length} of the borough&rsquo;s wards, from the council&rsquo;s own records.</p>
        </div>
        <ul className="feeds feeds-wards">
          {party.councillors.map((c) => (
            <li key={c.id}>
              <a href={`/councillor/${c.id}`}>{c.name}</a> <span className="muted small">{c.ward}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="qa-h" className="pay-section">
        <div className="sec-head">
          <h2 id="qa-h">Questions</h2>
        </div>
        <div className="faq faq-flush">
          {qa.map(({ q, a }) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${party.name}: pledges`,
            url: `${SITE_URL}/party/${party.id}`,
            inLanguage: "en-GB",
            dateModified: party.changed,
            about: { "@type": "PoliticalParty", name: party.name, alternateName: party.short },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: party.promises.length,
              itemListElement: party.promises.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/promise/${p.id}`, name: p.text })),
            },
          },
          { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qa.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Promises", item: `${SITE_URL}/promises` },
              { "@type": "ListItem", position: 3, name: party.name, item: `${SITE_URL}/party/${party.id}` },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
