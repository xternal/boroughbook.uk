# Data sources

✓ = URL seen on 6 Oct 2026. Others are from memory and must be checked when the ETL module is written.

## Council (Hammersmith & Fulham)

| Source | What | URL |
|---|---|---|
| Revenue Budget and Council Tax Levels 2026/27 | Net budget, funding, savings, growth, reserves, medium-term strategy | ✓ https://democracy.lbhf.gov.uk/documents/s133753/Revenue%20Budget%20and%20Council%20Tax%20Levels%202026-27.pdf |
| Budget 2026/27 committee paper | Committee-level budgets and savings (e.g. Streets etc. £41.3m net; transitional relief £6.0m) | ✓ https://democracy.lbhf.gov.uk/documents/s133637/Budget%202026-27.pdf |
| Council Tax Base and Collection Rate 2026/27 | Tax base and collection rate | ✓ https://democracy.lbhf.gov.uk/documents/s133440/Council%20Tax%20Base%20and%20Collection%20Rate%202026-27%20and%20Delegation%20of%20the%20Business%20Rate%20Estimate.pdf |
| Council Tax Support Scheme 2026/27 | Who gets support | ✓ https://democracy.lbhf.gov.uk/documents/s133556/Council+Tax+Support+Scheme+2026-27.pdf |
| Democracy site (ModernGov) | Councillors, wards, committees, decisions, agendas, webcasts. ModernGov sites usually expose a web service (`mgWebService.asmx`); check | ✓ https://democracy.lbhf.gov.uk |
| Transparency: payments over £500, contracts over £5,000, procurement cards | Quarterly files under the Transparency Code | ✓ https://www.lbhf.gov.uk/councillors-and-democracy/data-and-information/transparency/procurement-and-financial-data |
| Statement of accounts | Outturn, reserves, balance sheet | Council website |

## Central government (same for every English council)

| Source | What | URL |
|---|---|---|
| Local Government Transparency Code 2015 | What councils must publish | https://www.gov.uk/government/publications/local-government-transparency-code-2015 |
| Local authority revenue expenditure and financing | Revenue budget (RA) and outturn (RO) returns by standard service line, all councils | https://www.gov.uk/government/collections/local-authority-revenue-expenditure-and-financing |
| Council tax statistics | Band D levels and tax base for every council | https://www.gov.uk/government/collections/council-tax-statistics |
| Local government finance settlement | Core funding, referendum principles | gov.uk, per year |

## London and the GLA

| Source | What | URL |
|---|---|---|
| GLA council tax decision (MD3472, 26 Feb 2026) | The Mayor of London's Band D amount by body: police, fire, transport, City Hall | https://www.london.gov.uk/md3472-approval-2026-27-council-tax-and-precepts-and-communication-council-taxpayers ✓ in use |

## Places and people

| Source | What | URL |
|---|---|---|
| ONS Open Geography Portal | Ward boundaries and codes | https://geoportal.statistics.gov.uk |
| Postcodes.io | Postcode → ward (free, open data) | https://postcodes.io |
| ONS population estimates | Residents per ward/borough | https://www.ons.gov.uk |
| FixMyStreet (mySociety) | Street reports by area | https://www.fixmystreet.com |
| WhatDoTheyKnow (mySociety) | FOI responses as evidence | https://www.whatdotheyknow.com |
| Contracts Finder / Find a Tender | Contracts and tenders | https://www.contractsfinder.service.gov.uk and https://www.find-tender.service.gov.uk |
| Companies House, Free Company Data Product | Supplier matching: number, status, type, date formed, business | https://download.companieshouse.gov.uk/en_output.html ✓ in use (bulk file, no account) |

## Politics

| Source | What | URL |
|---|---|---|
| Council election results | Votes, turnout and winners by ward | Democracy Club API, copied from the council's declarations ✓ in use; council pages at https://www.lbhf.gov.uk/councillors-and-democracy/elections |
| Party manifestos 2026 | Pledges | Party websites; archive every copy |
| Leaflets | Ward-level pledges | Reader submissions (photos), ElectionLeaflets.org archive if available |
| Local press | Statements and coverage | Local outlets, Local Democracy Reporting Service |

## Reused figures in the prototype

