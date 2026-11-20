import { Updated } from "@/components/Updated";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DATA, derive } from "@borough-ledger/schema";
import { AdultCare } from "@/components/AdultCare";
import { ChildrenCare } from "@/components/ChildrenCare";
import { BillSection } from "@/components/BillSection";
import { ControlKpi, Councillors } from "@/components/BoroughCouncillors";
import { BudgetFlow } from "@/components/BudgetFlow";
import { ChartTable, DataTable } from "@/components/ChartTable";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { LedgerStateProvider } from "@/components/LedgerState";
import { Num } from "@/components/Num";
import { QualityGroup } from "@/components/QualityLegend";
import { TopBar } from "@/components/TopBar";
import { TownBill } from "@/components/TownBill";
import { HeroTop } from "@/components/HeroTop";
import { councilWithThe } from "@/lib/boroughList";
import { BOROUGHS, boroughModel, type BoroughModel } from "@/lib/boroughs";
import { format, formatDay } from "@/lib/format";
import { adultCare, careResults } from "@/lib/adultCare";
import { childrenCare } from "@/lib/childrenCare";
import { isRatesCouncil, ratesModel } from "@/lib/rates";
import { RatesPage, ratesWords } from "@/components/RatesPage";
import { SITE, SITE_URL } from "@/lib/site";
import { share } from "@/lib/share";

