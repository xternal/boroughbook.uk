"""A failed workflow run opens an issue labelled job-failed, or adds a comment to the one already open for that workflow,
with the run's link and the error from its log (GitHub emails the owner about both). Run by the report-failure job of
each scheduled AI workflow (daily-decisions.yml, weekly-digest.yml) when another job in the run has failed.

Without it a failed scheduled run shows only in the Actions tab: the daily decisions job failed every morning from 14 to
16 October 2026 (claude-opus-5-5 refused its forced tool call) and nobody knew until the AI Journalist backtest of
19 October (docs/PRE_SHIP_REVIEW.md).

    python3 scripts/job_failed.py              needs GH_TOKEN, REPO and RUN_ID, which the workflow sets
    python3 scripts/job_failed.py --dry-run    print the issue or comment, change nothing

Only GitHub's REST API, through the gh command line tool, and the standard library.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from typing import Callable, Dict, List, Optional, Tuple

LABEL = "job-failed"
LABEL_COLOUR = "b60205"
LABEL_DESCRIPTION = "A scheduled job failed; opened by scripts/job_failed.py"
EXCERPT_LINES = 40
LINE_CHARS = 400
LOG_TRIES = 6
LOG_WAIT_SECONDS = 10

Api = Callable[..., object]

_STAMP = re.compile(r"^\ufeff?\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z ?")
_ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
# "Error: Claude API 400: ...", "ValueError: ...", "httpx.HTTPStatusError: ...", "error: ...": not "throw new Error(".
_HEADLINE = re.compile(r"^\s*(?:[\w.]*(?:Error|Exception)\b|error\b)[:\s]")


def gh_api(path: str, method: str = "GET", body: Optional[dict] = None, raw: bool = False) -> object:
    """One REST call through `gh api`. JSON in and out, or the raw text (logs)."""
    cmd = ["gh", "api", "-X", method, path]
    if raw:
        # A job's log carries the colour codes of each `run:` step's echo; without this flag gh refuses to print it,
        # so every issue said "no error line in the log" with an empty excerpt (1 November 2026).
        cmd.append("--allow-escape-sequences")
    if body is not None:
        cmd += ["--input", "-"]
    out = subprocess.run(cmd, input=json.dumps(body) if body is not None else None, capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(f"gh api {method} {path}: {out.stderr.strip() or out.stdout.strip()}")
    if raw:
        return out.stdout
    return json.loads(out.stdout) if out.stdout.strip() else None


def clean(line: str) -> str:
    return _ANSI.sub("", _STAMP.sub("", line.rstrip("\r\n")))[:LINE_CHARS]


def error_excerpt(log: str) -> Tuple[str, List[str]]:
    """The error's headline and the end of the failed step's output, from a job's log.

    The failed step's output runs from the last `##[endgroup]` (the end of the step's header) to the first `##[error]`;
    the excerpt is its end, then GitHub's own message ("Process completed with exit code 1.")."""
    lines = [clean(x) for x in log.splitlines()]
    err = next((i for i, x in enumerate(lines) if x.startswith("##[error]")), None)
    if err is None:
        tail = [x for x in lines if x.strip()][-EXCERPT_LINES:]
        return ("no error line in the log", tail)
    start = max((i for i in range(err) if lines[i].startswith("##[endgroup]")), default=-1) + 1
    step = [x for x in lines[start:err] if not x.startswith("##[")]
    while step and not step[-1].strip():
        step.pop()
    message = lines[err][len("##[error]"):].strip()
    return headline_of(step, message), step[-EXCERPT_LINES:] + [message]


def headline_of(step: List[str], message: str) -> str:
    """A Python traceback's exception line; else the first line that reads like an error; else GitHub's own message."""
    for i, x in enumerate(step):
        if x.startswith("Traceback (most recent call last):"):
            exc = next((y.strip() for y in step[i + 1:] if y.strip() and not y[0].isspace()), None)
            if exc:
                return exc
    return next((x.strip() for x in step if _HEADLINE.match(x)), message)


