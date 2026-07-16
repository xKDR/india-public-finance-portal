# examples/data/

This directory contains **processed** data derived from the Karnataka state budget package.
Raw PDFs and NDJSON are **not duplicated** here — they remain in `state-finances/karnataka/`.

---

## Files

### `processed/karnataka_budget_tidy.csv`

Long-format tidy table of Karnataka budget amounts, canonical-only (one clean series per fiscal
year × measure × leaf account). Safe to filter and SUM directly.

**Columns:**

| Column | Description |
|---|---|
| `document_year` | Budget document year (source document, e.g. `2024-25`) |
| `fiscal_year` | Fiscal year the amount refers to (e.g. `2022-23`) |
| `measure` | `BE` (Budget Estimate), `RE` (Revised Estimate), or `Actuals` |
| `demand` | Demand (grant) number, e.g. `22` |
| `major_head_code` | 4-digit major head code, e.g. `2210` |
| `major_head_name` | Major head name, e.g. `Medical and Public Health` |
| `object_head_code` | Object head code, e.g. `001` |
| `object_head_description` | Object head description |
| `amount_lakh` | Amount in INR lakh (source unit; divide by 100 for crore) |
| `amount_unit` | Always `INR_lakh` |

**Source:** `state-finances/karnataka/KA_years/KA_*/KA_csv/KA_budget_*.csv`
**How to regenerate:** `python3 examples/src/python/00_build_tidy.py`

### `processed/canonical_numbers.json`

Expected answers for all four examples, computed from the tidy table. Used as the reconciliation
fixture — each language track's output is compared against this within 0.01 crore tolerance.
All monetary values in INR crore, rounded to 2 decimals.

---

## How the processed table is built

### 1. Additive-leaf predicate

The source CSVs contain both data rows and pre-computed subtotal/header rows. Only rows where
`type_of_table == 'object_head' AND row_type == 'Data' AND row_level == 'Object-Head'` are
included. Summing any other rows would double-count.

### 2. Canonical source rule

Each budget document carries four amount columns (Actuals for T−2, BE for T−1, RE for T−1, BE
for T, where T = document year). The tidy table applies a canonical-source rule so each fiscal
year's amount appears exactly once from its authoritative document:

- **BE(Y)** ← document Y (as-tabled figure)
- **RE(Y)** ← document Y+1
- **Actuals(Y)** ← document Y+2

### 3. OCR outlier drop

Single-leaf amounts exceeding Rs 50,000 crore (`abs(amount_lakh) > 5,000,000`) are treated as
OCR extraction errors and excluded. Five such values were identified across all years.

### 4. Unit caveat

All amounts are in **INR lakh** as extracted from the source PDFs. They have not been
independently certified. See the "Caveats" section in `state-finances/karnataka/KA_README.md` for details.

---

## Reading the raw package data

The raw NDJSON budget leaves (one JSON object per leaf row) are at:

```
state-finances/karnataka/KA_years/KA_<YEAR>/KA_json/KA_budget_leaves_<YEAR>.ndjson
```

These are read directly by some examples (the formats-lesson exercise). Do not copy them here.
