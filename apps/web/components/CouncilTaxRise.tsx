/* What the council's three council tax options for next year mean for a reader: their band's bill, the headline read
   right, why it is happening, and how to have a say before the decision. /council-tax-rise and one page per band. */
import { COUNCIL_UPDATED } from "@/lib/updated";
import { derive, type Band } from "@borough-ledger/schema";
import type { PageModel } from "@/lib/model";
import { formatDay, formatMonthYear } from "@/lib/format";
import { SITE_URL } from "@/lib/site";
import { optionName } from "@/lib/ctOptions";
import { CouncilTaxOptions } from "./CouncilTaxOptions";
import { JsonLd } from "./JsonLd";
import { LedgerStateProvider } from "./LedgerState";
import { Num } from "./Num";
import { PageShell } from "./PageShell";
import { MakeYourCase } from "./MakeYourCase";
import { councilTaxCase } from "@/lib/makeYourCase";

/** "19 October to 15 November 2026", "December 2026", "15 February 2027". */
export function when(start: string, end?: string): string {
  const one = (d: string) => (d.length === 7 ? formatMonthYear(`${d}-01`) : formatDay(d));
  if (!end) return one(start);
  if (start.length === 7 && end.length === 7) return `${formatMonthYear(`${start}-01`).replace(/ \d{4}$/, "")} to ${formatMonthYear(`${end}-01`)}`;
  return `${formatDay(start).replace(/ \d{4}$/, "")} to ${one(end)}`;
}

/** Plain-words questions and answers, from the same figures as the page; also the page's FAQ structured data. */
export function riseQA(m: PageModel): { q: string; a: string }[] {
  const ct = m.ctOptions!;
  const total = m.bill.total.value;
  const gbp = (v: number) => `£${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const opts = ct.options.map((o) => ({ pct: o.pct, whole: o.total.value, rise: Math.round((o.total.value / total - 1) * 100), week: (o.total.value - total) / 52 }));
  const list = (f: (o: (typeof opts)[number]) => string) => opts.map(f).reduce((a, s, i) => (i === 0 ? s : `${a}${i === opts.length - 1 ? " or " : ", "}${s}`), "");
  const council = m.bill.council.value;
  const final = ct.timetable.find((t) => t.id === "council_budget");
  const cabinet = ct.timetable.find((t) => t.id === "cabinet_budget");
  const engage = ct.timetable.find((t) => t.id === "engagement");
  return [
    {
      q: "Will council tax in Hammersmith & Fulham really go up by 150%?",
      a: `Nothing is decided. The council's report to Cabinet on 12 October 2026 sets out three options for ${m.place.nextYearLabel} that raise the council's own share of the bill by ${list((o) => `${o.pct}%`)}. That share is ${gbp(council)} of this year's ${gbp(total)} Band D bill; the rest goes to the Mayor of London. So the whole Band D bill would rise by about ${list((o) => `${o.rise}%`)}, to ${list((o) => gbp(o.whole))}.`,
    },
    {
      q: "How much more would I pay?",
      a: `At Band D, ${list((o) => gbp(o.week))} a week more on the whole bill. Other bands pay a fixed share of Band D, from two thirds (Band A) to twice as much (Band H); someone living alone gets ${Math.round(m.bill.spd.value * 100)}% off. Pick your band on this page to see yours.`,
    },
    {
      q: "Why is this happening?",
      a: `${ct.funding ? `The government's funding for the council falls from £${ct.funding.from.value}m in ${ct.funding.fromLabel} to £${ct.funding.to.value}m in ${ct.funding.toLabel}, under a new way of sharing money between councils that moves it away from central London. ` : ""}With rising costs, the council forecasts a gap of ${ct.gap2030 ? `£${ct.gap2030.gap.value}m by ${ct.gap2030.label}` : "tens of millions of pounds"}. The government has given Hammersmith & Fulham and five other councils with low council tax (Westminster, Kensington and Chelsea, Wandsworth, the City of London and Windsor and Maidenhead) the power to raise it by any amount for two years without a local referendum.`,
    },
    {
      q: "When will it be decided?",
      a: `${final ? `Full Council sets the ${m.place.nextYearLabel} budget and council tax on ${when(final.start)}` : "Full Council sets the budget in March"}${final?.proposed ? " (a proposed date)" : ""}${cabinet ? `, after Cabinet considers the draft budget on ${when(cabinet.start)}` : ""}.`,
    },
    {
      q: "How can I have my say?",
      a: `${engage ? `The council asks residents, businesses and others for their views from ${when(engage.start, engage.end)}: which services matter most to them, and what they expect of council tax. ` : ""}You can also write to your ward councillors, or to those who lead on the budget for each side: this page helps you draft the letter in your own words and finds them by postcode. Anyone who lives, works or studies in the borough can also put a question to Full Council, or start a petition.`,
    },
    {
      q: "Is BoroughBook.UK the council?",
      a: "No. BoroughBook.UK is an independent project, not run by or affiliated with any council or party. Every figure here comes from the council's own report, with its page.",
    },
  ];
}

