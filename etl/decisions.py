"""Council decisions from the council's ModernGov web service: Cabinet and Full Council.

    python3 etl/decisions.py            fetch meetings since FROM, keep each published decision, write data/build/decisions.json
    python3 etl/decisions.py --offline  rebuild from the snapshots in data/raw/decisions/
    python3 etl/decisions.py --check    check data/build/decisions.json is well formed (CI has no snapshots)

Kept for each decision: the meeting, the item's title, the formal decision text and the published report. Full Council
records its decisions in the minutes, so for it only the resolution is kept (the text after "RESOLVED"); never the debate,
which can name members of the public who spoke. A person's name after a courtesy title (Mr, Mrs, Ms, Miss, Dr)
is removed from decision text too; councillors and officers named in their role stay (CLAUDE.md invariant 6).

The council's web pages refuse scripts, but its web service is meant for them; the ETL identifies itself honestly and
never pretends to be a browser. Links point residents to the council's own decision and meeting pages.
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "decisions"
OUT = ROOT / "data" / "build" / "decisions.json"
UA = "BoroughLedger-ETL/0.1 (independent research; https://github.com/xternal/boroughbook.uk)"

SITE = "https://democracy.lbhf.gov.uk"
SERVICE = f"{SITE}/mgWebService.asmx"
# TODO(config): the council's committees move to its config with M8 (second borough).
COMMITTEES = {116: "Cabinet", 114: "Full Council"}
# From the start of the 2026/27 budget round, so the budget decisions themselves are in.
FROM = date(2026, 1, 1)

PERSON = re.compile(r"\b(?:Mr|Mrs|Ms|Miss|Mx|Dr)\.?\s+(?:[A-Z][a-zA-Z'’-]+\s+){0,2}[A-Z][a-zA-Z'’-]+")


BULLETS = re.compile(r"\s*[\u00b7\u2022\u25aa\u25e6\u2023\u2043]\s*")


def plain(fragment: str) -> str:
    """Decision HTML as plain text: paragraphs, list items and bullets become line breaks, nothing else survives.
    The council's bullets are middle dots, which the site never shows (CLAUDE.md invariant 10)."""
    s = re.sub(r"(?i)<\s*(br|/p|/li|/div|/h\d)\s*/?>", "\n", fragment or "")
    s = re.sub(r"<[^>]+>", " ", s)
    s = BULLETS.sub("\n", html.unescape(s).replace("\xa0", " "))
    lines = [" ".join(line.split()) for line in s.split("\n")]
    return "\n".join(rejoin([line for line in lines if line])).strip()


MARKER = re.compile(r"^(\d{1,2}\.|[a-z][.)]|\(?[ivx]{1,4}\)|[a-z]\)|\([a-z]\))$")
LIST_START = re.compile(r"^(\d{1,2}\.|[a-z][.)]|\(?[ivx]{1,4}\)|\([a-z]\))\s")


def rejoin(lines: List[str]) -> List[str]:
    """The council's HTML breaks lines mid-sentence. A line joins the one before it unless that one ended a sentence or
    clause, or this one starts a numbered item; a number standing alone joins the line after it. Only spacing changes."""
    out: List[str] = []
    pending = ""
    for line in lines:
        if MARKER.match(line):
            pending = f"{pending}{line} "
            continue
        line, pending = pending + line, ""
        if out and not out[-1].endswith((".", ":", ";", "?", "!")) and not LIST_START.match(line):
            out[-1] = f"{out[-1]} {line}"
        else:
            out.append(line)
    if pending:
        out.append(pending.strip())
    return out


def redact(text: str) -> str:
    return PERSON.sub("[name removed]", text)


# Full Council records its decisions in the minutes. Procedural items are left out.
PROCEDURAL = re.compile(
    r"^(apologies|declarations? of interests?|minutes|mayor'?s announcements|public questions|election of the mayor|items for discussion|"
    r"special motions$|information reports|allocation of seats|appointment|review of the constitution|council calendar|honorary|freedom of the borough)",
    re.I,
)


def resolution(minutes_html: str) -> str:
    """The text after the last "RESOLVED" in an item's minutes, as one paragraph: only what was decided, never the debate."""
    raw = BULLETS.sub(" \x00 ", html.unescape(re.sub(r"<[^>]+>", " ", minutes_html or "")).replace("\xa0", " "))
    t = " ".join(raw.split())
    i = t.upper().rfind("RESOLVED")
    if i < 0:
        return ""
    out = t[i + len("RESOLVED"):].lstrip(" :.-–—")
    out = "\n".join(part.strip() for part in out.split("\x00") if part.strip())
    return out[0].upper() + out[1:] if out else ""


def unescape(s: str) -> str:
    return " ".join(html.unescape(s or "").split())


# The council's site sits behind an Azure firewall that now and then answers 403 to a GitHub runner for a minute or two
# (1 November 2026: three tries 5 and 10 seconds apart all got 403; the same job passed when rerun). So a refused or
# failed request is tried again over about four minutes, never faster. A 404 or 400 is the request's own fault and
# fails at once.
RETRY_WAITS = (15, 30, 60, 120)


def get(op: str, **params) -> bytes:
    url = f"{SERVICE}/{op}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt, wait in enumerate((*RETRY_WAITS, None)):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if wait is None or e.code in (400, 404):
                raise
            print(f"{op}: HTTP {e.code}, trying again in {wait}s (attempt {attempt + 1} of {len(RETRY_WAITS) + 1})", file=sys.stderr)
        except Exception as e:  # noqa: BLE001 - network errors and timeouts: try again
            if wait is None:
                raise
            print(f"{op}: {e}, trying again in {wait}s (attempt {attempt + 1} of {len(RETRY_WAITS) + 1})", file=sys.stderr)
        time.sleep(wait)
    raise RuntimeError("unreachable")


