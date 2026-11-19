# Bihar package: known caveats

Every known fault in the data, with its count in this build and a way to filter it. `quality_flags` is a `;`-joined column of the budget CSV (a list in the NDJSON).

## 1. Blocks never extracted

Three demand 20, major 2210 snippets were never sent to the model. Each is a Git LFS file over GitHub's 100 MB limit. Their rows are absent, so demand 20 falls short of its printed total in those years.

| Year | Demand | Major | Snippet | Pages | Leaf rows of 2210 from other blocks |
|---|---|---|---|---|---|
| 2024-25 | 20 | 2210 | `snip_BR_2024_25_DN20_maj2210_p06-p220` | 215 | 81 |
| 2025-26 | 20 | 2210 | `snip_BR_2025_26_DN20_maj2210_p05-p221` | 217 | 79 |
| 2026-27 | 20 | 2210 | `snip_BR_2026_27_DN20_maj2210_p05-p195` | 191 | 88 |

Filter: treat demand 20 leaf totals in these years as incomplete; the printed demand total (flag `demand_total`) is complete.

## 2. Object-head summary annex

In some per-demand PDFs the demand ends with a summary of the whole demand by object head. The model read it as object rows under the demand's last sub-head. A page is marked as annex when one of its object rows prints no page number or prints `<dd> - <oo> <name>`. Every row on such a page has `type_of_table = object_head_summary` and the flag `summary_annex`; none is a leaf.

| Year | Annex pages | Annex rows | Annex object rows | Their BE, crore |
|---|---|---|---|---|
| 2022-23 | 16 | 340 | 197 | 7,395.32 |
| 2024-25 | 14 | 311 | 192 | 63,512.72 |
| 2025-26 | 12 | 225 | 149 | 24,118.91 |

The rule is a heuristic. An annex page with no such row is not caught: its rows stay leaves and show as an excess in `BR_leaf_reconciliation.csv`. Filter: `type_of_table = 'object_head'`.

## 3. Demands whose leaves do not reach the printed total

47 of 515 demand-years have a gap between the leaf sum and the printed demand total in at least one position; 0 have no printed total in the data. Causes: rows or blocks lost in extraction (section 1), page splits, misread amounts, and annex pages the rule did not catch (section 2). Filter: `BR_leaf_reconciliation.csv`, `status = gap`; for a demand-level figure use the printed total (flag `demand_total`).

Demand 14 has a gap in 10 of 10 years and the largest shortfalls. The ten largest gaps at position 4 (BE of the document year):

| Year | Demand | Leaf BE, crore | Printed BE, crore | Gap, crore |
|---|---|---|---|---|
| 2026-27 | 14 | 4,964.82 | 22,664.83 | -17,700.02 |
| 2025-26 | 14 | 5,319.83 | 22,819.87 | -17,500.04 |
| 2023-24 | 14 | 6,089.59 | 23,558.69 | -17,469.10 |
| 2024-25 | 14 | 5,969.61 | 22,392.72 | -16,423.11 |
| 2026-27 | 20 | 10,603.51 | 21,270.41 | -10,666.90 |
| 2022-23 | 14 | 5,569.93 | 14,670.03 | -9,100.10 |
| 2025-26 | 20 | 10,950.54 | 20,035.80 | -9,085.26 |
| 2024-25 | 20 | 7,676.66 | 14,932.09 | -7,255.44 |
| 2021-22 | 14 | 5,094.31 | 9,094.43 | -4,000.12 |
| 2018-19 | 14 | 3,929.29 | 7,326.41 | -3,397.12 |

## 4. Failing checks

183 of 112,708 checked keys fail (477 of 450,832 comparisons). By check: W06 41, W08 31, W13 51, W11 34, W12 11, W25 15.

The pipeline sorted the 183 failing keys of pipeline commit 19ebba199070 by cause (`DOC/BR/snippet_kit/evidence/causes_20261111/CAUSES.md`): 116 misread amounts, 32 omitted rows, 23 extra or duplicated rows, 10 snippet boundary cases (detail pages filed as summary pages, or a page no snippet covers), and 2 other. None can be fixed without a new model call.

Filters: checks CSV `passed = 0`; budget CSV `has_check = yes AND pass_pct < 100`; leaves under a failing detailed head carry `w06_mismatch`.

## 5. Unmatched keys

