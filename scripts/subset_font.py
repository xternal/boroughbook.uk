"""Cut the Geist variable font down to the characters an English-language site needs.

The `geist` package ships one 70 KB variable font with Cyrillic, Greek and Vietnamese, which this site never shows.
Every reader downloads it before the first screen settles. This keeps Latin (with Latin-1 and Latin Extended-A for
names such as Zoë or Łukasz), punctuation, currency, arrows, maths and shapes, every weight (the variable axis) and
every OpenType feature (tabular figures, fractions, stylistic sets), so nothing on screen changes.

Run after updating the `geist` package:  pip install fonttools brotli && python scripts/subset_font.py
It writes apps/web/app/fonts/Geist-Variable-latin.woff2 and geist-latin.json; test/font.test.ts checks every
character in the site's text and data against that list.
"""
import glob
import json
import pathlib

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = sorted(glob.glob(str(ROOT / "node_modules/.pnpm/geist@*/node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2")))[-1]
OUT = ROOT / "apps/web/app/fonts"

RANGES = [
    (0x0000, 0x00FF),  # Basic Latin and Latin-1 (£, é, ×, ½)
    (0x0100, 0x017F),  # Latin Extended-A (names: Ł, ő, ş)
    (0x0300, 0x036F),  # combining accents, used by the font's own composition
    (0x02B0, 0x02FF),  # modifier letters (ʼ, ˆ, ˜)
    (0x2000, 0x206F),  # punctuation: dashes, curly quotes, bullet, ellipsis
    (0x2070, 0x209F),  # superscripts and subscripts
    (0x20A0, 0x20CF),  # currency (€)
    (0x2100, 0x214F),  # letterlike (№, ™)
    (0x2150, 0x218F),  # number forms (⅓)
    (0x2190, 0x21FF),  # arrows
    (0x2200, 0x22FF),  # maths (−, ≠, ≤)
    (0x2300, 0x23FF),  # technical (⌘)
    (0x25A0, 0x25FF),  # shapes (●)
    (0x2600, 0x27BF),  # symbols (✓)
    (0xFB00, 0xFB06),  # ligatures (ﬁ)
]


def main() -> None:
    full = TTFont(SRC).getBestCmap()
    keep = sorted(c for c in full if any(a <= c <= b for a, b in RANGES))
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.hinting = True
    font = TTFont(SRC)
    s = subset.Subsetter(opts)
    s.populate(unicodes=keep)
    s.subset(font)
    OUT.mkdir(parents=True, exist_ok=True)
    font.save(OUT / "Geist-Variable-latin.woff2")
    dropped = sorted(set(full) - set(keep))
    (OUT / "geist-latin.json").write_text(
        json.dumps({"source": "geist " + pathlib.Path(SRC).parts[-7].split("_")[0].split("@")[1], "kept": keep, "dropped": dropped}) + "\n"
    )
    print(f"kept {len(keep)} characters, dropped {len(dropped)}; {(OUT / 'Geist-Variable-latin.woff2').stat().st_size} bytes")


if __name__ == "__main__":
    main()
