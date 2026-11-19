# Bihar Budget Data Package (v0.1.0-draft)

Bihar's Detailed Budget Estimates of Expenditure (विस्तृत आय-व्ययक अनुमान), 10 budget years, 2017-18 to 2026-27: 338,377 printed rows, of which 117,973 are additive leaves. Same two-table format as the Karnataka and Tamil Nadu packages. Schema version `br-public-two-table-v1`.

Head names are in Hindi, as printed and extracted. No English names are added: no Bihar name lookup is committed in the pipeline.

## Start here

```python
import csv
with open("BR_years/BR_2026-27/BR_csv/BR_budget_2026-27.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
leaves = [r for r in rows if r["type_of_table"] == "object_head"
          and r["row_type"] == "Data" and r["row_level"] == "Object-Head"]
total = sum(float(r["budget_estimate_2026_27_amount_inRs"] or 0) for r in leaves)
print(f"BE 2026-27: {total / 1e7:,.0f} crore")   # rupees -> crore
```

**Unit: rupees** (`amount_unit = INR`). Divide by 1e7 for crore, by 1e5 for lakh. Karnataka is in lakh and Tamil Nadu in thousand, so every Bihar amount column ends in `_inRs`. Bihar prints some amounts with paise.

## Do not sum every row

The budget CSV keeps every printed row: Header rows, the leaves, and seven kinds of printed total. Sum only the additive leaves:

```
type_of_table = 'object_head' AND row_type = 'Data' AND row_level = 'Object-Head'
```

This is Karnataka's predicate. `BR_budget_leaves_<year>.ndjson` holds exactly these rows. Levels, top to bottom: Demand, Major-Head (with its Voted and Charged lines), Sub-Major-Head, Minor-Head, Sub-Head, Detailed-Head, Object-Head (leaf).

The `type_of_table` condition matters in Bihar. In some per-demand PDFs the demand ends with a summary of the whole demand by object head. The extraction read it as object rows, so it would count the demand twice. Its 876 rows have `type_of_table = object_head_summary` and are not leaves (see the leaf proof and `BR_known_caveats.md`).

## Coverage

| Year | Source | Demands | Rows | Leaves | Keys checked | Keys failing | Keys unmatched | Key pass % | Leaf proof (demands) | Leaf BE, crore |
|---|---|---|---|---|---|---|---|---|---|---|
| 2017-18 | 1 consolidated volume | 51 | 30,480 | 11,610 | 10,404 | 46 | 37 | 99.56 | 44 of 51 match | 158,875.50 |
| 2018-19 | 1 consolidated volume | 51 | 33,120 | 12,015 | 10,756 | 17 | 32 | 99.84 | 44 of 51 match | 172,150.16 |
| 2019-20 | 1 consolidated volume | 51 | 33,535 | 11,778 | 11,054 | 11 | 33 | 99.90 | 47 of 51 match | 197,487.67 |
| 2020-21 | 1 consolidated volume | 51 | 33,515 | 11,818 | 11,016 | 11 | 50 | 99.90 | 49 of 51 match | 208,636.60 |
| 2021-22 | 51 demand PDFs | 51 | 32,714 | 11,396 | 10,797 | 13 | 8 | 99.88 | 46 of 51 match | 214,925.32 |
| 2022-23 | 51 demand PDFs | 51 | 34,514 | 12,079 | 11,261 | 18 | 58 | 99.84 | 49 of 51 match | 228,590.78 |
| 2023-24 | 50 demand PDFs | 50 | 36,610 | 13,177 | 11,968 | 11 | 27 | 99.91 | 48 of 50 match | 244,239.00 |
| 2024-25 | 52 demand PDFs | 52 | 32,858 | 10,798 | 11,123 | 26 | 44 | 99.77 | 47 of 52 match | 254,707.80 |
| 2025-26 | 52 demand PDFs | 52 | 35,586 | 11,503 | 11,990 | 18 | 24 | 99.85 | 49 of 52 match | 290,309.72 |
| 2026-27 | 55 demand PDFs | 55 | 35,445 | 11,799 | 12,339 | 12 | 6 | 99.90 | 45 of 55 match | 318,450.35 |
| All | | | 338,377 | 117,973 | 112,708 | 183 | 319 | 99.84 | | |

