# Maharashtra Budget Data Package (v0.1.0-draft)

Machine-readable Maharashtra **Demands for Grants** (department white books) for **15 budget years, 2010-11 to 2026-27**, in the two-table format of the Karnataka and Tamil Nadu packages in this repository. MH-only differences are marked below.

Schema version `mh-public-two-table-v1`. Source commit `2b4ce9f0d13d2c68301818264855bbdf69ed37c8` of the pipeline repository. 501,984 budget rows, 224,299 additive leaves, 729,876 check comparisons.

## Start in 5 Minutes

```python
import json
total = 0
with open("MH_years/MH_2026-27/MH_json/MH_budget_leaves_2026-27.ndjson") as f:
    for line in f:
        for a in json.loads(line)["amounts"]:
            if a["measure"] == "budget_estimate" and a["fiscal_year"] == "2026-27":
                total += a["value"]
print(f"BE 2026-27: {total / 1e4:,.0f} INR crore (gross, before recoveries)")
```

**Units: every amount is INR thousand (`amount_unit = INR_thousand`).** Divide by 100 for INR lakh, by 10,000 for INR crore. Karnataka is in INR lakh; the `_inThous` suffix on the amount columns marks the difference, as in Tamil Nadu.

## Do Not Blindly Sum

The budget CSV keeps every extracted row: headings, leaves, printed totals at five levels, the closing Gross Total / Recoveries / Net Total block, and the I-Summary and recoveries tables. Summing a column double-counts. **The additive-leaf predicate** (the same three conditions as Karnataka):

```
type_of_table = 'object_head'
AND row_type  = 'Data'
AND row_level = 'Object-Head'
```

`MH_budget_leaves_<year>.ndjson` holds exactly these rows. Leaves are **gross** expenditure. Recoveries print in the `recoveries` table and are not leaves; Net = Gross Total - Deduct Recoveries per major head.

Row levels, top to bottom: Major-Head, Sub-Major-Head, Minor-Head, Sub-Head, Detailed-Head, Object-Head (leaf). MH demands are letter-scoped per department book (`F-2` is demand 2 of book F, Urban Development).

## Coverage

| Year | Era | Demands | Budget rows | Leaves | Snippets extracted / expected | Check keys | Key pass % | W06 pass % |
|---|---|---|---|---|---|---|---|---|
| 2010-11 | plan (12 money columns) | 189 | 28,099 | 13,462 | 380 / 426 | 9,043 | 79.52 | 86.90 |
| 2012-13 | plan (12 money columns) | 189 | 29,366 | 14,071 | 400 / 434 | 9,492 | 80.53 | 86.69 |
| 2013-14 | plan (12 money columns) | 206 | 30,233 | 14,333 | 419 / 440 | 9,860 | 80.61 | 90.72 |
| 2014-15 | plan (12 money columns) | 208 | 29,341 | 14,048 | 414 / 447 | 9,188 | 81.84 | 90.15 |
| 2015-16 | plan (12 money columns) | 209 | 31,197 | 14,654 | 435 / 449 | 9,743 | 82.29 | 91.44 |
| 2016-17 | plan (12 money columns) | 205 | 33,577 | 15,038 | 427 / 451 | 10,221 | 81.77 | 89.03 |
| 2017-18 | plan (12 money columns) | 205 | 33,884 | 15,783 | 427 / 456 | 10,064 | 79.46 | 92.40 |
| 2018-19 | 4 money columns | 201 | 29,723 | 12,201 | 415 / 415 | 12,460 | 92.40 | 95.85 |
| 2019-20 | 4 money columns | 216 | 35,364 | 15,157 | 442 / 442 | 14,107 | 91.85 | 95.51 |
| 2020-21 | 4 money columns | 207 | 33,886 | 14,501 | 448 / 448 | 13,728 | 92.06 | 95.89 |
| 2021-22 | 4 money columns | 212 | 35,381 | 15,202 | 452 / 452 | 14,349 | 92.15 | 96.17 |
| 2022-23 | 4 money columns | 213 | 36,271 | 15,544 | 455 / 455 | 14,346 | 92.89 | 97.05 |
| 2023-24 | 4 money columns | 213 | 36,995 | 16,046 | 450 / 450 | 14,862 | 91.63 | 94.55 |
| 2024-25 | 4 money columns | 211 | 37,713 | 16,324 | 450 / 450 | 15,003 | 92.14 | 95.19 |
| 2026-27 | 4 money columns | 225 | 40,954 | 17,935 | 488 / 488 | 16,003 | 91.73 | 96.43 |
| All | | | 501,984 | 224,299 | | 182,469 | 87.93 | 92.92 |