| Figure | Value | Source |
|---|---|---|
| Band D 2026/27 | £1,519.51 = £1,009.00 council + £510.51 GLA; 2025/26 £1,451.44 | ✓ https://councildata.co.uk/council-tax/london-borough-of-hammersmith-and-fulham/ (replace with the council's own page or the government table) |
| Council tax increase | 2.99% plus 2% social care precept | Budget 2026/27 committee paper |
| Streets, waste, parks and transport | £41.3m net (committee) | Budget 2026/27 committee paper |
| Transitional relief | £6.0m | Budget 2026/27 committee paper |
| Council tax resources | +£7.7m year on year | Budget 2026/27 committee paper |
| Seats | Labour 38, Conservative 12 of 50; leader Stephen Cowan | Wikipedia (verify with council) |

## ETL notes

* Budget PDFs: extract tables to `data/manual/*.csv` with page references; validate against report totals; human check once per year.
* Payments files: monthly CSV/XLSX with inconsistent columns across years. Normalise headers, keep raw files with hashes, map cost centres to services with a reviewed mapping table.
* Government returns: ODS/XLSX with stable line codes. Best source for comparing councils.

## In use (M1)

`etl/sources.json` lists every file the ETL reads, with its download URL and SHA-256. Council tax tables for 2022/23 to 2026/27, the RA budget return (parts 1 and 2) and the SG grants return for 2026/27 come from gov.uk under the Open Government Licence. The referendum principles report for 2026/27 is cited in `data/config/rules.json`.

The council's democracy site (democracy.lbhf.gov.uk) sits behind an Azure firewall with a JavaScript challenge. Scripts get a 403, and the ETL does not try to get around it. Budget papers are downloaded by hand into `data/raw/` and extracted into `data/manual/` (see its README).

## In use (M4)

`etl/payments_sources.json` lists every quarterly spend file with the council's URL, the Internet Archive's copy where there is one, its SHA-256, and the rows and total recorded from it. The council's page lists the latest nine quarters (April 2024 onwards). Older files were taken down; the Internet Archive kept Q4 2023/24 and five quarters from 2015 to 2017, which `python3 etl/payments.py --fetch` downloads from there.

The council's website answers scripts with "page not found", even with an honest user agent, and the ETL does not pretend to be a browser. Newer files are downloaded by hand from the page above into `data/raw/payments/`, then `--fetch` records their hash, rows and total. Two layouts so far: 2015 to 2017 (14 columns, every payment including under £500, ending with the council's own total row) and 2023/24 onwards (7 columns, over £500 only). Both are read by header name, and a file with unknown headers stops the build.

DuckDB is not used: the whole ledger adds up in Python in a few seconds, and the output is plain JSON that DuckDB can query directly (`read_json`) if anyone wants SQL.

## In use (M6)

