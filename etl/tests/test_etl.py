"""Unit tests for the ETL. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import extract  # noqa: E402
from ods import find_rows, read_ods  # noqa: E402

NS = (
    'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
    'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" '
    'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"'
)


def num(v: float, repeat: int = 1) -> str:
    rep = f' table:number-columns-repeated="{repeat}"' if repeat > 1 else ""
    return f'<table:table-cell office:value-type="float" office:value="{v}"{rep}><text:p>{v}</text:p></table:table-cell>'


def txt(t: str) -> str:
    return f'<table:table-cell office:value-type="string"><text:p>{t}</text:p></table:table-cell>'


def make_ods(path: Path, sheet: str, rows: list) -> None:
    body = "".join(f"<table:table-row>{''.join(r)}</table:table-row>" for r in rows)
    xml = f'<?xml version="1.0"?><office:document-content {NS}><office:body><office:spreadsheet>' \
          f'<table:table table:name="{sheet}">{body}<table:table-row table:number-rows-repeated="1048000"><table:table-cell/></table:table-row></table:table>' \
          f"</office:spreadsheet></office:body></office:document-content>"
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("content.xml", xml)


class OdsReader(unittest.TestCase):
    def test_reads_numbers_text_and_repeats(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "t.ods"
            make_ods(p, "S", [[txt("Name"), txt("Value")], [txt("Hammersmith and Fulham"), num(2, repeat=3)]])
            s = read_ods(str(p))["S"]
            self.assertEqual(s[0], ["Name", "Value"])
            self.assertEqual(s[1], ["Hammersmith and Fulham", 2.0, 2.0, 2.0])
            self.assertEqual(len(s), 2, "trailing blank rows are dropped, not expanded a million times")
            self.assertEqual(find_rows(s, "hammersmith"), [1])


class AreaBands(unittest.TestCase):
    def _sheet(self, d: str, bands: list) -> str:
        p = Path(d) / "bands.ods"
        hdr = [txt(h) for h in ["E Code", "ONS Code", "Authority", "Region", "Class", "Area"]] + [txt(f"Band {b}") for b in "ABCDEFGH"]
        row = [txt("E5014"), txt("E09000013"), txt("Hammersmith and Fulham"), txt("L"), txt("ILB"), txt("Inner London")] + [num(v) for v in bands]
        make_ods(p, "Table_9", [hdr, row])
        return p.name

    def test_accepts_statutory_ninths(self) -> None:
        with tempfile.TemporaryDirectory() as d, mock.patch.object(extract, "RAW", Path(d)):
            f = self._sheet(d, [1013.01, 1181.84, 1350.68, 1519.51, 1857.18, 2194.85, 2532.52, 3039.02])
            self.assertEqual(extract.area_bands(f, "Table_9", "E09000013")["D"], 1519.51)

    def test_rejects_a_band_that_is_not_the_statutory_ratio(self) -> None:
        with tempfile.TemporaryDirectory() as d, mock.patch.object(extract, "RAW", Path(d)):
            f = self._sheet(d, [1013.01, 1181.84, 1350.68, 1519.51, 1857.18, 2194.85, 2532.52, 3100.00])
            with self.assertRaises(extract.CheckFailed):
                extract.area_bands(f, "Table_9", "E09000013")


class Ranges(unittest.TestCase):
    def test_line_ranges(self) -> None:
        self.assertTrue(extract._in_range("150", "102-199"))
        self.assertFalse(extract._in_range("313", "102-199"))
        self.assertTrue(extract._in_range("313", "313"))


if __name__ == "__main__":
    unittest.main()


class ManualSavings(unittest.TestCase):
    """Named savings must add up to each directorate's total in Appendix C."""

    HEAD = "id,directorate,service,label,k_2026_27,k_2027_28,kind,service_group,page\n"

    def _run(self, csv_text: str):
        import build  # noqa: WPS433

        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "data" / "manual").mkdir(parents=True)
            (root / "data" / "manual" / "savings_2026-27.csv").write_text(csv_text)
            (root / "data" / "manual" / "service_groups.csv").write_text("id,label,official_term,desc,order\nrunning,Running,Central,x,1\n")
            with mock.patch.object(build, "ROOT", root), mock.patch.object(extract, "MANUAL", root / "data" / "manual"):
                return build.manual_savings()

    def test_flags_one_off_savings(self) -> None:
        out = self._run(self.HEAD + "a,Corp,,Thing,-100,-100,service,running,1\nb,Corp,,Once,-50,0,service,,1\nt,Corp,,Total,-150,-100,total,,1\n")
        self.assertEqual([(s["id"], s["m"], s["one_off"]) for s in out], [("a", 0.1, False), ("b", 0.05, True)])

    def test_rejects_lines_that_miss_the_directorate_total(self) -> None:
        with self.assertRaises(extract.CheckFailed):
            self._run(self.HEAD + "a,Corp,,Thing,-100,-100,service,,1\nt,Corp,,Total,-150,-100,total,,1\n")


