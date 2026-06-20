# Karnataka Validation Findings

This report is generated from the shipped `budget_<year>.csv` and `checks_<year>.csv` files. It does not rerun extraction.

- Failed check-column rows: 25,317 (13.1% of 192,804 check-column rows)
- Anchor pages with at least one failed check: 3,202

Page-wise findings are anchor-page findings: the page is where the checked printed total or summary row appears. The source extraction issue may be on that page or among the contributing lower-level rows.

A validation row passes when `abs_diff <= threshold`. `diff` is signed as `source_amount - target_amount`; `abs_diff` is the magnitude used for pass/fail. The `0.01` threshold is in the package amount unit; if `INR_lakh` is correct for a volume, `0.01` equals Rs 1,000.

This failure rate measures internal accounting consistency over generated checks. It is not line-level PDF extraction accuracy.

## How To Investigate A Failed Check

1. Take `reference_check_id` and `check_id` from `validation_findings.csv`.
2. Filter `years/<year>/csv/checks_<year>.csv` to those values to see the compared amounts and financial columns.
3. Filter `years/<year>/csv/budget_<year>.csv` where `reference_check_id` matches to find the checked printed total or summary row.
4. Use `source_file`, `page_number`, hierarchy codes, and `check_type` to inspect the PDF and the contributing lower-level rows.

## Check Code Glossary

| Check | Scope | Meaning |
| --- | --- | --- |
| W01 | in_schema | Object Data -> Minor Total (within object_head) |
| W02 | in_schema | Object Data -> Sub-Major Total (within object_head) |
| W03 | in_schema | Minor Data -> Minor Total (within minor_head) |
| W04 | in_schema | Minor Data -> Sub-Major Total (within minor_head) |
| W05 | in_schema | Sub-Major Data -> Sub-Major Total (within sub_major_head) |
| W06 | in_schema | Object Data -> Detailed-Head Total (HOA Total) (within object_head) |
| W07 | in_schema | Object Data -> Major-Head Total (within object_head) |
| A01 | across_schema | Object Minor Total -> Minor Data |
| A02 | across_schema | Object Sub-Major Total -> Sub-Major Data |
| A03 | across_schema | Minor Sub-Major Total -> Sub-Major Data |

## Worst Failed Check Rows

| Year | Volume | Page | Check | Financial column | Abs diff | Threshold | Reference |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| 2017-18 | 2 | 27 | W07 | Budget_2020_21 | 24212222060106004038968.41259 | 0.01 | `KA.2017-18.expvol_2.in_schema.object_head.major.12_2220` |
| 2016-17 | 5 | 241 | W01 | Accounts_2018_19 | 2365231344.58 | 0.01 | `KA.2016-17.expvol_5.in_schema.object_head.minor.23_2230_03_101` |
| 2016-17 | 2 | 99 | W01 | Accounts_2018_19 | 952171992.28 | 0.01 | `KA.2016-17.expvol_2.in_schema.object_head.minor.17_2202_03_102` |
| 2022-23 | 1 | 175 | W05 | Budget_2020_21 | 2939456.55 | 0.01 | `KA.2022-23.expvol_1.in_schema.sub_major_head.sub_major.29_2049_60` |
| 2022-23 | 2 | 34 | W05 | Budget_2020_21 | 2841102.05 | 0.01 | `KA.2022-23.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80` |
| 2021-22 | 1 | 190 | W05 | Budget_2020_21 | 2716085 | 0.01 | `KA.2021-22.expvol_1.in_schema.sub_major_head.sub_major.29_2049_60` |
| 2022-23 | 1 | 175 | W05 | Budget_2019_20 | 2716085 | 0.01 | `KA.2022-23.expvol_1.in_schema.sub_major_head.sub_major.29_2049_60` |
| 2022-23 | 1 | 175 | W05 | Revised_2019_20 | 2715702.01 | 0.01 | `KA.2022-23.expvol_1.in_schema.sub_major_head.sub_major.29_2049_60` |
| 2021-22 | 2 | 33 | W05 | Budget_2020_21 | 2629121.75 | 0.01 | `KA.2021-22.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80` |
| 2022-23 | 2 | 34 | W05 | Budget_2019_20 | 2629121.75 | 0.01 | `KA.2022-23.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80` |
| 2022-23 | 2 | 34 | W05 | Revised_2019_20 | 2621535.75 | 0.01 | `KA.2022-23.expvol_2.in_schema.sub_major_head.sub_major.17_2202_80` |
| 2022-23 | 1 | 175 | A02 | Budget_2020_21 | 2571781.55 | 0.01 | `KA.2022-23.expvol_1.across_schema.sub_major_head.sub_major.29_2049_01` |