type Props = { params: Promise<{ borough: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return BOROUGHS.map((b) => ({ borough: b.slug }));
}

const SECTIONS = [
  ["bill", "Your bill"],
  ["budget", "Budget"],
  ["history", "Over the years"],
  ["councillors", "Councillors"],
] as const;

/** A two-tier area's menu: its towns, then the county's budget before the district's (the county sets most of the bill). */
function sectionsOf(m: BoroughModel) {
  if (!m.county) return SECTIONS;
  return [
    ["bill", "Your bill"],
    ...m.towns.map((t) => [t.id, t.town] as const),
    ["county-budget", "County budget"],
    ["budget", "District budget"],
    ["history", "Over the years"],
    ["councillors", "Councillors"],
  ] as const;
}

/** "a, b, and c" where the items have "and" in them ("schools and education"), else "a, b and c". */
const list = (xs: string[]) =>
  xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")}${xs.some((x) => / and /.test(x)) ? ", and " : " and "}${xs[xs.length - 1]}`;
const topServices = (lines: BoroughModel["services"], n: number) =>
  [...lines]
    .sort((a, z) => z.f.value - a.f.value)
    .slice(0, n)
    .map((l) => l.label.charAt(0).toLowerCase() + l.label.slice(1));

function words(m: BoroughModel) {
  const title = `Where your council tax goes in ${m.place.short} | ${SITE.name}`;
  const description = m.county
    ? `${m.place.short}: a Band D council tax bill of ${format("gbp2", m.bill.total.value)} in ${m.place.yearLabel}, split between ${m.county.council}, the police and ${m.place.council}; both councils' budgets by service and where the money comes from; ${m.towns.length ? `what ${list(m.towns.map((t) => t.town))} pays with its town council; ` : ""}council tax over the years; and every ward's councillors and election result. From government returns and the councils' own records.`
    : `${m.place.short}: a Band D council tax bill of ${format("gbp2", m.bill.total.value)} in ${m.place.yearLabel}, split between the council and ${m.bill.others.to}; the council's ${format("m0", m.netBudget.value)} budget by service and where the money comes from; council tax over the years; and every ward's councillors and election result. From government returns and the council's own records.`;
  return { title, description };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { borough } = await params;
  const r = isRatesCouncil(borough) ? ratesModel(borough) : null;
  const m = r ? null : boroughModel(borough);
  if (!r && !m) return {};
  const { title, description } = r ? ratesWords(r) : words(m!);
  return { title, description, alternates: { canonical: `/${borough}` }, ...share(`/${borough}`, title, description, { own: true }) };
}

export default async function BoroughPage({ params }: Props) {
  const { borough } = await params;
  // Northern Ireland: rates, not council tax (lib/rates.ts).
  if (isRatesCouncil(borough)) {
    const r = ratesModel(borough);
    if (!r) notFound();
    return <RatesPage m={r} slug={borough} />;
  }
  const m = boroughModel(borough);
  if (!m) notFound();
  const { title, description } = words(m);
  const P = m.people;
  const map = m.map;
  // England only: the government's adult social care finance report covers English councils. In a two-tier area the
  // county runs social care, so its figures are shown.
  const careBy = m.county ? { ons: m.county.ons, council: m.county.council, short: m.county.short } : { ons: m.b.ons, council: m.place.council, short: m.place.short };
  const care = adultCare(careBy.ons);
  const kids = childrenCare(careBy.ons);
  const K = m.county;
  const others = K ? m.bill.glaSplit.filter((g) => g.f !== K.bandD) : [];
  const notRun = K ? m.services.filter((s) => s.f.value === 0).map((s) => s.label.charAt(0).toLowerCase() + s.label.slice(1)) : [];
  const first = m.history[0]!;
  const last = m.history[m.history.length - 1]!;
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "WebPage", name: title.split(" | ")[0], description, url: `${SITE_URL}/${borough}`, inLanguage: "en-GB", about: { "@type": "GovernmentOrganization", name: m.place.council } },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: m.place.short, item: `${SITE_URL}/${borough}` },
      ],
    },
  ];
  return (
    <>
      <TopBar place={m.place.short} year={m.place.yearLabel} borough={{ base: `/${borough}`, items: P ? sectionsOf(m) : sectionsOf(m).filter(([id]) => id !== "councillors") }} />
      <main className="wrap" id="top">
        <div className="hero">
          <HeroTop
            current={m.place.short}
            council={`${councilWithThe(m.place.council)}${K ? ` or ${K.council}` : ""}`}
            example={m.b.example_postcode ?? "W6 9JU"}
            results={!!P?.wards.some((w) => w.election)}
          />
          <h1>Where your council tax goes in {m.place.short}</h1>
          <p className="small muted">
            <Updated date={m.vintage} />
          </p>
          {K ? (
            <p className="lede">
              A Band D home pays <Num f={m.bill.total} fmt="gbp2" /> this year, up <Num f={m.bill.risePct} fmt="pct1" />. Most of it,{" "}
              <Num f={K.bandD} fmt="gbp2" />, goes to {K.council}, which spends most on {list(topServices(K.budget.services, 3))}. Of the rest,{" "}
              {others.map((g, i) => (
                <span key={g.id}>
                  {i ? ", " : ""}
                  <Num f={g.f} fmt="gbp2" /> goes to {g.phrase === "police" ? "the police" : g.phrase}
                </span>
              ))}{" "}
              and <Num f={m.bill.council} fmt="gbp2" /> to {m.place.council}, which spends most of its own budget on {topServices(m.services, 1)[0]}.
            </p>
          ) : (
          <p className="lede">
            A Band D home pays <Num f={m.bill.total} fmt="gbp2" /> this year, up <Num f={m.bill.risePct} fmt="pct1" />. Council tax covers about{" "}
            <Num f={m.ctShare} fmt="share0" /> of what the council spends on day-to-day services; government grants pay{" "}
            <Num f={m.grantsShare} fmt="share0" />
            {m.funding.some((f) => f.ringFencedTo) ? ", including the money passed straight to schools," : ","} and business rates{" "}
            <Num f={m.ratesShare} fmt="share0" />.
          </p>
          )}
          <div className="kpis">
            <div className="kpi">
              <span className="l">Band D bill</span>
              <span className="v">
                <Num f={m.bill.total} fmt="gbp0" />
              </span>
              <span className="s">
                up <Num f={m.bill.risePct} fmt="pct1" /> on last year
              </span>
            </div>
            {K ? (
              <>
                <div className="kpi">
                  <span className="l">County council budget</span>
                  <span className="v">
                    <Num f={K.budget.netBudget} fmt="m0" />
                  </span>
                  <span className="s">{K.short}&rsquo;s, day-to-day, including schools</span>
                </div>
                <div className="kpi">
                  <span className="l">District council budget</span>
                  <span className="v">
                    <Num f={m.netBudget} fmt="m0" />
                  </span>
                  <span className="s">{m.place.short}&rsquo;s, day-to-day</span>
                </div>
              </>
            ) : (
              <>
                <div className="kpi">
                  <span className="l">Council budget</span>
                  <span className="v">
                    <Num f={m.netBudget} fmt="m0" />
                  </span>
                  <span className="s">day-to-day, including schools</span>
                </div>
                <div className="kpi">
                  <span className="l">Paid by council tax</span>
                  <span className="v">
                    <Num f={m.ctShare} fmt="share0" />
                  </span>
                  <span className="s">of the budget</span>
                </div>
              </>
            )}
            {P ? (
              <ControlKpi P={P} />
            ) : (
              <div className="kpi">
                <span className="l">The council keeps</span>
                <span className="v">
                  <Num f={m.bill.councilShare} fmt="share0" />
                </span>
                <span className="s">of the Band D bill</span>
              </div>
            )}
          </div>
        </div>

        {m.reorganisation ? (
          <section id="changes" aria-labelledby="changes-h">
            <div className="sec-head">
              <h2 id="changes-h">Your councils are changing</h2>
              <p className="callout">{m.reorganisation.note}</p>
            </div>
            <p className="small muted">
              From{" "}
              {m.reorganisation.sources.map((x, i) => (
                <span key={x.url}>
                  {i ? " and " : ""}
                  <a href={x.url}>{x.title}</a>
                </span>
              ))}
              .
            </p>
          </section>
        ) : null}

        <LedgerStateProvider
          input={{ gapM: 0, levers: [], toggles: [], reserves: { general_m: 0, minimum_safe_m: 0 }, referendumThresholdPct: null, toleranceM: DATA.rules.balanced_budget.tolerance_m }}
        >
          <BillSection
            bill={m.bill}
            rules={m.rules}
            services={m.services.filter((x) => x.f.value !== 0)}
            ctShareGeneral={m.ctShareGeneral}
            generalBudget={m.generalBudget}
            place={m.place}
            {...(m.funding.some((f) => f.id === "business_rates") ? {} : { rest: "government grants and other income" })}
          />
        </LedgerStateProvider>
        {m.towns.map((t) => (
          <TownBill key={t.id} t={t} council={m.place.council} county={K?.council ?? null} yearLabel={m.place.yearLabel} />
        ))}
        {K ? (
          <BudgetFlow
            id="county-budget"
            title={`${K.council}’s budget`}
            lead={
              <>
                The county council sets the biggest part of the bill, <Num f={K.bandD} fmt="gbp2" /> at Band D, and runs schools, social care and roads across{" "}
                {K.short}. It sends no bills of its own: {m.place.council} collects its share with yours.
              </>
            }
            m={{ ...K.budget, place: m.place }}
            legend={K.budget.budgetLegend}
          />
        ) : null}
        <BudgetFlow
          m={m}
          legend={m.budgetLegend}
          {...(K ? { title: `${m.place.council}’s budget` } : {})}
          more={
            K ? (
              <>
                {notRun.length ? (
                  <p className="small muted">
                    Nothing here for {list(notRun)}: {K.council} runs {notRun.length > 1 ? "them" : "it"} (see its budget above).
                  </p>
                ) : null}
                {!m.funding.some((f) => f.id === "business_rates") ? (
                  <p className="small muted">
                    The council&rsquo;s budget return keeps no business rates for {m.place.yearLabel} (it shows nothing on that line), so there is none in the flow.
                  </p>
                ) : null}
              </>
            ) : m.returnsDiffer ? (
              <p className="small muted">
                The council&rsquo;s two returns to government do not agree on its council tax for {m.place.yearLabel}:{" "}
                <Num f={m.returnsDiffer.budget} fmt="gbp0" /> in its budget return and <Num f={m.returnsDiffer.councilTax} fmt="gbp0" /> in its council tax return,{" "}
                <Num f={m.returnsDiffer.apart} fmt="gbp0" /> apart. The budget here uses the budget return&rsquo;s figure, so it adds up; your bill uses the council tax
                return&rsquo;s. There is probably an explanation; we have not found it yet.
              </p>
            ) : null
          }
        />

        {care ? <AdultCare care={care} council={careBy.council} results={careResults(careBy.ons)} /> : null}
        {kids ? <ChildrenCare care={kids} council={careBy.council} short={careBy.short} /> : null}

        <section id="history" aria-labelledby="history-h">
          <div className="sec-head">
            <h2 id="history-h">Council tax over the years</h2>
            <p>
              The council&rsquo;s own share of a Band D bill went from <Num f={first.council} fmt="gbp2" /> in {first.label} to <Num f={last.council} fmt="gbp2" /> in{" "}
              {last.label}, up <Num f={derive((last.council.value / first.council.value - 1) * 100, last.council, first.council)} fmt="pct0" />.
            </p>
          </div>
          <div className="tablewrap">
            <table>
              <caption className="sr-only">Band D council tax in {m.place.short} each year</caption>
              <thead>
                <tr>
                  <th scope="col">Year</th>
                  <th scope="col" className="n">
                    The council&rsquo;s share
                  </th>
                  <th scope="col" className="n">
                    Whole bill, with {m.bill.others.with}
                  </th>
                </tr>
              </thead>
              <tbody>
                {m.history.map((y) => (
                  <tr key={y.year}>
                    <th scope="row">{y.label}</th>
                    <td className="n">
                      <Num f={y.council} fmt="gbp2" />
                    </td>
                    <td className="n">{y.area ? <Num f={y.area} fmt="gbp2" /> : <span className="muted">not published</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {m.history.some((y) => !y.area) ? (
            <p className="small muted">
              The whole bill is shown for the years whose {m.bill.others.with} charges are published in a form we can read; for earlier years only the
              council&rsquo;s share is.
            </p>
          ) : null}
        </section>

        {P && map ? <Councillors m={m} P={P} map={map} /> : null}

        <section aria-labelledby="next-h" className="pay-section">
          <div className="sec-head">
            <h2 id="next-h">Still to come for {m.place.short}</h2>
          </div>
          <p>
            For Hammersmith &amp; Fulham, BoroughBook.UK also tracks every party&rsquo;s manifesto pledges, every council payment over £500, Cabinet and Full Council
            decisions, how this year&rsquo;s budget gap was closed and a tool to balance next year. Those need the council&rsquo;s own papers, read by hand, and come
            here next. <a href="/">See Hammersmith &amp; Fulham</a>.
          </p>
          {m.b.councillors_later ? (
            <p>
              Councillors and how each ward voted: {m.b.councillors_later.why} <a href={m.b.councillors_later.url}>See the council&rsquo;s own list of councillors</a>.
            </p>
          ) : null}
          <div className="qrow">
            <QualityGroup
              q="sourced"
              text={`Bill, budget and history: ${m.b.nation === "scotland" ? "the Scottish Government's returns and Scottish Water's charges" : "government returns"}, checked against their own totals (${formatDay(m.vintage)})`}
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
        <Footer council={m.place.short} full={`${councilWithThe(m.place.council)}${K ? ` or ${K.council}` : ""}`} hasTestData={false} />
      </main>
      <JsonLd data={jsonLd} modified={m.vintage} />
    </>
  );
}
