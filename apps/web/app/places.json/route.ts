import { PLACES } from "@/lib/places";

/** Every borough on the site with its wards, for the postcode finders. Served as one static file and fetched only when
 *  a reader looks a postcode up, so the list (about 100 KB) is not built into every page that has a finder. */
export const dynamic = "force-static";

export function GET() {
  return Response.json(PLACES);
}
