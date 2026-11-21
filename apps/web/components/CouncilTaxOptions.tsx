"use client";

import { bandsOf, derive, type Figure } from "@borough-ledger/schema/client";
import { billFor } from "@borough-ledger/engine";
import { optionName } from "@/lib/ctOptions";
import type { CtOptionsModel, PageModel } from "@/lib/model";
import { ChartTable, DataTable } from "./ChartTable";
import { useLedger } from "./LedgerState";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";

type Props = Pick<PageModel, "bill" | "rules" | "place"> & {
  ct: CtOptionsModel;
  /** On the home page: the options for the band picked above, and a link to the full page. */
  compact?: boolean;
};


/**
 * Next year's bill for the reader's band under each of the council's three options (October's report to Cabinet). The
 * options are rises in the council's own share; the whole bill also carries the Mayor of London's share, which the
 * report assumes rises 5%. Other bands follow Band D by the statutory ratios, as the bill above does, and the single
 * person discount comes off the whole bill.
 */
export function CouncilTaxOptions({ bill, rules, place, ct, compact = false }: Props) {
  const { band, singlePerson, setBand } = useLedger();
  const inputs: Figure[] = [bill.ratios, ...(singlePerson ? [bill.spd] : [])];
  const now = billFor(rules, { council: bill.council.value, gla: bill.gla.value }, band, singlePerson);
  const nowF = derive(now.total, bill.total, ...inputs);
  const rows = ct.options.map((o) => {
    const b = billFor(rules, { council: o.council.value, gla: o.gla.value }, band, singlePerson);
    const total = derive(b.total, o.total, ...inputs);
    const up = derive(b.total - now.total, o.total, bill.total, ...inputs);
    return { o, total, up, week: derive(up.value / 52, up), councilUp: derive(b.council - now.council, o.council, bill.council, ...inputs) };
  });
  const who = `Band ${band}${singlePerson ? ", living alone" : ""}`;

  return (
    <div className="ct-options">
      {compact ? null : (
        <div className="seg" role="group" aria-label="Council tax band">
          {bandsOf(rules).map((x) => (
            <button key={x} type="button" aria-pressed={x === band} onClick={() => setBand(x)}>
              {x}
            </button>
          ))}
        </div>
      )}
      <div className="tablewrap">
        <table className="ct-table">
          <caption className="sr-only">
            {who}: the whole council tax bill in {place.nextYearLabel} under each of the council&rsquo;s options
          </caption>
          <thead>
            <tr>
              <th scope="col">{who}</th>
              <th scope="col" className="n">
                Whole bill a year
              </th>
              <th scope="col" className="n">
                Extra a year
              </th>
              <th scope="col" className="n">
                Extra a week
              </th>
              <th scope="col" className="n">
                Still to find
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">This year</th>
              <td className="n">
                <Num f={nowF} fmt="gbp2" />
              </td>
              <td className="n muted">–</td>
              <td className="n muted">–</td>
              <td className="n muted">–</td>
            </tr>
            {rows.map(({ o, total, up, week }) => (
              <tr key={o.pct}>
                <th scope="row">
                  Council&rsquo;s share {optionName(o.pct)}
                </th>
                <td className="n">
                  <Num f={total} fmt="gbp2" />
                </td>
                <td className="n">
                  <Num f={up} fmt="gbp2" />
                </td>
                <td className="n">
                  <b>
                    <Num f={week} fmt="gbp2" />
                  </b>
                </td>
                <td className="n">{o.shortfall.value > 0 ? <Num f={o.shortfall} fmt="m1" /> : <span className="muted">balances</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        The options are rises in the council&rsquo;s own share of the bill, <Num f={bill.council} fmt="gbp2" /> of this year&rsquo;s{" "}
        <Num f={bill.total} fmt="gbp2" /> at Band D. The whole bill also pays the Mayor of London, whose share the report assumes rises{" "}
        <Num f={ct.glaRise} fmt="pct0" />. &ldquo;Still to find&rdquo; is what each option leaves of the council&rsquo;s forecast gap by{" "}
        {ct.gap2030?.label ?? "2030/31"}, if council tax then rises 5% a year. Council Tax Support and other discounts would lower some bills; nothing is decided
        yet.
      </p>
      <div className="qrow">
        <QualityGroup q={ct.options[0]!.total.quality} text="The options: the council's report to Cabinet, 12 October 2026, Tables 7 to 9; other bands by the statutory ratios" />
      </div>
      {compact ? (
        <p className="ct-more">
          <a href="/council-tax-rise">What the options mean, why, and how to have your say</a>
        </p>
      ) : (
        <ChartTable summary="Every band, at a glance">
          <DataTable
            caption={`Extra a week on the whole bill in ${place.nextYearLabel}, by band${singlePerson ? ", living alone" : ""}`}
            head={["Band", ...ct.options.map((o) => `Council's share ${optionName(o.pct)}`)]}
            rows={bandsOf(rules).map((x) => {
              const n = billFor(rules, { council: bill.council.value, gla: bill.gla.value }, x, singlePerson).total;
              return {
                key: x,
                cells: [
                  `Band ${x}`,
                  ...ct.options.map((o) => {
                    const v = billFor(rules, { council: o.council.value, gla: o.gla.value }, x, singlePerson).total - n;
                    return <Num key={o.pct} f={derive(v / 52, o.total, bill.total, ...inputs)} fmt="gbp2" />;
                  }),
                ],
              };
            })}
          />
        </ChartTable>
      )}
    </div>
  );
}
