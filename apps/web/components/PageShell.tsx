import type { PageModel } from "@/lib/model";
import { BudgetTabs } from "./BudgetTabs";
import { Footer } from "./Footer";
import { TopBar } from "./TopBar";
import { Updated } from "./Updated";

/** Top bar, independence notice (with the date the page last changed, where it has one) and footer for pages other than the main statement. */
export function PageShell({ m, updated, children }: { m: PageModel; updated?: string; children: React.ReactNode }) {
  return (
    <>
      <TopBar place={m.place.short} year={m.place.yearLabel} />
      <main className="wrap" id="top">
        <BudgetTabs />
        <div className="kicker page-kicker">
          <span>Independent project, not run by or affiliated with {m.place.short} Council</span>
          {updated ? <Updated date={updated} /> : null}
        </div>
        {children}
        <Footer council={m.place.short} hasTestData={m.hasTestData} />
      </main>
    </>
  );
}
