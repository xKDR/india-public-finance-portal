# Known Caveats

## Amount Unit

Risk: all extracted amounts are emitted as `INR_lakh`, but the unit is not yet source-certified per volume.

User action: treat unit-sensitive results as draft until the relevant PDF pages are checked.

## Generic Financial Columns

Risk: years with source headers `Financial_Col_1` through `Financial_Col_4` are mapped positionally: prior actuals, current budget estimate, current revised estimate, next budget estimate.

User action: use the semantic amount column names, and inspect `data_dictionary.csv` before comparing across years.

## Document-Shaped Rows

Risk: totals and summary rows repeat lower-level amounts.

User action: for additive analysis, filter `type_of_table = 'object_head'`, `row_type = 'Data'`, and `row_level = 'Object-Head'`.

## Validation Scope

Risk: across-schema checks are present only where the relevant minor-head or sub-major-head source summary table exists.

User action: read `validation_findings.md` and the per-year `validation_summary_<year>.md` files before treating a volume as high-confidence.

## Recovered Inputs

Risk: 2016-17, 2017-18, and 2022-23 final summaries are recovered from `origin/cleaned-up-repo-v1-old` when not present locally.

User action: cite the package version and preserve the packaged PDFs with any derived analysis.

## OCR And Extraction Anomalies

Risk: a small number of source extraction errors survive into the package; for example, 2022-23 `expvol_1` page 153 includes a malformed account-code row and an implausibly large amount.

User action: sanity-check outliers against the source PDF and use validation findings to prioritize review.
