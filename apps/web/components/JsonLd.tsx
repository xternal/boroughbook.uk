const PAGE_TYPES = new Set(["WebPage", "CollectionPage", "Article", "Dataset", "WebSite"]);

/** Adds dateModified to the first page-like node that lacks one, so the date shown on the page is in its JSON-LD too. */
export function withModified(data: unknown, modified: string | undefined): unknown {
  if (!modified) return data;
  const nodes = Array.isArray(data) ? data : [data];
  const i = nodes.findIndex((n) => n && typeof n === "object" && PAGE_TYPES.has((n as { "@type"?: string })["@type"] ?? "") && !("dateModified" in n));
  if (i < 0) return data;
  const out = nodes.map((n, j) => (j === i ? { ...(n as object), dateModified: modified } : n));
  return Array.isArray(data) ? out : out[0];
}

/** Structured data for search engines. `<` is escaped so text from content cannot close the script tag. */
export function JsonLd({ data, modified }: { data: unknown; modified?: string }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(withModified(data, modified)).replace(/</g, "\\u003c") }} />;
}
