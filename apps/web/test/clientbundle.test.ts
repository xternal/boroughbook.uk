import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * What a reader's browser downloads. Every module a client component reaches (through value imports; type imports are
 * erased) ends up in the JavaScript sent to every reader. The schema package's root pulls in every data file and parses
 * it with zod at import (data.ts), which once put about 600 KB of data and zod into the shared chunk on every page and
 * pushed mobile LCP past 2.5 s. Client code imports `@borough-ledger/schema/client` instead.
 */
const WEB = join(__dirname, "..");
const REPO = join(WEB, "..", "..");
/** The one data file client code may bundle: the postcode finders' council index (about 17 KB). */
const ALLOWED_JSON = new Set(["data/build/council_tax_decoder_index.json"]);

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [];
  });

function resolve(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(WEB, spec.slice(2));
  else if (spec.startsWith(".")) base = normalize(join(dirname(from), spec));
  else if (spec === "@borough-ledger/schema") return join(REPO, "packages/schema/src/index.ts");
  else if (spec === "@borough-ledger/schema/client") return join(REPO, "packages/schema/src/client.ts");
  else if (spec === "@borough-ledger/engine") return join(REPO, "packages/engine/src/index.ts");
  else return `pkg:${spec}`;
  for (const ext of ["", ".ts", ".tsx", "/index.ts"]) if (existsSync(base + ext) && statSync(base + ext).isFile()) return base + ext;
  return null;
}

/** Value imports and re-exports: `import type` and `import { type A, type B }` are left out, as the compiler drops them. */
const IMPORT = /^\s*(?:import|export)\s+(?!type\b)([^;]*?)\s*from\s*"([^"]+)"/gm;
const typeOnly = (clause: string) =>
  clause.startsWith("{") && clause.slice(1, -1).split(",").every((x) => !x.trim() || x.trim().startsWith("type "));

function reached(): { banned: string[]; count: number } {
  const clients = [...files(join(WEB, "components")), ...files(join(WEB, "app"))].filter((f) => /^["']use client["']/.test(readFileSync(f, "utf8")));
  const seen = new Set<string>();
  const banned: string[] = [];
  const walk = (f: string) => {
    if (seen.has(f)) return;
    seen.add(f);
    for (const [, clause = "", spec = ""] of readFileSync(f, "utf8").matchAll(IMPORT)) {
      if (typeOnly(clause)) continue;
      const to = resolve(f, spec);
      const at = relative(REPO, f);
      if (to === null) continue;
      if (to === "pkg:zod") banned.push(`${at} imports zod`);
      else if (to.endsWith("packages/schema/src/index.ts")) banned.push(`${at} imports @borough-ledger/schema (use @borough-ledger/schema/client)`);
      else if (to.endsWith(".json") && !ALLOWED_JSON.has(relative(REPO, to))) banned.push(`${at} bundles ${relative(REPO, to)}`);
      else if (!to.startsWith("pkg:") && !to.endsWith(".json")) walk(to);
    }
  };
  clients.forEach(walk);
  return { banned, count: seen.size };
}

describe("what client components send to the browser", () => {
  it("never pulls in the data files, zod or the schema package's root", () => {
    const { banned, count } = reached();
    expect(count).toBeGreaterThan(20);
    expect(banned).toEqual([]);
  });
});
