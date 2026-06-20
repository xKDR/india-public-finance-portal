# Task B1 Report — Validation Summary CSV + Interactive HTML

## Status

DONE — all deliverables produced, all verifications pass.

---

## Position → Fiscal-Year Mapping Verification

**Formula used** (document_year Y, y = int(Y[:4])):
| Position | Measure | Fiscal Year |
|---|---|---|
| 1 | Actuals | `{y-2}-{(y-1)%100:02d}` |
| 2 | BE | `{y-1}-{y%100:02d}` |
| 3 | RE | `{y-1}-{y%100:02d}` |
| 4 | BE | `{y}-{(y+1)%100:02d}` |

**Spot-checks performed:**

| Year | Pos | Formula gives | Budget column | Check target_amount | Budget amount | Match |
|---|---|---|---|---|---|---|
| 2024-25 | 1 | 2022-23 | `accounts_2022_23_amount` | 24,775.73 | 24,775.73 | ✓ |
| 2024-25 | 4 | 2024-25 | `budget_estimate_2024_25_amount` | 31,335.31 | 31,335.31 | ✓ |
| 2016-17 | 1 | 2014-15 | `accounts_2014_15_amount` | 8,135 | 8,135 | ✓ |

All three spot-checks used W07 (Object Data → Major-Head Total) checks where the `target_amount` is the budget's Major-Head Total row for position 1/4. All matched exactly.

**Note:** The A2 task already corrected the budget column labels for all 11 years, so `accounts_2014_15_amount` etc. are now correctly labelled in the budget CSVs. The position formula works uniformly.

---

## Cross-Year Pass-Rate Trust Gradient (harvested from per-year .md files)

| Year | Pass% | n_passed | n_checks | Worst volume | Notable |
|---|---|---|---|---|---|
| 2016-17 | 84.32% | 16,826 | 19,956 | expvol_5 | Recovered historical summaries |
| 2017-18 | 74.83% | 14,322 | 19,140 | expvol_2 | Recovered hist. summaries; OCR-scale diff in W07 |
| 2018-19 | 86.78% | 17,998 | 20,740 | expvol_1 | |
| 2019-20 | 89.53% | 19,206 | 21,452 | expvol_2 | |
| 2020-21 | 89.55% | 19,632 | 21,924 | expvol_2 | |
| 2021-22 | 89.88% | 19,787 | 22,016 | expvol_1 | |
| 2022-23 | 83.36% | 16,606 | 19,920 | expvol_1 | Recovered historical summaries |
| 2023-24 | 99.45% | 11,990 | 12,056 | expvol_3 | object_head only |
| 2024-25 | 99.00% | 11,745 | 11,864 | expvol_5 | object_head only |
| 2025-26 | 99.62% | 11,823 | 11,868 | expvol_1 | object_head only |
| 2026-27 | 99.68% | 11,830 | 11,868 | expvol_1 | object_head only |

---

## Row Counts and Rollup Spot-Checks

**CSV:** 283,950 rows  
(56,779 unique hierarchy nodes × 5 positions [1,2,3,4,ALL])

Node breakdown:
- Year: 11
- Demand: 316
- MajorHead: 2,510
- SubMajor: 3,633
- Minor: 10,275
- SubHead: 11,563
- Detailed: 28,482

**Rollup verification:**

All 11 years: `Year.n_checks == sum(Demand children)` → ALL MATCH

All demand×year pairs: `Demand.n_checks == sum(MajorHead children)` → ALL MATCH (confirmed by script)

**Pass-rate reconciliation with harvested .md values:**

All 11 years computed exactly match the per-year `.md` files (identical n_passed/n_checks counts). Zero discrepancies.

---

## HTML Size and Depth

**Target depth:** Year ▸ Demand ▸ Major Head ▸ Sub-Major ▸ Minor Head (4.96 levels)

**Attempted Minor Head cap:** 10.96 MB → exceeds 8 MB limit  
**Shipped Sub-Major cap:** **4.23 MB** (depth: Demand ▸ Major Head ▸ Sub-Major, 3 levels below Year)

The HTML states plainly: "Full Minor Head, Sub-Head, and Detailed depth available in `validation_summary.csv` (HTML would exceed 8 MB at Minor depth)."

HTML structure: 6,470 `<details>` elements, all balanced; DOCTYPE present; closes `</html>` cleanly.

---

## Files Deleted (14 total)

- `karnataka-state-finance/validation_findings.csv`
- `karnataka-state-finance/validation_findings_summary.csv`
- `karnataka-state-finance/validation_findings.md`
- `karnataka-state-finance/years/2016-17/validation_summary_2016-17.md`
- `karnataka-state-finance/years/2017-18/validation_summary_2017-18.md`
- `karnataka-state-finance/years/2018-19/validation_summary_2018-19.md`
- `karnataka-state-finance/years/2019-20/validation_summary_2019-20.md`
- `karnataka-state-finance/years/2020-21/validation_summary_2020-21.md`
- `karnataka-state-finance/years/2021-22/validation_summary_2021-22.md`
- `karnataka-state-finance/years/2022-23/validation_summary_2022-23.md`
- `karnataka-state-finance/years/2023-24/validation_summary_2023-24.md`
- `karnataka-state-finance/years/2024-25/validation_summary_2024-25.md`
- `karnataka-state-finance/years/2025-26/validation_summary_2025-26.md`
- `karnataka-state-finance/years/2026-27/validation_summary_2026-27.md`

---

## New Files

- `karnataka-state-finance/validation_summary.csv` — 283,950 rows, full drill depth (Year→Detailed)
- `karnataka-state-finance/validation_summary.html` — 4.23 MB, self-contained, drill depth Year→Sub-Major
- `tools/build_validation_summary.py` — reproducible build script (stdlib Python only)

---

## Concerns / Notes

1. **HTML depth capped at Sub-Major (not Minor):** Minor-level HTML was 10.96 MB. Sub-Major at 4.23 MB is within limit and still provides meaningful drill-down (3 levels: demand → major → sub-major). The CSV carries full depth.

2. **Animal Husbandry anomaly (demand 02, 2024-25):** Surfaced in the HTML as "to investigate" per the brief. This is an amount-ratio observation (Actuals/BE ≈ 14×), not a validation check failure. The checks for that demand pass at the same rate as other demands.

3. **2017-18 OCR-scale diff:** The W07 check for major head 2220 in expvol_2 shows an abs_diff of ~2.4×10²² — almost certainly an OCR error in the recovered summary document. This is preserved in the data and noted in the trust-gradient table's worst-check column.

4. **Years 2016-17, 2017-18, 2022-23:** Use recovered historical final summaries for some volumes; the per-year .md caveats note this. This is now captured in the cross-year table in the HTML.

5. **fiscal_year for positions 2 and 3 is identical** (both refer to the same year, e.g. "2023-24" for doc year 2024-25): this is expected (BE and RE are different measures for the same fiscal year). The `financial_column_label` distinguishes them ("BE 2023-24" vs "RE 2023-24").