export function CouncilTaxRise({ m, band, path }: { m: PageModel; band: Band; path: string }) {
  const ct = m.ctOptions!;
  const top = ct.options[ct.options.length - 1]!;
  const qa = riseQA(m);
  const taxCase = councilTaxCase(m);
  const bandD = ct.options.map((o) => ({ o, rise: derive((o.total.value / m.bill.total.value - 1) * 100, o.total, m.bill.total) }));
  return (
    <PageShell m={m} updated={COUNCIL_UPDATED}>
      <div className="hero">
        <h1>Council tax next year: the council&rsquo;s three options{band !== "D" ? ` for Band ${band} homes` : ""}</h1>
        <p className="lede">
          Hammersmith &amp; Fulham Council has set out three options for {m.place.nextYearLabel} that would raise its own share of the bill by{" "}
          {ct.options.map((o, i) => (
            <span key={o.pct}>
              {i ? (i === ct.options.length - 1 ? " or " : ", ") : ""}
              {o.pct}%
            </span>
          ))}
          . With the Mayor of London&rsquo;s share, a Band D bill of <Num f={m.bill.total} fmt="gbp2" /> would become{" "}
          {ct.options.map((o, i) => (
            <span key={o.pct}>
              {i ? (i === ct.options.length - 1 ? " or " : ", ") : ""}
              <Num f={o.total} fmt="gbp2" />
            </span>
          ))}
          . Nothing is decided yet. Here is what each would mean for your home, and how to have your say.
        </p>
      </div>

      <section id="your-band" aria-labelledby="your-band-h" className="ward-sec">
        <h2 id="your-band-h">Your bill under each option</h2>
        <p className="small muted">Pick your band. It is on your council tax bill, or at gov.uk/council-tax-bands.</p>
        <LedgerStateProvider input={m.balance.input} initialBand={band}>
          <CouncilTaxOptions bill={m.bill} rules={m.rules} place={m.place} ct={ct} />
        </LedgerStateProvider>
      </section>

      <section id="headlines" aria-labelledby="headlines-h" className="ward-sec">
        <h2 id="headlines-h">Reading the headlines</h2>
        <p>
          Headlines say council tax could rise by up to {top.pct}%. That is the council&rsquo;s own share, <Num f={m.bill.council} fmt="gbp2" /> of a Band D bill this
          year. The whole bill also pays the Mayor of London (<Num f={m.bill.gla} fmt="gbp2" /> this year, which the report assumes rises{" "}
          <Num f={ct.glaRise} fmt="pct0" />
          ), so in percentage terms it rises less: at Band D,
        </p>
        <ul>
          {bandD.map(({ o, rise }) => (
            <li key={o.pct}>
              council&rsquo;s share {optionName(o.pct)}: the whole bill becomes <Num f={o.total} fmt="gbp2" />, up <Num f={rise} fmt="pct0" />
            </li>
          ))}
        </ul>
        <p>
          The top option roughly doubles the whole bill. Some reports set the council&rsquo;s new share (such as <Num f={ct.options[0]!.council} fmt="gbp2" />) beside
          today&rsquo;s whole bill (<Num f={m.bill.total} fmt="gbp2" />): the two are not the same thing.
        </p>
      </section>

      <section id="why" aria-labelledby="why-h" className="ward-sec">
        <h2 id="why-h">Why it is happening</h2>
        <p>
          {ct.funding ? (
            <>
              The government&rsquo;s funding for the council falls from <Num f={ct.funding.from} fmt="m1" /> in {ct.funding.fromLabel} to{" "}
              <Num f={ct.funding.to} fmt="m1" /> in {ct.funding.toLabel}, under a new way of sharing money between councils that moves it away from central
              London.{" "}
            </>
          ) : null}
          With costs rising too, the council forecasts a gap of <Num f={m.balance.revised?.gap ?? m.balance.gap} fmt="m1" /> next year
          {ct.gap2030 ? (
            <>
              {" "}
              and <Num f={ct.gap2030.gap} fmt="m1" /> by {ct.gap2030.label}
            </>
          ) : null}
          . The government has given Hammersmith &amp; Fulham and five other councils with low council tax the power to raise it by any amount for two years without
          a local referendum.
        </p>
        <p>
          Each option leaves a different amount still to find by {ct.gap2030?.label ?? "2030/31"}:{" "}
          {ct.options.map((o, i) => (
            <span key={o.pct}>
              {i ? (i === ct.options.length - 1 ? " and " : ", ") : ""}
              {o.shortfall.value > 0 ? <Num f={o.shortfall} fmt="m1" /> : "nothing (it broadly balances)"} with {optionName(o.pct)}
            </span>
          ))}
          . The rest would have to come from savings: try your own mix in <a href="/balance">Balance it</a>.
        </p>
      </section>

      <section id="have-your-say" aria-labelledby="say-h" className="ward-sec">
        <h2 id="say-h">Have your say</h2>
        <ol className="ct-timetable">
          {ct.timetable.map((t) => (
            <li key={t.id}>
              <b>
                {when(t.start, t.end)}
                {t.proposed ? " (proposed)" : ""}
              </b>
              <span>
                {t.label}.
                {t.note ? (
                  <>
                    {" "}
                    <span className="muted">
                      {t.note}
                      {t.note_url ? (
                        <>
                          {" "}
                          <a href={t.note_url}>The calendar</a>.
                        </>
                      ) : null}
                    </span>
                  </>
                ) : null}
              {t.id === "engagement" ? (
                t.url ? (
                  <>
                    {" "}
                    <a href={t.url}>Take part</a>.
                  </>
                ) : (
                  " We will link the council's page here when it opens."
                )
              ) : null}
              </span>
            </li>
          ))}
        </ol>
        {taxCase ? (
          <MakeYourCase
            id="case-council-tax"
            level={3}
            setup={taxCase.setup}
            wants={taxCase.wants}
            facts={taxCase.facts}
            page={`${SITE_URL}${path}`}
            intro="Prefer one of the options, or none of them? Your ward councillors vote on it at Full Council. Tell them, or the councillors who lead on the budget for each side, before they decide."
          />
        ) : null}
        <p className="small muted">
          From the council&rsquo;s{" "}
          <a href={ct.timetable.find((t) => t.id === "cabinet_mtfs")?.url ?? "https://democracy.lbhf.gov.uk/mgConvert2PDF.aspx?ID=136431"}>
            report to Cabinet, 12 October 2026
          </a>
          , Table 11 (page 19) and paragraph 6.4 (page 16).
        </p>
      </section>

      <section id="questions" aria-labelledby="qa-h" className="ward-sec">
        <h2 id="qa-h">Questions</h2>
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
          { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qa.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Council tax next year", item: `${SITE_URL}/council-tax-rise` },
              ...(path !== "/council-tax-rise" ? [{ "@type": "ListItem", position: 3, name: `Band ${band}`, item: `${SITE_URL}${path}` }] : []),
            ],
          },
        ]}
      />
    </PageShell>
  );
}
