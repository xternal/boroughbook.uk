"""Failed scheduled jobs (scripts/job_failed.py): a failed run opens a job-failed issue, or comments on the open one, with
the run link and the error; every scheduled AI workflow runs it. Run: python3 -m unittest discover -s etl/tests -t ."""
from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import job_failed as J  # noqa: E402

# The end of the daily decisions job's log on 14 October 2026, as GitHub serves it (timestamps, colour codes).
LOG_14_OCTOBER = """\
2026-10-14T10:29:04.2909518Z Done in 1.8s using pnpm v12.9.1
2026-10-14T10:29:04.3155414Z ##[group]Run pnpm --filter @borough-ledger/schema decisions:suggest "$RUNNER_TEMP/suggestions.json"
2026-10-14T10:29:04.3155811Z \x1b[36;1mpnpm --filter @borough-ledger/schema decisions:suggest "$RUNNER_TEMP/suggestions.json"\x1b[0m
2026-10-14T10:29:04.3207382Z shell: /usr/bin/bash -e {0}
2026-10-14T10:29:04.3207521Z env:
2026-10-14T10:29:04.3209553Z   ANTHROPIC_API_KEY: ***
2026-10-14T10:29:04.3209680Z ##[endgroup]
2026-10-14T10:29:04.3412076Z $ tsx src/decision-links-cli.ts suggest /home/runner/work/_temp/suggestions.json
2026-10-14T10:29:05.1662187Z /home/runner/work/borough-ledger/borough-ledger/packages/schema/src/decision-links-cli.ts:38
2026-10-14T10:29:05.1662843Z   if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
2026-10-14T10:29:05.1663562Z                      ^
2026-10-14T10:29:05.1663738Z
2026-10-14T10:29:05.1664353Z Error: Claude API 400: {"type":"error","error":{"type":"invalid_request_error","message":"tool_choice: type \\"tool\\" and \\"any\\" are not supported for this model."},"request_id":"req_011Cg1yNN3yNYjG7vYNDRG8k"}
2026-10-14T10:29:05.1664961Z     at ask (/home/runner/work/borough-ledger/borough-ledger/packages/schema/src/decision-links-cli.ts:38:22)
2026-10-14T10:29:05.1778993Z [ELIFECYCLE] Command failed with exit code 1.
2026-10-14T10:29:05.1784483Z Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL
2026-10-14T10:29:05.1785688Z
2026-10-14T10:29:05.1807085Z ##[error]Process completed with exit code 1.
2026-10-14T10:29:05.1871233Z Post job cleanup.
2026-10-14T10:29:05.3397248Z git version 2.55.0
"""

RUN = {
    "name": "Daily council decisions",
    "html_url": "https://github.com/xternal/boroughbook.uk/actions/runs/38549740899",
    "event": "schedule",
    "run_started_at": "2026-10-14T10:27:51Z",
}


def failed_job() -> Dict:
    return {
        "id": 115804505143,
        "name": "decisions",
        "url": "https://github.com/xternal/boroughbook.uk/actions/runs/38549740899/job/115804505143",
        "steps": ["Ask Claude which pledges new decisions move"],
        "error": J.error_excerpt(LOG_14_OCTOBER),
    }


class FakeApi:
    """Records the calls report() makes; answers the issue search with `open_issues`."""

    def __init__(self, open_issues: List[Dict], label_exists: bool = True) -> None:
        self.open_issues = open_issues
        self.label_exists = label_exists
        self.calls: List[Tuple[str, str, Optional[dict]]] = []

    def __call__(self, path: str, method: str = "GET", body: Optional[dict] = None, raw: bool = False) -> object:
        self.calls.append((method, path, body))
        if method == "GET" and path.startswith("repos/o/r/issues?"):
            return self.open_issues
        if method == "GET" and path.endswith(f"/labels/{J.LABEL}") and not self.label_exists:
            raise RuntimeError("gh api GET labels: HTTP 404")
        return {}

    def posts(self) -> List[Tuple[str, Optional[dict]]]:
        return [(p, b) for m, p, b in self.calls if m == "POST"]


class ExcerptTest(unittest.TestCase):
    def test_the_14_october_error_is_the_headline(self) -> None:
        headline, excerpt = J.error_excerpt(LOG_14_OCTOBER)
        self.assertTrue(headline.startswith("Error: Claude API 400:"), headline)
        self.assertIn('tool_choice: type \\"tool\\"', headline)
        # Only the failed step's output: no header, no timestamps, no colour codes, nothing after the error.
        self.assertEqual(excerpt[0], "$ tsx src/decision-links-cli.ts suggest /home/runner/work/_temp/suggestions.json")
        self.assertEqual(excerpt[-1], "Process completed with exit code 1.")
        text = "\n".join(excerpt)
        for absent in ("ANTHROPIC_API_KEY", "##[", "\x1b", "2026-10-14T", "Post job cleanup"):
            self.assertNotIn(absent, text)

    def test_a_python_error_and_a_log_with_no_error_line(self) -> None:
        log = "##[group]Run python etl/decisions.py\n##[endgroup]\nTraceback (most recent call last):\n  File \"x.py\", line 1\nhttpx.ConnectTimeout: timed out\n##[error]Process completed with exit code 1.\n"
        self.assertEqual(J.error_excerpt(log)[0], "httpx.ConnectTimeout: timed out")
        headline, tail = J.error_excerpt("line one\nline two\n")
        self.assertEqual(headline, "no error line in the log")
        self.assertEqual(tail, ["line one", "line two"])