A check key is one check on one key over all money columns (the state validator's item). 2011-12 is out of scope; 2025-26 is not public.

## Amount Columns

| Pos | Column pattern | Content | Fiscal year |
|---|---|---|---|
| 1 | `accounts_<year>_amount_inThous` | Actuals | document year - 2 |
| 2 | `budget_estimate_<year>_amount_inThous` | BE (restated) | document year - 1 |
| 3 | `revised_estimate_<year>_amount_inThous` | RE | document year - 1 |
| 4 | `budget_estimate_<year>_amount_inThous` | BE (headline) | document year |

`<year>` is the fiscal year with an underscore (`2024_25`). Canonical source rule, as in Karnataka: BE(Y) from document Y, RE(Y) from document Y+1, Actuals(Y) from document Y+2.

**Plan era (2010-11 to 2017-18).** The book prints each year group as Non-Plan | Plan | Total. The positional column holds the printed Total. The MH-only columns `<type>_<year>_nonplan_amount_inThous` and `<type>_<year>_plan_amount_inThous` hold the two parts; they are blank from 2018-19. NDJSON amounts carry them as `plan_split`.

**Money cells.** The package reads each money cell of the source by this rule (counts over all money cells of all years):

| Source cell | Example | Package amount | Flag | Validator reads | Cells | Rows |
|---|---|---|---|---|---|---|
| Figure | `1,234`, `-56` | the figure | none | the figure | 1,457,280 | 296,642 |
| Nil mark | `..` (1,100,947), `-` (1,107), `.` (1) | 0 | none | 0 | 1,102,055 | 214,251 |
| Minus, comma, figure | `-,15` | -15 | none | -15 | 109 | 82 |
| Bracketed code | `(00)`, `(01)`, `(47028056)` | blank | `NON_MONEY_AMOUNT` | a negative number (`(01)` = -1) | 1,670 | 1,670 |
| Code with trailing comma | `00,`, `904,` | blank | `NON_MONEY_AMOUNT` | the number (`904,` = 904) | 25 | 25 |
| Two equal figures merged | `-,44,80,44,80` | blank | `NON_MONEY_AMOUNT` | one long negative number | 5 | 5 |
| Other text | `02 Wages`, `INR_thousand` | blank | `NON_MONEY_AMOUNT` | 0 | 20,747 | 19,014 |

A blank cell stays blank. Rows counts a row once per form; one row can hold several forms. The nil marks, `-` included, are printed nils: the package reads them as 0, as the state validator does. MH prints a negative with a minus sign. The bracketed cells are codes (sub-head, detailed-head or account codes) that landed in a money column, and so are the cells with a trailing comma. The checks keep the validator's reading of every cell, so the reconciliation with the validator is not affected by this rule.

## Schema Mapping

| Source column (year tables) | Package column |
|---|---|
| table file (minor_head_summary, object_head_summary, recoveries) | `type_of_table` (minor_head, object_head, recoveries) |
| Printed_Page_Number | `page_number` |
| Row_Type, Row_Level | `row_type`, `row_level` (as extracted) |
| Printed_Row_Label | `row_header` |
| demand of the file name (D-tag, e.g. DF2) | `demand_number` (F-2) |
| Major/Sub_Major/Minor/Sub/Detailed_Head_Code and _Name | the shared code and name columns |
| Object_Head_Code, Object_Head_Name | `object_head_code`, `object_head_description` (Karnataka names) |
| Scheme_Account_ID | `full_account_code` (MH budget code as printed) |
| Vote_Charge_Marker | `vote_charge_marker` |
| Financial_Col_1..4, or the Total sub-columns 3, 6, 9, 12 | the four `_amount_inThous` columns |
| Financial_Col_1, 2, 4, 5, 7, 8, 10, 11 (plan era) | MH-only `_nonplan_` / `_plan_` columns |
| Scheme_Type_Marker | MH-only `scheme_type_marker` |
| Source_Snippet | MH-only `source_snippet` |
| Amount_Unit | `amount_unit` (always INR_thousand; a different cell value is flagged) |
| Source_Page_Number, Source_Section, Header_Marker, Notes, Extraction_Page, Extraction_Iteration | not carried (pipeline provenance; the section is `type_of_table`) |

MH-only `quality_flags` lists the data faults of each row (see `MH_known_caveats.md`). Column definitions: `MH_data_dictionary.csv`.

## Leaf Rule, Proved

MH prints no statewide total in the white books (the summary volume is not extracted). The top printed total of each packet is the major-head **Gross Total**. The proof compares, per year, the sum of the leaves with the printed Gross Totals over the major heads (per demand) where both were extracted (check W16), and reports the leaves outside those major heads. All figures INR crore, position 4 (BE of the document year). Some Gross Total rows were extracted twice (same leg, same figures); the check sums both copies. "Rows once" counts each such row once.

| Year | Majors with Gross Total | Majors exact | Majors with a repeated row | Leaf sum there | Printed Gross Total (as checked) | Gap % | Printed Gross Total (rows once) | Gap % (rows once) | Leaves elsewhere |
|---|---|---|---|---|---|---|---|---|---|
| 2010-11 | 170 | 100 | 1 | 83,878 | 90,836 | -7.66 | 90,813 | -7.64 | 42,474 |
| 2012-13 | 178 | 115 | 1 | 78,167 | 97,811 | -20.08 | 97,786 | -20.06 | 52,519 |
| 2013-14 | 190 | 119 | 2 | 89,020 | 108,581 | -18.02 | 108,574 | -18.01 | 75,413 |
| 2014-15 | 177 | 104 | 1 | 107,467 | 120,739 | -10.99 | 119,337 | -9.95 | 63,506 |
| 2015-16 | 198 | 128 | 3 | 145,938 | 155,458 | -6.12 | 153,277 | -4.79 | 74,497 |
| 2016-17 | 267 | 176 | 0 | 160,981 | 168,802 | -4.63 | 168,802 | -4.63 | 81,315 |
| 2017-18 | 250 | 145 | 2 | 158,492 | 194,513 | -18.52 | 194,513 | -18.52 | 71,559 |
| 2018-19 | 397 | 334 | 7 | 306,965 | 359,226 | -14.55 | 351,210 | -12.60 | 1,352 |
| 2019-20 | 423 | 358 | 12 | 389,824 | 528,905 | -26.30 | 409,421 | -4.79 | 8,842 |
| 2020-21 | 436 | 378 | 2 | 384,630 | 435,132 | -11.61 | 423,898 | -9.26 | 12,605 |
| 2021-22 | 444 | 385 | 6 | 469,481 | 635,408 | -26.11 | 522,137 | -10.08 | 13,836 |
| 2022-23 | 445 | 385 | 8 | 530,595 | 690,285 | -23.13 | 567,799 | -6.55 | 15,876 |
| 2023-24 | 441 | 369 | 5 | 580,051 | 682,107 | -14.96 | 614,127 | -5.55 | 9,783 |
| 2024-25 | 443 | 376 | 4 | 647,270 | 753,169 | -14.06 | 680,038 | -4.82 | 4,703 |
| 2026-27 | 478 | 401 | 6 | 734,338 | 1,066,289 | -31.13 | 975,291 | -24.71 | 107,403 |

All four positions: `MH_leaf_proof.csv`. **The leaf sum does not equal the printed Gross Totals.** The gap is the net of the failing W16 keys. Repeated Gross Total rows explain part of it; the rest is leaves lost to missing or misread rows, totals misread, and keys split by a wrong code. Leaves elsewhere sit under major heads with no matching Gross Total (not extracted, or keyed under another printed demand or code). Use W16 and W06 failures to find the affected heads.

## NDJSON Files

* `MH_budget_leaves_<Y>.ndjson`: the additive leaves. `_id = MH.<year>.oh.dn<demand>.r<row_number>`.
* `MH_budget_nodes_<Y>.ndjson`: one document per demand, leaves nested major > sub-major > minor > sub-head > detailed > object. `_id = MH.<year>.<demand>`.
* `MH_summaries_<Y>.ndjson`: one document per printed total row (Total, Gross Total, Recoveries, Net Total, any table) and per I-Summary Data row, with a `reconciliation` block where a check anchors. `_id = MH.<year>.<oh|mh|rc>.dn<demand>.r<row_number>`.
* `MH_checks_<Y>.ndjson.gz`: one document per checks-CSV row, gzip. `_id = <reference_check_id>::<check_id>::<compared_key>::<position>`.

Amount arrays hold `{fiscal_year, measure, value}`; blank cells are omitted, so an array can have fewer than four entries. Every document carries `quality_flags` and `source.snippet`.

`source.page` is the printed page as extracted, so its type varies inside one file. It is an integer when the page is all digits, else a string (for example `H 166`: book letter and page). It is null where the printed page cell is blank; the package does not invent a page. Leaves over all years: 111,688 integer, 112,228 string, 383 null. The budget CSV column `page_number` holds the same text, blank where null.

## Validation

Three layers, as in Karnataka and Tamil Nadu:

1. **Per comparison**: `MH_checks_<Y>.csv` / `.ndjson.gz`, one row per (check, key, position 1 to 4): `source_amount` (sum of children), `target_amount` (printed total), `diff = source - target`, `abs_diff`, `accuracy_pct`, `passed`. **A comparison passes when abs_diff < 0.01** INR thousand, the state validator's rule.
2. **On budget rows**: the printed target row carries `has_check`, `reference_check_id`, `pass`, `pass_pct`, `diff`, `diff_pct`; the summaries NDJSON carries `reconciliation`.
3. **Aggregated**: `MH_validation_summary.csv.gz` and `.html`, pass rates and mean / standard deviation of accuracy per year, demand, hierarchy level and position.

**`reference_check_id`** = `MH.<year>.dn_<demand>.<table_family>.<row_token>.<anchor_key>`. It names the printed row, not the check, because one MH printed total is the target of several checks. `row_token` is the row's type and level (`total_detailed_head`, `gross`, `net`, `data_minor_head`); `anchor_key` is the row's printed demand and codes down to its level. Charged, Voted and Total rows of one block share it. Unlike Karnataka and Tamil Nadu it has no scope token: one row can anchor checks of both scopes.

### Check glossary

Ids are the portal's shared series: W = within one table, A = across tables. An id is reused only where the identity is the same as in Karnataka or Tamil Nadu. MH-only checks take the next free ids (W14 to W24, A04). `legacy_check_id` is the state validator's name.

W25 is taken by Bihar (Voted + Charged = the printed total). Do not reuse it for another state.

| ID | legacy_check_id | Tier | Verifies | Same check in |
|---|---|---|---|---|
| W01 | `SUM_OBJ_TO_MIN` | T | Sum of Object Data = Minor-Head Totals | KA W01 |
| W02 | `SUM_OBJ_TO_SMAJ` | T | Sum of Object Data = Sub-Major Totals | KA W02 |
| W06 | `SUM_OBJ_TO_DH` | A | Sum of Object Data = Detailed-Head Totals | KA W06, TN W06 |
| W08 | `SUM_DH_TO_SH` | A | Sum of Detailed-Head Totals = Sub-Head Totals | TN W08 |
| W11 | `SUM_MIN_TO_SMAJ` | A | Sum of Minor-Head Totals = Sub-Major Totals | TN W11 |
| W13 | `SUM_SH_TO_MIN` | A | Sum of Sub-Head Totals = Minor-Head Totals | TN W13 |
| W14 | `SUM_SMAJ_TO_MAJ` | A | Sum of Sub-Major Totals = Major-Head Gross Total | MH only |
| W15 | `SUM_OBJ_TO_SH` | T | Sum of Object Data = Sub-Head Totals | MH only |
| W16 | `SUM_OBJ_TO_MAJ` | T | Sum of Object Data = Major-Head Gross Total | MH only |
| W17 | `SUM_DH_TO_MIN` | T | Sum of Detailed-Head Totals = Minor-Head Totals | MH only |
| W18 | `SUM_DH_TO_SMAJ` | T | Sum of Detailed-Head Totals = Sub-Major Totals | MH only |
| W19 | `SUM_DH_TO_MAJ` | T | Sum of Detailed-Head Totals = Major-Head Gross Total | MH only |
| W20 | `SUM_SH_TO_SMAJ` | T | Sum of Sub-Head Totals = Sub-Major Totals | MH only |
| W21 | `SUM_SH_TO_MAJ` | T | Sum of Sub-Head Totals = Major-Head Gross Total | MH only |
| W22 | `SUM_MIN_TO_MAJ` | T | Sum of Minor-Head Totals = Major-Head Gross Total | MH only |
| W23 | `SUM_VC_TO_TOTAL` | A | Charged + Voted = the printed Total leg, wherever all three print | MH only |
| W24 | `NEAREST_CHILD` | A | Each printed total = sum of its nearest children (a child's printed total if extracted, else its own children) | MH only |
| A01 | `MATCH_MIN_OBJ_VS_SUMMARY` | A | Minor-Head Total in II-Details = Minor-Head Data row in I-Summary | KA A01 |
| A04 | `MATCH_NET_GROSS_VS_RECOVERIES` | A | Gross Total - Deduct Recoveries = Net Total, per major head, across tables | MH only |

Tier A: adjacent ladder links and reconciliations. Tier T: skip-level links, implied by a clean chain. The MH major-head target is the printed Gross Total, before Deduct Recoveries, so W14, W16, W19, W21 and W22 do not reuse Karnataka W07 or Tamil Nadu W12.

**Plan era.** The validator compares all 12 money columns. The package compares the four positional (Total) columns and records in the MH-only column `plan_split_passed` whether the Non-Plan and Plan parts of that position match too. A validator key passes when its four comparisons pass and none has `plan_split_passed = 0`.

**Filled levels.** The book prints no total at a level for a one-child branch (or a branch with no code at that level). A ladder check from that level then uses the sum of the branch's object rows in place of the missing total, as the state validator does. The MH-only checks column `unprinted_level_fill` marks such keys: `filled_only` when the key exists only because of the fill, `filled_part` when it mixes printed totals and fills. W06 also splits a detailed head printed as several budget-code blocks; `compared_key` then ends with the code.

### Reconciliation with the state validator

The checks are a stdlib port of `SRC/MH/validation/MH_run_validation.py`, run per demand as the validator was, with the validator's leg rule of the source commit (`block`: a printed total's component legs are dropped when its own block also prints a Total leg). Per check and per year, the package's key count and pass count are compared with the validator's own summaries (`validation_<demand>/validation_summary.csv`). **Every check in every year matches exactly.**

| Check | Legacy id | Validator keys | Validator passed | Package keys | Package passed | Pass % | Filled-only keys | Filled-only passed | Filled-part keys |
|---|---|---|---|---|---|---|---|---|---|
| W06 | `SUM_OBJ_TO_DH` | 25,788 | 23,963 | 25,788 | 23,963 | 92.92 | 0 | 0 | 0 |
| W15 | `SUM_OBJ_TO_SH` | 7,057 | 6,028 | 7,057 | 6,028 | 85.42 | 0 | 0 | 0 |
| W01 | `SUM_OBJ_TO_MIN` | 13,908 | 12,073 | 13,908 | 12,073 | 86.81 | 0 | 0 | 0 |
| W02 | `SUM_OBJ_TO_SMAJ` | 1,921 | 1,387 | 1,921 | 1,387 | 72.20 | 0 | 0 | 0 |
| W16 | `SUM_OBJ_TO_MAJ` | 4,937 | 3,873 | 4,937 | 3,873 | 78.45 | 0 | 0 | 0 |
| W08 | `SUM_DH_TO_SH` | 6,808 | 5,975 | 6,808 | 5,975 | 87.76 | 3,099 | 2,847 | 1,464 |
| W17 | `SUM_DH_TO_MIN` | 13,578 | 11,922 | 13,578 | 11,922 | 87.80 | 7,312 | 6,983 | 2,949 |
| W18 | `SUM_DH_TO_SMAJ` | 1,860 | 1,298 | 1,860 | 1,298 | 69.78 | 941 | 808 | 626 |
| W19 | `SUM_DH_TO_MAJ` | 4,842 | 3,710 | 4,842 | 3,710 | 76.62 | 2,469 | 2,258 | 1,470 |
| W13 | `SUM_SH_TO_MIN` | 9,592 | 8,785 | 9,592 | 8,785 | 91.59 | 6,494 | 6,249 | 959 |
| W20 | `SUM_SH_TO_SMAJ` | 1,149 | 711 | 1,149 | 711 | 61.88 | 495 | 432 | 325 |
| W21 | `SUM_SH_TO_MAJ` | 3,646 | 2,736 | 3,646 | 2,736 | 75.04 | 2,043 | 1,910 | 487 |
| W11 | `SUM_MIN_TO_SMAJ` | 1,886 | 1,531 | 1,886 | 1,531 | 81.18 | 383 | 327 | 150 |
| W22 | `SUM_MIN_TO_MAJ` | 4,910 | 4,176 | 4,910 | 4,176 | 85.05 | 329 | 283 | 371 |
| W14 | `SUM_SMAJ_TO_MAJ` | 3,746 | 3,157 | 3,746 | 3,157 | 84.28 | 2,841 | 2,492 | 310 |
| A01 | `MATCH_MIN_OBJ_VS_SUMMARY` | 10,219 | 9,631 | 10,219 | 9,631 | 94.25 | 0 | 0 | 0 |
| A04 | `MATCH_NET_GROSS_VS_RECOVERIES` | 4,421 | 4,087 | 4,421 | 4,087 | 92.45 | 0 | 0 | 0 |
| W23 | `SUM_VC_TO_TOTAL` | 7,242 | 6,798 | 7,242 | 6,798 | 93.87 | 0 | 0 | 0 |
| W24 | `NEAREST_CHILD` | 54,959 | 48,612 | 54,959 | 48,612 | 88.45 | 0 | 0 | 0 |
| All | | 182,469 | 160,453 | 182,469 | 160,453 | 87.93 | 26,406 | 24,589 | 9,111 |

Failing keys: 22,016 of 182,469. Per year: `MH_validator_reconciliation.csv`.

## How the Numbers Were Made

1. The department white books were cut into one snippet per demand and major head (manifests `DATA/manifests/MH/`).
2. Each page (a two-page spread in the plan era) was read by gemini-2.5-pro at 300 dpi into three pipe-delimited tables.
3. A deterministic cleaner realigned shifted cells on the printed unit and vote leg, flagged what it could not place, and never invented a value (`SRC/MH/pipeline/MH_csv_cleaner.py`, `MH_realign.py`).
4. The cleaned tables were combined per demand and year (`OUT/MH/extraction/yearwise/`) and validated per demand.
5. `SRC/MH/portal_export/convert_mh.py` read those tables at the source commit above and wrote this package. It recomputes the checks and reconciles them with the validator. The build is deterministic.

## Caveats

Read `MH_known_caveats.md`. In short: wrong or missing vote legs (including rows with `Committed` as the leg), major-head codes filled where the print is blank (`MAJOR_HEAD_FILLED`), 201 plan-era snippets missing from the tables (171 timed out), cells the cleaner could not place, and checks that fail where the extraction is wrong.

## Source PDFs

This build ships no PDFs: `source_file` is blank and `MH_pdfs/` is absent. `source_snippet` names the department book and its pages. The books are the per-department white books for each year.

## Package File Map

```
state-finances/maharashtra/
├── MH_README.md                       this file
├── MH_known_caveats.md                every known data fault, with counts and filters
├── MH_data_dictionary.csv             column definitions (budget / checks / validation_summary)
├── MH_demand_names.json               demand -> department book name
├── MH_package_stats.json              counts per year, versions, source commit
├── MH_validation_summary.csv.gz       pass rates and accuracy, Year to Detailed head (gzip)
├── MH_validation_summary.html         the same, by year, check and demand
├── MH_validator_reconciliation.csv    package vs state validator, per check and year
├── MH_leaf_proof.csv                  leaf sums vs printed Gross Totals, per year and position
└── MH_years/MH_<YYYY-YY>/
    ├── MH_csv/MH_budget_<Y>.csv
    ├── MH_csv/MH_checks_<Y>.csv
    ├── MH_json/MH_budget_leaves_<Y>.ndjson
    ├── MH_json/MH_budget_nodes_<Y>.ndjson
    ├── MH_json/MH_summaries_<Y>.ndjson
    ├── MH_json/MH_checks_<Y>.ndjson.gz
    └── MH_pdfs/<book>.pdf             department white books (absent in a no-PDF build)
```
