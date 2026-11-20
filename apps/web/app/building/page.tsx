import { COUNCIL_UPDATED } from "@/lib/updated";
import type { Metadata } from "next";
import { CapitalFunding, CapitalGroups, CapitalNotes, CapitalPledges } from "@/components/Capital";
import { JsonLd } from "@/components/JsonLd";
import { Num } from "@/components/Num";
import { PageShell } from "@/components/PageShell";
import { CAPITAL, RESOLUTION, SPAN, YEARS, capFig, fundingOf, groupsOf, totalOf } from "@/lib/capital";
import { format } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { SITE } from "@/lib/site";
import { capitalJsonLd } from "@/lib/structured";
import { share } from "@/lib/share";

const gf = totalOf("gf");
const hra = totalOf("hra");
const title = `What Hammersmith & Fulham Council is building, ${SPAN} | ${SITE.name}`;
const description = `The council's four-year building programme: ${format("m1", gf.total!)} for schools, streets, parks, buildings and regeneration, and ${format("m1", hra.total!)} for council homes, scheme by scheme, how it is paid for and the debt it leaves. From the council's own report.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/building" },
  ...share("/building", title, description),
};

export default function BuildingPage() {
  const m = buildModel();
  const borrowing = fundingOf("gf").find((f) => f.label === "Borrowing");
  const biggest = groupsOf("gf")[0]!;
  const firstTwo = gf.years[0]! + gf.years[1]!;
  return (
    <PageShell m={m} updated={COUNCIL_UPDATED}>
      <div className="hero">
        <p className="small">
          <a href="/budget">The council&rsquo;s budget</a>
        </p>
        <h1>What the council is building</h1>
        <p className="lede">
          Besides day-to-day services, the council pays for things that last: buildings, roads, parks, school places and council homes. From {YEARS[0]} to{" "}
          {YEARS[YEARS.length - 1]} it plans <Num f={capFig(gf.total!)} fmt="m1" /> of this work across the borough, and <Num f={capFig(hra.total!)} fmt="m1" /> on{" "}
          <a href="/council-homes">council homes</a>, which have an account of their own paid for by rents.
        </p>
        <div className="kpis">
          <div className="kpi">
            <span className="l">Building work, four years</span>
            <span className="v">
              <Num f={capFig(gf.total!)} fmt="m1" />
            </span>
            <span className="s">schools, streets, parks, buildings</span>
          </div>
          <div className="kpi">
            <span className="l">In the first two years</span>
            <span className="v">
              <Num f={capFig(firstTwo)} fmt="m1" />
            </span>
            <span className="s">
              {YEARS[0]} and {YEARS[1]}
            </span>
          </div>
          <div className="kpi">
            <span className="l">Biggest area</span>
            <span className="v">
              <Num f={capFig(biggest.total)} fmt="m1" />
            </span>
            <span className="s">{biggest.plain}</span>
          </div>
          {borrowing ? (
            <div className="kpi">
              <span className="l">Paid for by borrowing</span>
              <span className="v">
                <Num f={capFig(borrowing.total)} fmt="m1" />
              </span>
              <span className="s">repaid with interest</span>
            </div>
          ) : null}
          <div className="kpi">
            <span className="l">Council homes, four years</span>
            <span className="v">
              <Num f={capFig(hra.total!)} fmt="m1" />
            </span>
            <span className="s">
              <a href="/council-homes">from the rents account</a>
            </span>
          </div>
        </div>
      </div>

      <CapitalGroups account="gf" id="where-h" title={`Where the ${format("m1", gf.total!)} goes`} />
      <CapitalFunding account="gf" id="paid-h" />
      <CapitalPledges account="gf" m={m} />

      <section aria-labelledby="paid-so-far-h" className="pay-section">
        <div className="sec-head">
          <h2 id="paid-so-far-h">What has been paid so far</h2>
        </div>
        <p>
          A plan is not spending. The council&rsquo;s spend files show what it actually paid for building schemes, month by month:{" "}
          <a href="/wards">by ward</a>, and every payment on the <a href="/payments">payments pages</a>. Council decisions that approve or change schemes are on{" "}
          <a href="/decisions">the decisions page</a>.
        </p>
      </section>

      <CapitalNotes resolutionUrl={RESOLUTION.url} />
      <JsonLd data={capitalJsonLd("building", title, description, CAPITAL.source_id)} modified={COUNCIL_UPDATED} />
    </PageShell>
  );
}
