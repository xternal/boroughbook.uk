import { peopleUpdated } from "@/lib/updated";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DATA } from "@borough-ledger/schema";
import { FollowLink } from "@/components/FollowLink";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { formatDay } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { feedAlternate } from "@/lib/rss";
import { SITE } from "@/lib/site";
import { councillorJsonLd } from "@/lib/structured";
import { electedWith } from "@/lib/wards";
import { Num } from "@/components/Num";
import { share } from "@/lib/share";

type Props = { params: Promise<{ id: string }> };

export const revalidate = 86400;

export function generateStaticParams() {
  return DATA.content.councillors.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = buildModel().people.councillors.find((x) => x.id === id);
  if (!c) return {};
  const title = `${c.name}, ${c.ward} ward | ${SITE.name}`;
  const description = `${c.name} (${c.party}), councillor for ${c.ward} in Hammersmith & Fulham: posts held and the pledges of their party, independently tracked.`;
  return { title, description, alternates: { canonical: `/councillor/${id}`, types: feedAlternate(`/councillor/${id}/feed.xml`, `Pledges by ${c.name} and their party`) }, ...share(`/councillor/${id}`, title, description, { own: true }) };
}

export default async function CouncillorPage({ params }: Props) {
  const { id } = await params;
  const m = buildModel();
  const c = m.people.councillors.find((x) => x.id === id);
  if (!c) notFound();
  const colleagues = m.people.councillors.filter((x) => x.wardId === c.wardId && x.id !== c.id);
  const own = m.promises.filter((p) => p.actor === c.name);
  const won = electedWith(c.id, c.wardId);
  const party = m.promises.filter((p) => p.partyId === c.partyId && p.actor !== c.name);
  return (
    <PageShell m={m} updated={peopleUpdated(m.people.retrievedOn)}>
      <div className="hero">
        <h1>{c.name}</h1>
        <p className="lede">
          {c.party} councillor for <a href={`/ward/${c.wardId}`}>{c.ward} ward</a>
          {c.side === "administration" ? ", in the party running the council" : ", in opposition"}.
          {won ? (
            <>
              {" "}
              Elected on {formatDay(won.date)} with <Num f={won.votes} fmt="int" /> votes (<a href={`/ward/${c.wardId}#vote-h`}>the ward&rsquo;s full result</a>).
            </>
          ) : null}
        </p>
        <FollowLink href={`/councillor/${c.id}/feed.xml`} label={`Follow ${c.name}'s pledges by RSS`} />
      </div>
      <div className="councillor">
        <div>
          <h2>Posts</h2>
          {c.roles.length ? (
            <ul>
              {c.roles.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No key posts listed.</p>
          )}
          <p className="small">
            <a href={c.democracy_url} target="_blank" rel="noopener">
              Profile on the council&rsquo;s website
            </a>{" "}
            <span className="muted">(records as of {formatDay(m.people.retrievedOn)})</span>
          </p>
          {colleagues.length ? (
            <>
              <h2>Also representing {c.ward}</h2>
              <ul>
                {colleagues.map((x) => (
                  <li key={x.id}>
                    <a href={`/councillor/${x.id}`}>{x.name}</a> <span className="muted">{x.party}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
        <div>
          <h2>Their own pledges</h2>
          {own.length ? <PledgeList list={own} /> : <p className="muted">None recorded yet. Ward leaflets and hustings pledges are added as residents send them in.</p>}
          <h2>Their party&rsquo;s manifesto pledges</h2>
          <PledgeList list={party} />
        </div>
      </div>
      <JsonLd data={councillorJsonLd(c)} modified={peopleUpdated(m.people.retrievedOn)} />
    </PageShell>
  );
}

function PledgeList({ list }: { list: ReturnType<typeof buildModel>["promises"] }) {
  return (
    <ul className="pledges">
      {list.map((p) => (
        <li key={p.id}>
          <a href={`/promise/${p.id}`}>&ldquo;{p.text}&rdquo;</a>
        </li>
      ))}
    </ul>
  );
}
