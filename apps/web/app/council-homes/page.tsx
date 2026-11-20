import { COUNCIL_UPDATED } from "@/lib/updated";
import type { Metadata } from "next";
import { derive } from "@borough-ledger/schema";
import { CapitalFunding, CapitalGroups, CapitalPledges } from "@/components/Capital";
import { ChartTable, DataTable } from "@/components/ChartTable";
import { JsonLd } from "@/components/JsonLd";
import { Num } from "@/components/Num";
import { PageShell } from "@/components/PageShell";
import { QualityGroup } from "@/components/QualityLegend";
import { CAPITAL, HOMES, HOMES_SOURCE, SPAN, fact, homesFig, totalOf, yearLabel } from "@/lib/capital";
import { format, formatDay } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { STATUS_LABEL } from "@/lib/promises";
import { SITE } from "@/lib/site";
import { capitalJsonLd } from "@/lib/structured";
import { share } from "@/lib/share";

const [PREV, NOW] = HOMES.years.map(yearLabel) as [string, string];
const income = HOMES.budget.filter((b) => b.kind === "income");
const spend = HOMES.budget.filter((b) => b.kind === "spend").sort((a, z) => z.now - a.now);
const incomeNow = -income.reduce((a, b) => a + b.now, 0);
const F = HOMES.facts;
const title = `Council homes in Hammersmith & Fulham: rents, repairs and building, ${NOW} | ${SITE.name}`;
const description = `Where the ${format("m1", incomeNow)} of council rent and service charges goes in ${NOW}, how rents compare with private rents, the ${format("m1", totalOf("hra").total!)} four-year programme for council homes, and the debt behind it. From the council's own reports.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/council-homes" },
  ...share("/council-homes", title, description),
};

export default function CouncilHomesPage() {
  const m = buildModel();
  const total = homesFig(incomeNow);
  const max = Math.max(...spend.map((b) => b.now));
  const rent = homesFig(-income.find((b) => b.key === "rents")!.now);
  const weeks = derive(F.reserve_m!.value / (rent.value / 52), fact("reserve_m"), rent);
  const rents = [
    ["One bedroom", "rent_1bed_weekly", "private_1bed_weekly"],
    ["Two bedrooms", "rent_2bed_weekly", "private_2bed_weekly"],
  ] as const;
  const rmax = Math.max(...rents.map(([, , p]) => F[p]!.value));
  const housingPledges = m.promises.filter((p) => p.area === "Housing and homelessness");
  const pp = (b: (typeof HOMES.budget)[number]) => homesFig(b.now);
  return (
    <PageShell m={m} updated={COUNCIL_UPDATED}>
      <div className="hero">
        <p className="small">
          <a href="/budget">The council&rsquo;s budget</a>
        </p>
        <h1>Council homes</h1>
        <p className="lede">
          The council is landlord to about <Num f={fact("homes")} fmt="int" /> homes. Their rents and service charges go into an account of their own, the
          Housing Revenue Account. By law it pays only for council homes: council tax cannot top it up, and rents cannot pay for other services.
        </p>
        <div className="kpis">
          <div className="kpi">
            <span className="l">Rent rise from April</span>
            <span className="v">
              <Num f={fact("rent_rise_pct")} fmt="pct1" />
            </span>
            <span className="s">
              <Num f={fact("rent_rise_weekly")} fmt="gbp2" /> a week on average
            </span>
          </div>
          <div className="kpi">
            <span className="l">One-bedroom council home</span>
            <span className="v">
              <Num f={fact("rent_1bed_weekly")} fmt="gbp2" />
            </span>
            <span className="s">
              a week; privately at least <Num f={fact("private_1bed_weekly")} fmt="gbp0" />
            </span>
          </div>
          <div className="kpi">
            <span className="l">Of every £1 of rent</span>
            <span className="v">
              <Num f={derive(F.interest_to_rent_pct!.value / 100, fact("interest_to_rent_pct"))} fmt="pence" />
            </span>
            <span className="s">pays interest on debt</span>
          </div>
          <div className="kpi">
            <span className="l">Money in reserve</span>
            <span className="v">
              <Num f={fact("reserve_m")} fmt="m1" />
            </span>
            <span className="s">
              about <Num f={weeks} fmt="int" /> weeks of rent
            </span>
          </div>
        </div>
      </div>

      <section aria-labelledby="pound-h" className="pay-section">
        <div className="sec-head">
          <h2 id="pound-h">Where the money goes, {NOW}</h2>
          <p>
            Rent (<Num f={rent} fmt="m1" />), service charges and other income bring in <Num f={total} fmt="m1" />. The account must balance, so all of it is
            budgeted.
          </p>
        </div>
        <div className="rows">
          {spend.map((b) => (
            <div className="row" key={b.key}>
              <span title={b.label === b.plain ? undefined : `The council's term: ${b.label}`}>{b.plain}</span>
              <span className="v">
                <Num f={pp(b)} fmt="m1" /> <span className="muted small">(<Num f={derive(b.now / incomeNow, pp(b), total)} fmt="pence" /> of every £1)</span>
              </span>
              <div className="track" aria-hidden="true">
                <i style={{ width: `${((b.now / max) * 100).toFixed(1)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <ChartTable summary="Show the budget as a table">
          <DataTable
            caption={`The council homes account, ${PREV} and ${NOW}, £m`}
            head={["", PREV, NOW]}
            rows={[
              { key: "in", group: "Money in" },
              ...income.map((b) => ({ key: b.key, cells: [b.plain, <Num key="p" f={homesFig(-b.prev)} fmt="m1" />, <Num key="n" f={homesFig(-b.now)} fmt="m1" />] })),
              { key: "out", group: "Money out" },
              ...spend.map((b) => ({ key: b.key, cells: [b.plain, <Num key="p" f={homesFig(b.prev)} fmt="m1" />, <Num key="n" f={homesFig(b.now)} fmt="m1" />] })),
            ]}
          />
        </ChartTable>
      </section>

      <section aria-labelledby="rents-h" className="pay-section">
        <div className="sec-head">
          <h2 id="rents-h">Council rents and private rents</h2>
          <p>Weekly rent from April {NOW.slice(0, 4)}, and what the council says the same home would cost to rent privately in the borough.</p>
        </div>
        <div className="rows">
          {rents.flatMap(([label, c, p]) => [
            <div className="row" key={c}>
              <span>{label}, council</span>
              <span className="v">
                <Num f={fact(c)} fmt="gbp2" />
              </span>
              <div className="track" aria-hidden="true">
                <i style={{ width: `${((F[c]!.value / rmax) * 100).toFixed(1)}%` }} />
              </div>
            </div>,
            <div className="row" key={p}>
              <span className="muted">{label}, private</span>
              <span className="v">
                <Num f={fact(p)} fmt="gbp0" />
              </span>
              <div className="track muted-track" aria-hidden="true">
                <i style={{ width: `${((F[p]!.value / rmax) * 100).toFixed(1)}%` }} />
              </div>
            </div>,
          ])}
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>
          Private rents are the council&rsquo;s estimate from the Office for National Statistics&rsquo; private rent figures. Each 1% on council rents brings in
          about <Num f={fact("rent_1pct_m")} fmt="m1" /> a year.
        </p>
      </section>

      <CapitalGroups account="hra" id="works-h" title={`Building work on council homes, ${SPAN}`} />
      <CapitalFunding account="hra" id="works-paid-h" />

      <section aria-labelledby="long-h" className="pay-section">
        <div className="sec-head">
          <h2 id="long-h">The next ten years</h2>
        </div>
        <p>
          The council&rsquo;s ten-year plan for council homes includes <Num f={fact("capital_10y_m")} fmt="m1" /> of building work, <Num f={fact("new_homes_10y")} fmt="int" />{" "}
          new homes, and <Num f={fact("retrofit_4y_m")} fmt="m0" /> over the first four years to make homes warmer and cut their carbon. Borrowing per council home
          rises from <Num f={fact("borrowing_per_home")} fmt="gbp0" /> to <Num f={fact("borrowing_per_home_2035_36")} fmt="gbp0" /> by 2035/36; interest falls from{" "}
          <Num f={fact("interest_to_rent_pct")} fmt="pct0" /> to <Num f={fact("interest_to_rent_pct_2035_36")} fmt="pct0" /> of rent income as rents rise.
          Repairs this year come to about <Num f={fact("repairs_per_home")} fmt="gbp0" /> a home.
        </p>
      </section>

      <CapitalPledges account="hra" m={m} />
      {housingPledges.length ? (
        <section aria-labelledby="housing-pledges-h" className="pay-section">
          <div className="sec-head">
            <h2 id="housing-pledges-h">Pledges about housing</h2>
            <p>Every party&rsquo;s housing pledges, and where each one stands.</p>
          </div>
          <ul className="cap-pledges">
            {housingPledges.map((p) => (
              <li key={p.id}>
                <a href={`/promise/${p.id}`}>
                  {p.partyShort} pledge: &ldquo;{p.text}&rdquo;
                </a>{" "}
                <span className="muted small">{STATUS_LABEL[p.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="homes-notes-h" className="pay-section">
        <div className="sec-head">
          <h2 id="homes-notes-h">About these figures</h2>
        </div>
        <div className="qrow">
          <QualityGroup q={HOMES.quality} text={HOMES.quality === "sourced" ? "Checked line by line against the report" : "Copied from the report and checked against its own totals; awaiting a second person's check"} />
          <QualityGroup q={CAPITAL.quality} text="Building work: from the four-year capital programme" />
        </div>
        <p className="small muted">
          The budget, rents and ten-year plan are from <a href={HOMES_SOURCE.url}>{HOMES_SOURCE.title}</a>, agreed by Cabinet on {formatDay(HOMES_SOURCE.published_on!)}:
          Table 1 (page 164), paragraphs 13 to 25 (pages 165 to 167) and Appendices 1, 3 and 5 (pages 170 to 174). The building work is from the{" "}
          <a href="/building#cap-notes-h">four-year capital programme</a>.
        </p>
      </section>
      <JsonLd data={capitalJsonLd("council-homes", title, description, HOMES.source_id)} modified={COUNCIL_UPDATED} />
    </PageShell>
  );
}
