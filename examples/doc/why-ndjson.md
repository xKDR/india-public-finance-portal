# Why NDJSON? CSV vs NDJSON for Karnataka Budget Data

This document explains when to use the CSV files vs the NDJSON files in the Karnataka budget
package, and — most importantly — **what you must exclude before doing any naive analysis**.

---

## The Formats at a Glance

### CSV (`budget_<year>.csv`, `checks_<year>.csv`)

- One row per extracted budget line; all values are strings
- Universally readable: Excel, pandas, R `read.csv`, any spreadsheet tool
- Flat: hierarchy columns (`major_head_code`, `minor_head_code`, etc.) appear as separate
  columns on every row
- Contains **all row types**: Data, Header, and Total rows — you must apply the additive-leaf
  predicate before summing (see below)

### NDJSON (`budget_leaves_<year>.ndjson`, etc.)

- One JSON document per line (Newline-Delimited JSON)
- Every document is self-describing: amounts are typed numbers (not strings), booleans are
  booleans, nulls are nulls
- Streamable: process line-by-line without loading the whole file into memory
- Hierarchy is **embedded** in each document — no join needed to get the major head name
- Amounts are an array: `[{"measure": "...", "fiscal_year": "...", "value": <float>}, ...]`
- Compatible with `jq`, MongoDB (`mongoimport`), DuckDB (`read_ndjson`), and Python's `json`
  module

---

## When to Use Which

| Situation | Recommendation |
|---|---|
| Opening in Excel or a spreadsheet | CSV |
| Pandas / R `data.frame` analysis | CSV (or the pre-built tidy table) |
| You want to SUM without a predicate | `budget_leaves` NDJSON (filter already applied) |
| Loading into MongoDB or a document store | NDJSON |
| Processing with `jq` | NDJSON |
| DuckDB analysis | Either — `read_csv_auto` or `read_ndjson_auto` both work |
| You need the embedded hierarchy per document | NDJSON |
| You just want the tidy canonical table | Use `examples/data/processed/karnataka_budget_tidy.csv` |

---

## What to Exclude from Naive Analysis

Before summing or averaging amounts, you **must** apply the following exclusions. Missing any
one of them produces incorrect totals.

### 1. The additive-leaf predicate (mandatory for CSV)

The Karnataka budget CSVs include Data rows, Header rows, and Total rows, because the package
stays close to the source PDF structure. Summing all rows double-counts amounts already present
at lower levels.

Apply all three conditions:

```sql
WHERE type_of_table = 'object_head'
  AND row_type      = 'Data'
  AND row_level     = 'Object-Head'
```

In Python:

```python
def is_additive_leaf(row):
    return (row["type_of_table"] == "object_head"
        and row["row_type"]      == "Data"
        and row["row_level"]     == "Object-Head")
```

**Why all three conditions?** In 2024-25, approximately 37% of CSV rows (≈6,000 of 16,389) are
non-additive. `row_type = 'Data'` alone is not sufficient: it does not exclude `minor_head` and
`sub_major_head` Data rows, which repeat amounts already present at the object-head level.

If you use `budget_leaves_<year>.ndjson` instead, the filter has already been applied — you can
sum amounts directly without this predicate.

### 2. OCR outlier exclusion

A small number of rows contain implausibly large values caused by OCR extraction errors. Known
cases include a row in 2022-23 EXPVOL1 page 153 with Actuals ≈ 1.5 × 10²³ crore, and three
rows in 2016-17 with similarly extreme values (see `karnataka-state-finance/README.md` for the
full list).

Filter rule: drop any leaf where `abs(amount) > 5,000,000` in INR lakh (> ₹50,000 crore per
single leaf entry). In Python:

```python
def parse_amount(s):
    s = (s or "").replace(",", "").strip()
    if not s or s == "-":
        return None
    try:
        v = float(s)
        return v if abs(v) <= 5_000_000 else None  # drop OCR outliers
    except ValueError:
        return None
```

The `examples/data/processed/karnataka_budget_tidy.csv` tidy table already excludes all five
known outlier rows.

### 3. Amount unit caveat (annotation, not a filter)

Every row carries `amount_unit = INR_lakh`, but this has **not been independently verified
against the source PDFs per volume**. Do not drop rows because of this; instead, caveat
unit-sensitive aggregate outputs. A row-level `amount_unit` value does not guarantee that the
source PDF for that specific volume uses INR lakh.

### 4. Cross-document duplication (canonical rule)

Each fiscal year's amounts appear in multiple document years: BE(Y) is in document Y; a
restated BE(Y) appears in document Y+1 column 2; RE(Y) is in document Y+1 column 3; Actuals(Y)
is in document Y+2 column 1.

**Do not combine amounts from different document years without applying the canonical rule:**

| Measure | Canonical source | Document year | Column |
|---|---|---|---|
| BE(Y) | As-tabled figure | Y | 4 |
| RE(Y) | Following-year budget | Y + 1 | 3 |
| Actuals(Y) | Two-years-later budget | Y + 2 | 1 |

Reading BE(Y) from document Y+1 column 2 and including it alongside the canonical BE(Y) from
document Y column 4 will double-count. The tidy table (`karnataka_budget_tidy.csv`) applies this
rule — each (fiscal_year, measure, leaf) appears exactly once.

---

## Irregular Amounts Arrays (NDJSON)

Many NDJSON documents in `budget_leaves_<year>.ndjson` legitimately have **fewer than four
amounts**. These are partial entries where the source PDF printed zero or absent values for some
columns. For example, a newly-introduced programme may only have a current BE and no Actuals.

Do not assume every document carries a full four-element amounts array. Iterate over
`doc["amounts"]` and filter by `measure` and `fiscal_year` as shown in the quick-start snippets
in `karnataka-state-finance/README.md`.

---

## A Complete Beginner Filter Block (Python, CSV)

```python
import csv

def is_additive_leaf(row):
    return (row["type_of_table"] == "object_head"
        and row["row_type"]      == "Data"
        and row["row_level"]     == "Object-Head")

def parse_amount(s):
    s = (s or "").replace(",", "").strip()
    if not s or s == "-":
        return None
    try:
        v = float(s)
        return v if abs(v) <= 5_000_000 else None
    except ValueError:
        return None

total = 0.0
with open("karnataka-state-finance/years/2024-25/csv/budget_2024-25.csv") as f:
    for row in csv.DictReader(f):
        if is_additive_leaf(row):
            amt = parse_amount(row["budget_estimate_2024_25_amount"])
            if amt is not None:
                total += amt
print(f"Total BE 2024-25: Rs {total/100:,.0f} crore")
```

Or skip the predicate entirely by using the tidy table, which has all exclusions pre-applied:

```python
import csv
total = sum(
    float(r["amount_lakh"]) for r in
    csv.DictReader(open("examples/data/processed/karnataka_budget_tidy.csv"))
    if r["fiscal_year"] == "2024-25" and r["measure"] == "BE"
) / 100
print(f"Total BE 2024-25: Rs {total:,.0f} crore")
```