319 keys have a child sum or a printed total but not both (not in the checks CSV):

| Check | Printed total, no children | Children, no printed total |
|---|---|---|
| W06 | 57 | 192 |
| W08 | 50 | 11 |
| W13 | 1 | 2 |
| W11 | 0 | 2 |
| W12 | 0 | 4 |
| W25 | 0 | 0 |

Filter: `BR_validation_totals.csv`; leaves whose detailed head has no printed total carry `no_printed_dh_total`.

Not printed: 2,650 key and section pairs (W11 382, W12 1,325, W25 943). Some sections of a major print the Voted or Charged line and the totals one level down, but no Sub-Major or Major total. 2017-18 and 2018-19 print no sub-major total for sub-major 00. 2019-20 to 2025-26 often print no major total for a major's last section in a scheme group. The book prints no total at that level for that section, so the key cannot be checked there. These keys are not failing and not unmatched. They are counted per year and check in `BR_validation_totals.csv` (`keys_not_printed`), as the validator lists them in `details/not_printed_keys.csv`.

In the detail table, the 51 printed Detailed-Head totals with no object rows under their key (W06, printed total, no children) sum to 0.00 crore at position 4. Their object rows are missing or carry other codes, so part of this money is absent from the leaves (section 3).

## 6. Row flags

| Flag | 2017-18 | 2018-19 | 2019-20 | 2020-21 | 2021-22 | 2022-23 | 2023-24 | 2024-25 | 2025-26 | 2026-27 | All | Meaning |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `summary_annex` | 0 | 0 | 0 | 0 | 0 | 340 | 0 | 311 | 225 | 0 | 876 | A row on a page of the demand's object-head summary annex (type_of_table = object_head_summary). The annex repeats the whole demand by object head; its rows are not leaves. |
| `malformed_amount` | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 2 | 0 | 0 | 4 | An amount cell is not a money value (for example dots used as group separators). The package leaves the cell blank; the checks read it as 0, as the pipeline validator does. |
| `incomplete_code_path` | 19 | 22 | 14 | 23 | 13 | 27 | 21 | 34 | 16 | 8 | 197 | A leaf with a blank code at one or more of the seven levels (demand to object head). |
| `total_at_object_level` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | A Total row the extraction placed at Object-Head level. It is not a leaf and no check reads it. |
| `demand_level_line` | 51 | 224 | 234 | 223 | 283 | 325 | 213 | 312 | 325 | 235 | 2425 | A Major-Head, Voted or Charged total that prints no major code: a demand total or a scheme-category line. Outside the per-major checks. |
| `demand_total` | 51 | 51 | 51 | 51 | 51 | 51 | 50 | 52 | 52 | 55 | 515 | The demand's printed grand total (कुल योग- <dd>-<name>). Used for the leaf proof. |
| `w06_mismatch` | 20 | 6 | 10 | 0 | 3 | 2 | 2 | 10 | 1 | 8 | 62 | A leaf whose detailed head fails W06: the leaves under that detailed head do not add up to its printed total. |
| `no_printed_dh_total` | 39 | 19 | 18 | 30 | 7 | 25 | 19 | 24 | 7 | 4 | 192 | A leaf whose detailed head has no printed total in the data (W06 missing target). |

`demand_level_line` and `demand_total` are not faults. They mark printed totals that sit above the major head; summing them with major-head totals double-counts.

The 4 unreadable amount cells:

| Year | row_number | Position | Printed cell |
|---|---|---|---|
| 2020-21 | 30664 | 1 | `-1.28.76.535` |
| 2023-24 | 25432 | 4 | `2.30.59.36.000` |
| 2024-25 | 23975 | 1 | `14.03.10.339` |
| 2024-25 | 24821 | 3 | `10.00.00.000` |

## 7. Other limits

* Exact comparison. A total printed rounded to the rupee fails against leaves with paise (threshold 0.01 rupee).
* Voted/Charged marker. Rows inherit the marker of their major's printed Voted and Charged lines. On demand-level lines the marker is not reliable.
* Names. Hindi names are as extracted, with the model's spelling. No English names.
* Model. All ten years are single `gemini-2.5-pro` runs. No year has a human-checked ground truth; the reference kit (one 3-page snippet) has an agent-keyed sample.
* Checks test the printed arithmetic, not extraction accuracy. A row read wrong on both sides of a check passes.
