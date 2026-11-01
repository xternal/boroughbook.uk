# Pledge finder

Every two weeks the AI Journalist (Claude, an AI, run by the weekly ledger desk, a scheduled task on the owner's computer every Sunday evening; `docs/desk/WEEKLY.md`) looks for new pledges about Hammersmith & Fulham, drafts a card for each one and checks each quote word for word against its source. It opens a pull request and never merges or approves it: a card appears on the site only after the editor, Pavel Guzhikov, has read its quote against the source and approved it. One editor's approval is enough since 17 October 2026 (docs/PROMISE_STANDARD.md, sections 5 and 7). These are its instructions. Change them by pull request, like any other rule.

## Where it runs, and why not in the cloud

On the owner's Mac, in the Claude app, as part of the weekly ledger desk (`docs/desk/WEEKLY.md`), in a worktree of its own beside `/Users/xternal/dev/borough-ledger`. Until 20 October 2026 it was its own task, `bb-pledge-finder`, on Monday mornings. It needs the open web: the party sites, the council's site (which refuses scripts, so it is read in the app's built-in browser) and the Wayback Machine. On 13 October 2026 a cloud routine on this account could reach only GitHub, npm and PyPI, and its GitHub login failed, so it could not read a single source. To move it to the cloud later, set the cloud environment's network access to "Full" and connect GitHub on claude.ai, run it once by hand, and check that `promises:quotes` reaches web.archive.org. If the Mac is off on a Sunday evening, the task runs when the app next opens.

## 0. Is a run due? Then start the branch

The weekly desk reaches this site every Sunday. A run is due when no **scheduled** run has opened a "New pledges, ..." pull request in the last 10 days, open, merged or closed:

```bash
python3 scripts/pledge_finder.py due
```

It prints `run` or `skip` with the reason, then how far back to look (section 1). On `skip`, stop at once and do nothing else. This checks what actually happened rather than the weekday, so a late or repeated run cannot draft a fortnight's work twice, and a missed Sunday is caught up the next Sunday. With a run every other Sunday it skips the Sundays in between (25 October 2026 runs, 1 November skips, 8 November runs). A scheduled run that opens no pull request leaves the next Sunday due.

Because the task runs on the owner's computer, GitHub checks it from outside: every Tuesday the workflow `pledge-finder-watch.yml` runs `due` too, and if it still says `run`, Sunday's run did not open its pull request (it never fired, stopped at a permission prompt or failed), so the workflow opens or updates the `job-failed` issue. If the run found nothing new with the backlog empty (section 5), close the issue.

Only scheduled runs set the schedule. The only way past a `skip` is a person in a Claude session asking for the pledge finder to "run anyway"; the scheduled task never does. A run by hand skips the check, and its pull request counts only for where the next run looks back to: it never moves the next scheduled run. (Until 19 October 2026 any "New pledges" pull request counted, so the run by hand of 18 October, #95, would have pushed the run due on 26 October out to 2 November.) Each pull request says in its first line which kind of run opened it; the check reads that line, and a pull request without it counts as by hand. The schedule started with the first run, on 14 October 2026 (#89), recorded in the script as `SCHEDULE_STARTED`.

On `run`, or for a run by hand, start the branch before anything else:

```bash
python3 scripts/pledge_finder.py start --scheduled   # the weekly desk's scheduled run
python3 scripts/pledge_finder.py start --by-hand     # a person's "run anyway"
```

It fetches `main`, switches to a new branch `pledges-<YYYY-MM-DD>` off `origin/main` (`pledges-<YYYY-MM-DD>-2` if a run that day already has the name), and prints the pull request's title and the first line of its body. Every run works and commits on that branch, a run by hand too: never on a Claude session's own branch (such as `claude/...`) or on `main`.

## 1. Where to look: the same places for every party

Look back to the date of the last pledge-finder pull request (titled "New pledges, ..."), scheduled or by hand, or 21 days if there is none. `due` prints it ("look back to ...").

| Place | What to read | Notes |
|---|---|---|
| Each party with seats (`content/parties.yaml`) | Its local website's news and campaign pages | Conservatives: https://www.hfconservatives.org.uk/news. Labour: https://hflabour.com/, which often does not answer scripts; read its newest Wayback Machine capture (`https://web.archive.org/web/2026/https://hflabour.com/`). hflabour.org.uk is not the party. |
| Each party's official social media | Posts in the window | Labour: https://www.facebook.com/HFLabour/ and https://www.instagram.com/hflabour/ (given by the editor on 14 October 2026, while hflabour.com does not answer). Conservatives: https://www.facebook.com/hfconservatives and https://x.com/hfconscllrs (linked from their own site). Read in the built-in browser without signing in: decline optional cookies, close any sign-in box, never sign in. Facebook then shows the newest posts; on Instagram, open the newest posts to read each date and caption. If a login wall still hides the posts, list the page under "Could not read". |
| The council's news | https://www.lbhf.gov.uk/news | Only commitments made by a named councillor (usually a Cabinet member). Officers' plans are not pledges. |
| Cabinet and Full Council | `data/build/decisions.json` (fetched daily) and the agendas on https://democracy.lbhf.gov.uk | Motions passed, the Leader's statements, the budget speech in February and March. |
| By-elections | Candidates' published leaflets and websites, for any ward with a by-election in the window | Every candidate in that ward, not only the parties with seats. |
| The manifesto backlog | `pnpm --filter @borough-ledger/schema promises:manifesto <party id>` | See section 3. |

Read each place with curl or WebFetch first. A site that refuses scripts (the council's, often hflabour.com) is read in the built-in browser instead; never sign in, never get round a bot check, never download files. If a place still cannot be read, say so in the pull request under "Could not read". Never skip a place silently, and never read one party's places more closely than another's. Social media posts count only when the post can be archived and its words read from the archive (`promises:quotes` checks this); a post the archive cannot read goes under "Considered, not added".

## 2. What counts

A pledge is a commitment to a future, checkable change in the borough, made by a party, a councillor or a candidate (docs/PROMISE_STANDARD.md, section 1). "We will build 500 council homes by 2030" counts. These do not:

- an aim with nothing to check ("we want a fairer borough");
- something already done, or a description of a service that already runs;
- a national party's pledge that is not specific to the borough;
- a plan in an officers' report, unless a councillor commits to it;
- criticism of another party.

A pledge already on a card, said again in new words, is a **rewording**: add a version to that card and a `reworded` event; never start a second card. A pledge said again in the same words is not news; leave it.

Judge only what was said, never who said it. When in doubt, leave it out and list it under "Considered, not added" with one line on why.

## 3. The manifesto backlog

Every party's headline pledges already have cards. The rest of each manifesto gets cards in page order: in each run, draft the **next two** pledges from each party's manifesto that have no card yet (the same number for every party), using the rules in section 2. When one manifesto has none left, carry on with the others; in the end every manifesto is covered in full. Use the manifesto's own words, its PDF page number, and its `source_url` from `content/parties.yaml` (the manifesto's archived copy there covers the card).

## 4. The card

One YAML file per pledge in `content/promises/`, named by its id: the party's prefix (`lab`, `con`, or the first three letters of another party's id), the year the pledge was made, and a few words (`con-2026-street-lighting`). Copy an existing card's layout. For each new card:

- `actor`: `{kind: "councillor", id: <file name in content/councillors without .yaml>}` when a named councillor made it; otherwise `{kind: "party", id: <party id>}`.
- `made_on`: the date it was first said or published. `venue`: `manifesto`, `leaflet`, `hustings`, `council_meeting`, `press` or `social`.
- `area`: one of the areas already used on cards (`grep -h "^area:" content/promises/*.yaml | sort -u`).
- `versions`: one entry with `text` copied exactly as published (typos included), `recorded_on` today, `source_url`, `page` for a PDF, and `archive_url`: a Wayback Machine copy you made (`https://web.archive.org/save/<url>`). A manifesto pledge needs no `archive_url`; the manifesto's own archive covers it.
- `status`: `promised` if the party (or the councillor's party) runs the council (`control` in `data/build/content.json`), otherwise `not_in_power`. Never anything else: statuses move only on evidence, through the daily decisions job.
- `deadline`: the date the pledge itself names, otherwise `null`. Leave out costs; the editor costs pledges from council figures.
- `events`: one `promised` event on `made_on`, saying where it was made ("Said by the Cabinet Member for ... in a council press release").
- `replies: []` and `editor_check_required: true`.

A status event that quotes its evidence (in curly quotes) is checked word for word by `promises:quotes`, like a version: against the decision's text when `evidence_url` is a council decision in `data/build/decisions.json`, otherwise against `archive_url`, the Wayback Machine copy of the evidence, which the event must then have (October 2026 backtest: two news-based events of 18 October went live unchecked).

Never edit or delete anything already in `versions`, `events` or `replies` (CLAUDE.md invariant 8). Plain British English, active voice, no middle dots.

## 5. Checks, then the pull request

```bash
pnpm install --frozen-lockfile
pnpm --filter @borough-ledger/schema content:build
pnpm --filter @borough-ledger/schema content:check
pnpm --filter @borough-ledger/schema content:append-only origin/main
pnpm --filter @borough-ledger/schema promises:quotes origin/main
```

`promises:quotes` reads every new quote's source and fails unless the words are there word for word, on the cited page. Fix or drop any card it fails; never loosen the check. When all pass, commit on the `pledges-<YYYY-MM-DD>` branch that `start` made (section 0), push it and open a pull request against `main` with the title `start` printed ("New pledges, <day month year>"):

```bash
gh pr create --base main --head pledges-2026-10-26 --title "New pledges, 26 October 2026" --body-file pr-body.md
```

Commit messages end with "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" and the pull request body with "🤖 Generated with [Claude Code](https://claude.com/claude-code)". Write `pr-body.md` outside the repository (or delete it before committing), so it is never committed.

The pull request body starts with the line `start` printed, exactly as printed (it ends with a hidden marker that `due` reads): "Run: scheduled ..." for the scheduled task, "Run: by hand ..." for a run by hand. Then:

1. **Places checked**: each place in section 1, with what was found or "nothing new".
2. **New cards**: for each, one line on why it counts and who made it.
3. **Quotes**: the table `promises:quotes` printed.
4. **Considered, not added**: with one line each.
5. **Could not read**: each place and the error.

Do not merge it, approve it or turn on auto-merge. If nothing new was found and the backlog is empty, open no pull request. If no place could be read at all, open an issue titled "Pledge finder could not read its sources" with the errors (`gh issue create`), so the editor knows.
