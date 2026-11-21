import type { Metadata, Viewport } from "next";
import { feedAlternate } from "@/lib/rss";
import localFont from "next/font/local";
import { JsonLd } from "@/components/JsonLd";
import { CONTACT, GOOGLE_SITE_VERIFICATION, INDEXABLE, MAKER, REPO, SITE, SITE_URL } from "@/lib/site";
import "./globals.css";

/** Geist, cut to Latin, punctuation and symbols (scripts/subset_font.py): 48 KB instead of the package's 70 KB, every
 *  weight and OpenType feature kept. Same settings as `geist/font/sans`, so the page looks the same. */
const GeistSans = localFont({
  src: "./fonts/Geist-Variable-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

/** Who runs the site, on every page: an independent project, never the council (CLAUDE.md invariant 5). */
const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.name,
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: SITE.description,
  email: CONTACT,
  founder: { "@type": "Person", name: MAKER.name, url: MAKER.url },
  sameAs: [REPO],
  areaServed: { "@type": "AdministrativeArea", name: "London Borough of Hammersmith & Fulham" },
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE.title,
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { canonical: "/", types: feedAlternate("/feed.xml", "BoroughBook.UK: everything new") },
  // Full previews and snippets: a quoted pledge or figure is the point of the site, always with its source on the page.
  robots: INDEXABLE
    ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 } }
    : { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "/",
    siteName: SITE.name,
    title: SITE.title,
    description: SITE.description,
  },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description },
  ...(GOOGLE_SITE_VERIFICATION ? { verification: { google: GOOGLE_SITE_VERIFICATION } } : {}),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#241F1A" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={GeistSans.variable}>
      <body>
        {children}
        <JsonLd data={ORGANIZATION} />
      </body>
    </html>
  );
}
