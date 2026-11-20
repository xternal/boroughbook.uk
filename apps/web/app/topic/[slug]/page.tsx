import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DATA } from "@borough-ledger/schema";
import { FollowLink } from "@/components/FollowLink";
import { JsonLd } from "@/components/JsonLd";
import { Num } from "@/components/Num";
import { PageShell } from "@/components/PageShell";
import { PledgeRows } from "@/components/PledgeRows";
import { STEP_LABEL } from "@/lib/decisions";
import { format, formatDay } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { STATUS_LABEL, standing } from "@/lib/promises";
import { assertRenderable } from "@/lib/quality";
import { feedAlternate } from "@/lib/rss";
import { SITE, SITE_URL } from "@/lib/site";
import { topicsOf, topicSlug, type TopicView } from "@/lib/topics";
import { share } from "@/lib/share";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return [...new Set(DATA.content.promises.map((p) => p.area))].map((a) => ({ slug: topicSlug(a) }));
}

const topicOf = (slug: string) => {
  const m = buildModel();
  return { m, topic: topicsOf(m).find((t) => t.slug === slug) };
};

function questions(t: TopicView, m: ReturnType<typeof buildModel>) {
  const parties = [...new Set(t.promises.map((p) => p.partyShort))];
  const qa = [
    {
      q: `What have the parties promised on ${t.area.toLowerCase()} in ${m.place.short}?`,
      a: `${t.promises.length} pledge${t.promises.length === 1 ? "" : "s"} from ${parties.join(" and ")}: ${t.promises
        .map((p) => `${p.partyShort}, “${p.text}” (${STATUS_LABEL[p.status]})`)
        .join("; ")}.`,
    },
  ];
  if (t.service) {
    const f = t.service.f;
    assertRenderable(f.quality, `topic ${t.slug} spending`);
    qa.push({
      q: `How much does ${m.place.short} Council spend on ${t.service.label.toLowerCase()}?`,
      a: `${format("m1", f.value)}${f.quality === "sourced" ? "" : " (estimate)"} in its ${m.place.yearLabel} day-to-day budget, from the council's own budget papers. See the budget on ${SITE_URL}/budget.`,
    });
  }
  return qa;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { m, topic } = topicOf(slug);
  if (!topic) return {};
  const title = `${topic.area} in ${m.place.short}: party pledges${topic.service ? " and council spending" : ""} | ${SITE.name}`;
  const description = `${standing(topic.promises).join(" ")} Every pledge on ${topic.area.toLowerCase()} for ${m.place.short}, from the 2026 manifestos and since, quoted word for word with its status and sources.`;
  return {
    title,
    description,
    alternates: { canonical: `/topic/${slug}`, types: feedAlternate(`/topic/${slug}/feed.xml`, `${topic.area}: pledges`) },
    ...share(`/topic/${slug}`, title, description, { own: true }),
  };
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  const { m, topic } = topicOf(slug);
  if (!topic) notFound();
  const qa = questions(topic, m);
  const others = topicsOf(m).filter((t) => t.slug !== topic.slug);
  return (
    <PageShell m={m} updated={topic.changed}>
      <div className="hero">
        <p className="small">
          <a href="/promises">Promises</a>
        </p>
        <h1>
          {topic.area} in {m.place.short}
        </h1>
        <p className="lede">{standing(topic.promises).join(" ")}</p>
        {topic.service ? (
          <p className="small">
            The council&rsquo;s {m.place.yearLabel} day-to-day budget for {topic.service.label.toLowerCase()}:{" "}
            <b>
              <Num f={topic.service.f} fmt="m1" />
            </b>
            {topic.service.general && topic.service.general.value < topic.service.f.value - 0.05 ? (
              <>
                , of which <Num f={topic.service.general} fmt="m1" /> is paid for from council tax, business rates and general grants
              </>
            ) : null}
            . <a href="/budget">The whole budget</a>.
          </p>
        ) : null}
        <FollowLink href={`/topic/${topic.slug}/feed.xml`} label={`Follow ${topic.area.toLowerCase()} pledges by RSS`} />
      </div>

      <section aria-labelledby="pledges-h" className="pay-section">
        <div className="sec-head">
          <h2 id="pledges-h">The pledges</h2>
          <p>From every party&rsquo;s 2026 manifesto and since, quoted word for word. Open one for its timeline, sources and the right of reply.</p>
        </div>
        <PledgeRows promises={topic.promises} show="party" />
      </section>

      {topic.decisions.length ? (
        <section aria-labelledby="decisions-h" className="pay-section">
          <div className="sec-head">
            <h2 id="decisions-h">Council decisions that moved them</h2>
          </div>
          <ul className="pledges">
            {topic.decisions.map(({ decision: d, promise: p }) => (
              <li key={`${d.id}-${p.id}`}>
                {formatDay(d.date)}, {d.body}: <a href={`/decisions#${d.id}`}>{d.title}</a>{" "}
                <span className="muted small">
                  ({STEP_LABEL[DATA.content.decision_links.find((l) => l.decision_id === d.id && l.promise_id === p.id)!.event].toLowerCase()})
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

      <section aria-labelledby="other-h" className="pay-section">
        <div className="sec-head">
          <h2 id="other-h">Other topics</h2>
        </div>
        <ul className="nearby">
          {others.map((t) => (
            <li key={t.slug}>
              <a className="chip" href={`/topic/${t.slug}`}>
                {t.area} <span className="count">{t.promises.length}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${topic.area} in ${m.place.short}: party pledges`,
            url: `${SITE_URL}/topic/${topic.slug}`,
            inLanguage: "en-GB",
            dateModified: topic.changed,
            about: { "@type": "Thing", name: topic.area },
            spatialCoverage: { "@type": "AdministrativeArea", name: m.place.council },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: topic.promises.length,
              itemListElement: topic.promises.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/promise/${p.id}`, name: `${p.partyShort}: ${p.text}` })),
            },
          },
          { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qa.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Promises", item: `${SITE_URL}/promises` },
              { "@type": "ListItem", position: 3, name: topic.area, item: `${SITE_URL}/topic/${topic.slug}` },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
