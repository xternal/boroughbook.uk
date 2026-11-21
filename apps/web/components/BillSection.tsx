"use client";

import { bandsOf, derive, worst, type Figure } from "@borough-ledger/schema/client";
import { billFor, splitPence } from "@borough-ledger/engine";
import type { PageModel } from "@/lib/model";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";
import { useLedger } from "./LedgerState";
import { ChartTable, DataTable } from "./ChartTable";
import { SecTitle, type SectionView } from "./SecTitle";

/** "two", "six": small counts in words, as the page says them; larger ones in figures. */
const numberWord = (n: number) => ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][n] ?? String(n);

type Props = Pick<PageModel, "bill" | "rules" | "services" | "ctShareGeneral" | "generalBudget" | "place"> & {
  /** What pays for the rest besides council tax, where it is not grants and business rates (South Oxfordshire keeps none). */
  rest?: string;
  /** On the overview (with a link to its own page) or on its own page (/bill). */
  view?: SectionView;
};

export function BillSection({ bill, rules, services, ctShareGeneral, generalBudget, place, rest = "government grants and business rates", view }: Props) {
  const { band, singlePerson, setBand, setSinglePerson } = useLedger();
  const b = billFor(rules, { council: bill.council.value, gla: bill.gla.value }, band, singlePerson);
  const inputs: Figure[] = [bill.ratios, ...(singlePerson ? [bill.spd] : [])];
  const council = derive(b.council, bill.council, ...inputs);
  const gla = derive(b.gla, bill.gla, ...inputs);
  const total = derive(b.total, bill.total, ...inputs);
  const pc = (b.council / b.total) * 100;
  // "Hammersmith & Fulham Council", but "Manchester City Council" where that is the council's own name.
  const councilName = /Council$/.test(place.council) ? place.council : `${place.short} Council`;
  // The Mayor's share by body, in pence that add back up to it; at Band D these are the GLA's own figures.
  const glaParts = bill.glaSplit.length
    ? splitPence(b.gla, bill.glaSplit.map((g) => g.f.value)).map((v, i) => ({ ...bill.glaSplit[i]!, amt: derive(v, bill.glaSplit[i]!.f, ...inputs) }))
    : [];
  const changed = bill.glaSplit.filter((g) => g.f.value !== g.prev.value);
  const glaChange = changed.length ? derive(changed.reduce((a, g) => a + g.f.value - g.prev.value, 0), changed[0]!.f, ...changed.flatMap((g) => [g.f, g.prev])) : null;

  // Council tax pays for what ring-fenced grants do not, so split it by spending after those grants. Scotland's return
  // gives each service after its grants already, so there is nothing to take off.
  const basis = bill.splitBasis;
  const ranked = services.filter((s) => s.general && s.general.value > 0).sort((a, z) => z.general!.value - a.general!.value);
  // A service whose share rounds to nothing (in some boroughs, public health after its grant) is left out of the list.
  const shares = ranked
    .map((s) => ({ ...s, share: derive((s.general!.value / generalBudget.value) * b.council, s.general!, generalBudget, council) }))
    .filter((s) => s.share.value >= 0.5);
  const max = shares[0]?.share.value ?? 1;
  const [lo, hi] = [Math.min(...bill.instalments.options), Math.max(...bill.instalments.options)];
  const perInstalment = (n: number) => derive(b.total / n, total, bill.instalments.f);

  return (
    <section id="bill" aria-labelledby="bill-h">
      <div className="sec-head">
        <SecTitle id="bill-h" section="bill" view={view}>
          Your bill
        </SecTitle>
        <p>
          Pick your band. The council keeps <Num f={bill.councilShare} fmt="share0" /> of it; the rest goes to {bill.others.to}.
        </p>
      </div>
      <div className="bill">
        <div className="bill-main">
          <div className="seg" role="group" aria-label="Council tax band">
            {bandsOf(rules).map((x) => (
              <button key={x} type="button" aria-pressed={x === band} onClick={() => setBand(x)}>
                {x}
              </button>
            ))}
          </div>
          <div>
            <div className="muted small">
              Band {band}, {place.yearLabel}
              {singlePerson ? ", with single person discount" : ""}
            </div>
            <div className="big" aria-live="polite">
              <Num f={total} fmt="gbp2" />
            </div>
            <div className="muted">
              <Num f={perInstalment(lo)} fmt="gbp2" /> a month over {lo} instalments
              {hi !== lo ? (
                <>
                  , or <Num f={perInstalment(hi)} fmt="gbp2" /> over {hi}
                </>
              ) : null}
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={singlePerson} onChange={(e) => setSinglePerson(e.target.checked)} />
            <span>
              I live alone (<Num f={bill.spd} fmt="share0" /> single person discount)
            </span>
          </label>
          <div className="split">
            <div className="barline" aria-hidden="true">
              <i style={{ width: `${pc}%`, background: "var(--fund)" }} />
              <i style={{ width: `${100 - pc}%`, background: "var(--gla)" }} />
            </div>
            <div className="legend2">
              <span className="sw" style={{ background: "var(--fund)" }} />
              <span>{councilName}</span>
              <span className="amt">
                <Num f={council} fmt="gbp2" />
              </span>
              <span className="sw" style={{ background: "var(--gla)" }} />
              <span>{bill.others.name}</span>
              <span className="amt">
                <Num f={gla} fmt="gbp2" />
              </span>
              {glaParts.map((g) => (
                <div className="part" key={g.id}>
                  <span title={g.officialTerm}>{g.label}</span>
                  <span className="amt">
                    <Num f={g.amt} fmt="gbp2" />
                  </span>
                </div>
              ))}
              <span className="sub">
                {glaChange ? (
                  <>
                    At Band D {bill.others.short} went {glaChange.value > 0 ? "up" : "down"} <Num f={derive(Math.abs(glaChange.value), glaChange)} fmt="gbp2" /> this
                    year
                    {/* One body only (South Wales Police): nothing to break down. */}
                    {bill.glaSplit.length > 1 ? ": " : ""}
                    {bill.glaSplit.length > 1
                      ? changed.map((g, i) => (
                          <span key={g.id}>
                            {i ? (i === changed.length - 1 ? " and " : ", ") : ""}
                            <Num f={derive(Math.abs(g.f.value - g.prev.value), g.f, g.prev)} fmt="gbp2" /> {g.f.value > g.prev.value ? "more" : "less"} for {g.phrase}
                          </span>
                        ))
                      : null}
                    .
                  </>
                ) : (
                  bill.glaNote
                )}
              </span>
            </div>
          </div>
          <div className="qrow">
            <QualityGroup q={bill.total.quality} text={`Band D bill for ${place.yearLabel}`} />
            {glaParts.length > 0 && <QualityGroup q={worst(...bill.glaSplit.map((g) => g.f.quality))} text={bill.others.quality} />}
          </div>
        </div>
        <div>
          <h3 style={{ marginBottom: 14 }}>
            Your <Num f={council} fmt="gbp2" /> to the council pays for
          </h3>
          <div className="rows">
            {shares.map((s) => (
              <div className="row" key={s.id}>
                <span>{s.label}</span>
                <span className="v">
                  <Num f={s.share} fmt="gbp0" />
                </span>
                <div className="track" aria-hidden="true">
                  <i style={{ width: `${((s.share.value / max) * 100).toFixed(1)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <ChartTable summary="Show your bill as a table">
            <DataTable
              caption={`Band ${band}, ${place.yearLabel}${singlePerson ? ", with single person discount" : ""}: where your council tax goes`}
              head={["", "Your bill", "Share"]}
              rows={[
                ...shares.map((s) => ({
                  key: s.id,
                  cells: [s.label, <Num key="v" f={s.share} fmt="gbp2" />, <Num key="p" f={derive(s.share.value / total.value, s.share, total)} fmt="share1" />],
                })),
                { key: "council", cells: [`${councilName}, all services`, <Num key="v" f={council} fmt="gbp2" />, <Num key="p" f={derive(b.council / b.total, council, total)} fmt="share1" />] },
                ...glaParts.map((g) => ({
                  key: `gla-${g.id}`,
                  cells: [`${bill.others.as}${bill.others.as ? g.phrase : g.label}`, <Num key="v" f={g.amt} fmt="gbp2" />, <Num key="p" f={derive(g.amt.value / total.value, g.amt, total)} fmt="share1" />],
                })),
                { key: "gla", cells: [`${bill.others.name}, all`, <Num key="v" f={gla} fmt="gbp2" />, <Num key="p" f={derive(b.gla / b.total, gla, total)} fmt="share1" />] },
              ]}
              foot={["Your bill", <Num key="v" f={total} fmt="gbp2" />, "100%"]}
            />
          </ChartTable>
          {bill.parish ? (
            <p className="small muted" style={{ marginTop: 14 }}>
              {bill.parish.per === "total" ? (
                <>
                  Homes in the areas of {place.short}&rsquo;s {numberWord(bill.parish.count)} {bill.parish.word}s
                  {bill.parish.names ? ` (${bill.parish.names})` : ""} also pay their {bill.parish.word}, on top of the bill above. Together they raise{" "}
                  <Num f={bill.parish.f} fmt="gbp0" /> this year.
                </>
              ) : (
                <>
                  Homes in {place.short}&rsquo;s {bill.parish.count === 1 ? "parish" : `${numberWord(bill.parish.count)} parishes`}
                  {bill.parish.names ? ` (${bill.parish.names})` : ""} also pay their {bill.parish.word}: on average <Num f={bill.parish.f} fmt="gbp2" /> at Band D, on top
                  of the bill above.
                </>
              )}
            </p>
          ) : null}
          <p className="small muted" style={{ marginTop: 14 }}>
            {basis === "before_grants" ? (
              <>
                Split in proportion to everything the council spends, <Num f={generalBudget} fmt="m0" />, including what specific government grants pay for: the
                budget return does not say which services those grants go to. Council tax pays about <Num f={ctShareGeneral} fmt="pence" /> of every £1 of it;
                {rest} pay the rest.
              </>
            ) : (
              <>
                Split in proportion to the <Num f={generalBudget} fmt="m0" /> the council pays for itself,{" "}
                {basis === "after_ring_fenced"
                  ? "after schools and public health, which have their own ring-fenced grants."
                  : "after the grants tied to particular services, which the budget return already takes off each one."}{" "}
                Council tax pays about <Num f={ctShareGeneral} fmt="pence" /> of every £1 of that; {rest} pay the rest.
              </>
            )}
          </p>
          <div className="qrow">
            <QualityGroup q={worst(...services.map((s) => s.f.quality))} text={`Split by service, ${place.yearLabel} budget return`} />
          </div>
        </div>
      </div>
    </section>
  );
}
