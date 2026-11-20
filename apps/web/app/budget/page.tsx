import { COUNCIL_UPDATED } from "@/lib/updated";
import type { Metadata } from "next";
import { BudgetPart } from "@/components/LedgerSections";
import { SectionPage } from "@/components/SectionPage";
import { buildModel } from "@/lib/model";
import { share } from "@/lib/share";
import { SITE } from "@/lib/site";
import { sectionJsonLd } from "@/lib/structured";

/** Rebuilt daily, like the home page it is part of. */
export const revalidate = 86400;

function words() {
  const m = buildModel();
  const name = `${m.place.short} Council's budget, ${m.place.yearLabel}`;
  const description = `Where ${m.place.short} Council's day-to-day money comes from (council tax, business rates, government grants) and what it pays for, service by service, with what everyday services and care for adults and children cost. From the council's own budget papers. An independent project, not run by the council.`;
  return { m, name, description };
}

export function generateMetadata(): Metadata {
  const { name, description } = words();
  const title = `${name}: where the money comes from and goes | ${SITE.name}`;
  return { title, description, alternates: { canonical: "/budget" }, ...share("/budget", title, description) };
}

/** The budget on its own, with the parts that sit under it on the home page: everyday services, care for adults and children. */
export default function BudgetPage() {
  const { m, name, description } = words();
  return (
    <SectionPage m={m} section="budget" updated={COUNCIL_UPDATED} jsonLd={sectionJsonLd("/budget", name, description)}>
      <BudgetPart m={m} view="own" />
    </SectionPage>
  );
}
