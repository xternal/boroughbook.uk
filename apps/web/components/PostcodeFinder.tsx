"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { DecoderIndex } from "@borough-ledger/schema";
import index from "../../../data/build/council_tax_decoder_index.json";
import { YOUR_WARD_KEY, loadPlaces, lookupPlace, type PlaceLookup, type YourWard } from "@/lib/wardFinder";

/** Every English council's decoded bill, for a postcode in a council without a full page yet. */
// Checked against the DecoderIndex schema in test/wards.test.ts; parsing it here would ship zod to every reader.
const DECODED = (index as unknown as DecoderIndex).councils;

/** Postcode to ward, in any borough on the site. The postcode goes to the site's own lookup (app/api/postcode), which asks postcodes.io and keeps nothing; it never reaches the address bar (docs/PRIVACY.md). On a council's page (here), a postcode in another council opens
 *  that council's page at the top, and the ward it found is kept for this tab so the page can say "your ward"; a postcode
 *  in this council opens its ward. */
export function PostcodeFinder({
  covered,
  example,
  compact = false,
  here,
  label = "Find your ward and councillors",
}: {
  covered: string;
  example: string;
  compact?: boolean;
  here?: string;
  label?: string;
}) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlaceLookup | null>(null);

  const elsewhere = (r: PlaceLookup): r is Extract<PlaceLookup, { kind: "ward" }> & { placeHref: string } =>
    r.kind === "ward" && !!here && r.place !== here && !!r.placeHref;
  const message = (r: PlaceLookup) => {
    switch (r.kind) {
      case "ward":
        return `${r.postcode} is in ${r.name} ${r.word ?? "ward"}, ${r.place}. Opening ${elsewhere(r) ? r.place : "it"}…`;
      case "council":
        return `${r.postcode} is in ${r.place}. Opening its page…`;
      case "elsewhere":
        return `${r.postcode} is in ${r.district}. BoroughBook.UK covers ${covered} so far.`;
      case "invalid":
        return `That does not look like a full postcode, such as ${example}.`;
      case "not_found":
        return "We could not find that postcode. Check it and try again.";
      case "error":
        return "The postcode service did not answer. Try again in a moment.";
    }
  };

  return (
    <form
      className={compact ? "finder finder-compact" : "finder"}
      role="search"
      aria-label="Find your ward by postcode"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        // The wards list loads alongside the postcode lookup; a failure to load it reads as "the service did not answer".
        const places = loadPlaces();
        places.catch(() => {});
        const r = await lookupPlace(value, places);
        setResult(r);
        setBusy(false);
        if (elsewhere(r)) {
          try {
            sessionStorage.setItem(YOUR_WARD_KEY, JSON.stringify({ place: r.place, name: r.name, href: r.href, ...(r.word ? { word: r.word } : {}) } satisfies YourWard));
          } catch {
            // No storage (a private window): the page opens without the "your ward" line.
          }
          router.push(r.placeHref);
        } else if (r.kind === "ward" || r.kind === "council") router.push(r.href);
      }}
    >
      <label htmlFor={`${id}-pc`}>{label}</label>
      <div className="finder-row">
        <input
          id={`${id}-pc`}
          name="postcode"
          type="text"
          autoComplete="postal-code"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={`Postcode, such as ${example}`}
          maxLength={10}
          value={value}
          onFocus={() => loadPlaces().catch(() => {})}
          onChange={(e) => {
            setValue(e.target.value);
            setResult(null);
          }}
          aria-describedby={`${id}-msg ${id}-note`}
        />
        <button type="submit" className="btn" aria-disabled={busy || undefined} disabled={busy}>
          {busy ? "Finding…" : "Find"}
        </button>
      </div>
      <p id={`${id}-msg`} className={result && result.kind !== "ward" && result.kind !== "council" ? "finder-msg warn" : "finder-msg"} aria-live="polite">
        {result ? message(result) : null}
        {result?.kind === "elsewhere" && result.ons && DECODED[result.ons] ? (
          <>
            {" "}
            <a href={`/council-tax/${DECODED[result.ons]![0]}`}>See where your council tax goes in {DECODED[result.ons]![1]}</a>.
          </>
        ) : null}
      </p>
      <p id={`${id}-note`} className="finder-note">
        Looked up through our own server with postcodes.io. Your postcode is never kept or logged, and postcodes.io never sees who you are.
      </p>
    </form>
  );
}
