import { breadcrumbs } from "@/lib/structured";
import { DECISIONS_UPDATED } from "@/lib/updated";
import type { Metadata } from "next";
import { FollowLink } from "@/components/FollowLink";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { DECISIONS, STEP_LABEL, meetingsOf } from "@/lib/decisions";
import { formatDay } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { feedAlternate } from "@/lib/rss";
import { SITE, SITE_URL } from "@/lib/site";
import { share } from "@/lib/share";

export const revalidate = 86400;

const title = `Council decisions in Hammersmith & Fulham, and the pledges they move | ${SITE.name}`;
const description =
  "Every Cabinet and Full Council decision in Hammersmith & Fulham since January 2026, from the council's own records, with the manifesto pledges each one moves, checked by an editor.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/decisions", types: feedAlternate("/decisions/feed.xml", "Council decisions") },
  ...share("/decisions", title, description),
};

/** Long decisions open on request, so the page stays a list of what was decided. */
const SHORT = 420;

export default function DecisionsPage() {
  const m = buildModel();
  const meetings = meetingsOf(m);
  const linked = meetings.reduce((a, x) => a + x.decisions.filter((d) => d.links.length).length, 0);
  return (
    <PageShell m={m} updated={DECISIONS_UPDATED}>
      <div className="hero">
        <p className="small">
          <a href="/promises">Promises</a>
        </p>
        <h1>Council decisions</h1>
        <p className="lede">
          What Cabinet and Full Council decided since {formatDay(DECISIONS.from)}: {DECISIONS.decisions.length} decisions at {meetings.length} meetings, from
          the council&rsquo;s own records. {linked ? `${linked} of them move a manifesto pledge.` : "None is linked to a pledge yet."} An editor checks
          each link before it reaches a pledge&rsquo;s card.
        </p>
        <FollowLink href="/decisions/feed.xml" label="Follow new decisions by RSS" />
      </div>

      {meetings.map((mtg) => (
        <section key={mtg.key} aria-labelledby={`m-${mtg.key}`} className="ward-sec decisions-mtg">
          <h2 id={`m-${mtg.key}`}>
            {mtg.body}, {formatDay(mtg.date)}
          </h2>
          <ol className="decisions">
            {mtg.decisions.map((d) => (
              <li key={d.id} id={d.id}>
                <h3>
                  <span className="muted">{d.item}</span> {d.title}
                </h3>
                {d.links.map((l) => (
                  <p key={l.promise.id} className="d-link">
                    <span className={`pill st-${l.event}`}>{STEP_LABEL[l.event]}</span>{" "}
                    <a href={`/promise/${l.promise.id}`}>
                      {l.promise.partyShort} pledge: &ldquo;{l.promise.text}&rdquo;
                    </a>
                  </p>
                ))}
                {d.text.length <= SHORT ? (
                  <p className="d-text">{d.text}</p>
                ) : (
                  <details className="d-more">
                    <summary>{d.kind === "resolution" ? "What the council resolved" : "What Cabinet decided"}</summary>
                    <p className="d-text">{d.text}</p>
                  </details>
                )}
                <p className="small">
                  <a href={d.url}>On the council&rsquo;s website</a>
                  {d.documents[0] ? (
                    <>
                      {" "}
                      <a href={d.documents[0].url}>Report</a>
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <p className="small muted">
        From the council&rsquo;s ModernGov records. For Full Council only the resolution is shown, never the debate, which can name members of the public. A
        link from a decision to a pledge is suggested by Claude, an AI, with the decision&rsquo;s exact words, and added only when an editor confirms it.
      </p>
      <JsonLd
        modified={DECISIONS_UPDATED}
        data={[{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Council decisions",
          url: `${SITE_URL}/decisions`,
          inLanguage: "en-GB",
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: DECISIONS.decisions.length,
            itemListElement: DECISIONS.decisions.map((d, i) => ({ "@type": "ListItem", position: i + 1, name: `${d.body}: ${d.title}`, url: `${SITE_URL}/decisions#${d.id}` })),
          },
        }, breadcrumbs([["Home", "/"], ["Council decisions", "/decisions"]])]}
      />
    </PageShell>
  );
}
