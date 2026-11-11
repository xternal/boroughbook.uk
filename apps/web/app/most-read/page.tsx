import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { format } from "@/lib/format";
import { buildModel } from "@/lib/model";
import { getViews, MOST_READ_TITLE, pageLabel } from "@/lib/mostRead";
import { share } from "@/lib/share";
import { SITE, SITE_URL } from "@/lib/site";
import { MOST_READ_PATH, MOST_READ_TOP, MOST_READ_WINDOWS, topPages, totalViews, VIEWS_PATH } from "@/lib/views";

/** Asks the counter again at most every ten minutes (VIEWS_CACHE_SECONDS). */
export const revalidate = 600;

const title = `${MOST_READ_TITLE} | ${SITE.name}`;
const description = `Which pages of ${SITE.name} readers open most, over the last 7 and 30 days. One count per page per day and nothing about the reader; the daily totals are public as JSON.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: MOST_READ_PATH },
  ...share(MOST_READ_PATH, title, description),
};

const views = (n: number) => `${format("int", n)} ${n === 1 ? "view" : "views"}`;

/**
 * /most-read: which pages readers open most, over the last 7 and 30 days, from the site's own count (one number per
 * page per day, nothing about the reader; lib/views.ts). The daily totals are public at /views.json.
 */
export default async function MostReadPage() {
  const m = buildModel();
  const state = await getViews();
  const file = state.kind === "ready" ? state.file : null;
  const longest = Math.max(...MOST_READ_WINDOWS);
  const total = file ? totalViews(file, longest) : 0;
  const pages = file ? topPages(file, longest).length : 0;

  return (
    <PageShell m={m}>
      <div className="hero">
        <h1>{MOST_READ_TITLE}</h1>
        {file && total > 0 ? (
          <p className="lede">
            {views(total)} in the last {longest} days, across {format("int", pages)} pages. We count one number per page per day, and nothing about who read it.
          </p>
        ) : (
          <p className="lede">
            {state.kind === "unavailable"
              ? "The count cannot be read just now. Try again in a few minutes."
              : state.kind === "not_connected"
                ? "Counting has not started here: this copy of the site has no counter connected, so nothing is counted."
                : "Counting has just started: the first readers' visits will show here within ten minutes."}
          </p>
        )}
        <p>
          The daily totals are public: <a href={VIEWS_PATH}>{VIEWS_PATH}</a>, the last 30 days by page, updated every ten minutes.
        </p>
      </div>

      {file && total > 0
        ? MOST_READ_WINDOWS.map((days) => {
            const top = topPages(file, days).slice(0, MOST_READ_TOP);
            const id = `last-${days}`;
            return (
              <section key={days} id={id} aria-labelledby={`${id}-h`} className="pay-section">
                <div className="sec-head">
                  <h2 id={`${id}-h`}>Last {days} days</h2>
                </div>
                <div className="tablewrap">
                  <table>
                    <caption className="sr-only">
                      The {top.length} most read pages over the last {days} days, with how many times each was opened
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" className="n">
                          Rank
                        </th>
                        <th scope="col">Page</th>
                        <th scope="col" className="n">
                          Views
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {top.map((p, i) => {
                        const label = pageLabel(p.path);
                        return (
                          <tr key={p.path}>
                            <td className="n muted">{i + 1}</td>
                            <td className="most-read-page">
                              <a href={p.path}>{label}</a>
                              {label !== p.path ? <span className="small muted block">{p.path}</span> : null}
                            </td>
                            <td className="n">{format("int", p.views)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })
        : null}

      <section id="how" aria-labelledby="how-h" className="ward-sec">
        <h2 id="how-h">How it is counted</h2>
        <ul>
          <li>
            Each time a reader opens one of the site&rsquo;s pages, that page&rsquo;s count for the day goes up by one. Days run midnight to midnight UTC;
            today&rsquo;s is still counting.
          </li>
          <li>
            Search engines and other crawlers, link previews, AI fetchers, scripts (including scripts that give a browser&rsquo;s name but do not behave like
            one) and pages a browser loads ahead of a click are not counted. Nor is any address that could hold something a reader typed, such as a postcode,
            or a link to the follow pages in our emails.
          </li>
          <li>
            The count keeps the page&rsquo;s address and the date, nothing else: no IP address, cookie, device, browser, country, referrer or time of day. It
            runs on our server, so there is no analytics script in your browser.
          </li>
          <li>
            The counts are kept by Upstash, which never sees anything about you. See the <a href="/privacy">privacy notice</a>.
          </li>
        </ul>
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: `${SITE.name}: page views per page per day`,
          description,
          url: `${SITE_URL}${MOST_READ_PATH}`,
          inLanguage: "en-GB",
          isAccessibleForFree: true,
          creator: { "@type": "Organization", name: SITE.name, url: SITE_URL },
          distribution: [{ "@type": "DataDownload", name: VIEWS_PATH, encodingFormat: "application/json", contentUrl: `${SITE_URL}${VIEWS_PATH}` }],
        }}
      />
    </PageShell>
  );
}
