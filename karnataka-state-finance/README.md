# Karnataka Budget Data Package (v0.2.0-draft)

Karnataka expenditure-budget tables extracted from public expenditure-volume PDFs and shipped as
CSV and NDJSON. Coverage: 2016-17 through 2026-27 (11 years), 220,211 budget rows, 192,804
validation check rows, 77 source PDFs. Version: `v0.2.0-draft`.

Every row carries `source_file`, `page_number`, and `row_number` so any figure can be traced to
a specific page of a specific source PDF.

---

## Start in 5 Minutes

The `budget_leaves` NDJSON contains only additive leaf rows — no predicate needed:

```python
import json
total = 0
with open("years/2024-25/json/budget_leaves_2024-25.ndjson") as f:
    for line in f:
        for amt in json.loads(line)["amounts"]:
            if amt["measure"] == "budget_estimate" and amt["fiscal_year"] == "2024-25":
                total += amt["value"]
print(f"Total BE 2024-25: ₹{total/100:,.0f} crore")  # ~₹370,659 crore
```

Or from CSV — requires the three-condition predicate (see next section):

```python
import csv
total = 0
with open("years/2024-25/csv/budget_2024-25.csv") as f:
    for row in csv.DictReader(f):
        if (row["type_of_table"] == "object_head"
                and row["row_type"] == "Data"
                and row["row_level"] == "Object-Head"):
            v = row["budget_estimate_2024_25_amount"].replace(",", "").strip()
            if v and v != "-":
                total += float(v)
print(f"Total BE 2024-25: ₹{total/100:,.0f} crore")  # ~₹370,659 crore
```

For demand-level analysis, load `demand_names.json` (in this directory) to map demand numbers
to department names.

---

## ⚠ Do Not Blindly Sum

**Read this before summing any column.**

The CSV keeps Header, Total, and summary rows to stay close to the source PDF. Summing every
amount row double-counts. Use the **additive-leaf predicate** — all three conditions are required:

```sql
WHERE type_of_table = 'object_head'
  AND row_type      = 'Data'
  AND row_level     = 'Object-Head'
```

In Python:

```python
def is_leaf(row):
    return (row["type_of_table"] == "object_head"
        and row["row_type"]      == "Data"
        and row["row_level"]     == "Object-Head")
```

**Why all three?** In 2024-25, 37% of rows (≈6,000 of 16,389) are non-additive.
`row_type = 'Data'` alone is not enough — it does not exclude `minor_head` and `sub_major_head`
Data rows that repeat amounts already counted at the object-head level.

If you use `budget_leaves_<year>.ndjson` the filter is already applied — sum directly.

---

## Amount Columns and `document_year`

### `document_year`

Every row and every NDJSON document now carries a `document_year` field (e.g. `2024-25`). This
identifies the source publication — the budget volume the row was extracted from. It is distinct
from `fiscal_year`, which is the year an amount refers to.

### Four positional amount columns

Each budget CSV has exactly four amount columns. Their **position** (not just their name) is
semantically fixed:

| Position | Column prefix | Content | Fiscal year |
|---|---|---|---|
| 1 | `accounts_*` | Actuals | document_year − 2 |
| 2 | `budget_estimate_*` (first) | BE (restated) | document_year − 1 |
| 3 | `revised_estimate_*` | RE | document_year − 1 |
| 4 | `budget_estimate_*` (second) | BE (current) | document_year |

