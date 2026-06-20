# Examples Scope Contract

This directory defines the **shared contract** that every language track (Python, R, DuckDB/SQL)
implements. Getting the same numbers across languages is the goal; this file explains every
decision that affects the output.

---

## 1. The tidy table

All examples read `data/processed/karnataka_budget_tidy.csv` (for the budget analysis examples)
and, for the formats-lesson exercise, the raw NDJSON from the package.

The tidy table is **canonical-only**: each `(fiscal_year, measure, leaf_account)` appears exactly
once, sourced from its canonical document year (see §3). A beginner can `filter` then `SUM` with
no further canonical logic.

Columns:
```
document_year, fiscal_year, measure, demand, major_head_code, major_head_name,
object_head_code, object_head_description, amount_lakh, amount_unit
```

`measure` ∈ {`Actuals`, `BE`, `RE`}.  `amount_lakh` is the raw source value in INR lakh.

---

## 2. Additive-leaf predicate

The Karnataka budget CSVs contain both data rows and pre-computed subtotal/header rows.
**Only rows satisfying all three conditions are additive (safe to SUM):**

```
type_of_table == 'object_head'
  AND row_type  == 'Data'
  AND row_level == 'Object-Head'
```

Summing any other rows double-counts amounts already captured at the object-head level.

The tidy table contains only additive-leaf rows. Example authors **must not** re-apply this
predicate — the filter was already applied at build time.

---

## 3. Canonical source rule

Each Karnataka budget document (identified by its folder year, e.g. `2024-25`) carries **four**
amount columns by position:

| Column position | Content | Fiscal year |
|---|---|---|
| `accounts_*`            | Actuals      | doc_year − 2 |
| `budget_estimate_*` [1] | BE (restated)| doc_year − 1 |
| `revised_estimate_*`    | RE           | doc_year − 1 |
| `budget_estimate_*` [2] | BE (current) | doc_year     |

Historical documents carried mislabelled column headers; reading by column prefix
(`accounts_`, `budget_estimate_`, `revised_estimate_`) is robust across all years.

**Canonical source per measure:**

| Measure  | Canonical document | Offset |
|---|---|---|
| BE(Y)      | document Y       | 0  |
| RE(Y)      | document Y + 1   | −1 |
| Actuals(Y) | document Y + 2   | −2 |

This means each fiscal year's BE is taken from the year it was tabled (the "as-tabled" figure),
RE from the following year's budget document, and Actuals from two years later.

The `canonical_source_offset` field in `scope.json` encodes this as
`{measure: (doc_year - fiscal_year)}`, i.e. `{"BE": 0, "RE": -1, "Actuals": -2}`.

---

## 4. OCR outlier drop

Single-leaf amounts where `abs(amount_lakh) > 5_000_000` (> Rs 50,000 crore) are treated as OCR
extraction errors and **excluded** from the tidy table. These are recorded in the build log.
Five such outliers were found across all years (see `00_build_tidy.py` output).

---

## 5. Scope constants

| Constant | Value | Purpose |
|---|---|---|
| Health major heads | `2210`, `2211` | Revenue health only (no capital 4210) |
| Interest major head | `2049` | Interest payments |
| Pension major head | `2071` | Employee pensions (post-retirement) |
| Salary object codes | 001–005, 008–009, 011, 014, 020, 033, 035 | Direct pay only; GIA-salaries (101, 118) excluded |

For committed expenditure, the **priority order** when a row could match multiple categories is:
pension major head > interest major head > salary object codes.
This prevents a pension row from also being counted as salary.

Amounts in the tidy table are in `INR_lakh`. Divide by 100 to get INR crore.

---

## 6. Contract for example authors

Each language track implements the four examples and writes results to `out/results_<lang>.json`
with the **same schema** as `data/processed/canonical_numbers.json`.

Steps every implementation must follow:

1. **Read** `data/processed/karnataka_budget_tidy.csv` — do not re-apply the additive-leaf
   predicate or the canonical rule; both were applied at build time.
2. **Implement** the four analyses using the scope constants in `scope.json`.
3. **Write** `out/results_<lang>.json` matching the schema of `canonical_numbers.json`.
4. **Reconcile**: the CI step compares each language's output against `canonical_numbers.json`
   within `tolerance_crore: 0.01` (Rs 1 lakh). Any value outside tolerance is a bug.

See `scope.json` for the canonical filenames and output paths.

---

## 7. Regenerating the tidy table

```bash
python3 examples/src/python/00_build_tidy.py
```

This rebuilds `karnataka_budget_tidy.csv` and `canonical_numbers.json` from the package CSVs.
The script is idempotent. stdlib only (no pandas).