class ManualToggles(unittest.TestCase):
    """A switch's cost comes from the budget report by page, or from another registered source such as an FOI answer."""

    SEED = [{"id": "a", "label": "A", "cost_m": 9, "quality": "test", "source_id": "prototype_test", "todo": "TODO(source)"},
            {"id": "b", "label": "B", "cost_m": 9, "quality": "test", "source_id": "prototype_test", "todo": "TODO(source)"}]

    def _run(self, csv_text: str):
        import build  # noqa: WPS433

        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "data" / "manual").mkdir(parents=True)
            (root / "data" / "manual" / "toggles_2027-28.csv").write_text(csv_text)
            sources = [{"id": "budget_report"}, {"id": "foi_x"}]
            with mock.patch.object(build, "ROOT", root), mock.patch.object(extract, "MANUAL", root / "data" / "manual"), \
                    mock.patch.object(build, "load_sources", return_value=sources):
                return build.manual_toggles([dict(t) for t in self.SEED])

    HEAD = "id,cost_m,quality,page,method_note,source_id\n"

    def test_cites_the_report_page_or_the_named_source(self) -> None:
        a, b = self._run(self.HEAD + "a,1.5,modelled,23,From the report,\nb,1.05,modelled,,Half the FOI cost,foi_x\n")
        self.assertEqual((a["source_id"], a["method_note"]), ("budget_report", "Budget report, PDF page 23: From the report"))
        self.assertEqual((b["source_id"], b["method_note"], b["cost_m"]), ("foi_x", "Half the FOI cost", 1.05))
        self.assertNotIn("todo", b)

    def test_refuses_an_unknown_source(self) -> None:
        with self.assertRaises(extract.CheckFailed):
            self._run(self.HEAD + "a,1,modelled,,Note,nowhere\n")


class ManualGap(unittest.TestCase):
    """The hand-extracted waterfall must add up to the report's own gap and close to zero."""

    def _run(self, csv_text: str):
        import build  # noqa: WPS433

        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "data" / "manual").mkdir(parents=True)
            (root / "data" / "manual" / "gap_2026-27.csv").write_text(csv_text)
            with mock.patch.object(build, "ROOT", root), mock.patch.object(extract, "MANUAL", root / "data" / "manual"):
                return build.manual_gap([{"label": "seed", "kind": "total"}])

    HEAD = "order,label,m,kind,page,note\n"

    def test_uses_seed_when_not_extracted(self) -> None:
        self.assertEqual(self._run(self.HEAD), [{"label": "seed", "kind": "total"}])

    def test_builds_a_closing_waterfall(self) -> None:
        out = self._run(self.HEAD + "1,Pay,10,pressure,12,Table 2: Pay\n2,Grant change,-2,funding,12,\n3,The gap,8,report_gap,12,\n"
                        "4,Council tax,-5,close,13,\n5,Savings,-3,close_saving,14,\n6,Bottom line,0,report_total,14,\n")
        self.assertEqual([r["kind"] for r in out], ["pressure", "funding", "subtotal", "close", "close_saving", "total"])
        self.assertEqual(out[0]["method_note"], "Budget report, PDF page 12. Table 2: Pay")

    def test_needs_the_report_bottom_line(self) -> None:
        with self.assertRaises(extract.CheckFailed):
            self._run(self.HEAD + "1,Pay,10,pressure,12,\n2,Council tax,-10,close,13,\n")

    def test_rejects_lines_that_do_not_match_the_report(self) -> None:
        with self.assertRaises(extract.CheckFailed):
            self._run(self.HEAD + "1,Pay,10,pressure,12,\n2,The gap,9,report_gap,12,\n3,Council tax,-10,close,13,\n4,Bottom,0,report_total,13,\n")

    def test_rejects_a_gap_that_does_not_close(self) -> None:
        with self.assertRaises(extract.CheckFailed):
            self._run(self.HEAD + "1,Pay,10,pressure,12,\n2,Council tax,-7,close,13,\n3,Bottom,0,report_total,13,\n")

    def test_rejects_a_report_that_is_not_balanced(self) -> None:
        with self.assertRaises(extract.CheckFailed):
            self._run(self.HEAD + "1,Pay,10,pressure,12,\n2,Council tax,-7,close,13,\n3,Bottom,3,report_total,13,\n")
