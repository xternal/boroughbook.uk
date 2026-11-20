import { Updated } from "./Updated";
/* A Northern Ireland council's page (Belfast): rates instead of council tax, the council's narrower budget, the rates over
   five years and the councillors by district electoral area. Same layout and checks as every other council's page. */
import { derive } from "@borough-ledger/schema";
import { councilWithThe } from "@/lib/boroughList";
import { format, formatDay } from "@/lib/format";
import type { RatesModel } from "@/lib/rates";
import { SITE_URL } from "@/lib/site";
import { ControlKpi, Councillors } from "./BoroughCouncillors";
import { BudgetFlow } from "./BudgetFlow";
import { ChartTable } from "./ChartTable";
import { Footer } from "./Footer";
import { HeroTop } from "./HeroTop";
import { JsonLd } from "./JsonLd";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";
import { RatesBill } from "./RatesBill";
import { TopBar } from "./TopBar";

const SECTIONS = [
  ["bill", "Your bill"],
  ["budget", "Budget"],
  ["history", "Over the years"],
  ["councillors", "Councillors"],
] as const;

export function ratesWords(m: RatesModel) {
  const title = `Where your rates go in ${m.place.short} | BoroughBook.UK`;
  const description = `${m.place.short}: how a rates bill splits between ${m.place.council} and the Northern Ireland Executive, worked out from your home's capital value; the council's ${format("m0", m.netBudget.value)} budget by service; rates over five years; and every area's councillors. From the Department of Finance, the Department for Communities and the council's own records.`;
  return { title, description };
}

