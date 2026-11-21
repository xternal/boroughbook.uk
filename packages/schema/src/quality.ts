import { z } from "zod";

import { QUALITIES } from "./client";

// The pure helpers live in ./client (no zod), so the browser can import them without the data; re-exported here.
export { QUALITIES, worst, fig, derive } from "./client";
export type { Figure } from "./client";

/** How much to trust a value. `test` is invented and must never reach production. */
export const Quality = z.enum(QUALITIES);
export type Quality = z.infer<typeof Quality>;
