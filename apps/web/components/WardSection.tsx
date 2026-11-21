import type { PageModel } from "@/lib/model";
import { COVERED } from "@/lib/places";
import { WardFinder } from "./WardFinder";
import { SecTitle, type SectionView } from "./SecTitle";

/** The home page's way in to the ward pages: who represents you, found by postcode. */
export function WardSection({ m, view }: { m: PageModel; view?: SectionView }) {
  const sizes = m.people.wards.map((w) => w.councillor_ids.length);
  const [lo, hi] = [Math.min(...sizes), Math.max(...sizes)];
  const per = lo === hi ? `${lo}` : `${lo} or ${hi}`;
  return (
    <section id="ward" aria-labelledby="ward-h">
      <div className="sec-head">
        <SecTitle id="ward-h" section="ward" view={view}>
          Your ward
        </SecTitle>
        <p>
          {m.place.short} has {m.people.wards.length} wards, each electing {per} councillors. Find yours to see who represents you, any pledges about your
          area and where to report street problems. Council tax is the same in every ward: only your band changes it. Or{" "}
          <a href="/wards">pick your ward on the map</a>.
        </p>
      </div>
      <WardFinder covered={COVERED} />
    </section>
  );
}