- **Ward boundaries:** the ONS Open Geography Portal's Wards (December 2024) Boundaries UK BGC, generalised to 20 m, queried for the borough's 21 wards. `python3 etl/ward_map.py` saves the answer to `data/raw/` with its SHA-256 and projects it to SVG paths in `data/build/ward_map.json`, with each ward's neighbours (wards sharing a stretch of boundary). H&F's wards have not changed since May 2022; the May 2026 file is not served for queries yet. Open Government Licence; the map carries the ONS and Ordnance Survey attribution. The schema checks that every ward on the site has exactly one shape, matched by ONS code.
- **Postcode to ward:** postcodes.io, called by the site's own route (`app/api/postcode`) so postcodes.io never sees the reader, with nothing kept or logged (docs/PRIVACY.md; until 12 Oct 2026 it was called from the reader's browser). It answers with the ONS ward code, which matches the codes in `content/wards.yaml`; the names differ slightly ("College Park & Old Oak", "Shepherd's Bush Green"), so the site matches on codes only.
- **FixMyStreet:** linked, never fetched or copied. Its ward pages use the ONS ward names; all 21 links were checked on 8 Oct 2026 (each page's heading names the ward), and an unknown name answers "Moved".
- **Building schemes by ward:** the spend files name each capital scheme ("Capital - Frank Banfield Park") but never its address. `python3 etl/capital_wards.py --draft` searches OpenStreetMap's Nominatim for the place in each name (bounded to the borough, one request a second, cached, as its usage policy asks) and finds the ward with the ONS boundaries. Claude's check then compared each point with the ward of the nearest postcodes from postcodes.io and placed schemes on roads by every segment of the road. The results, with what OpenStreetMap found, are in `data/manual/capital_scheme_wards.csv` (© OpenStreetMap contributors, ODbL); `python3 etl/capital_wards.py` adds up the month files by ward into `data/build/ward_spend.json`. Two service areas in the capital group are not schemes ("Finance and Resources", "Head of Capital Delivery", £15.7m) and are left out.

## In use (M7)

- **Council decisions:** the council's ModernGov web service (`mgWebService.asmx`, `GetMeetings` and `GetMeeting`) for Cabinet (committee 116) and Full Council (114) since 1 January 2026. The council's web pages refuse scripts, but its web service answers them; `etl/decisions.py` identifies itself honestly, keeps raw snapshots in `data/raw/decisions/` and writes `data/build/decisions.json` with a SHA-256 per meeting. Links on the site go to the council's own decision and meeting pages, which open normally in a browser.
- **Suggested links:** the Claude API (model in `CLAUDE_MODEL`, default `claude-opus-5-5`), asked once per decision; `data/build/decision_assessments.json` records which decisions it has seen. The first 45 decisions were read by Claude in a working session on 8 Oct 2026 instead.

## In use (Phase 1, 8 Oct 2026)

- **The Mayor of London's share by body:** Mayoral Decision MD3472, Appendices (london.gov.uk/media/112084/download, SHA-256 in `etl/sources.json`; the file downloads by script but is marked manual so CI never depends on it). Appendix B's Band D table (PDF page 4) gives police £334.13, fire brigade £76.85, transport £77.09 and City Hall £22.44 for 2026/27, and last year's figures; Appendix A line 9 (page 1) gives the £510.51 total. Extracted by hand into `data/manual/gla_2026-27.csv`; `etl/build.py` checks that the parts add up to the total in both years and that the total equals the GLA element of the government's council tax tables (area Band D less the council's own). Other bands are split in proportion, in whole pence that add back up (`splitPence` in the engine).
- **Ward election results:** Democracy Club's API (`/api/next/ballots/?election_id=local.hammersmith-and-fulham.2026-05-07`), CC BY-SA 4.0. Democracy Club copies each declaration from the council's result page and keeps its address. `python3 etl/elections.py` writes `data/build/elections.json`: seats, ballots, turnout, rejected papers and each candidate's party and votes. Only the elected are named, through the council's councillor records, matched by surname within the ward (the declarations use legal names, "Alexandra Sanderson" for Alex Sanderson). Addison and Palace and Hurlingham were read against the council's own result pages on 8 Oct 2026: every figure matched.
- **Free home care history:** the 2014 Labour manifesto (held by the council as document s50600, PDF page 18), the Cabinet report of 2 February 2015 (s60121) with its decision from the ModernGov web service, the Full Council minutes of 25 February 2015 (vote 25 to 0, from the web service) and the Full Council report of 17 October 2024 (s129307). The council's documents refuse scripts; they were read in a browser.
- **Free home care today:** the council's Freedom of Information answer of 27 October 2026 (reference 27548494, on WhatDoTheyKnow): 1,670 people and 1,259,466 hours of council-arranged home care in 2025/26, and no estimate since April 2022 of the income charging would raise, because the council does not assess most users' means. So the "Keep free home care" switch in Balance it stays held back: there is no sourced cost to put on it.
- **Weekly rubbish collections:** the council's Freedom of Information answer of 27 October 2026 (reference 27548393, on WhatDoTheyKnow): £2,101,200 budgeted in 2025/26 to collect household rubbish, separately from recycling and food waste, and no estimate since April 2022 of what fortnightly collections would save. The "Keep weekly rubbish collections" switch in Balance it uses half of that, about £1.05m, marked modelled: fortnightly rounds roughly halve the collections, and the real saving is likely smaller.

## In use (Phase 2, 8 Oct 2026)

- **Suppliers on the companies register:** Companies House's Free Company Data Product, the snapshot of 1 October 2026 (`BasicCompanyDataAsOneFile-2026-10-01.zip`, 471 MB, about 5.7 million live companies; SHA-256 in `etl/companies_house.py`). No account or API key. `python3 etl/companies_house.py --scan` streams it once and keeps the 2,931 companies whose name, now or before, could be a supplier's; `python3 etl/companies_house.py` matches and writes `data/build/companies.json`. A supplier is linked automatically only when its tidied name is exactly one live company's name, now or (if it still had that name when the council started paying it) before a change of name, and the company existed before the council first paid that name. Looser candidates (only the suffix differs, or the company was formed during the payments) are listed in `data/manual/companies_house_matches.csv` and linked only when checked. The registered office's local authority comes from postcodes.io; the postcode is not kept. Companies House states no formal licence for the file and says there are no restrictions on its use; we republish register facts only.

## In use (Phase 2, item 7, 9 Oct 2026)

- **The building programme:** Four Year Capital Programme 2026-30 and Capital Strategy 2026/27, the version Full Council adopted on 25 February 2026 (`mgConvert2PDF.aspx?ID=134079`, 28 pages, SHA-256 in `etl/sources.json`). The council's site refuses scripts, so it was read in a browser; its Appendix 1 matches the Cabinet version in the downloaded Cabinet pack (pages 152 to 156) line for line. Extracted by hand into `data/manual/capital_2026-30.csv` and checked by `etl/capital.py` against every printed total. The resolution names £135.5m and £318.8m while the report's tables add up to £135.0m and £317.2m; the site shows the tables and says so.
- **Council homes:** the Housing Revenue Account budget report to Cabinet, 9 February 2026, in the Cabinet pack already downloaded (pages 157 to 178). Table 1 and the quoted facts are in `data/manual/council_homes_2026-27.csv`, each with its page.

## In use (Kensington and Chelsea, 9 Oct 2026)

- **Bill, budget, history:** the same government returns already downloaded for Hammersmith & Fulham (they cover every council), read for ONS code E09000020 by `etl/boroughs.py` with the same checks.
- **Councillors:** the Royal Borough's ModernGov web service (`https://www.rbkc.gov.uk/committees/mgWebService.asmx`, `GetCouncillorsByWard`), which answers scripts.
- **Ward codes, seats and results:** Democracy Club, `local.kensington-and-chelsea.2026-05-07` (18 wards), CC BY-SA 4.0.
- **Ward boundaries:** the ONS Wards (December 2024) service already used, for LAD24CD E09000020.

## In use (15 more boroughs, 9 Oct 2026)

The same returns, Democracy Club and ONS sources as Kensington and Chelsea; each council's ModernGov web service for its councillors, listed in `data/config/boroughs.json` (Barking and Dagenham and Camden answer scripts only at their `*.moderngov.co.uk` address; Hackney's is at `hackney.moderngov.co.uk`). Hackney's and Tower Hamlets' mayoral results come from Democracy Club's mayoral ballots.

## In use (Manchester and Birmingham, 9 Oct 2026)

- Council Tax levels 2026 to 2027 and 2025 to 2026, Tables 8d (police), 8e (fire and rescue) and 8f (combined authorities), already downloaded with Tables 1 to 9, for the split of the rest of the bill outside London.
- Table 10's parish precept and parish tax base columns, for the parish note.
- Manchester's ModernGov web service (`https://democracy.manchester.gov.uk`). Birmingham has none that answers; its councillors are Democracy Club's record of May's winners.

## Not usable: Leeds' ModernGov (9 Oct 2026)

`https://democracy.leeds.gov.uk` answers 403 Forbidden to every request that is not a person's browser, its `mgWebService.asmx` included. Leeds' councillors are not shown until the council opens it or publishes the list another way; we do not disguise our requests.

## In use: by-elections (9 Oct 2026)

Democracy Club's register of elections (`https://elections.democracyclub.org.uk/api/elections/`, CC BY-SA 4.0): every by-election to each council since 7 May 2026, saved with the ballots as `data/raw/boroughs/<slug>/byelections_<date>.json` and cited on each borough's councillors. The API's date filter is not relied on; dates are filtered in `etl/borough_people.py`.

## In use: Scotland (9 Oct 2026)

- Scottish Government, Council Tax datasets: Council Tax by band 2026-27, and Band D Council Tax rates by year 1996-97 to 2026-27 (`scot_ct_bands_2026-27`, `scot_band_d_1996-2027`).
- Scottish Government, Local government 2025-26 provisional outturn and 2026-27 budget estimates, revenue workbook, revised 24 July 2026 (`pobe_2026`).
- Scottish Water, unmetered household charges leaflets 2025/26 and 2026/27, table on page 5 (`scottish_water_2025-26`, `scottish_water_2026-27`). Read in a browser; the 2024/25 leaflet has no text.
- Glasgow City Council's CoInS pages (`https://onlineservices.glasgow.gov.uk/councillorsandcommittees`): all members and each political group. Its main website shows a bot challenge, which we do not get round; these pages answer normally.
- The law in `data/config/rules_scotland.json`: LGFA 1992 ss.74, 79 and 93, SSI 2016/368, SI 1992/1332 Schedule 1, LG(S)A 1973 s.95.

## In use: Wales (9 Oct 2026)

StatsWales has moved to `https://stats.gov.wales` with an API at `https://api.stats.gov.wales/v2/` (datasets by id; a council's rows by a stable filter id). Cardiff's: composition of average Band D, council tax levels by band, budget requirement (BR1), budgeted revenue expenditure by service, and its financing. Cardiff's own website and ModernGov pages show a bot challenge, which we do not get round; its ModernGov web service answers normally. Snapshots of it include councillors' home addresses where they gave them, and stay in `data/raw` (not committed); only names, wards and parties are published.

## In use: Northern Ireland (9 Oct 2026)

Belfast's rates and budget come from three places, none of which a script reads in CI: the Department of Finance's rate poundages page (`finance-ni.gov.uk/articles/rate-poundages`, three years; earlier years from the Internet Archive), the Department for Communities' District Council Rate Statistics circulars (one PDF a year, five pages: Table 1 the amount to be raised and the rates, Table 2 penny products and grants, Table 3 the change on last year, Table 4 the rates on last year) and the council's Strategic Policy and Resources Committee minutes of 13 February 2026 (the rate-setting report itself was restricted). Each is recorded in `etl/sources.json` as manual, with its SHA-256, and read into `data/manual/` with page numbers. Rules: nidirect's rates pages and the Rates (Maximum Capital Value) Regulations. Wards to district electoral areas: NISRA's lookup (ODS). Councillors: Belfast's ModernGov web service. Not published anywhere we found: Belfast's budget by service below committee level, an official average capital value for Belfast, and vote counts in a form Democracy Club carries (the Electoral Office for Northern Ireland publishes a spreadsheet per area, not yet used).

## In use: adult social care costs (10 Oct 2026)

`etl/adult_care.py` reads the government's adult social care finance report for 2024/25 (Department of Health and Social Care, published 23 October 2025, data tables corrected 13 November 2025), which every English council's return (ASC-FR) feeds. For each English council on the site: gross spending on care for adults by type (Tables 14, 43 and 44, £ thousand) and the report's own average costs: a week in a care or nursing home by age group (Table 52) and an hour of home care (Table 51, from agencies, or the council's own where it buys none). The report warns against dividing spending by numbers of people, so no cost per person is worked out here. The build checks each age group's types of care add up to its total, the two add up to the long-term care total, and long-term, short-term and other care add up to the council's total. Shown on every English council's page as "What care for adults costs". Scotland, Wales and Northern Ireland publish theirs differently; children's services are next (the Department for Education's spending statistics and its count of children in care).

## In use: children's care (10 Oct 2026)

`etl/children_care.py` reads the Department for Education's Section 251 outturn for 2024/25 (LA and school expenditure, published 11 December 2025; the Department has decided to stop this series, and 2025/26's outturn moves to GOV.UK, so next year needs a new reader) and its children looked after statistics for 2025 (published 20 November 2025; counts on 31 March by placement). For each English council on the site: gross spending on children looked after by type (lines 3.1.1 to 3.1.10, which must add up to 3.1.11, allowing £10 of the Department's rounding), all children's services spending (5.0.2), and the number of children in care and where they live. The two files are joined by the Department's own council number, because the spending file keeps old codes for some councils (North Yorkshire). "c" (withheld to protect children's identities) is shown as withheld; Wandsworth's 2024/25 spending is withheld by the Department over data quality concerns, and the page says so. Neither source gives a cost per child, and the Department and the National Audit Office warn that councils' accounts vary (for Swindon, the Department's and the housing ministry's returns disagree about two to one on residential care), so no council's spending is divided by its children; England's cost of a year in a children's home is worked out the National Audit Office's way and marked as our own sum.

## In use: a two-tier area, South Oxfordshire (10 Oct 2026)

The county council's figures come from the same government files as every council's: its Band D from Table 8b of the council tax levels, its council tax requirement and tax base from Table 10's precepting authorities' sheet (`Data_Precepting`, second column of each pair), and its budget from the RA and SG returns. Read by hand, each recorded in `etl/sources.json` as manual with its SHA-256: South Oxfordshire's statutory notice of council tax for 2026/27 (PDF; every parish's Band D), Henley Town Council's 2026/27 budget (its precept and tax base, to check the notice), Oxfordshire County Council's councillors by division (its ModernGov web service), the government's decision letter of 16 July 2026 on reorganising Oxfordshire's councils (PDF) and the district's announcement of it. The adult and children's care readers now include county councils (codes E10), so a two-tier area shows its county's figures.

