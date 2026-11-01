"""Council decisions: plain text from the council's HTML, resolutions from Full Council minutes, names removed. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import decisions as D  # noqa: E402


class DecisionsTest(unittest.TestCase):
    def test_lines_broken_mid_sentence_are_joined_and_numbers_kept(self) -> None:
        html = "<p>That Cabinet agreed the</p><p>following recommendations:</p><p>1.</p><p>To note the report.</p><p>2.</p><p>To approve the</p><p>plan.</p>"
        self.assertEqual(D.plain(html), "That Cabinet agreed the following recommendations:\n1. To note the report.\n2. To approve the plan.")

    def test_bullets_become_lines_never_middle_dots(self) -> None:
        self.assertNotIn("·", D.plain("<p>This Council notes: · one thing · another.</p>"))

    def test_resolution_is_only_what_was_decided(self) -> None:
        minutes = "<p>Mr Smith spoke against.</p><p>The motion was CARRIED.</p><p>8.44pm – RESOLVED</p><p>That Full Council adopt the policy.</p>"
        self.assertEqual(D.resolution(minutes), "That Full Council adopt the policy.")
        self.assertEqual(D.resolution("<p>The motion was LOST.</p>"), "")

    def test_a_private_persons_name_is_removed_but_councillors_stay(self) -> None:
        self.assertEqual(D.redact("The petition from Mrs Jane Doe was noted by Councillor Stephen Cowan."), "The petition from [name removed] was noted by Councillor Stephen Cowan.")

    def test_procedural_items_are_left_out(self) -> None:
        for t in ["Apologies for Absence", "Minutes", "Mayor's Announcements", "Public Questions (20 Minutes)"]:
            self.assertTrue(D.PROCEDURAL.match(t), t)
        self.assertFalse(D.PROCEDURAL.match("Markets and Street Trading Licensing Policy"))


if __name__ == "__main__":
    unittest.main()


class RetryTest(unittest.TestCase):
    """The council's firewall now and then answers 403 for a minute or two (1 November 2026): the fetch waits and tries
    again over about four minutes; a 404 fails at once."""

    def _run(self, answers: list, waits: list) -> bytes:
        import io
        import urllib.error
        import urllib.request
        from contextlib import redirect_stderr
        from unittest import mock

        calls = iter(answers)

        def fake_urlopen(req, timeout=0):
            a = next(calls)
            if isinstance(a, int):
                raise urllib.error.HTTPError(req.full_url, a, "x", {}, None)  # type: ignore[arg-type]
            return io.BytesIO(a)

        with mock.patch.object(urllib.request, "urlopen", fake_urlopen), mock.patch.object(D.time, "sleep", waits.append), redirect_stderr(io.StringIO()):
            return D.get("GetMeetings", lCommitteeId=1)

    def test_a_403_is_tried_again_over_minutes_not_seconds(self) -> None:
        waits: list = []
        self.assertEqual(self._run([403, 403, 403, b"<ok/>"], waits), b"<ok/>")
        self.assertEqual(waits, [15, 30, 60])
        self.assertGreaterEqual(sum(D.RETRY_WAITS), 180)

    def test_a_403_every_time_fails_after_the_last_wait(self) -> None:
        import urllib.error

        waits: list = []
        with self.assertRaises(urllib.error.HTTPError):
            self._run([403] * (len(D.RETRY_WAITS) + 1), waits)
        self.assertEqual(waits, list(D.RETRY_WAITS))

    def test_a_404_fails_at_once(self) -> None:
        import urllib.error

        waits: list = []
        with self.assertRaises(urllib.error.HTTPError):
            self._run([404, b"<ok/>"], waits)
        self.assertEqual(waits, [])
