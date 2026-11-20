import { breadcrumbs } from "@/lib/structured";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { formatDay } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { MAKER, REPO, SITE, SITE_URL } from "@/lib/site";
import { groupSources } from "@/lib/sources";
import { share } from "@/lib/share";

const title = `Sources for Hammersmith & Fulham's money and promises | ${SITE.name}`;
const description =
  "Every document behind BoroughBook.UK: the council's budget papers and spend files, government council tax and spending returns, the laws a council budget must follow, and both parties' 2026 manifestos.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/sources" },
  ...share("/sources", title, description),
};

export default function SourcesPage() {
  const m = buildModel();
  const groups = groupSources(m.sources);
  return (
    <PageShell m={m}>
      <div className="hero">
        <h1>Sources</h1>
        <p className="lede">
          Every figure on BoroughBook.UK comes from one of these {m.sources.length} published documents, and links to it. Where we read a file, we keep its
          SHA-256 fingerprint, so anyone can check it is the same file.
        </p>
      </div>
      {groups.map((g) => (
        <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`} className="pay-section">
          <div className="sec-head">
            <h2 id={`${g.id}-h`}>{g.label}</h2>
            {g.desc ? <p>{g.desc}</p> : null}
          </div>
          <ul className="source-list">
            {g.items.map((s) => (
              <li key={s.id}>
                <a href={s.url}>{s.title}</a>
                <span className="small muted block">
                  {[s.publisher, s.published_on ? `published ${formatDay(s.published_on)}` : null, s.licence].filter(Boolean).join(", ")}
                  {s.asset_url && s.asset_url !== s.url ? (
                    <>
                      {" "}
                      <a href={s.asset_url}>file</a>
                    </>
                  ) : null}
                  {s.sha256 ? (
                    <>
                      {" "}
                      <code title={s.sha256}>{s.sha256.slice(0, 12)}&hellip;</code>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section id="reuse" aria-labelledby="reuse-h" className="pay-section">
        <div className="sec-head">
          <h2 id="reuse-h">Reusing this</h2>
          <p>
            Our own text and data tables are free to reuse under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>: credit &ldquo;
            {SITE.name} ({MAKER.name})&rdquo; and link back. The code is open under the MIT licence on <a href={REPO}>GitHub</a>. Data from the council,
            the government and the ONS keeps its own licence, shown against each source above, and quotes from manifestos are not ours to relicense.
          </p>
        </div>
      </section>
      <JsonLd
        data={[{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Sources",
          url: `${SITE_URL}/sources`,
          inLanguage: "en-GB",
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: m.sources.length,
            itemListElement: m.sources.map((s, i) => ({ "@type": "ListItem", position: i + 1, name: s.title, url: s.url })),
          },
        }, breadcrumbs([["Home", "/"], ["Sources", "/sources"]])]}
      />
    </PageShell>
  );
}