def failed_jobs(api: Api, repo: str, run_id: str) -> List[Dict]:
    jobs = api(f"repos/{repo}/actions/runs/{run_id}/jobs?per_page=100")
    out = []
    for j in jobs["jobs"]:  # type: ignore[index]
        if j.get("conclusion") != "failure":
            continue
        steps = [s["name"] for s in j.get("steps") or [] if s.get("conclusion") == "failure"]
        out.append({"id": j["id"], "name": j["name"], "url": j.get("html_url", ""), "steps": steps})
    return out


def job_log(api: Api, repo: str, job_id: int, tries: int = LOG_TRIES, wait: float = LOG_WAIT_SECONDS) -> str:
    """A finished job's log; GitHub can take a few seconds to make it available."""
    for attempt in range(tries):
        try:
            return str(api(f"repos/{repo}/actions/jobs/{job_id}/logs", raw=True))
        except RuntimeError:
            if attempt + 1 < tries:
                time.sleep(wait)
    return ""


def when(iso: str) -> str:
    """'14 October 2026, 11:27 BST' from the API's UTC timestamp (UTC if the zone database is missing)."""
    t = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    try:
        from zoneinfo import ZoneInfo

        t = t.astimezone(ZoneInfo("Europe/London"))
    except Exception:  # noqa: BLE001 - no zone data: say UTC
        pass
    return f"{t.day} {t:%B %Y, %H:%M} {t.tzname()}"


def title_for(workflow: str) -> str:
    return f"Job failed: {workflow}"


def failure_text(run: Dict, jobs: List[Dict]) -> str:
    """What failed and why, for the issue and for each later comment."""
    parts = [f"Run: {run['html_url']} ({run.get('event', 'run')}, {when(run['run_started_at'])})"]
    for j in jobs:
        where = f'job "{j["name"]}"' + (f', step "{j["steps"][0]}"' if j["steps"] else "")
        headline, excerpt = j["error"]
        block = "\n".join(excerpt).replace("```", "'''")
        parts.append(
            f"Failed: {where} ({j['url']})\n\nError: `{headline.replace('`', chr(39))}`\n\n"
            f"<details><summary>The end of the step's log</summary>\n\n```\n{block}\n```\n\n</details>"
        )
    return "\n\n".join(parts)


def issue_body(workflow: str, run: Dict, jobs: List[Dict]) -> str:
    return (
        f"The scheduled job **{workflow}** failed, so whatever it does after the failed step did not happen. "
        "Without this issue a failed scheduled run shows only in the Actions tab.\n\n"
        f"{failure_text(run, jobs)}\n\n"
        "While this issue is open, each new failure of this workflow adds a comment here instead of a new issue. "
        "Close it once the job is fixed and a run has passed (scripts/job_failed.py)."
    )


def report(api: Api, repo: str, run: Dict, jobs: List[Dict], dry_run: bool = False) -> str:
    """Comment on the open job-failed issue for this workflow, or open one. Returns what it did."""
    workflow = run["name"]
    title = title_for(workflow)
    issues = api(f"repos/{repo}/issues?state=open&labels={LABEL}&per_page=100")
    existing = next((i for i in issues if i.get("title") == title and "pull_request" not in i), None)  # type: ignore[union-attr]
    if existing:
        text = f"Failed again.\n\n{failure_text(run, jobs)}"
        if not dry_run:
            api(f"repos/{repo}/issues/{existing['number']}/comments", method="POST", body={"body": text})
        return f"commented on #{existing['number']}: {title}\n\n{text}"
    body = issue_body(workflow, run, jobs)
    if not dry_run:
        try:
            api(f"repos/{repo}/labels/{LABEL}")
        except RuntimeError:
            api(f"repos/{repo}/labels", method="POST", body={"name": LABEL, "color": LABEL_COLOUR, "description": LABEL_DESCRIPTION})
        api(f"repos/{repo}/issues", method="POST", body={"title": title, "body": body, "labels": [LABEL]})
    return f"opened: {title}\n\n{body}"


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    repo, run_id = os.environ["REPO"], os.environ["RUN_ID"]
    run = gh_api(f"repos/{repo}/actions/runs/{run_id}")
    jobs = failed_jobs(gh_api, repo, run_id)
    if not jobs:
        print("No failed job in this run: nothing to report.")
        return 0
    for j in jobs:
        j["error"] = error_excerpt(job_log(gh_api, repo, j["id"]))
    print(report(gh_api, repo, run, jobs, dry_run=args.dry_run))  # type: ignore[arg-type]
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
