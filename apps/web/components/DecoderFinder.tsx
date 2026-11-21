"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { DecoderIndex } from "@borough-ledger/schema";
import index from "../../../data/build/council_tax_decoder_index.json";
import { POSTCODE_LOOKUP, normalisePostcode } from "@/lib/wardFinder";

// Checked against the DecoderIndex schema in test/wards.test.ts; parsing it here would ship zod to every reader.
const COUNCILS = (index as unknown as DecoderIndex).councils;

/** Postcode to council, anywhere in England: the postcode goes to this site's own route, which asks postcodes.io and hands
    back only the council, and the page opens that council's decoded bill. The postcode is never kept, logged or put in an
    address, and postcodes.io never sees the reader (docs/PRIVACY.md). */
export function DecoderFinder({ example = "W6 9JU" }: { example?: string }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; warn: boolean } | null>(null);

  const find = async () => {
    const postcode = normalisePostcode(value);
    if (!postcode) {
      setMsg({ text: `That does not look like a full postcode, such as ${example}.`, warn: true });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(POSTCODE_LOOKUP, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postcodes: [postcode] }),
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store",
      });
      const body = (await res.json()) as { result?: { result: { admin_district?: string; codes?: { admin_district?: string } } | null }[] };
      const r = body.result?.[0]?.result;
      const council = r?.codes?.admin_district ? COUNCILS[r.codes.admin_district] : undefined;
      if (council) {
        setMsg({ text: `${postcode} is in ${council[1]}. Opening its bill…`, warn: false });
        router.push(`/council-tax/${council[0]}`);
        return;
      }
      setMsg(
        r
          ? { text: `${postcode} is in ${r.admin_district ?? "a council outside England"}. The decoder covers England; Scotland, Wales and Northern Ireland set their bills differently.`, warn: true }
          : { text: "We could not find that postcode. Check it and try again.", warn: true },
      );
    } catch {
      setMsg({ text: "The postcode service did not answer. Try again in a moment, or pick your council from the list.", warn: true });
    }
    setBusy(false);
  };

  return (
    <form
      className="finder"
      role="search"
      aria-label="Find your council by postcode"
      onSubmit={(e) => {
        e.preventDefault();
        void find();
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
          placeholder={`Postcode, such as ${example}`}
          maxLength={10}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMsg(null);
          }}
          aria-describedby={`${id}-msg ${id}-note`}
        />
        <button type="submit" className="btn" aria-disabled={busy || undefined} disabled={busy}>
          {busy ? "Finding…" : "Decode my bill"}
        </button>
      </div>
      <p id={`${id}-msg`} className={msg?.warn ? "finder-msg warn" : "finder-msg"} aria-live="polite">
        {msg?.text}
      </p>
      <p id={`${id}-note`} className="finder-note">
        Looked up through our own server with postcodes.io. Your postcode is never kept or logged, and postcodes.io never sees who you are.
      </p>
    </form>
  );
}
