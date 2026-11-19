# Maharashtra package: known caveats (v0.1.0-draft)

Every known data fault, its size, and how to filter it out.
Counts are over all years of this build. Per-year counts are in the tables.

## Row flags

The budget CSV column `quality_flags` lists the faults of each row, separated by `;`. The NDJSON documents carry the same list. A row with no fault has an empty value. To drop flagged rows in pandas:

```python
clean = df[df["quality_flags"].fillna("") == ""]
committed = df[df["quality_flags"].fillna("").str.contains("VOTE_LEG_COMMITTED")]
```

| Flag | Rows | Meaning |
|---|---|---|
| `NON_MONEY_AMOUNT` | 20,676 | A money cell holds text, not a figure: a shifted label, unit or leg; a bracketed code such as '(00)' or '(47028056)'; a code with a trailing comma such as '904,'; or two equal figures merged, as '-,44,80,44,80'. The amount is left blank. The state validator read most text as 0, a bracketed code as a negative number ('(01)' as -1), a trailing-comma code as the number ('904,' as 904) and a merged pair as one long number. The checks keep the validator's reading. |
| `MAJOR_HEAD_FILLED` | 7,005 | The printed major-head code is blank. major_head_code is the first four digits of the row's 8-digit full_account_code, else the major head of its source snippet (maj<NNNN>); major_head_name is the name printed for that code elsewhere in the year. Checks keep the blank code, as the validator does. |
| `VOTE_LEG_COMMITTED` | 625 | The vote leg reads 'Committed', a scheme tag, not a leg. The validator's nearest-child check counts it as Voted. |
| `VOTE_LEG_OTHER` | 9,757 | The vote leg holds a value outside Charged, Voted, Total (a scheme name, a code, a column name). |
| `VOTE_LEG_MISSING` | 36,401 | An object-head leaf with no vote leg. The validator's nearest-child check counts it as Voted. |
| `BAD_ROW_TYPE` | 139 | row_type is outside Header, Data, Total, Gross Total, Recoveries, Net Total (a shifted row). |
| `BAD_ROW_LEVEL` | 38 | row_level is not blank and is outside the six MH levels (a shifted row). |
| `UNIT_CELL_SHIFTED` | 1,458 | The printed unit cell holds something other than INR_thousand (a sign of a shifted row). |
| `SHORT_ROW` | 0 | The source row had fewer cells than the header; the missing cells are blank. (A row cut short by an unbalanced quote is split again on the pipes and is not flagged.) |
| `DEMAND_MISMATCH` | 6,505 | The printed demand number differs from the demand of the file (taken from the snippet manifest). demand_number holds the file's demand. |
| `PLAN_SPLIT_MISMATCH` | 1,108 | Plan era: for at least one position, Non-Plan + Plan differs from the printed Total. |

Rows per flag and year:

| Year | `NON_MONEY_AMOUNT` | `MAJOR_HEAD_FILLED` | `VOTE_LEG_COMMITTED` | `VOTE_LEG_OTHER` | `VOTE_LEG_MISSING` | `BAD_ROW_TYPE` | `BAD_ROW_LEVEL` | `UNIT_CELL_SHIFTED` | `SHORT_ROW` | `DEMAND_MISMATCH` | `PLAN_SPLIT_MISMATCH` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2010-11 | 1,787 | 164 | 0 | 798 | 3,696 | 25 | 2 | 124 | 0 | 1,965 | 197 |
| 2012-13 | 2,085 | 204 | 0 | 998 | 4,073 | 0 | 0 | 170 | 0 | 2,118 | 206 |
| 2013-14 | 2,152 | 156 | 0 | 1,015 | 4,388 | 34 | 9 | 125 | 0 | 451 | 137 |
| 2014-15 | 2,084 | 118 | 0 | 1,053 | 4,407 | 0 | 2 | 107 | 0 | 491 | 78 |
| 2015-16 | 2,275 | 130 | 0 | 979 | 4,790 | 1 | 1 | 143 | 0 | 451 | 194 |
| 2016-17 | 2,505 | 126 | 0 | 1,238 | 4,798 | 21 | 19 | 152 | 0 | 375 | 105 |
| 2017-18 | 2,635 | 149 | 179 | 1,318 | 6,330 | 29 | 4 | 165 | 0 | 446 | 191 |
| 2018-19 | 497 | 628 | 12 | 234 | 433 | 2 | 0 | 59 | 0 | 87 | 0 |
| 2019-20 | 630 | 862 | 16 | 290 | 509 | 20 | 0 | 64 | 0 | 5 | 0 |
| 2020-21 | 577 | 644 | 27 | 298 | 575 | 0 | 0 | 23 | 0 | 114 | 0 |
| 2021-22 | 706 | 586 | 59 | 302 | 409 | 2 | 0 | 60 | 0 | 1 | 0 |
| 2022-23 | 681 | 729 | 24 | 305 | 366 | 0 | 0 | 84 | 0 | 0 | 0 |
| 2023-24 | 666 | 663 | 199 | 299 | 383 | 4 | 1 | 57 | 0 | 1 | 0 |
| 2024-25 | 672 | 782 | 52 | 309 | 754 | 1 | 0 | 64 | 0 | 0 | 0 |
| 2026-27 | 724 | 1,064 | 57 | 321 | 490 | 0 | 0 | 61 | 0 | 0 | 0 |

