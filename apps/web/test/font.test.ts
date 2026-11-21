import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import cut from "../app/fonts/geist-latin.json";

/**
 * The site's font is Geist cut down to Latin (scripts/subset_font.py). A character the cut left out but full Geist has
 * would quietly fall back to another font, so every character in the site's text, content and data must be either
 * kept, or missing from Geist altogether (then it fell back before too).
 */
const REPO = join(__dirname, "..", "..", "..");
const ROOTS = ["apps/web/app", "apps/web/components", "apps/web/lib", "content", "data/build", "packages/schema/src", "packages/engine/src"];
const TEXT = /\.(json|ya?ml|tsx?|md|txt|css)$/;

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    if (n === "node_modules" || n === "fonts") return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : TEXT.test(n) ? [p] : [];
  });

describe("the cut-down Geist font", () => {
  it("has every character the site shows that full Geist has", () => {
    const dropped = new Set(cut.dropped);
    const missing = new Map<string, string>();
    for (const root of ROOTS)
      for (const f of files(join(REPO, root)))
        for (const ch of readFileSync(f, "utf8"))
          if (dropped.has(ch.codePointAt(0)!) && !missing.has(ch)) missing.set(ch, f.slice(REPO.length + 1));
    expect([...missing].map(([ch, f]) => `U+${ch.codePointAt(0)!.toString(16).toUpperCase()} ${ch} in ${f}`)).toEqual([]);
  });

  it("keeps the basics: Latin, pound sign, dashes, curly quotes", () => {
    const kept = new Set(cut.kept);
    for (const ch of "AZaz09£€–—‘’“”…→−×½éŁ") expect(kept.has(ch.codePointAt(0)!), ch).toBe(true);
  });
});
