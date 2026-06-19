# Karnataka Budget Data Package (v0.2.0-draft)

This is a research draft of Karnataka budget tables extracted from public expenditure-volume PDFs. The goal is to make PDF budget documents usable as CSV and JSON while keeping provenance, caveats, and validation evidence next to the data.

Coverage: 2016-17 through 2026-27, 7 expenditure volumes per year, 220,211 extracted budget rows, 192,804 validation check rows, and 77 packaged PDFs.

## Start Here

- Open `years/<year>/csv/budget_<year>.csv` for the document-shaped budget rows.
- Open `years/<year>/csv/checks_<year>.csv` for validation comparisons.
- Open `validation_findings.csv` for failed validation rows with page and row anchors.
- Open `data_dictionary.csv` for column definitions and controlled values.
- Open `known_caveats.md` before using the data in unit-sensitive analysis.
- Open `guide.html` for a visual guide to the hierarchy and validation IDs.
- Load `years/<year>/json/*.ndjson` into MongoDB (or any document store) for queryable, nested documents.

Every budget row carries `source_file`, `page_number`, and `row_number`. In budget rows and validation findings, `source_file` is package-relative, for example `years/2021-22/pdfs/KA_2021_22_EXPVOL1.pdf`. `row_number` is the row number in the extracted final-summary CSV, not a PDF text-line number.

## JSON Documents

Each year ships four newline-delimited JSON (`.ndjson`) files under `years/<year>/json/`, one document per line, ready to load into MongoDB or any document store. Values are typed (numbers, booleans, null), amounts are a long array `[{measure, fiscal_year, value}]`, and every document has a stable `_id`.

- `budget_nodes_<year>.ndjson`: one document per demand, nested Major Head -> Sub-Major -> Minor -> Sub-Head -> Detailed -> Object leaf. Read a demand's whole tree in one query.
- `budget_leaves_<year>.ndjson`: one document per additive object-head leaf, hierarchy embedded. This is the safe-to-sum collection.
- `summaries_<year>.ndjson`: printed totals plus the minor-head and sub-major-head summary tables, kept separate from the leaves so leaves never double-count.
- `checks_<year>.ndjson`: one document per validation comparison; find failures with `{"failed": true}`.

Example: `mongoimport --db ka_budget --collection budget_leaves --file years/2018-19/json/budget_leaves_2018-19.ndjson`.

## How To Sum Amounts

Do not sum every amount row. The CSV deliberately includes source Data rows, Header rows, Total rows, and summary-table rows because the package is meant to stay close to the PDF.

Use this predicate for additive budget leaf rows:

```sql
WHERE type_of_table = 'object_head'
  AND row_type = 'Data'
  AND row_level = 'Object-Head'
```

`row_type = 'Data'` alone is not enough. Total and summary rows repeat amounts already present at lower levels.

`object_head_code` is still present for traceability, but the safe summation rule should use the full predicate above rather than `object_head_code` alone.

## What The Hierarchy Means

The account hierarchy follows the standard budget classification tiers described in the Department of Economic Affairs (DEA) Budget Manual: Major Head is a 4-digit function, Sub-Major Head is a 2-digit sub-function, Minor Head is a 3-digit programme, Sub-Head is a 2-digit scheme, Detailed Head is a 2-digit sub-scheme, and Object Head is a 2-digit object or primary unit of appropriation.

`vote_charge_marker` records whether an amount is voted or charged where the source prints that distinction. Charged expenditure is expenditure not submitted for the vote under the Constitution; voted expenditure is subject to legislative vote.

## Financial Columns

Each budget CSV has four semantic amount columns, such as `accounts_2018_19_amount`, `budget_estimate_2019_20_amount`, `revised_estimate_2019_20_amount`, and `budget_estimate_2020_21_amount`. Later years with generic source headers use the positional convention documented in `known_caveats.md`.

All amount columns are emitted with `amount_unit = INR_lakh`, but the unit is not yet source-certified per volume. Treat it as a package-level caveat, not a row-level quality signal.

## Validation

Validation checks internal accounting consistency. For example, object-head Data rows should add up to the printed Minor-Head Total inside the same object-head table. A passing check means that relationship holds in the extracted data; it does not prove every PDF line was extracted perfectly.

`checks_<year>.csv` is one row per validation comparison and financial column. In checks rows, `source_file` and `target_file` name the final-summary CSV families being compared, not PDFs. `diff` is signed (`source_amount - target_amount`), `abs_diff` is absolute, and `threshold` is the pass threshold. In this package, `abs_diff <= 0.01` passes. The `0.01` threshold is in the package amount unit; if `INR_lakh` is correct for a volume, `0.01` equals Rs 1,000.

Page-wise findings in `validation_findings.csv` are anchor-page findings: they identify the page containing the checked printed total or summary row. The original extraction mistake may be on that page or on one of the contributing lower-level rows.

To investigate a failed check: (1) take `reference_check_id` and `check_id` from `validation_findings.csv`; (2) filter `years/<year>/csv/checks_<year>.csv` to those values to see the compared amounts and financial columns; (3) filter `years/<year>/csv/budget_<year>.csv` where `reference_check_id` matches to find the checked printed total or summary row; (4) use its `source_file`, `page_number`, hierarchy codes, and the lower-level source-row role described by `check_type` to inspect the PDF and contributing rows.

## Example Validation ID

`KA.2021-22.expvol_1.in_schema.object_head.minor.03_2043_00_101` means Karnataka, source year 2021-22, expenditure volume 1, an in-schema check inside the object-head table, at minor-head rollup level, for Demand 03 / Major Head 2043 / Sub-Major 00 / Minor Head 101.
