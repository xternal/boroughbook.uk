import { COUNCIL_UPDATED } from "@/lib/updated";
import type { Metadata } from "next";
import { BillPart } from "@/components/LedgerSections";
import { SectionPage } from "@/components/SectionPage";
import { buildModel } from "@/lib/model";
import { share } from "@/lib/share";
import { SITE } from "@/lib/site";
import { sectionJsonLd } from "@/lib/structured";

/** Rebuilt daily, like the home page it is part of. */
export const revalidate = 86400;

function words() {
  const m = buildModel();
  const name = `Your council tax bill in ${m.place.short}, ${m.place.yearLabel}`;
  const description = `Pick your council tax band to see your ${m.place.yearLabel} bill in ${m.place.short}: what you pay, how it splits between the council and the Mayor of London, and what your share pays for${m.ctOptions ? `, with the council's options for ${m.place.nextYearLabel}` : ""}. An independent project, not run by the council.`;
  return { m, name, description };
}

export function generateMetadata(): Metadata {
  const { name, description } = words();
  const title = `${name} | ${SITE.name}`;
  return { title, description, alternates: { canonical: "/bill" }, ...share("/bill", title, description) };
}

/** Your bill on its own: the band picker, the split and what it pays for, and next year's options for that band. */
export default function BillPage() {
  const { m, name, description } = words();
  return (
    <SectionPage m={m} section="bill" updated={COUNCIL_UPDATED} jsonLd={sectionJsonLd("/bill", name, description)}>
      <BillPart m={m} view="own" />
    </SectionPage>
  );
}
