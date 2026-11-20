import { COUNCIL_UPDATED } from "@/lib/updated";
import type { Metadata } from "next";
import { SectionPage } from "@/components/SectionPage";
import { Waterfall } from "@/components/Waterfall";
import { buildModel } from "@/lib/model";
import { share } from "@/lib/share";
import { SITE } from "@/lib/site";
import { sectionJsonLd } from "@/lib/structured";

/** Rebuilt daily, like the home page it is part of. */
export const revalidate = 86400;

function words() {
  const m = buildModel();
  const name = `How this year's budget gap opened and closed in ${m.place.short}, ${m.place.yearLabel}`;
  const description = `Each year a council's costs rise faster than its funding, and by law it must close the gap before the year starts. How the gap in ${m.place.short} Council's ${m.place.yearLabel} budget opened, and how the council closed it, saving by saving. From the council's budget report. An independent project, not run by the council.`;
  return { m, name, description };
}

export function generateMetadata(): Metadata {
  const { name, description } = words();
  const title = `${name} | ${SITE.name}`;
  return { title, description, alternates: { canonical: "/gap" }, ...share("/gap", title, description) };
}

/** The gap on its own: what opened it, and the council tax, savings and reserves that closed it. */
export default function GapPage() {
  const { m, name, description } = words();
  return (
    <SectionPage m={m} section="gap" updated={COUNCIL_UPDATED} jsonLd={sectionJsonLd("/gap", name, description)}>
      <Waterfall m={m} view="own" />
    </SectionPage>
  );
}
