import { formatDay } from "@/lib/format";

/** "Updated 17 November 2026", machine-readable for search engines and AI tools that weigh how fresh a page is. */
export function Updated({ date }: { date: string }) {
  return (
    <span className="updated">
      Updated <time dateTime={date}>{formatDay(date)}</time>
    </span>
  );
}
