/*
 * When each kind of page last changed, from the data itself: the date shown as "Updated" on the page, given as
 * dateModified in its JSON-LD and as lastmod in the sitemap. A page with no date it can trust (method, privacy,
 * payments) shows none: search engines and AI tools discount a date that changes on every build.
 */
import { DATA } from "@borough-ledger/schema";
import { DECISIONS } from "@/lib/decisions";
import type { PromiseModel } from "@/lib/model";
import { dateModified } from "@/lib/promiseText";
import { WARD_MAP } from "@/lib/wards";

/** The newest of some ISO dates, ignoring empty ones. */
export function latest(dates: readonly (string | undefined | null)[]): string | undefined {
  return dates.filter((d): d is string => !!d).sort().at(-1);
}

/** The council's money pages (bill, budget, gap, balance, building, council homes): the budget build's date. */
export const COUNCIL_UPDATED = DATA.council.meta.vintage;

export const promisesUpdated = (promises: readonly PromiseModel[]) => latest(promises.map(dateModified));

export const DECISIONS_UPDATED = latest([DECISIONS.decisions[0]?.date, ...DATA.content.decision_links.map((l) => l.suggested_on)]);

/** Wards and councillors: when the council's lists and the ward map were last read. */
export const peopleUpdated = (retrievedOn: string) => latest([retrievedOn, WARD_MAP.source.retrieved_on]);


/** The home page: the newest of the money, the promises and the decisions it summarises. */
export const homeUpdated = (promises: readonly PromiseModel[]) => latest([COUNCIL_UPDATED, promisesUpdated(promises), DECISIONS_UPDATED])!;
