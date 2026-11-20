import { homeUpdated } from "@/lib/updated";
import { BalancePart, BillPart, BudgetPart } from "@/components/LedgerSections";
import { Footer } from "@/components/Footer";
import { HomeFirstScreen } from "@/components/HomeFirstScreen";
import { HomePromises } from "@/components/HomePromises";
import { JsonLd } from "@/components/JsonLd";
import { LedgerStateProvider } from "@/components/LedgerState";
import { Method } from "@/components/Method";
import { Payments } from "@/components/Payments";
import { Promises } from "@/components/Promises";
import { TopBar } from "@/components/TopBar";
import { WardSection } from "@/components/WardSection";
import { Waterfall } from "@/components/Waterfall";
import { faq } from "@/lib/faq";
import type { PageModel } from "@/lib/model";
import { MAKER, SITE, SITE_URL } from "@/lib/site";

/**
 * The home page. First a screen of cards (HomeFirstScreen: the year's figures, the promises at a glance, Balance it,
 * your postcode, four promises to watch and the logbook; Pavel, 23 Oct 2026); then the whole statement on one long
 * page, the overview. Every section keeps its anchor, so an old /#bill link still opens here, and each section's
 * heading links to the section's own page (/bill, /budget, ...). The promises block comes straight after the first
 * screen (decision 30): the latest changes and what is due next, each a link to its card.
 */
export function LedgerPage({ m }: { m: PageModel }) {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      url: SITE_URL,
      description: SITE.description,
      inLanguage: "en-GB",
      creator: { "@type": "Person", name: MAKER.name, url: MAKER.url },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq(m.place.short).map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];
  return (
    <>
      <TopBar place={m.place.short} year={m.place.yearLabel} />
      <main className="wrap" id="top">
        <LedgerStateProvider input={m.balance.input}>
          <HomeFirstScreen m={m} />
          <HomePromises promises={m.promises} today={m.today} />
          <BillPart m={m} view="overview" />
          <BudgetPart m={m} view="overview" />
          <Waterfall m={m} view="overview" />
          <BalancePart m={m} view="overview" />
        </LedgerStateProvider>
        <Promises promises={m.promises} today={m.today} limit={6} view="overview" />
        <WardSection m={m} view="overview" />
        <Payments payments={m.payments} view="overview" />
        <Method m={m} view="overview" />
        <Footer council={m.place.short} hasTestData={m.hasTestData} />
      </main>
      <JsonLd data={jsonLd} modified={homeUpdated(m.promises)} />
    </>
  );
}
