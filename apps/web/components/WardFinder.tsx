"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { loadPlaces, lookupPlace, type PlaceLookup } from "@/lib/wardFinder";

/** Postcode to ward, in any borough on the site. The postcode goes to the site's own lookup (app/api/postcode), which asks
 *  postcodes.io and keeps nothing; it never reaches the address bar. */
export function WardFinder({ covered }: { covered: string }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlaceLookup | null>(null);

  const message = (r: PlaceLookup) => {
    switch (r.kind) {
      case "ward":
        return `${r.postcode} is in ${r.name} ward, ${r.place}. Opening it…`;
      case "council":
        return `${r.postcode} is in ${r.place}. Opening its page…`;
      case "elsewhere":
        return `${r.postcode} is in ${r.district}. BoroughBook.UK covers ${covered} so far; your own council's website lists your councillors.`;
      case "invalid":
        return "That does not look like a full postcode, such as W6 9JU.";
      case "not_found":
        return "We could not find that postcode. Check it, or pick your ward from the list.";
      case "error":
        return "The postcode service did not answer. Pick your ward from the list instead.";
    }
  };

  return (
    <form
      className="finder"
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
        if (r.kind === "ward" || r.kind === "council") router.push(r.href);
      }}
    >
      <label htmlFor={`${id}-pc`}>Your postcode</label>
      <div className="finder-row">
        <input
          id={`${id}-pc`}
          name="postcode"
          type="text"
          autoComplete="postal-code"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="W6 9JU"
          maxLength={10}
          value={value}
          onFocus={() => loadPlaces().catch(() => {})}
          onChange={(e) => {
            setValue(e.target.value);
            setResult(null);
          }}
          aria-describedby={`${id}-note ${id}-msg`}
        />
        <button type="submit" className="btn" aria-disabled={busy || undefined} disabled={busy}>
          {busy ? "Finding…" : "Find my ward"}
        </button>
      </div>
      <p id={`${id}-msg`} className={result && result.kind !== "ward" && result.kind !== "council" ? "finder-msg warn" : "finder-msg"} aria-live="polite">
        {result ? message(result) : null}
      </p>
      <p id={`${id}-note`} className="small muted">
        Your postcode goes to our own server, which asks postcodes.io, a free public service, for the ward. Nothing is kept or logged, and postcodes.io never sees who you are.
      </p>
    </form>
  );
}