Leaf BE is the sum of the leaves at position 4 (BE of the document year). Leaf proof and unmatched keys are explained below.

## Amount columns

Each year prints four positional amounts. The column name is `<type>_<year>_amount_inRs`:

| Position | `<type>` | Fiscal year | Printed as |
|---|---|---|---|
| 1 | `accounts` | document year - 2 | Actuals |
| 2 | `budget_estimate` | document year - 1 | BE |
| 3 | `revised_estimate` | document year - 1 | RE |
| 4 | `budget_estimate` | document year | BE |

For 2026-27: `accounts_2024_25_amount_inRs`, `budget_estimate_2025_26_amount_inRs`, `revised_estimate_2025_26_amount_inRs`, `budget_estimate_2026_27_amount_inRs`. Take BE(Y) from document Y, RE(Y) from document Y+1 and Actuals(Y) from document Y+2, as in Karnataka.

## Schema mapping

Bihar's 24-column extraction schema is Karnataka's `object_head` table. Source column to package column:

| Year table column | Package column | Rule |
|---|---|---|
| Source_Page_Number | page_number | unwrapped |
| Source_Snippet + Extraction_Page | pdf_page_number | snippet first page + page - 1 |
| (position in the year table) | row_number | 1-based |
| Volume_Number | (dropped) | blank in every Bihar row |
| Demand_Number | demand_number | zero-padded to 2 digits |
| Major_Head_Code / _Name | major_head_code / _name | as extracted |
| Sub_Major_Head_Code / _Name | sub_major_head_code / _name | as extracted |
| Minor_Head_Code / _Name | minor_head_code / _name | as extracted |
| Sub_Head_Code / _Name | sub_head_code / _name | as extracted |
| Detailed_Head_Code / _Name | detailed_head_code / _name | as extracted |
| Object_Head_Code / _Description | object_head_code / _description | as extracted |
| Full_Account_Code | full_account_code | as extracted |
| Description | row_header | as extracted |
| Vote_Charge_Marker | vote_charge_marker | as extracted |
| Row_Type, Row_Level | row_type, row_level | as extracted |
| Financial_Col_1..4 | <type>_<year>_amount_inRs | commas removed; blank stays blank |
| Extraction_Iteration | (dropped) | 0 in every row |

Package-only columns: `document_year`, `state_code`, `type_of_table` (`object_head`, or `object_head_summary` on annex pages), `amount_unit`, `source_file`, the check columns (`has_check`, `reference_check_id`, `pass`, `pass_pct`, `diff`, `diff_pct`) and `quality_flags`. Two columns are Bihar-only: `pdf_page_number` (the consolidated volumes run to about 2,100 pages) and `quality_flags` (see `BR_known_caveats.md`). Karnataka's `volume_number` is dropped: the source column is blank in every Bihar row.

## Leaf rule and its proof

Every demand ends with a printed grand total, `कुल योग- <dd>-<name>`. For each demand the sum of its leaves is compared with that line in all four positions (|diff| < 0.01 rupee). `BR_leaf_reconciliation.csv` has one row per demand and year.

| Year | Demands match | Demands with a gap | No printed total | Leaf BE, crore | Printed BE (all demand totals), crore | BE gap, crore |
|---|---|---|---|---|---|---|
| 2017-18 | 44 | 7 | 0 | 158,875.50 | 160,085.69 | -1,210.20 |
| 2018-19 | 44 | 7 | 0 | 172,150.16 | 176,990.28 | -4,840.12 |
| 2019-20 | 47 | 4 | 0 | 197,487.67 | 200,501.01 | -3,013.35 |
| 2020-21 | 49 | 2 | 0 | 208,636.60 | 211,761.49 | -3,124.89 |
| 2021-22 | 46 | 5 | 0 | 214,925.32 | 218,302.70 | -3,377.38 |
| 2022-23 | 49 | 2 | 0 | 228,590.78 | 237,691.19 | -9,100.41 |
| 2023-24 | 48 | 2 | 0 | 244,239.00 | 261,708.10 | -17,469.10 |
| 2024-25 | 47 | 5 | 0 | 254,707.80 | 278,725.72 | -24,017.92 |
| 2025-26 | 49 | 3 | 0 | 290,309.72 | 316,895.02 | -26,585.30 |
| 2026-27 | 45 | 10 | 0 | 318,450.35 | 347,589.76 | -29,139.41 |

