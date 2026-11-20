import { JsonLd } from "@/components/JsonLd";
import { breadcrumbs } from "@/lib/structured";
import type { Metadata } from "next";
import { CONFIRM_TTL_DAYS, DELIVERY_KEEP_DAYS } from "@borough-ledger/server/follow";
import { loadConfig } from "@borough-ledger/server";
import { PageShell } from "@/components/PageShell";
import { EMAIL_ALERTS } from "@/lib/follow";
import { buildModel } from "@/lib/model";
import { CONTACT, MAKER, SITE } from "@/lib/site";
import { share } from "@/lib/share";

const title = `Privacy | ${SITE.name}`;
const description = `What ${SITE.name} keeps about you: nothing when you read the site (we only count how often each page is opened), and for email alerts only your encrypted address and the pledges you follow.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/privacy" },
  ...share("/privacy", title, description),
};

/** The privacy notice. The email section appears only when the site sends email, and names who holds the data then. */
export default function PrivacyPage() {
  const m = buildModel();
  const controller = EMAIL_ALERTS ? loadConfig().controller : null;
  return (
    <PageShell m={m}>
      <div className="hero">
        <h1>Privacy</h1>
        <p className="lede">
          You can read every page, work out your bill and share anything without an account, and we keep nothing about you when you do.
          {EMAIL_ALERTS ? " If you ask for email alerts, we keep your address, encrypted, and the pledges you follow, until you stop." : ""}
        </p>
      </div>

      <section aria-labelledby="who-h" className="ward-sec">
        <h2 id="who-h">Who we are</h2>
        <p>
          {SITE.name} is an independent project made by {MAKER.name}. It is not run by any council or party.{" "}
          {controller ? `${controller} holds the data described here and is responsible for it (the controller, in the words of UK data protection law).` : ""} Write to{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a> about anything on this page.
        </p>
      </section>

      <section aria-labelledby="read-h" className="ward-sec">
        <h2 id="read-h">Reading the site</h2>
        <ul>
          <li>No account, no cookies, no analytics scripts and no advertising.</li>
          <li>
            We count how often each page is opened: one number per page per day, with nothing about who opened it (no IP address, device, browser, country or
            time of day). Search engines, link previews and an address that could hold something you typed are never counted. The counts are kept by Upstash,
            which sees only a page&rsquo;s address and the date, and they are public on <a href="/most-read">Most read pages</a>.
          </li>
          <li>The bill calculator and the balance-it tool run in your browser. Your band, discounts and choices are never sent to us.</li>
          <li>
            The postcode boxes send your postcode to our own server, which asks postcodes.io, a free service using official data, and passes back only your council and ward. Your postcode is never kept or logged, and postcodes.io never
            sees who you are.
          </li>
          <li>
            Make your case drafts a letter in your browser from what you choose and write. We never see it and nothing is stored or counted: you copy it, or open it in
            your own email app, or paste it into WriteToThem (a free service run by the charity mySociety), which sends it for you under its own privacy policy.
          </li>
          <li>Vercel, which serves the site, keeps standard request logs (including IP addresses) for a short time to run and protect it.</li>
          <li>RSS feeds are plain files: nobody is recorded as following anything.</li>
        </ul>
      </section>

      <section aria-labelledby="email-h" className="ward-sec">
        <h2 id="email-h">Email alerts</h2>
        {EMAIL_ALERTS ? (
          <>
            <p>
              You can ask for an email when a pledge changes. What you follow can reveal your political opinions, so we treat it as sensitive data and ask for your
              explicit consent first. We use your address only to send these alerts.
            </p>
            <ul>
              <li>
                <b>What we keep:</b> your email address, encrypted, a one-way code to find it, the pledges you follow, when you agreed and to which wording, and
                which alerts we have sent you. Nothing else: no name, no IP address, no tracking in our emails.
              </li>
              <li>
                <b>For how long:</b> until you stop. A sign-up nobody confirms is deleted after {CONFIRM_TTL_DAYS} days. Records of which alerts we sent are deleted after{" "}
                {DELIVERY_KEEP_DAYS} days.
              </li>
              <li>
                <b>Who else handles it:</b> Resend, which delivers our emails and so sees your address and each alert, and Neon, which hosts our database in its London
                region. Neither may use it for anything else.
              </li>
              <li>
                <b>Spam checks:</b> the form solves a small puzzle in your browser instead of a third-party check. To stop floods of sign-ups we count requests per
                connection for one day, using a code that cannot be traced back to you once the day is over.
              </li>
              <li>
                <b>Your rights:</b> every email has a link to see what you follow, remove a pledge, or stop everything and delete your data at once. You can also write
                to us to see or delete what we hold, and complain to the Information Commissioner&rsquo;s Office at ico.org.uk.
              </li>
            </ul>
          </>
        ) : (
          <p>
            We do not offer email alerts yet, so we hold no email addresses. Follow pledges <a href="/follow">by RSS</a> instead.
          </p>
        )}
      </section>

      <section aria-labelledby="mail-h" className="ward-sec">
        <h2 id="mail-h">If you write to us</h2>
        <p>
          Emails to {CONTACT} are used only to check and make a correction or publish a reply you asked us to publish. A published reply shows its words, the
          sender&rsquo;s public role and the date, never an email address. We never add anyone to a mailing list from the inbox.
        </p>
      </section>

      <section aria-labelledby="names-h" className="ward-sec">
        <h2 id="names-h">People named on the site</h2>
        <p>
          We name only councillors, council officers and elected mayors, from official publications, in their public role. Payments to people are shown only as
          totals, and only candidates who were elected are named.
        </p>
      </section>
      <JsonLd data={breadcrumbs([["Home", "/"], ["Privacy", "/privacy"]])} />
    </PageShell>
  );
}
