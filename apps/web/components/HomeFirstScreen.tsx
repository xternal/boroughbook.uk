import { Updated } from "./Updated";
import { homeUpdated } from "@/lib/updated";
import { formatDay } from "@/lib/format";
import { logbook, statusCounts, watchTiles, type LogEntry, type WatchPick } from "@/lib/home";
import type { PageModel, PromiseModel } from "@/lib/model";
import { sectionHref } from "@/lib/nav";
import { STATUS_LABEL } from "@/lib/promises";
import { ALLOW_TEST_DATA } from "@/lib/quality";
import { shorten } from "@/lib/rss";
import { isPublished } from "@/lib/spotlight";
import { BalanceCard } from "./BalanceCard";
import { promisesTracked } from "./HomePromises";
import { HeroTop } from "./HeroTop";
import { Num } from "./Num";

/** The home page's first screen (the element id the tests and the page's own links use). */
export const FIRST_SCREEN_ID = "first-screen";

const TILES = [
  { key: "delivered", label: "Latest delivered", tone: "good", none: "No pledge has been delivered yet." },
  { key: "notMet", label: "Latest not met", tone: "bad", none: "No pledge has failed or been dropped yet." },
  { key: "dueNext", label: "Due next", tone: "moved", none: "No open pledge has a deadline yet." },
  { key: "forward", label: "Latest step forward", tone: "new", none: "No pledge has moved into a plan, the budget or delivery yet." },
] as const;

const who = (p: PromiseModel) => (p.party ? `${p.actor}, ${p.party}` : p.partyShort);