Of the 47 demand-years with a gap, 25 have leaves below the printed total at position 4 and 22 at or above it. A shortfall means rows or blocks lost in extraction. An excess means rows counted twice or amounts misread. The largest gaps are listed in `BR_known_caveats.md`. The annex rule (`object_head_summary`) turns 19 demand-years from a gap into a match and 0 from a match into a gap.

## Checks

The checks are the Tier A checks of the Bihar pipeline validator (`SRC/BR/validation/BR_run_validation.py`), computed by the validator's own functions on each year table. Each child sum is compared with its printed total in each of the four positions. A comparison passes when |diff| < 0.01 rupee.

| ID | Pipeline id | Verifies | Same check in |
|---|---|---|---|
| W06 | `SUM_OBJ_TO_DH` | Σ Object-Head leaves = Detailed-Head total | Karnataka, Tamil Nadu |
| W08 | `SUM_DH_TO_SH` | Σ Detailed-Head totals = Sub-Head total | Tamil Nadu |
| W13 | `SUM_SH_TO_MIN` | Σ Sub-Head totals = Minor-Head total | Tamil Nadu |
| W11 | `SUM_MIN_TO_SMAJ` | Σ Minor-Head totals = Sub-Major total | Tamil Nadu |
| W12 | `SUM_SMAJ_TO_MAJ` | Σ Sub-Major totals = Major-Head total | Tamil Nadu |
| W25 | `SUM_VC_TO_MAJ` | Voted line + Charged line = Major-Head total | Bihar only (new) |

W25 is new. Bihar prints a Voted line (`मतदेय`) and a Charged line (`प्रभृत`) under each major head; W25 checks that they add up to the major-head total. W13 has no group level to bridge in Bihar: it is the plain Sub-Head to Minor-Head step. The validator's ten skip-level (Tier T) checks are not published; the adjacent chain implies them.

Failing keys by year and check (a key fails when any of its four positions fails):

| Year | W06 | W08 | W13 | W11 | W12 | W25 | All | Checked | Unmatched |
|---|---|---|---|---|---|---|---|---|---|
| 2017-18 | 19 | 6 | 14 | 1 | 1 | 5 | 46 | 10,404 | 37 |
| 2018-19 | 5 | 0 | 4 | 2 | 1 | 5 | 17 | 10,756 | 32 |
| 2019-20 | 5 | 0 | 4 | 2 | 0 | 0 | 11 | 11,054 | 33 |
| 2020-21 | 0 | 0 | 3 | 5 | 3 | 0 | 11 | 11,016 | 50 |
| 2021-22 | 1 | 2 | 6 | 4 | 0 | 0 | 13 | 10,797 | 8 |
| 2022-23 | 2 | 5 | 4 | 5 | 1 | 1 | 18 | 11,261 | 58 |
| 2023-24 | 1 | 3 | 2 | 3 | 1 | 1 | 11 | 11,968 | 27 |
| 2024-25 | 5 | 7 | 3 | 5 | 3 | 3 | 26 | 11,123 | 44 |
| 2025-26 | 1 | 5 | 7 | 4 | 1 | 0 | 18 | 11,990 | 24 |
| 2026-27 | 2 | 3 | 4 | 3 | 0 | 0 | 12 | 12,339 | 6 |
| All | 41 | 31 | 51 | 34 | 11 | 15 | 183 | 112,708 | 319 |

The checks run on all rows of the year table, annex rows included, as the validator does.

A check runs only on keys that have both a child sum and a printed total. A key with one side only is unmatched: it is counted in `BR_validation_totals.csv` (`keys_missing_source`, `keys_missing_target`) and has no row in the checks CSV.

Not printed: 2,650 key and section pairs (W11 382, W12 1,325, W25 943). Some sections of a major print the Voted or Charged line and the totals one level down, but no Sub-Major or Major total. 2017-18 and 2018-19 print no sub-major total for sub-major 00. 2019-20 to 2025-26 often print no major total for a major's last section in a scheme group. The book prints no total at that level for that section, so the key cannot be checked there. These keys are not failing and not unmatched. They are counted per year and check in `BR_validation_totals.csv` (`keys_not_printed`), as the validator lists them in `details/not_printed_keys.csv`.