class GhApiTest(unittest.TestCase):
    def test_a_log_is_asked_for_with_its_colour_codes_allowed(self) -> None:
        """Without the flag gh refuses a log with colour codes and every issue said "no error line in the log"."""
        import subprocess
        from unittest import mock

        seen: List[List[str]] = []

        def fake_run(cmd, **kw):
            seen.append(cmd)
            return subprocess.CompletedProcess(cmd, 0, stdout="log text\x1b[0m" if "--allow-escape-sequences" in cmd else "{}", stderr="")

        with mock.patch.object(subprocess, "run", fake_run):
            self.assertEqual(J.gh_api("repos/o/r/actions/jobs/1/logs", raw=True), "log text\x1b[0m")
            self.assertEqual(J.gh_api("repos/o/r/issues"), {})
        self.assertIn("--allow-escape-sequences", seen[0])
        self.assertNotIn("--allow-escape-sequences", seen[1])


class ReportTest(unittest.TestCase):
    def test_a_first_failure_opens_a_labelled_issue_with_the_run_and_the_error(self) -> None:
        api = FakeApi(open_issues=[], label_exists=False)
        J.report(api, "o/r", RUN, [failed_job()])
        [(label_path, label), (path, issue)] = api.posts()
        self.assertEqual(label_path, "repos/o/r/labels")
        self.assertEqual(label["name"], "job-failed")
        self.assertEqual(path, "repos/o/r/issues")
        self.assertEqual(issue["title"], "Job failed: Daily council decisions")
        self.assertEqual(issue["labels"], ["job-failed"])
        for text in (RUN["html_url"], "14 October 2026, 11:27 BST", 'step "Ask Claude which pledges new decisions move"', "Claude API 400"):
            self.assertIn(text, issue["body"])
        self.assertNotIn("\u00b7", issue["body"])  # CLAUDE.md: no middle dots

    def test_a_failure_while_the_issue_is_open_comments_on_it(self) -> None:
        open_issues = [
            {"number": 7, "title": "Job failed: Weekly digest draft"},
            {"number": 9, "title": "Job failed: Daily council decisions", "pull_request": {}},
            {"number": 12, "title": "Job failed: Daily council decisions"},
        ]
        api = FakeApi(open_issues)
        J.report(api, "o/r", RUN, [failed_job()])
        [(path, comment)] = api.posts()
        self.assertEqual(path, "repos/o/r/issues/12/comments")
        self.assertTrue(comment["body"].startswith("Failed again."))
        self.assertIn(RUN["html_url"], comment["body"])

    def test_a_dry_run_changes_nothing(self) -> None:
        api = FakeApi(open_issues=[])
        self.assertTrue(J.report(api, "o/r", RUN, [failed_job()], dry_run=True).startswith("opened: Job failed: Daily council decisions"))
        self.assertEqual(api.posts(), [])

    def test_failed_jobs_lists_only_failed_ones_with_their_failed_step(self) -> None:
        jobs = {
            "jobs": [
                {"id": 1, "name": "decisions", "conclusion": "failure", "html_url": "u",
                 "steps": [{"name": "Checkout", "conclusion": "success"}, {"name": "Ask Claude", "conclusion": "failure"}, {"name": "Commit", "conclusion": "skipped"}]},
                {"id": 2, "name": "report-failure", "conclusion": None, "steps": []},
            ]
        }
        self.assertEqual(J.failed_jobs(lambda path, **kw: jobs, "o/r", "5"), [{"id": 1, "name": "decisions", "url": "u", "steps": ["Ask Claude"]}])


class WorkflowsTest(unittest.TestCase):
    def test_every_scheduled_ai_workflow_reports_its_failures(self) -> None:
        workflows = sorted((ROOT / ".github" / "workflows").glob("*.yml"))
        ai = [w for w in workflows if "schedule:" in w.read_text() and "ANTHROPIC_API_KEY" in w.read_text()]
        self.assertEqual([w.name for w in ai], ["daily-decisions.yml", "weekly-digest.yml"])
        # The pledge finder runs on the owner's computer; its watch reports a due run that opened no pull request.
        for w in ai + [ROOT / ".github" / "workflows" / "pledge-finder-watch.yml"]:
            text = w.read_text()
            jobs = re.findall(r"^  ([\w-]+):\n", text.split("\njobs:\n", 1)[1], flags=re.M)
            self.assertIn("report-failure", jobs, w.name)
            job = text.split("\n  report-failure:\n", 1)[1]
            others = sorted(j for j in jobs if j != "report-failure")
            needs = re.search(r"^    needs: \[([^\]]*)\]", job, flags=re.M)
            assert needs is not None, w.name
            self.assertEqual(sorted(x.strip() for x in needs.group(1).split(",")), others, w.name)
            self.assertRegex(job, r"(?m)^    if: \$\{\{ failure\(\)", w.name)
            self.assertIn("      issues: write", job)
            self.assertIn("      actions: read", job)
            self.assertIn("run: python3 scripts/job_failed.py", job)


if __name__ == "__main__":
    unittest.main()
