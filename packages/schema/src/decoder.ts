/* The council tax decoder (etl/decoder.py): every English billing authority's Band D bill, split between the council,
   parish and town councils on average, and the major preceptors, for this year and last. */
import { z } from "zod";
import { Quality } from "./quality";
import { Source } from "./seed";

const gbp = z.number().min(0);
const Parts = z.object({ council: gbp, parish: gbp, county: gbp, police: gbp, fire: gbp, combined: gbp });
export type DecoderParts = z.infer<typeof Parts>;

export const DecoderFile = z.object({
  note: z.string(),
  year: z.string().regex(/^\d{4}-\d{2}$/),
  prev_year: z.string().regex(/^\d{4}-\d{2}$/),
  sources: z.array(Source).min(2),
  quality: Quality,
  source_id: z.string(),
  method_note: z.string(),
  councils: z
    .array(
      z.object({
        ons: z.string().regex(/^E0[6789]\d{6}$/),
        name: z.string(),
        /** The body that sets the council's own share: "Wigan Council", "the City of London Corporation". */
        council_name: z.string(),
        /** The place mid-sentence: "Wigan", "the City of London". */
        place: z.string(),
        slug: z.string().regex(/^[a-z0-9-]+$/),
        region: z.string(),
        kind: z.enum(["London borough", "metropolitan borough", "unitary council", "district council"]),
        parts: Parts,
        total: gbp,
        prev_parts: Parts,
        prev_total: gbp,
        preceptors: z.object({ county: z.string().nullable(), police: z.string().nullable(), fire: z.string().nullable(), combined: z.string().nullable() }),
      }),
    )
    .length(296),
});
export type DecoderFile = z.infer<typeof DecoderFile>;

export const DecoderIndex = z.object({ note: z.string(), councils: z.record(z.string().regex(/^E0[6789]\d{6}$/), z.tuple([z.string(), z.string()])) });
export type DecoderIndex = z.infer<typeof DecoderIndex>;