/** The year's figures: the bill, the budget, what council tax pays, the savings, the reserves and who runs the council. */
export function Kpis({ m }: { m: PageModel }) {
  const { bill, place, balance } = m;
  const kpis: { l: string; v: React.ReactNode; s: React.ReactNode }[] = [
    { l: "Band D bill", v: <Num f={bill.total} fmt="gbp0" />, s: <>up <Num f={bill.risePct} fmt="pct1" /> on last year</> },
    { l: "Council budget", v: <Num f={m.netBudget} fmt="m0" />, s: "day-to-day, including schools" },
    { l: "Paid by council tax", v: <Num f={m.ctShare} fmt="share0" />, s: <><Num f={m.funding.find((f) => f.id === "council_tax")!.f} fmt="m1" /> a year</> },
    { l: "Savings this year", v: <Num f={m.savingsThisYear} fmt="m1" />, s: `to balance ${place.yearLabel}` },
    { l: "Reserves", v: <Num f={balance.reservesGeneral} fmt="m0" />, s: <>safe minimum <Num f={balance.reservesMin} fmt="m0" /></> },
    { l: "Council control", v: m.politics.control, s: <><Num f={m.politics.seats} fmt="int" /> of <Num f={m.politics.totalSeats} fmt="int" /> seats</> },
  ];
  return (
    <div className="kpis">
      {kpis.map((k) => (
        <div className="kpi" key={k.l}>
          <div className="l">{k.l}</div>
          <div className="v">{k.v}</div>
          <div className="s">{k.s}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * The first screen (Pavel, 23 Oct 2026; docs/PRE_SHIP_REVIEW.md, "A short menu and a first screen of cards"): a
 * one-line headline, the year's figures, the promises at a glance, Balance it, your postcode, four promises to watch and
 * the logbook. Every number comes from the data with its source, every card links on, and the promise tiles and the
 * logbook are picked by fixed rules (lib/home.ts). Inside the page's LedgerStateProvider, so Balance it here and the
 * full tool further down share the reader's choices.
 */
export function HomeFirstScreen({ m }: { m: PageModel }) {
  const { place } = m;
  const published = m.promises.some(isPublished);
  const counts = statusCounts(m.promises);
  const tiles = watchTiles(m.promises, m.today);
  const log = logbook(m.promises, m.today);
  const total = m.promises.length;
  return (
    <div className="fs" id={FIRST_SCREEN_ID}>
      <div className="fs-title">
        <h1>
          Where <Num f={m.netBudget} fmt="m0" /> of council money goes in {place.short}
          {published ? <>, and {total} promises to watch</> : null}
        </h1>
        <p>
          {place.yearLabel}, from the council&rsquo;s own budget and spend files. <Updated date={homeUpdated(m.promises)} />
        </p>
      </div>

      <Kpis m={m} />

      <div className="fs-row3">
        {published ? (
          <section aria-labelledby="fs-promises-h" className="fs-card">
            <div className="fs-head">
              <h2 id="fs-promises-h">
                <a href={sectionHref("promises")}>{promisesTracked(total)}</a>
              </h2>
              <span>from every party on the council</span>
            </div>
            <div aria-hidden="true" className="fs-bar">
              {counts.map((c) => (
                <span key={c.status} className={`st-${c.status}`} style={{ flexGrow: c.count }} />
              ))}
            </div>
            <ul className="fs-counts" aria-label="Where they stand">
              {counts.map((c) => (
                <li key={c.status}>
                  <i aria-hidden="true" className={`st-${c.status}`} />
                  <b className="num">{c.count}</b> {STATUS_LABEL[c.status].toLowerCase()}
                </li>
              ))}
            </ul>
            <a className="fs-more" href={sectionHref("promises")}>
              All promises, by party, status or topic <span aria-hidden="true">&rarr;</span>
            </a>
          </section>
        ) : null}

        <BalanceCard balance={m.balance} place={place} />

        <section aria-label="Your council and ward" className="fs-card fs-ward">
          <HeroTop current={place.short} council={`${place.short} Council`} example="W6 9JU">
            {m.hasTestData && ALLOW_TEST_DATA ? <span className="tagline">Prototype with test data. Figures underlined in red are invented.</span> : null}
          </HeroTop>
          <a className="fs-more" href={sectionHref("ward")}>
            Every ward and its councillors <span aria-hidden="true">&rarr;</span>
          </a>
        </section>
      </div>

      {published ? (
        <section aria-label="Promises to watch" className="fs-tiles">
          {TILES.map((t) => (
            <Tile key={t.key} label={t.label} tone={t.tone} none={t.none} pick={tiles[t.key]} date={t.key === "dueNext" ? "due" : "on"} />
          ))}
        </section>
      ) : null}

      <section aria-labelledby="fs-log-h" className="fs-card fs-log">
        <div className="fs-head">
          <h2 id="fs-log-h">
            Logbook <span>added, moved, reworded or checked, newest first</span>
          </h2>
          <a href="/follow">
            Follow every change <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
        <ol>
          {log.map((l, i) => (
            <LogRow key={`${l.date}-${i}`} l={l} />
          ))}
        </ol>
      </section>
    </div>
  );
}

/** One promise to watch: its rule's name, the pledge, and who made it and when; or, when the rule finds none, that it found none. */
function Tile({ label, tone, none, pick, date }: { label: string; tone: string; none: string; pick: WatchPick | null; date: "on" | "due" }) {
  if (!pick)
    return (
      <div className="fs-card fs-tile fs-tile-none">
        <span className={`fs-tag t-${tone}`}>{label}</span>
        <span className="fs-quiet">{none}</span>
      </div>
    );
  const p = pick.card;
  return (
    <a className="fs-card fs-tile" href={`/promise/${p.id}`}>
      <span className={`fs-tag t-${tone}`}>{label}</span>
      <span className="fs-tile-q">&ldquo;{shorten(p.text, 110)}&rdquo;</span>
      <span className="fs-quiet">
        {who(p)}, {date === "due" ? "due " : ""}
        {formatDay(pick.date)}
      </span>
    </a>
  );
}

function LogRow({ l }: { l: LogEntry }) {
  return (
    <li>
      <span className="fs-log-date">{formatDay(l.date)}</span>
      <span className={`fs-tag t-${l.tone}`}>{l.label}</span>
      <a href={l.href}>
        <span className="sr-only">{l.label}: </span>
        {l.text}
      </a>
    </li>
  );
}