## In use: Make your case (11 Oct 2026)

`etl/make_your_case.py` builds `data/build/make_your_case.json` from two tables read by hand. `data/manual/make_your_case.csv` says, for each subject (care for adults, council tax next year, next year's budget), what the law requires, what the government decides and what the council chooses, each row citing a law on legislation.gov.uk (Care Act 2014 sections 9, 14 and 18; Local Government Finance Act 1992 sections 31A and 52ZB), the government's settlement, or the council's own papers (the report to Cabinet of 12 October 2026; the report to Full Council of 17 October 2024 on free home care). `data/manual/take_part_2026-27.csv` holds the council's rules for public questions to Full Council (with the 2026-27 deadlines), petitions (100, 250 and 5,000 signatures) and deputations, from its "Take part in the democratic process" page, read in a browser on 11 October 2026. The build checks every subject covers the law, the government and the council, every source is one we hold, and every question deadline is at least seven clear working days before its meeting at 12 noon, as the council's rules say. Both tables were checked by Claude and reviewed by the owner (October 2026), so sourced; next year's deadlines need the same review. The care comparison (`careComparison` in `apps/web/lib/adultCare.ts`) ranks each council's costs among London boroughs (or all English councils on the site) from the adult social care finance report, and `etl/adult_care.py` now keeps long-term care by age group (Tables 43 and 44). Next year: the council's 2027-28 deadlines, when it publishes them.

## In use: what people who get care say (11 Oct 2026)

`etl/adult_care.py` also reads the Department of Health and Social Care's adult social care outcomes framework for 2024/25 (time series data, 23 January 2026), which comes from the yearly Adult Social Care Survey of people who get care and support from their council. For every English council on the site, London and England: the share extremely or very satisfied with their care and support (ASCOF 1D), who say they have control over their daily life (3A), and who say they feel safe (4A), each with its 95% margin of error and number of respondents. Shown on every English council's page under "What care for adults costs" (for a two-tier area, the county's), and in Make your case. A council's answer is called lower or higher than London's or England's only where the gap is bigger than the two margins of error together; nothing is ranked, because a survey of a few hundred people cannot carry a league table. The care regulator's ratings of councils are published one report at a time, with no single file, and are not on the site yet.

Budget meeting dates: the council's report to Cabinet of 12 October 2026 (Table 11) proposes Cabinet on 15 February and Full Council on 1 March 2027; its calendar of meetings, read on 11 October 2026, has Cabinet on 8 February and Full Council on 24 February, and no Full Council in March. The page shows the report's dates, marked proposed, with the calendar's beside them (`note` in `budget_timetable_2027-28.csv`).

## In use: Make your case for everyday services (12 Oct 2026)

Three more subjects in `data/manual/make_your_case.csv`, each citing the law on legislation.gov.uk: bins and streets (Environmental Protection Act 1990 section 45; Highways Act 1980 section 41; Road Traffic Regulation Act 1984 section 45), libraries, parks and leisure (Public Libraries and Museums Act 1964 sections 7 and 10), and housing and homelessness (Housing Act 1996 sections 166A, 188, 189 and 189B). `etl/make_your_case.py` also works out, for each, the share of the money each London borough on the site pays for itself that goes on it, from the 2026/27 budget returns already in `data/build` (Hammersmith & Fulham's statement and every London borough's): a share rather than a sum per resident, so no population figures are needed. The rows are "checked" until the owner reviews them.

## In use: the council tax decoder (12 Oct 2026)

`etl/decoder.py` builds `data/build/council_tax_decoder.json` (and a small index for the postcode box) from the government's council tax requirement tables for 2026/27 and 2025/26 (Table 10, `ctr_2026-27` and `ctr_2025-26`, already fetched with their SHA-256). For each of England's 296 billing authorities, `Data_Billing` gives the average Band D (two adults) without local precepts (line 9: the council's own share), with them (line 8: the difference is parish and town councils on average), each major preceptor's share (line 16: county council or GLA, police, fire, combined authority) and the area's whole Band D (line 17); `Precepting_Bodies` names the preceptors, which the build puts into plain words ("Thames Valley PCC" is the Thames Valley Police and Crime Commissioner). The build checks the parts add up to line 17 for every authority in both years, to the penny; that this year's table and last year's agree on last year's figures; and that every share is named. A test checks the decoder against every English council page on the site, whose bills come from Tables 8 and 9: outside a parish they agree for all of them. Postcodes are looked up by the site's own route (`app/api/postcode`), which asks postcodes.io and keeps nothing (docs/PRIVACY.md). Built for the owner's 30-day plan ("Build 2"), at `/council-tax` and one page per council at `/council-tax/<council>`.

