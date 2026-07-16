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
| Karnataka | [`state-finances/karnataka/`](state-finances/karnataka/) | 2018-19 to 2026-27 (9 years) | v0.2.0-draft |
| Tamil Nadu | [`state-finances/tamil-nadu/`](state-finances/tamil-nadu/) | 2014-15 to 2026-27 (13 years) | v0.1.0-draft |

Each state is a self-describing package under `state-finances/`. Every directory
and file inside a package carries the state's prefix (`KA_`, `TN_`), so a file
stays identifiable once it is downloaded, copied, or opened away from its folder.
More states will be added the same way.

**Units differ between states**: Karnataka amounts are INR lakh; Tamil Nadu
amounts are INR thousand (its amount columns carry an explicit `_inThous`
suffix). Every row also carries an `amount_unit` column — check it before
comparing across states.

## Repository Layout

```
india-public-finance-portal/
├── state-finances/
│   ├── karnataka/                    Karnataka budget data package (v0.2.0-draft)
│   │   ├── KA_README.md              How to read this package: summation rules, caveats, schema
│   │   ├── KA_data_dictionary.csv    Column definitions and controlled values for all tables
│   │   ├── KA_demand_names.json      Demand number → department name lookup
│   │   ├── KA_package_stats.json     Row counts, PDF counts, schema version
│   │   ├── KA_validation_summary.csv Cross-year pass rates + μ/σ accuracy (machine-readable)
│   │   ├── KA_validation_summary.html   Same, browser-viewable, with a column legend
│   │   └── KA_years/
│   │       └── KA_<year>/            e.g. KA_2024-25
│   │           ├── KA_csv/           KA_budget_<year>.csv, KA_checks_<year>.csv
│   │           ├── KA_json/          KA_budget_leaves/_nodes/_summaries/_checks_<year>.ndjson
│   │           └── KA_pdfs/          Source expenditure-volume PDFs (7 volumes per year)
│   └── tamil-nadu/                   Tamil Nadu budget data package (v0.1.0-draft)
│       ├── TN_README.md              Same structure as Karnataka's; TN deltas documented
│       ├── TN_data_dictionary.csv    Column definitions and controlled values for all tables
│       ├── TN_demand_names.json      Demand number → department name (canonical + per-year)
│       ├── TN_package_stats.json     Row counts, PDF counts, schema version
│       ├── TN_validation_summary.csv.gz   Cross-year pass rates + μ/σ accuracy (gzip)
│       ├── TN_validation_summary.html     Same, browser-viewable, with a column legend
│       └── TN_years/
│           └── TN_<year>/            2014-15 … 2026-27
│               ├── TN_csv/           TN_budget_<year>.csv, TN_checks_<year>.csv
│               ├── TN_json/          leaves/nodes/summaries + TN_checks_<year>.ndjson.gz
│               └── TN_pdfs/          Source PDFs (one per demand)
├── tools/
│   └── build_validation_summary.py   Rebuilds a package's validation summary from its checks CSVs
└── examples/                         Multi-language worked-examples compendium (Karnataka)
    ├── README.md                     Compendium index, quick-start, Docker instructions
    ├── src/python/                   Four analysis scripts in Python (stdlib only)
    ├── src/r/                        Same four analyses in R (base-R primary path)
    ├── src/sql/                      Same four analyses in DuckDB SQL
    ├── data/processed/               Canonical tidy table + reconciliation fixture
    ├── doc/                          why-ndjson.md, learning-module.md, guide.html, usability-audit.md
    ├── Dockerfile + compose.yaml     Pinned Docker image for one-command reproduction
    └── Makefile                      make reproduce
```

## How the Data Package and Examples Relate

`state-finances/karnataka/` is the **data package**: raw extracted rows, hierarchy structure,
validation checks, and source PDFs. It is self-describing — the package `README.md` and
`data_dictionary.csv` document everything needed to work with it directly.

`examples/` is a **worked-examples compendium** built on top of that package. It provides:

- A pre-filtered canonical tidy table (`data/processed/karnataka_budget_tidy.csv`, 234,930 rows)
  that is safe to SUM with no further predicate
- Four analysis questions (onboarding, health spending, committed expenditure, demand variation)
- Identical implementations in Python, R, and DuckDB/SQL — all reconcile to 0.000000 crore
- One-command reproduction via Make or Docker

Start with the package `KA_README.md` if you want to understand the data structure. Start with
`examples/README.md` if you want to see working code first.

## Quick-Start (Karnataka, 5 minutes)

**New here? Start with the warm-up** — one number, no Docker, nothing to install beyond Python 3
or R:

```bash
python3 examples/src/python/hello_budget.py     # or:  Rscript examples/src/r/hello_budget.R
```

Then read the **visual guide** to the documents and the data: open `examples/doc/guide.html` in a
browser (`open examples/doc/guide.html` on macOS, `xdg-open examples/doc/guide.html` on Linux, or
double-click it; on GitHub the link shows raw HTML, so clone or download first). The
[`examples/`](examples/) compendium has the full getting-started path.

The options below are for **reading the raw data directly**, once you know what you want.

### Option A — Raw CSV with predicate

```python
import csv
total = 0
with open("state-finances/karnataka/KA_years/KA_2024-25/KA_csv/KA_budget_2024-25.csv") as f:
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
to stay close to the source PDF. See `KA_README.md` for why all three conditions are
required.

### Option B — Filter-free NDJSON leaves

```python
import json
total = 0
with open("state-finances/karnataka/KA_years/KA_2024-25/KA_json/KA_budget_leaves_2024-25.ndjson") as f:
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
| Karnataka | [`state-finances/karnataka/`](state-finances/karnataka/) | [`examples/`](examples/) |
| Tamil Nadu | [`state-finances/tamil-nadu/`](state-finances/tamil-nadu/) | — |

## Source Provenance

Every budget row carries `source_file`, `page_number`, and `row_number`, so any value can be
traced to a specific page of a specific source PDF.

## Versioning

Packages are versioned per state (e.g. `v0.2.0-draft`). A `-draft` suffix means the data has not
been finalised. Pin to the package directory and re-check that package's README when a new
version lands.

## License

Code and data in this repository are released under the MIT License (see [`LICENSE`](LICENSE)). If
you use the data, please cite it — see [`CITATION.cff`](CITATION.cff).
