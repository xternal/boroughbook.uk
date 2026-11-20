import { JsonLd } from "@/components/JsonLd";
import { breadcrumbs } from "@/lib/structured";
import type { Metadata } from "next";
import { EmailFollow } from "@/components/EmailFollow";
import { PageShell } from "@/components/PageShell";
import { consentForForm, EMAIL_ALERTS } from "@/lib/follow";
import { buildModel } from "@/lib/model";
import { feedAlternate } from "@/lib/rss";
import { SITE } from "@/lib/site";
import { wardsOf } from "@/lib/wards";
import { share } from "@/lib/share";

const title = `Follow changes${EMAIL_ALERTS ? "" : " by RSS"} | ${SITE.name}`;
const description =
  "Follow Hammersmith & Fulham's pledges, wards, councillors and council payments by RSS: no account, no email, and nobody knows who follows.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/follow", types: feedAlternate("/feed.xml", `${SITE.name}: everything new`) },
  ...share("/follow", title, description),
};

export default function FollowPage() {
  const m = buildModel();
  const wards = wardsOf(m);
  return (
    <PageShell m={m}>
      <div className="hero">
        <h1>Follow changes</h1>
        <p className="lede">
          Every pledge, ward and councillor has a feed. Copy a feed&rsquo;s address into a feed reader and it tells you when something changes: a pledge is
          budgeted or misses its deadline, a party replies, or a new month of payments arrives.
        </p>
      </div>

      <section aria-labelledby="how-h" className="ward-sec">
        <h2 id="how-h">How it works</h2>
        <p>
          A feed reader checks these addresses for you, a few times a day. Free ones include Feedly, Inoreader and NetNewsWire, and Outlook and Thunderbird can
          follow feeds too. You need no account here and give us no email address, and we cannot see who follows anything.
        </p>
      </section>

      {EMAIL_ALERTS ? (
        <section aria-labelledby="email-h" className="ward-sec">
          <h2 id="email-h">By email</h2>
          <p>
            Prefer email? Ask for one when any pledge changes, or use the form on a pledge&rsquo;s page to follow just that one. We send at most one email a day, and
            every email has a link to stop.
          </p>
          <EmailFollow target={{ kind: "all", id: "*" }} consent={consentForForm()} heading="An email when any pledge changes. No account needed." />
        </section>
      ) : null}

      <section aria-labelledby="feeds-h" className="ward-sec">
        <h2 id="feeds-h">Feeds</h2>
        <ul className="feeds">
          <li>
            <a href="/feed.xml">Everything new</a> <span className="muted small">pledges, replies and each month of payments</span>
          </li>
          <li>
            <a href="/promises/feed.xml">Every pledge</a> <span className="muted small">new cards, status changes, deadlines and replies, for every party alike</span>
          </li>
          <li>
            <a href="/decisions/feed.xml">Council decisions</a> <span className="muted small">every Cabinet and Full Council decision, with the pledges it moves</span>
          </li>
          <li>
            <a href="/payments/feed.xml">Payments over £500</a> <span className="muted small">one item for each month of the council&rsquo;s spend files</span>
          </li>
        </ul>
        <h3 className="small">Your ward</h3>
        <p className="small muted">Pledges about the ward, pledges by its councillors and building work the council pays for there.</p>
        <ul className="feeds feeds-wards">
          {wards.map((w) => (
            <li key={w.id}>
              <a href={`/ward/${w.id}/feed.xml`}>{w.name}</a>
            </li>
          ))}
        </ul>
        <p className="small muted">
          Each pledge and each councillor has a feed too: look for &ldquo;Follow by RSS&rdquo; on <a href="/promises">a pledge&rsquo;s page</a> or{" "}
          <a href="/wards">a councillor&rsquo;s page</a>.
        </p>
      </section>
      <JsonLd data={breadcrumbs([["Home", "/"], ["Follow changes", "/follow"]])} />
    </PageShell>
  );
}
