"use client";

import { useId, useState } from "react";
import { derive, worst, type Figure } from "@borough-ledger/schema/client";
import { ratesBill } from "@borough-ledger/engine";
import type { FlowLine } from "@/lib/model";
import { ChartTable, DataTable } from "./ChartTable";
import { Num } from "./Num";
import { QualityGroup } from "./QualityLegend";

/**
 * Northern Ireland's rates bill: no bands, so the reader gives their home's capital value (what it would have sold for in
 * 2005, on their rate bill or in Land & Property Services' search). The page starts on the official average for Northern
 * Ireland. The bill is the value, capped, times the council's district rate and the Executive's regional rate.
 */
export function RatesBill({
  council,
  yearLabel,
  rates,
  cap,
  allowance,
  allowanceAge,
  instalments,
  valuationYear,
  example,
  services,
  budget,
}: {
  council: string;
  yearLabel: string;
  rates: { district: Figure; regional: Figure; councilShare: Figure };
  cap: Figure;
  allowance: Figure;
  allowanceAge: number;
  instalments: Figure;
  valuationYear: string;
  example: { value: Figure; label: string };
  services: FlowLine[];
  budget: Figure;
}) {
  const id = useId();
  const [text, setText] = useState(String(example.value.value));
  const [lone, setLone] = useState(false);
  const typed = Number(text.replace(/[£,\s]/g, ""));
  const ok = text.trim() !== "" && Number.isFinite(typed) && typed > 0 && typed <= 100_000_000;
  const value: Figure = ok && typed === example.value.value ? example.value : { value: ok ? typed : example.value.value, quality: "sourced", sources: [] };
  const b = ratesBill(value.value, { district: rates.district.value, regional: rates.regional.value }, { cap: cap.value, allowance: allowance.value }, lone);
  // Our arithmetic on official rates: modelled, whatever value it starts from.
  const inputs: Figure[] = [rates.district, rates.regional, cap, ...(lone ? [allowance] : [])];
  const m = (v: number, ...more: Figure[]): Figure => ({ ...derive(v, value, ...inputs, ...more), quality: "modelled" });
  const district = m(b.district);
  const regional = m(b.regional);
  const total = m(b.total);
  const perMonth = m(b.total / instalments.value, instalments);
  const pc = (b.district / b.total) * 100;
  const capped = value.value > cap.value;

  const max = Math.max(...services.map((s) => s.f.value));
  const shares = [...services]
    .sort((a, z) => z.f.value - a.f.value)
    .map((s) => ({ ...s, share: m((s.f.value / budget.value) * b.district, s.f, budget) }))
    .filter((s) => s.share.value >= 0.5);

  return (
    <section id="bill" aria-labelledby="bill-h">
      <div className="sec-head">
        <h2 id="bill-h">Your rates bill</h2>
        <p>
          Homes in Northern Ireland pay rates, not council tax, and there are no bands: the bill is your home&rsquo;s capital value times two rates. {council} sets
          the district rate and keeps it; the Northern Ireland Executive sets the regional rate, for its own services, such as schools, hospitals and
          roads.
        </p>
      </div>
      <div className="bill">
        <div className="bill-main">
          <div className="cv">
            <label htmlFor={`${id}-cv`}>Your home&rsquo;s capital value</label>
            <div className="cv-row">
              <span aria-hidden="true">£</span>
              <input
                id={`${id}-cv`}
                inputMode="numeric"
                autoComplete="off"
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-invalid={!ok || undefined}
                aria-describedby={`${id}-cv-note`}
              />
            </div>
            <p id={`${id}-cv-note`} className="small muted">
              {ok ? (
                typed === example.value.value ? (
                  <>
                    Starts on <Num f={example.value} fmt="gbp0" />, {example.label}.{" "}
                  </>
                ) : null
              ) : (
                <span className="warn">Type a value in pounds, such as 150,000. </span>
              )}
              Your rate bill gives your home&rsquo;s value; so does Land &amp; Property Services&rsquo;{" "}
              <a href="https://valuationservices.finance-ni.gov.uk/Property/Search" rel="noopener">
                property search
              </a>
              . It is what the home would have sold for in {valuationYear}, not today.
            </p>
          </div>
          <div>
            <div className="muted small">
              {yearLabel}
              {lone ? ", with Lone Pensioner Allowance" : ""}
            </div>
            <div className="big" aria-live="polite">
              <Num f={total} fmt="gbp2" />
            </div>
            <div className="muted">
              <Num f={perMonth} fmt="gbp2" /> a month over <Num f={instalments} fmt="int" /> months
            </div>
            {capped ? (
              <p className="small muted">
                Value above <Num f={cap} fmt="gbp0" /> is not counted, so the bill is worked out on <Num f={cap} fmt="gbp0" />.
              </p>
            ) : null}
          </div>
          <label className="check">
            <input type="checkbox" checked={lone} onChange={(e) => setLone(e.target.checked)} />
            <span>
              I am {allowanceAge} or over and live alone (Lone Pensioner Allowance, <Num f={allowance} fmt="share0" /> off, if you apply)
            </span>
          </label>
          <div className="split">
            <div className="barline" aria-hidden="true">
              <i style={{ width: `${pc}%`, background: "var(--fund)" }} />
              <i style={{ width: `${100 - pc}%`, background: "var(--gla)" }} />
            </div>
            <div className="legend2">
              <span className="sw" style={{ background: "var(--fund)" }} />
              <span>{council}: district rate</span>
              <span className="amt">
                <Num f={district} fmt="gbp2" />
              </span>
              <span className="sw" style={{ background: "var(--gla)" }} />
              <span>Northern Ireland Executive: regional rate</span>
              <span className="amt">
                <Num f={regional} fmt="gbp2" />
              </span>
              <span className="sub">
                District rate <Num f={rates.district} fmt="p4" /> and regional rate <Num f={rates.regional} fmt="p4" /> in the pound of capital value.
              </span>
            </div>
          </div>
          <div className="qrow">
            <QualityGroup q={worst(rates.district.quality, rates.regional.quality)} text={`District and regional rates for ${yearLabel}`} />
            <QualityGroup q="modelled" text="Your bill: our arithmetic on those rates" />
          </div>
        </div>
        <div>
          <h3 style={{ marginBottom: 14 }}>
            Your <Num f={district} fmt="gbp2" /> to the council pays for
          </h3>
          <div className="rows">
            {shares.map((s) => (
              <div className="row" key={s.id}>
                <span>{s.label}</span>
                <span className="v">
                  <Num f={s.share} fmt="gbp0" />
                </span>
                <div className="track" aria-hidden="true">
                  <i style={{ width: `${((s.f.value / max) * 100).toFixed(1)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <ChartTable summary="Show your bill as a table">
            <DataTable
              caption={`Rates on a capital value of £${value.value.toLocaleString("en-GB")}, ${yearLabel}${lone ? ", with Lone Pensioner Allowance" : ""}`}
              head={["", "Your bill", "Share"]}
              rows={[
                ...shares.map((s) => ({
                  key: s.id,
                  cells: [s.label, <Num key="v" f={s.share} fmt="gbp2" />, <Num key="p" f={derive(s.share.value / total.value, s.share, total)} fmt="share1" />],
                })),
                { key: "district", cells: [`${council}, district rate`, <Num key="v" f={district} fmt="gbp2" />, <Num key="p" f={derive(b.district / b.total, district, total)} fmt="share1" />] },
                {
                  key: "regional",
                  cells: ["Northern Ireland Executive, regional rate", <Num key="v" f={regional} fmt="gbp2" />, <Num key="p" f={derive(b.regional / b.total, regional, total)} fmt="share1" />],
                },
              ]}
              foot={["Your bill", <Num key="v" f={total} fmt="gbp2" />, "100%"]}
            />
          </ChartTable>
          <p className="small muted" style={{ marginTop: 14 }}>
            Split in proportion to what the council spends from rates and government grants, <Num f={budget} fmt="m0" />, after its own fees, charges and other grants.
            The council does not run schools, care, roads, housing or libraries: in Northern Ireland the Executive does, and the regional rate helps pay for them.
          </p>
          <p className="small muted">
            Help with rates is by application: Lone Pensioner Allowance, Disabled Persons Allowance for an adapted home, and rate relief or a rate rebate on a low
            income.
          </p>
        </div>
      </div>
    </section>
  );
}
