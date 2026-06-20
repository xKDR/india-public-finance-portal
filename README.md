# India State Budget Data

Research-grade state budget data extracted from public expenditure-volume PDFs, with source
provenance, validation checks, and user documentation kept next to the data.

## Why This Exists

Public budget documents are PDFs. PDFs are good for publication and bad for research: they do not
expose row roles, hierarchy levels, subtotals, or extraction errors. This repository turns those
documents into CSV and NDJSON while preserving enough of the original document structure to audit
any value against the source PDF.

The goal is not to hide uncertainty. The goal is to make it inspectable.

## What Is Here Today

| State | Package | Years | Status |
|-------|---------|-------|--------|
| Karnataka | [`karnataka-state-finance/`](karnataka-state-finance/) | 2016-17 to 2026-27 (11 years) | v0.2.0-draft |

More states will be added as data packages under their own directories.

## Repository Layout

```
india-public-finance-portal/
├── karnataka-state-finance/          Karnataka budget data package (v0.2.0-draft)
│   ├── README.md                     How to read this package: summation rules, caveats, schema
│   ├── data_dictionary.csv           Column definitions and controlled values for all tables
│   ├── demand_names.json             Demand number → department name lookup
│   ├── validation_summary.csv        Cross-year validation pass rates (machine-readable)
│   ├── validation_summary.html       Cross-year validation pass rates (browser-viewable)
│   ├── package_stats.json            Row counts, PDF counts, schema version
│   └── years/
│       └── <year>/                   e.g. 2024-25
│           ├── csv/                  budget_<year>.csv, checks_<year>.csv
│           ├── json/                 budget_leaves_<year>.ndjson, budget_nodes_<year>.ndjson,
│           │                         summaries_<year>.ndjson, checks_<year>.ndjson
│           └── pdfs/                 Source expenditure-volume PDFs (7 volumes per year)
└── examples/                         Multi-language worked-examples compendium
    ├── README.md                     Compendium index, quick-start, Docker instructions
    ├── src/python/                   Four analysis scripts in Python (stdlib only)
    ├── src/r/                        Same four analyses in R (base-R primary path)
    ├── src/sql/                      Same four analyses in DuckDB SQL
    ├── data/processed/               Canonical tidy table + reconciliation fixture
    ├── doc/                          why-ndjson.md, learning-module.md
    ├── Dockerfile + compose.yaml     Pinned Docker image for one-command reproduction
    └── Makefile                      make reproduce
```

## How the Data Package and Examples Relate

`karnataka-state-finance/` is the **data package**: raw extracted rows, hierarchy structure,
validation checks, and source PDFs. It is self-describing — the package `README.md` and
`data_dictionary.csv` document everything needed to work with it directly.

`examples/` is a **worked-examples compendium** built on top of that package. It provides:

- A pre-filtered canonical tidy table (`data/processed/karnataka_budget_tidy.csv`, 285,604 rows)
  that is safe to SUM with no further predicate
- Four analysis questions (onboarding, health spending, committed expenditure, demand variation)
- Identical implementations in Python, R, and DuckDB/SQL — all reconcile to 0.000000 crore
- One-command reproduction via Make or Docker

Start with the package `README.md` if you want to understand the data structure. Start with
`examples/README.md` if you want to see working code first.

## Quick-Start (Karnataka, 5 minutes)

### Option A — Raw CSV with predicate

```python
import csv
total = 0
with open("karnataka-state-finance/years/2024-25/csv/budget_2024-25.csv") as f:
    for row in csv.DictReader(f):
        if (row["type_of_table"] == "object_head"
                and row["row_type"] == "Data"
                and row["row_level"] == "Object-Head"):
            v = row["budget_estimate_2024_25_amount"].replace(",", "").strip()
            if v and v != "-":
                total += float(v)
print(f"Total BE 2024-25: ₹{total/100:,.0f} crore")  # ~₹370,659 crore
```

**The three-condition predicate is not optional.** The CSV keeps Header, Total, and summary rows
to stay close to the source PDF. See the package `README.md` for why all three conditions are
required.

### Option B — Filter-free NDJSON leaves

```python
import json
total = 0
with open("karnataka-state-finance/years/2024-25/json/budget_leaves_2024-25.ndjson") as f:
    for line in f:
        for amt in json.loads(line)["amounts"]:
            if amt["measure"] == "budget_estimate" and amt["fiscal_year"] == "2024-25":
                total += amt["value"]
print(f"Total BE 2024-25: ₹{total/100:,.0f} crore")  # ~₹370,659 crore
```

`budget_leaves` NDJSON contains only the additive leaf rows — no predicate needed.

### Option C — Pre-filtered tidy table (examples/)

```python
import csv
total = sum(
    float(r["amount_lakh"]) for r in
    csv.DictReader(open("examples/data/processed/karnataka_budget_tidy.csv"))
    if r["fiscal_year"] == "2024-25" and r["measure"] == "BE"
) / 100
print(f"Total BE 2024-25: ₹{total:,.0f} crore")  # ~₹370,658 crore
```

### Option D — Docker (all three languages, verified)

```bash
docker compose -f examples/compose.yaml run --rm examples
# or natively:
make -C examples reproduce
```

## States and Examples

| State | Data package | Examples compendium |
|-------|-------------|---------------------|
| Karnataka | [`karnataka-state-finance/`](karnataka-state-finance/) | [`examples/`](examples/) |

## Source Provenance

Every budget row carries `source_file`, `page_number`, and `row_number`, so any value can be
traced to a specific page of a specific source PDF.

## Versioning

Packages are versioned per state (e.g. `v0.2.0-draft`). A `-draft` suffix means the data has not
been finalised. Pin to the package directory and re-check the package `README.md` when a new
version lands.