def uk_date(s: str) -> str:
    return datetime.strptime(s.strip(), "%d/%m/%Y").date().isoformat()


def fetch(until: date) -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    for cid in COMMITTEES:
        xml = get("GetMeetings", lCommitteeId=cid, sFromDate=FROM.strftime("%d/%m/%Y"), sToDate=until.strftime("%d/%m/%Y"))
        (RAW / f"meetings_{cid}.xml").write_bytes(xml)
        for m in ET.fromstring(xml).iter("meeting"):
            mid = m.findtext("meetingid", "").strip()
            when = uk_date(m.findtext("meetingdate", ""))
            path = RAW / f"meeting_{mid}.xml"
            # Meetings in the last 90 days are fetched again: decisions are often published days after the meeting.
            if path.exists() and when < (until - timedelta(days=90)).isoformat():
                continue
            path.write_bytes(get("GetMeeting", lMeetingId=mid))
            time.sleep(0.5)


def build() -> dict:
    decisions: List[dict] = []
    sources: List[dict] = []
    for cid, body in COMMITTEES.items():
        listing = RAW / f"meetings_{cid}.xml"
        if not listing.exists():
            raise SystemExit("no snapshots in data/raw/decisions/; run python3 etl/decisions.py first")
        for m in ET.fromstring(listing.read_bytes()).iter("meeting"):
            mid = m.findtext("meetingid", "").strip()
            path = RAW / f"meeting_{mid}.xml"
            if not path.exists():
                continue
            data = path.read_bytes()
            meeting = ET.fromstring(data)
            if "True" not in {(meeting.findtext("decisionpublished") or "").strip(), (meeting.findtext("minutepublished") or "").strip()}:
                continue
            when = uk_date(meeting.findtext("meetingdate", ""))
            meeting_url = f"{SITE}/ieListDocuments.aspx?CId={cid}&MId={mid}"
            kept = 0
            for a in meeting.iter("agendaitem"):
                flag = lambda t: (a.findtext(t) or "").strip() == "True"
                if flag("isrestricted") or not flag("isdisplayallowed"):
                    continue
                title = unescape(a.findtext("agendaitemtitle") or "")
                aid = a.findtext("agendaitemid", "").strip()
                if flag("isdecision") and flag("isdecisionpublished"):
                    kind, text, url = "decision", plain(a.findtext("decisionnonemptyhtmlbody") or ""), f"{SITE}/ieDecisionDetails.aspx?AIId={aid}"
                elif flag("isminutepublished") and not PROCEDURAL.match(title):
                    kind, text, url = "resolution", resolution(a.findtext("minutesnonemptyhtmlbody") or ""), meeting_url
                else:
                    continue
                text = redact(text)
                if not text:
                    continue
                docs = []
                for d in a.iter("linkeddoc"):
                    if (d.findtext("isrestricted") or "").strip() == "True" or (d.findtext("isdecisionattachment") or "").strip() == "True":
                        continue
                    docs.append({"title": unescape(d.findtext("title") or ""), "url": (d.findtext("url") or "").strip()})
                decisions.append(
                    {
                        "id": f"mg-{aid}",
                        "date": when,
                        "body": body,
                        "meeting_id": int(mid),
                        "item": (a.findtext("fulldisplaynumberformat") or "").strip().rstrip("."),
                        "kind": kind,
                        "title": title,
                        "text": text,
                        "url": url,
                        "meeting_url": meeting_url,
                        "documents": docs[:4],
                    }
                )
                kept += 1
            if kept:
                sources.append({"meeting_id": int(mid), "body": body, "date": when, "url": meeting_url, "sha256": hashlib.sha256(data).hexdigest()})
    decisions.sort(key=lambda d: (d["date"], d["meeting_id"], d["item"].zfill(4)), reverse=True)
    sources.sort(key=lambda s: s["date"], reverse=True)
    return {
        "note": "Generated by etl/decisions.py from the council's ModernGov web service. Do not edit by hand.",
        "publisher": "London Borough of Hammersmith & Fulham",
        "service": SERVICE,
        "from": FROM.isoformat(),
        "decisions": decisions,
        "meetings": sources,
    }


def dump(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1) + "\n"


def check(d: dict) -> List[str]:
    problems = []
    ids = [x["id"] for x in d["decisions"]]
    if len(ids) != len(set(ids)):
        problems.append("duplicate decision ids")
    for x in d["decisions"]:
        if "\u00b7" in x["text"] or "\u00b7" in x["title"]:
            problems.append(f"{x['id']}: middle dot")
        if PERSON.search(x["text"]):
            problems.append(f"{x['id']}: a person's name after a courtesy title")
        if not x["url"].startswith(SITE):
            problems.append(f"{x['id']}: link is not the council's")
    return problems


def main(argv: List[str]) -> None:
    if "--check" in argv:
        d = json.loads(OUT.read_text())
        problems = check(d)
        if problems:
            raise SystemExit("decisions: " + "; ".join(problems))
        print(f"decisions: {len(d['decisions'])} decisions from {len(d['meetings'])} meetings, well formed.")
        return
    if "--offline" not in argv:
        fetch(date.today())
    out = build()
    problems = check(out)
    if problems:
        raise SystemExit("decisions: " + "; ".join(problems))
    OUT.write_text(dump(out))
    print(f"decisions: {len(out['decisions'])} decisions from {len(out['meetings'])} meetings since {FROM.isoformat()}")


if __name__ == "__main__":
    main(sys.argv[1:])