## Money cells

How a money cell of the source is read. Counts are over all money cells of all years (12 per row in the plan era, 4 after).

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

## Vote legs

- **`Committed` as the vote leg: 625 rows** (`vote_charge_marker = 'Committed'`, flag `VOTE_LEG_COMMITTED`). `Committed` is a scheme tag of the plan era; the model wrote it in the leg slot. The source diagnosis counted 4,353 such rows before the cleaner's leg repairs (commit 381260bc2d38). The leg of these rows is unknown: the Charged/Voted split of any total that sums them is unreliable. The roll-up checks that sum all legs are not affected.
- **Other wrong legs: 9,757 rows** (flag `VOTE_LEG_OTHER`): a scheme name, a code or a column name in the leg slot.
- **Missing legs on leaves: 36,401 object-head leaves** (flag `VOTE_LEG_MISSING`). Many plan-era blocks print the leg only on their totals, so a blank leaf leg is often faithful to the page. Do not read a blank leg as Voted.

To get a reliable Charged/Voted split, keep rows whose `vote_charge_marker` is `Charged`, `Voted` or `Total` and whose flags do not contain `VOTE_LEG_`.

## Missing snippets

**201 of the manifest's major-head snippets have no rows** in the tables, all in the plan era. The source diagnosis (`DOC/MH/snippet_kit/DIAGNOSIS_80pct.md`, section 3) gives the causes: 171 snippets whose every API call timed out (10 attempts each against a 120 s client timeout), 29 snippets whose rows carry another major head (a manifest mislabel), 1 with empty pages. The major heads of these snippets are absent or partial for that year; a sum over a demand or the year understates the book by their amounts.

| Year | Missing snippets |
|---|---|
| 2010-11 | 46 |
| 2012-13 | 34 |
| 2013-14 | 21 |
| 2014-15 | 33 |
| 2015-16 | 14 |
| 2016-17 | 24 |
| 2017-18 | 29 |
| 2018-19 | 0 |
| 2019-20 | 0 |
| 2020-21 | 0 |
| 2021-22 | 0 |
| 2022-23 | 0 |
| 2023-24 | 0 |
| 2024-25 | 0 |
| 2026-27 | 0 |

The list is `OUT/MH/extraction/reports/coverage/MH_missing_snippets.csv` in the pipeline repository (source commit in `MH_package_stats.json`). To exclude a partial major head, drop its `(demand_number, major_head_code)` pairs.

## Check failures

Failed comparisons are data, not package faults: each one marks a key where the extracted children do not add up to the extracted printed total. Causes, from the source diagnosis: shifted cells the cleaner could not place (flags above), wrong vote legs, wrong parent codes, rows lost at page splits and model misreads.

Filter failing keys with `passed = 0` in `MH_checks_<year>.csv`, or `pass_pct < 100` on budget rows.

## Filled levels

The book prints no total at a level for a one-child branch, or for a branch with no code at that level. For a ladder check whose source is a printed total level, the state validator then counts that branch at the sum of its object rows. A missing total that the layout does not explain is not filled, so a dropped total still fails. 26,406 check keys exist only because of such fills (`unprinted_level_fill = filled_only`); 9,111 more mix printed totals and fills (`filled_part`). Counts per year and check are in `MH_validator_reconciliation.csv`. To keep only printed sources, drop rows whose `unprinted_level_fill` is not blank.

## Major heads filled

7,005 rows print no major-head code (flag `MAJOR_HEAD_FILLED`). The package fills the code from the first four digits of an 8-digit `full_account_code`, else from the `maj<NNNN>` token of `source_snippet`. Each snippet is one major-head packet. The token equals the printed code on every row that prints one; the account code does on every leaf that prints both. The name is the name printed for that code elsewhere in the year. The checks and `MH_validation_summary` keep the blank code, as the state validator does.

| Year | Leaves filled from account code | Leaves filled from snippet |
|---|---|---|
| 2018-19 | 127 | 19 |
| 2019-20 | 165 | 158 |
| 2020-21 | 22 | 191 |
| 2021-22 | 81 | 88 |
| 2022-23 | 117 | 136 |
| 2023-24 | 183 | 42 |
| 2024-25 | 172 | 47 |
| 2026-27 | 315 | 50 |

## Validator crash

The state validator crashes with `KeyError: 'Check_Order'` when a demand has no check to run. Its summary for that demand is empty. This package computes the checks itself and gives such a demand zero comparisons. Years with an empty validator summary: 2012-13.

## Anchors

16 check keys take their target from printed rows with more than one anchor (for example a Gross Total printed on two tables, or one detailed-head key whose printed rows carry different codes). Such a check is linked to the first anchor in sort order; the other rows show `has_check = no` for it.

## Other limits

- The tables are model output (gemini-2.5-pro on page images), cleaned without inventing values. Values are not checked against the PDF one by one.
- `row_number` follows the per-demand table files, which are sorted by page, not by print position inside a page.
- 2011-12 is out of scope. 2025-26 is not public. The statewide summary volume (MHCDS) is not extracted, so no statewide printed total is available to check the leaf sums against.
- 2017-18: the book prints BE 2017-18 as one column. The model sometimes copies that value into the unprinted Total slot.
