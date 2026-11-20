import type { Scenario } from "@borough-ledger/engine";
import { nextSection, sectionHref, sectionLabel, type SectionId } from "@/lib/nav";
import type { PageModel } from "@/lib/model";
import { JsonLd } from "./JsonLd";
import { LedgerStateProvider } from "./LedgerState";
import { PageShell } from "./PageShell";

/**
 * A section's own page (/bill, /budget, /gap, /balance, /method): the section as it is on the home page, with the
 * reader's choices (band, Balance it) shared by whatever is on the page, in the shell every page has (top bar,
 * independence notice, footer), and the way on to the next section.
 */
export function SectionPage({
  m,
  section,
  initialScenario,
  jsonLd,
  updated,
  children,
}: {
  m: PageModel;
  section: SectionId;
  initialScenario?: Scenario;
  jsonLd: object | readonly object[];
  /** When the page's content last changed, shown on it and given as dateModified. */
  updated?: string;
  children: React.ReactNode;
}) {
  const next = nextSection(section);
  return (
    <PageShell m={m} updated={updated}>
      <LedgerStateProvider input={m.balance.input} initialScenario={initialScenario}>
        {children}
      </LedgerStateProvider>
      <nav className="read-on" aria-label="Read on">
        {next ? <a href={sectionHref(next)}>Next: {sectionLabel(next)}</a> : null}
        <a href="/">Everything on one page</a>
      </nav>
      <JsonLd data={jsonLd} modified={updated} />
    </PageShell>
  );
}
