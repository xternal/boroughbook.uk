/* A council's councillors, area by area, with how each voted where the counts are published: the same for every council
   beyond Hammersmith & Fulham. Councillors represent wards, or in Northern Ireland district electoral areas ("areas"). */
import type { BoroughPeople, WardMap } from "@borough-ledger/schema";
import type { Borough } from "@/lib/boroughs";
import { formatDay, formatMonthYear } from "@/lib/format";
import { Num } from "./Num";

/** What the councillors part needs to know about the council's page. */
type Place = { place: { short: string }; b: Borough };

/** A borough's wards drawn from the ONS boundaries; each opens its part of the page. */
function BoroughMap({ m, P, map }: { m: Place; P: BoroughPeople; map: WardMap }) {
  const [w, h] = map.view_box;
  const byCode = new Map(P.wards.map((x) => [x.ons_code, x]));
  return (
    <figure className="wardmap">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Map of ${m.place.short} and its ${wordOf(m.b)}s`}>
        {map.wards.map((s) => {
          const ward = byCode.get(s.ons_code);
          return (
            <a key={s.ons_code} href={ward ? `#ward-${ward.id}` : undefined} tabIndex={-1}>
              <title>{ward?.name ?? s.ons_name}</title>
              <path d={s.path} className="wm" />
            </a>
          );
        })}
      </svg>
    </figure>
  );
}

/** Who runs the council: its elected mayor, or the party with more than half the seats. */
export function ControlKpi({ P }: { P: BoroughPeople }) {
  const control = P.parties.find((x) => x.id === P.control);
  const seats = P.councillors.length;
  const fig = (v: number) => ({ value: v, quality: "sourced" as const, sources: [P.sources[0]!.url] });
  const shortOf = new Map(P.parties.map((x) => [x.id, x.short]));
  return (P.mayor ? (
    <div className="kpi">
      <span className="l">Run by an elected mayor</span>
      <span className="v v-text">{shortOf.get(P.mayor.party_id) ?? P.mayor.party}</span>
      <span className="s">{P.mayor.name}</span>
    </div>
  ) : (
    <div className="kpi">
      <span className="l">Council control</span>
      <span className="v v-text">{control?.short ?? "No overall control"}</span>
      <span className="s">
        {control ? (
          <>
            <Num f={fig(control.seats)} fmt="int" /> of <Num f={fig(seats)} fmt="int" /> seats
          </>
        ) : (
          "no party has more than half the seats"
        )}
      </span>
    </div>
  )
  );
}