Column headers now carry the correct fiscal year across all 11 years. Historically, years
2016-17 through 2022-23 carried identical wrong labels (all seven years showed 2020-21's labels).
Those labels are corrected in v0.2.0-draft — no numeric values changed.

### Canonical source rule

Each fiscal year's amount should come from one canonical document, not every document that
mentions it:

| Measure | Canonical document year | Column position |
|---|---|---|
| BE(Y) | Y | 4 |
| RE(Y) | Y + 1 | 3 |
| Actuals(Y) | Y + 2 | 1 |

Reading BE(Y) from document Y+1 (column 2) is valid as a cross-check but will double-count if
mixed with the canonical figure. The `examples/` compendium applies this rule in its tidy table.

---

## NDJSON Files

The four NDJSON files under `years/<year>/json/` are:

| File | Contents |
|---|---|
| `budget_leaves_<year>.ndjson` | **One doc per additive object-head leaf.** Additive-leaf filter already applied — safe to sum directly. Hierarchy embedded. |
| `budget_nodes_<year>.ndjson` | Full demand tree (nested Major → Sub-Major → Minor → Sub-Head → Detailed → Object). |
| `summaries_<year>.ndjson` | Printed totals and minor-head / sub-major-head summary tables, separated from leaves. |
| `checks_<year>.ndjson` | One doc per validation comparison; find failures with `{"failed": true}`. |

Each `amounts` array entry has the shape
`{"measure": "budget_estimate"|"revised_estimate"|"accounts", "fiscal_year": "<Y>", "value": <number>}`.

**Note on irregular amounts arrays:** many documents legitimately have fewer than 4 amounts.
These are partial entries where the source PDF printed fewer columns (zero or absent values) for
that line item. Do not assume every document has a full 4-element amounts array.

---

## CSV vs NDJSON: When to Use Which

**Use CSV when:**
- You want flat, universally readable data (Excel, pandas, R `read.csv`)
- You are doing column-by-column analysis or filtering by predicate
- You do not need the embedded hierarchy

**Use NDJSON (`budget_leaves`) when:**
- You want pre-filtered additive leaves with no summation predicate to remember
- You are loading into MongoDB, DuckDB, or processing with `jq`
- You want the full hierarchy (major head, minor head, etc.) as structured fields

See `examples/doc/why-ndjson.md` for a fuller comparison and the complete list of exclusions
required before any naive analysis.

---

## Page-Numbering Note

Each budget row carries a `page_number`. This is the **body arabic page number** — the numeric
page label in the main content section of the source PDF.

Evidence from `KA_2024_25_EXPVOL1.pdf` (PDF pages 1–10 examined): the front matter (cover
pages and blank pages, PDF pages 1–3) carries no visible page numbers. The abstract section
(PDF pages 4–8) uses its own "Abstract Page 1 of 5" through "Abstract Page 5 of 5" label in
the footer — not roman numerals. The Table of Contents (PDF page 10) lists body sections with
arabic page numbers (Finance: 1–34; DPAR: 35–68; E-Governance: 69–71; Home: 72–97; Transport:
98–112; Law: 113–126; Parliamentary Affairs: 127–139; Debt Servicing: 140–208). No roman-numeral
pagination was found anywhere in the first 10 PDF pages.

The `page_number` column matches the body arabic numbers shown in the Table of Contents.
Page-wise findings in `validation_summary.csv` are **anchor-page findings**: they identify the
PDF page containing the checked printed total or summary row. The actual extraction discrepancy
may originate on an earlier contributing row that feeds into that total. ("Anchor page" means
the page of the checked total, not necessarily the page of the error.)

---

## Caveats

### Amount unit (unverified)

`amount_unit` is always `INR_lakh` on every row, but this has not been independently verified
against the source PDFs per volume. Treat unit-sensitive results as draft. Do not drop rows
because of this; caveat your outputs instead.

### OCR and extraction anomalies

A small number of source extraction errors survive into the package. Known outliers:

| Document year | Volume | Page | Description |
|---|---|---|---|
| 2016-17 | EXPVOL2 | p. 95 | Actuals ≈ ₹9.5 million crore (OCR artefact) |
| 2016-17 | EXPVOL2 | p. 108 | Actuals ≈ ₹10.8 million crore (OCR artefact) |
| 2016-17 | EXPVOL5 | p. 236 | Actuals ≈ ₹23.6 million crore (OCR artefact) |
| 2017-18 | EXPVOL2 | p. 24 | BE ≈ 2.4 × 10²⁴ crore (OCR artefact) |
| 2022-23 | EXPVOL1 | p. 153 | Malformed account code; Actuals ≈ 1.5 × 10²³ crore |

Filter rule: `abs(amount_lakh) > 5_000_000` (> ₹50,000 crore per leaf) reliably identifies
these. The `examples/` tidy table excludes all five rows.

### Label history (now corrected)

Years 2016-17 through 2022-23 originally shipped with identical mislabelled column headers —
all seven years carried 2020-21's labels. Fixed in v0.2.0-draft; no numeric values changed.
If you pinned a prior version, re-pull.

### Cross-document restatement gaps

BE(Y) as tabled in document Y and the restated BE(Y) printed in document Y+1 (column 2) may
differ due to mid-year supplementary budgets. These are genuine restatements, not extraction
errors.

### Validation scope

Across-schema checks are present only where the relevant minor-head or sub-major-head summary
table exists in the source PDF. Coverage is not uniform across all years and volumes.

### Recovered inputs

Years 2016-17, 2017-18, and 2022-23 final summaries are recovered from an earlier repository
state. Cite the package version and preserve the packaged PDFs with any derived analysis.

---

## Validation

Validation checks internal accounting consistency — for example, whether object-head Data rows
add up to the printed Minor-Head Total in the same table. A passing check means the relationship
holds in the extracted data; it does not prove every PDF line was extracted perfectly.

**Per-year overall pass rates** (source: `validation_summary.csv`, level = Year, all financial
columns aggregated):

| Year | Pass rate | Year | Pass rate |
|---|---|---|---|
| 2016-17 | 84.3% | 2021-22 | 89.9% |
| 2017-18 | 74.8% | 2022-23 | 83.4% |
| 2018-19 | 86.8% | 2023-24 | 99.5% |
| 2019-20 | 89.5% | 2024-25 | 99.0% |
| 2020-21 | 89.6% | 2025-26 | 99.6% |
| | | 2026-27 | 99.7% |

Years 2016-17 through 2022-23 have lower pass rates; treat those volumes with extra caution.
2023-24 onward: 99%+.

Machine-readable detail: `validation_summary.csv` (columns: document_year, fiscal_year, level,
demand_number, major_head_code, …, n_checks, n_passed, pass_pct). Browser-viewable summary:
`validation_summary.html`. The `checks_<year>.csv` and `checks_<year>.ndjson` files contain the
full row-level comparison data for drill-down.

---

## Package File Map

```
karnataka-state-finance/
├── README.md                         This file
├── data_dictionary.csv               Column definitions for budget, checks, validation_summary
├── demand_names.json                 Demand number → department name lookup (29 demands)
├── validation_summary.csv            Cross-year pass rates, machine-readable
├── validation_summary.html           Cross-year pass rates, browser-viewable
├── package_stats.json                Row counts, schema version, PDF counts
└── years/
    └── <year>/                       e.g. 2024-25
        ├── csv/
        │   ├── budget_<year>.csv     Budget rows (all row types; use additive-leaf predicate)
        │   └── checks_<year>.csv     One row per validation comparison per financial column
        ├── json/
        │   ├── budget_leaves_<year>.ndjson   Additive leaves only; safe to sum directly
        │   ├── budget_nodes_<year>.ndjson    Full demand trees (nested hierarchy)
        │   ├── summaries_<year>.ndjson       Printed totals and summary tables
        │   └── checks_<year>.ndjson          Validation comparisons as typed documents
        └── pdfs/
            └── KA_<year>_EXPVOL{1..7}.pdf    Source expenditure-volume PDFs
```

**Demand names:** `demand_names.json` maps demand numbers to department names
(e.g. `"29"` → `"Debt Servicing"`). Source: 2024-25 volume cover pages, independently
cross-checked against dominant major heads per demand.

**Examples compendium:** `examples/` at the repo root contains four worked analyses in Python,
R, and DuckDB/SQL, all reconciling to 0.000000 crore. See `examples/README.md`.

---

## Advanced: JSON / Document Store

Load a year's leaves into MongoDB:

```bash
mongoimport --db ka_budget --collection budget_leaves_2024_25 \
  --file years/2024-25/json/budget_leaves_2024-25.ndjson
```

Query with `jq` (sum BE 2024-25 across all leaves):

```bash
jq -s '[.[].amounts[] | select(.measure=="budget_estimate" and .fiscal_year=="2024-25") | .value] | add' \
  years/2024-25/json/budget_leaves_2024-25.ndjson
```

Or with DuckDB:

```sql
SELECT SUM(a.value) / 100 AS total_be_crore
FROM read_ndjson_auto('years/2024-25/json/budget_leaves_2024-25.ndjson') t,
     UNNEST(t.amounts) AS a
WHERE a.measure = 'budget_estimate' AND a.fiscal_year = '2024-25';
```

**checks NDJSON schema notes:** `source_file` and `target_file` name the CSV families being
compared, not PDFs. `diff` is signed (`source_amount - target_amount`); `abs_diff <= 0.01`
(in INR_lakh, i.e. Rs 1,000) passes. Find failures with `{"failed": true}`.