How a check links to the budget rows: the printed total of the key carries `has_check = yes` and a `reference_check_id`, with `pass`, `pass_pct`, `diff` and `diff_pct` over its comparisons. W12 and W25 both anchor on the Major-Head total, so that row's id covers 8 comparisons. Format: `BR.<year>.dn_<demand>.in_schema.object_head.<level>.<compared_key>`.

Validation summary: `BR_validation_summary.csv.gz` and `.html` (pass rate and accuracy by year, demand and head), `BR_validation_totals.csv` (keys per year and check). Overall comparison pass rate by year: 2017-18 99.82%, 2018-19 99.92%, 2019-20 99.92%, 2020-21 99.93%, 2021-22 99.91%, 2022-23 99.87%, 2023-24 99.93%, 2024-25 99.81%, 2025-26 99.90%, 2026-27 99.93%.

## NDJSON

Same four files as Karnataka, one document per line:

* `BR_budget_leaves_<Y>.ndjson`: the additive leaves. `_id = BR.<Y>.oh.dn<dd>.r<row>`.
* `BR_budget_nodes_<Y>.ndjson`: one document per demand, the leaves nested major head to object head. `_id = BR.<Y>.<dd>`.
* `BR_summaries_<Y>.ndjson`: every printed Total row, with a `reconciliation` block where a check anchors.
* `BR_checks_<Y>.ndjson.gz`: one document per checks-CSV row. `_id = <reference_check_id>::<check_id>::<position>`.

`amounts` holds `{fiscal_year, measure, value}`; a blank cell is left out and a printed 0 is kept. `source` holds `file`, `page` (printed), `pdf_page` and `row`. Leaves and summaries carry `quality_flags`.

## How the numbers were made

1. Source: the Bihar Finance Department's Detailed Budget Estimates PDFs. 2017-18 to 2020-21 are one consolidated volume a year; 2021-22 onward one PDF per demand.
2. Snippets: each PDF was cut into one snippet per demand and major-head block (`SRC/BR/BR_build_snippet_manifest.py`). The manifests are in `DATA/manifests/BR/`.
3. Extraction: `gemini-2.5-pro` read each page image into the 24-column schema. The cleaner (`SRC/BR/pipeline/BR_csv_cleaner.py`, rules of 2026-11-11) set total levels from the printed banners. `SRC/core/combine_year.py` made the demand and year tables.
4. Validation: `SRC/BR/validation/BR_run_validation.py`. The package checks reuse its functions and reproduce its Tier A totals.
5. Packaging: `SRC/BR/portal_export/convert_br.py` on the year tables of pipeline commit `19ebba1990701c904afb505566914d0e2cf2a6c2`. The build is deterministic.

## Source PDFs

This build does not ship the PDFs, so `source_file` is blank. The 315 source PDFs (5,448.1 MB) are Git LFS objects in `DATA/full_source/BR/<year>/` of the pipeline repo.

## Files

```
state-finances/bihar/
├── BR_README.md                  this file
├── BR_known_caveats.md           every known data fault, with counts and filters
├── BR_data_dictionary.csv        columns of every table
├── BR_demand_names.json          demand -> printed Hindi name
├── BR_package_stats.json         counts, versions, source commit
├── BR_validation_summary.csv.gz  pass rate and accuracy by year and head
├── BR_validation_summary.html    the same, browsable
├── BR_validation_totals.csv      keys checked, failing, unmatched, per year and check
├── BR_leaf_reconciliation.csv    leaf sum vs printed demand total, per demand and year
└── BR_years/BR_<Y>/
    ├── BR_csv/BR_budget_<Y>.csv, BR_checks_<Y>.csv
    ├── BR_json/BR_budget_leaves_<Y>.ndjson, BR_budget_nodes_<Y>.ndjson,
    │           BR_summaries_<Y>.ndjson, BR_checks_<Y>.ndjson.gz
    └── BR_pdfs/                  (only in a build with PDFs)
```
