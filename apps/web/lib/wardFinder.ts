/* Postcode to ward. The browser sends the postcode to this site's own route (app/api/postcode), in the body of a POST so
   it is in no address or request log; the server asks postcodes.io (a free, open service using ONS data), so postcodes.io
   never sees the reader, and hands back only the council and ward. The postcode is never kept or logged; only the ward
   found may be kept in the tab (YOUR_WARD_KEY, docs/PRIVACY.md). */

export const POSTCODE_LOOKUP = "/api/postcode";

export type FinderWard = { id: string; name: string; ons_code: string };

export type Lookup =
  | { kind: "ward"; id: string; name: string; postcode: string }
  | { kind: "elsewhere"; district: string; postcode: string }
  | { kind: "not_found" }
  | { kind: "invalid" }
  | { kind: "error" };

/** "w69ju" or "W6 9JU" → "W6 9JU". Whole postcodes only; null when it cannot be one. */
export function normalisePostcode(input: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/.test(s)) return null;
  return `${s.slice(0, -3)} ${s.slice(-3)}`;
}

type Result = { postcode?: string; admin_district?: string | null; codes?: { admin_ward?: string | null; admin_district?: string | null } } | null;

/** Reads one postcodes.io result: one of our wards, somewhere else, or not found. */
export function wardFromResult(result: Result, wards: readonly FinderWard[], councilCode: string): Lookup {
  if (!result) return { kind: "not_found" };
  const postcode = result.postcode ?? "";
  const ward = wards.find((w) => w.ons_code === result.codes?.admin_ward);
  if (ward && result.codes?.admin_district === councilCode) return { kind: "ward", id: ward.id, name: ward.name, postcode };
  return { kind: "elsewhere", district: result.admin_district ?? "another area", postcode };
}

export async function lookupWard(input: string, wards: readonly FinderWard[], councilCode: string, fetchImpl: typeof fetch = fetch): Promise<Lookup> {
  const postcode = normalisePostcode(input);
  if (!postcode) return { kind: "invalid" };
  try {
    const res = await fetchImpl(POSTCODE_LOOKUP, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcodes: [postcode] }),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    if (!res.ok) return { kind: "error" };
    const body = (await res.json()) as { result?: { result: Result }[] };
    return wardFromResult(body.result?.[0]?.result ?? null, wards, councilCode);
  } catch {
    return { kind: "error" };
  }
}

/* ------------------------------------------------------------------ every borough on the site */

/** The ward a postcode found, kept for this tab only (sessionStorage) so the council's page it opens can say "your ward".
 *  The postcode itself is never kept. */
export const YOUR_WARD_KEY = "bb:your-ward";
/** `word` is what the council's councillors represent: a ward, or in Northern Ireland a district electoral area ("area"). */
export type YourWard = { place: string; name: string; href: string; word?: string };

/** A borough the finder knows: its ONS code, its page and, for each ward, the page (or part of a page) to open. A council
 *  whose wards are not on the site yet has none, and its postcodes open its page. */
export type FinderPlace = { short: string; ons: string; href?: string; word?: string; wards: { name: string; ons_code: string; href: string }[] };

export type PlaceLookup =
  | { kind: "ward"; place: string; name: string; href: string; placeHref?: string; word?: string; postcode: string }
  | { kind: "council"; place: string; href: string; postcode: string }
  | { kind: "elsewhere"; district: string; postcode: string; ons?: string }
  | { kind: "not_found" }
  | { kind: "invalid" }
  | { kind: "error" };

/** Reads one postcodes.io result against every borough on the site. */
export function placeFromResult(result: Result, places: readonly FinderPlace[]): PlaceLookup {
  if (!result) return { kind: "not_found" };
  const postcode = result.postcode ?? "";
  const place = places.find((p) => p.ons === result.codes?.admin_district);
  const ward = place?.wards.find((w) => w.ons_code === result.codes?.admin_ward);
  if (place && ward)
    return { kind: "ward", place: place.short, name: ward.name, href: ward.href, ...(place.href ? { placeHref: place.href } : {}), ...(place.word ? { word: place.word } : {}), postcode };
  if (place?.href && !place.wards.length) return { kind: "council", place: place.short, href: place.href, postcode };
  return { kind: "elsewhere", district: result.admin_district ?? "another area", postcode, ...(result.codes?.admin_district ? { ons: result.codes.admin_district } : {}) };
}

/** Where the finders get every borough's wards (app/places.json): fetched on first use, not built into each page. */
export const PLACES_URL = "/places.json";

let placesOnce: Promise<readonly FinderPlace[]> | null = null;
/** The places list, fetched once per page view; a failed fetch is forgotten so the next try asks again. */
export function loadPlaces(fetchImpl: typeof fetch = fetch): Promise<readonly FinderPlace[]> {
  placesOnce ??= fetchImpl(PLACES_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`places ${r.status}`);
      return r.json() as Promise<FinderPlace[]>;
    })
    .catch((e: unknown) => {
      placesOnce = null;
      throw e;
    });
  return placesOnce;
}

export async function lookupPlace(
  input: string,
  places: readonly FinderPlace[] | Promise<readonly FinderPlace[]>,
  fetchImpl: typeof fetch = fetch,
): Promise<PlaceLookup> {
  const postcode = normalisePostcode(input);
  if (!postcode) return { kind: "invalid" };
  try {
    const res = await fetchImpl(POSTCODE_LOOKUP, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcodes: [postcode] }),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    if (!res.ok) return { kind: "error" };
    const body = (await res.json()) as { result?: { result: Result }[] };
    return placeFromResult(body.result?.[0]?.result ?? null, await places);
  } catch {
    return { kind: "error" };
  }
}