export function RatesPage({ m, slug }: { m: RatesModel; slug: string }) {
  const { title, description } = ratesWords(m);
  const P = m.people;
  const first = m.history[0]!;
  const last = m.history[m.history.length - 1]!;
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "WebPage", name: title.split(" | ")[0], description, url: `${SITE_URL}/${slug}`, inLanguage: "en-GB", about: { "@type": "GovernmentOrganization", name: m.place.council } },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: m.place.short, item: `${SITE_URL}/${slug}` },
      ],
    },
  ];
  return (
    <>
      <TopBar place={m.place.short} year={m.place.yearLabel} borough={{ base: `/${slug}`, items: SECTIONS }} />
      <main className="wrap" id="top">
        <div className="hero">
          <HeroTop current={m.place.short} council={councilWithThe(m.place.council)} example={m.b.example_postcode ?? "BT1 5GS"} results={false} />
          <h1>Where your rates go in {m.place.short}</h1>
          <p className="small muted">
            <Updated date={m.vintage} />
          </p>
          <p className="lede">
            On a home of <Num f={m.example.value} fmt="gbp0" /> capital value, {m.example.label}, the rates are <Num f={m.exampleBill} fmt="gbp2" /> this year, up{" "}
            <Num f={m.rates.risePct} fmt="pct1" />. The council keeps <Num f={m.rates.councilShare} fmt="share0" /> of every bill; the rest goes to the Northern
            Ireland Executive. Rates pay for <Num f={m.ratesShare} fmt="share0" /> of what the council spends from rates and grants.
          </p>
          <div className="kpis">
            <div className="kpi">
              <span className="l">Bill on an average home</span>
              <span className="v">
                <Num f={m.exampleBill} fmt="gbp0" />
              </span>
              <span className="s">
                up <Num f={m.rates.risePct} fmt="pct1" /> on last year
              </span>
            </div>
            <div className="kpi">
              <span className="l">Council budget</span>
              <span className="v">
                <Num f={m.netBudget} fmt="m0" />
              </span>
              <span className="s">from rates and grants, after fees</span>
            </div>
            <div className="kpi">
              <span className="l">The council keeps</span>
              <span className="v">
                <Num f={m.rates.councilShare} fmt="share0" />
              </span>
              <span className="s">of every rates bill</span>
            </div>
            <ControlKpi P={P} />
          </div>
        </div>

        <RatesBill
          council={m.place.council}
          yearLabel={m.place.yearLabel}
          rates={m.rates}
          cap={m.cap}
          allowance={m.allowance}
          allowanceAge={m.allowanceAge}
          instalments={m.instalments}
          valuationYear={m.valuationYear}
          example={m.example}
          services={m.services}
          budget={m.netBudget}
        />
        <BudgetFlow
          m={m}
          legend={m.budgetLegend}
          more={
            <p className="small muted">
              This is what {m.place.council} needs from rates and government grants once its own fees, charges and other grants are counted, as it told the Department
              for Communities, by the committee that oversees each part; the council&rsquo;s report with the detail was not made public. It used none of its reserves
              this year. The district rates line includes what businesses pay: the statistics do not split homes from businesses.
            </p>
          }
        />

        <section id="history" aria-labelledby="history-h">
          <div className="sec-head">
            <h2 id="history-h">Rates over the years</h2>
            <p>
              The district rate went from <Num f={first.district} fmt="p4" /> in the pound in {first.label} to <Num f={last.district} fmt="p4" /> in {last.label}, up{" "}
              <Num f={derive((last.district.value / first.district.value - 1) * 100, last.district, first.district)} fmt="pct0" />; the regional rate from{" "}
              <Num f={first.regional} fmt="p4" /> to <Num f={last.regional} fmt="p4" />, up{" "}
              <Num f={derive((last.regional.value / first.regional.value - 1) * 100, last.regional, first.regional)} fmt="pct0" />.
            </p>
          </div>
          <div className="tablewrap">
            <table>
              <caption className="sr-only">Domestic rates in {m.place.short} each year</caption>
              <thead>
                <tr>
                  <th scope="col">Year</th>
                  <th scope="col" className="n">
                    District rate
                  </th>
                  <th scope="col" className="n">
                    Regional rate
                  </th>
                  <th scope="col" className="n">
                    Bill on <Num f={m.example.value} fmt="gbp0" />
                  </th>
                  <th scope="col" className="n">
                    Council budget
                  </th>
                </tr>
              </thead>
              <tbody>
                {m.history.map((y) => (
                  <tr key={y.year}>
                    <th scope="row">{y.label}</th>
                    <td className="n">
                      <Num f={y.district} fmt="p4" />
                    </td>
                    <td className="n">
                      <Num f={y.regional} fmt="p4" />
                    </td>
                    <td className="n">
                      <Num f={y.bill} fmt="gbp2" />
                    </td>
                    <td className="n">
                      <Num f={y.amount} fmt="pm1" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">
            Rates are in pence for each pound of capital value. The bill on <Num f={m.example.value} fmt="gbp0" /> is our arithmetic for every year on the same value,
            as homes have not been revalued since {m.valuationYear}. The council budget is the amount to be raised from rates and grants each year.
          </p>
        </section>

        <Councillors m={m} P={P} map={m.map} />

        <section aria-labelledby="next-h" className="pay-section">
          <div className="sec-head">
            <h2 id="next-h">Still to come for {m.place.short}</h2>
          </div>
          <p>
            For Hammersmith &amp; Fulham, BoroughBook.UK also tracks every party&rsquo;s manifesto pledges, every council payment over £500, council decisions, how this
            year&rsquo;s budget gap was closed and a tool to balance next year. Those need the council&rsquo;s own papers, read by hand, and come here next.{" "}
            <a href="/">See Hammersmith &amp; Fulham</a>.
          </p>
          <div className="qrow">
            <QualityGroup
              q={m.rates.district.quality}
              text={`Rates and budget: the Department of Finance's poundages, the Department for Communities' rate statistics and the council's minutes, read by hand and checked against each other (${formatDay(m.vintage)})`}
            />
          </div>
          <ChartTable summary="Where every figure on this page comes from">
            <ul className="small">
              {m.sources.map((s) => (
                <li key={s.url + s.title}>
                  <a href={s.url}>{s.title}</a>
                </li>
              ))}
            </ul>
          </ChartTable>
        </section>
        <Footer council={m.place.short} full={councilWithThe(m.place.council)} hasTestData={false} />
      </main>
      <JsonLd data={jsonLd} modified={m.vintage} />
    </>
  );
}