/** Every ward's councillors and how it voted, for a council whose councillors the site can read. */
export function Councillors({ m, P, map }: { m: Place; P: BoroughPeople; map: WardMap }) {
  const word = wordOf(m.b);
  const control = P.parties.find((x) => x.id === P.control);
  const seats = P.councillors.length;
  const fig = (v: number) => ({ value: v, quality: "sourced" as const, sources: [P.sources[0]!.url] });
  const shortOf = new Map(P.parties.map((x) => [x.id, x.short]));
  const thirds = P.wards.some((w) => w.election?.seats_total);
  const results = P.wards.some((w) => w.election);
  // Empty seats, where the last result gives each ward's number of seats.
  const vacant = results ? P.wards.reduce((a, w) => a + (w.election ? (w.election.seats_total ?? w.election.seats) : w.councillor_ids.length), 0) - seats : 0;
  const byId = new Map(P.councillors.map((c) => [c.id, c]));
  return (
    <section id="councillors" aria-labelledby="councillors-h">
      <div className="sec-head">
        <h2 id="councillors-h">{results ? `Councillors and how each ${word} voted` : "Councillors"}</h2>
        <p>
          {P.parties.map((x, i) => (
            <span key={x.id}>
              {i ? (i === P.parties.length - 1 ? " and " : ", ") : ""}
              {x.short} <Num f={fig(x.seats)} fmt="int" />
            </span>
          ))}{" "}
          of the <Num f={fig(seats)} fmt="int" /> councillors on the council&rsquo;s list
          {vacant > 0 ? (
            <>
              , with <Num f={fig(vacant)} fmt="int" /> {vacant === 1 ? "seat" : "seats"} empty
            </>
          ) : null}
          .{" "}
          {P.mayor ? (
            <>
              The council is run by its elected mayor, {P.mayor.name} ({shortOf.get(P.mayor.party_id) ?? P.mayor.party}), elected on {formatDay(P.election.date)}
              {P.mayor.votes ? (
                <>
                  {" "}
                  with <Num f={fig(P.mayor.votes)} fmt="int" /> votes
                </>
              ) : null}{" "}
              (<a href={P.mayor.result_url}>result</a>).{" "}
              {control ? `${control.short} has more than half the seats.` : "No party has more than half the seats."}
            </>
          ) : control ? (
            `${control.short} has more than half the seats, so runs the council.`
          ) : (
            "No party has more than half the seats."
          )}{" "}
          {thirds ? ` In May ${P.election.date.slice(0, 4)} one of each ward's seats was up for election; the ward's other councillors were elected in earlier years.` : ""}
          {P.councillors_from === "ballots"
            ? " The councillors are those elected in May, from the declarations: the council publishes no list we can read, so any change since is not shown."
            : ""}{" "}
          {m.b.voting === "stv" && m.b.areas === "dea" ? (
            <>
              {m.place.short}&rsquo;s councillors were elected in {formatMonthYear(P.election.date)} by single transferable vote, five to seven for each district
              electoral area, where voters number the candidates in order of choice; the next election is in {formatMonthYear(m.b.next_election ?? "")}. How each area
              voted is not shown yet: Democracy Club has the winners but not the counts. The list is the council&rsquo;s own, so it includes everyone who has taken a
              seat since: in Northern Ireland, when a councillor leaves, their party names who takes the seat, without a by-election.{" "}
            </>
          ) : m.b.voting === "stv" ? (
            <>
              {m.place.short}&rsquo;s councillors were elected in {formatMonthYear(P.election.date)} by single transferable vote, where voters number the candidates in
              order of choice; the next election is in {formatMonthYear(m.b.next_election ?? "")}. How each ward voted is not shown yet: Democracy Club has the winners
              but not the counts. The list is the council&rsquo;s own, so it includes everyone elected at by-elections since.{" "}
            </>
          ) : !results ? (
            <>
              {m.place.short}&rsquo;s councillors were elected in {formatMonthYear(P.election.date)}; the next election is in {formatMonthYear(m.b.next_election ?? "")}.
              How each ward voted is not shown: Democracy Club has only some of the counts. The list is the council&rsquo;s own, so it includes everyone elected at
              by-elections since.{" "}
            </>
          ) : null}
          {results && m.b.next_election ? (
            <>
              These are the results of the {formatMonthYear(P.election.date)} election; the next is in {formatMonthYear(m.b.next_election)}. Where a ward has held a
              by-election since, a winner no longer on the council&rsquo;s list is shown but not named.{" "}
            </>
          ) : null}
          {results ? <>Only the councillors elected are named here; everyone else stood as their party&rsquo;s candidate.</> : null}
        </p>
      </div>
      <div className="ward-page">
        <div>
          {P.wards.map((w) => {
            const e = w.election;
            const top = e ? Math.max(...e.candidates.map((c) => c.votes)) : 0;
            return (
              <section key={w.id} id={`ward-${w.id}`} aria-labelledby={`ward-${w.id}-h`} className="ward-sec">
                <h3 id={`ward-${w.id}-h`}>{w.name}</h3>
                <ul className="cllrs">
                  {w.councillor_ids.map((id) => {
                    const c = byId.get(id)!;
                    return (
                      <li key={id}>
                        <a href={c.democracy_url} rel="noopener">
                          {c.name}
                        </a>
                        <span className="muted">{shortOf.get(c.party) ?? c.party_name}</span>
                        {c.roles.length ? <span className="small muted block">{c.roles.join("; ")}</span> : null}
                      </li>
                    );
                  })}
                </ul>
                {e ? (
                  <details className="chart-table">
                    <summary>
                      How {w.name} voted{e.seats_total ? ` in May for ${e.seats === 1 ? "one" : e.seats} of its ${e.seats_total} seats` : ""}
                      {e.turnout_pct !== null ? (
                        <>
                          : turnout <Num f={fig(e.turnout_pct)} fmt="pct1" />
                        </>
                      ) : null}
                    </summary>
                    <div className="tablewrap votes">
                      <table>
                        <caption className="sr-only">Votes for each candidate in {w.name} {word}</caption>
                        <thead>
                          <tr>
                            <th scope="col">Party</th>
                            <th scope="col" className="n">
                              Votes
                            </th>
                            <th scope="col">Elected</th>
                          </tr>
                        </thead>
                        <tbody>
                          {e.candidates.map((c, i) => (
                            <tr key={i} className={c.elected ? "won" : undefined}>
                              <th scope="row">{c.party}</th>
                              <td className="n">
                                <span className="vbar" aria-hidden="true" style={{ width: `calc((100% - 80px) * ${(c.votes / top).toFixed(3)})` }} />
                                <Num f={fig(c.votes)} fmt="int" />
                              </td>
                              <td>{c.councillor_id ? byId.get(c.councillor_id)?.name : c.left ? <span className="muted">No longer on the council&rsquo;s list</span> : null}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="small muted">
                      {e.ballots !== null ? (
                        <>
                          <Num f={fig(e.ballots)} fmt="int" /> people voted.{" "}
                        </>
                      ) : (
                        "The declaration gave no turnout. "
                      )}
                      {e.rejected !== null ? (
                        <>
                          <Num f={fig(e.rejected)} fmt="int" /> ballot papers were rejected.{" "}
                        </>
                      ) : null}
                      From
                      the <a href={e.result_url}>council&rsquo;s declaration</a>, via <a href={e.dc_url}>Democracy Club</a> (CC BY-SA 4.0).
                    </p>
                  </details>
                ) : null}
              </section>
            );
          })}
        </div>
        <aside className="ward-aside">
          <BoroughMap m={m} P={P} map={map} />
          <p className="small muted">{map.source.attribution}</p>
        </aside>
      </div>
    </section>
  );
}

/** What the council's councillors represent: wards, or district electoral areas in Northern Ireland. */
export function wordOf(b: Borough): "ward" | "area" {
  return b.areas === "dea" ? "area" : "ward";
}
