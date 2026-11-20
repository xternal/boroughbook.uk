import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { FAMILY, THIS_SITE } from "@/lib/family";
import { buildModel } from "@/lib/model";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `Page not found | ${SITE.name}`,
  description: `There is no page at this address on ${SITE.name}. Start from the home page or the promises, or visit another site of the family.`,
  robots: { index: false, follow: true },
  // A missing page has no address of its own to point search engines at.
  alternates: { canonical: null },
};

/**
 * The 404 page, the same on every site of the family (Pavel, 23 Oct 2026): a calm "this page isn't here", the ways back
 * into this site, and the six sites of the family as cards, from the switcher's own FAMILY list and in its order.
 * Server-rendered, no JavaScript. Next.js answers it with HTTP status 404.
 */
export default function NotFound() {
  return (
    <PageShell m={buildModel()}>
      <div className="hero">
        <h1>{"This page isn't here"}</h1>
        <p className="lede">The link may be old or mistyped.</p>
        <p className="nf-links">
          <a href="/">The home page</a>
          <a href="/promises">The promises</a>
        </p>
        <p className="nf-more">
          Or start from <a href="/bill">your council tax bill</a>, <a href="/budget">the budget</a> or the <a href="/payments">payments over £500</a>.
        </p>
      </div>
      <section className="nf-family" aria-labelledby="nf-family-h">
        <h2 id="nf-family-h">The family</h2>
        <p>Public money and promises, one ledger per country or place, on the same open engine.</p>
        <ul>
          {FAMILY.map((s) => {
            const here = s.name === THIS_SITE;
            return (
              <li key={s.name}>
                <a href={here ? "/" : s.href} aria-current={here ? "page" : undefined}>
                  <b>{s.name}</b>
                  <span className="nf-domain">{here ? "You are here" : new URL(s.href).host}</span>
                  <span>{s.about}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    </PageShell>
  );
}
