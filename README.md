# India State Budget Data

Research-grade state budget data extracted from public budget PDFs, with source provenance,
validation checks, caveats, and user documentation kept next to the data.

## Why This Exists

Public budget documents are usually PDFs. PDFs are good for publication and bad for research:
they do not naturally expose row roles, hierarchy levels, totals, subtotals, or extraction errors.
This repository turns those documents into CSV and JSON while preserving enough of the original
document structure to audit the result against the source PDF.

The goal is not to hide uncertainty. The goal is to make it inspectable.

## What Is Here Today

| State | Package | Years | Status |
|-------|---------|-------|--------|
| Karnataka | [`karnataka/v0.2.0-draft`](karnataka/v0.2.0-draft) | 2016-17 to 2026-27 (11 years) | Draft |

More states will be added as packages under their own directories. The structure is built to hold
many states and many revisions of each state side by side.

## Repository Layout

```
india-public-finance-portal/
└── <state>/
    └── <version>/                      e.g. karnataka/v0.2.0-draft
        ├── README.md                   how to read this package, summation rules, hierarchy
        ├── data_dictionary.csv         column definitions and controlled values
        ├── known_caveats.md            read before unit-sensitive analysis
        ├── validation_findings.csv     failed validation rows, anchored to page and row
        ├── validation_findings.md      narrative version of the findings
        ├── package_stats.json          row counts, PDF counts, schema version
        ├── guide.html                  visual guide to the hierarchy and validation IDs
        └── years/
            └── <year>/                 e.g. 2021-22
                ├── csv/                 budget_<year>.csv, checks_<year>.csv
                ├── json/                NDJSON documents: budget_nodes, budget_leaves,
                │                        summaries, checks (one per line, MongoDB-loadable)
                └── pdfs/                source expenditure-volume PDFs
```

Each state package is self-describing. Start from the package `README.md` for the rules that apply
to that state's data, because column meanings and summation rules belong to the package, not to this
top-level overview.

## Karnataka At A Glance

The current Karnataka draft (`karnataka/v0.2.0-draft`) covers 2016-17 through 2026-27.

| Quantity | Count |
|----------|-------|
| Budget rows | 220,211 |
| Validation check rows | 192,804 |
| Validation findings (rows flagged) | 25,317 |
| Source PDFs | 77 (7 expenditure volumes per year) |
| Schema | `ka-public-two-table-v3` |

## How To Use The Data

1. Open the package `README.md` (for Karnataka, [`karnataka/v0.2.0-draft/README.md`](karnataka/v0.2.0-draft/README.md)).
2. Read the budget rows in `years/<year>/csv/budget_<year>.csv` (or the JSON equivalent).
3. Read `years/<year>/csv/checks_<year>.csv` for the validation comparisons.
4. Read `validation_findings.csv` for the rows that failed validation, with page and row anchors.
5. Read `data_dictionary.csv` for column definitions and `known_caveats.md` before any analysis that
   depends on units.

Every budget row carries `source_file`, `page_number`, and `row_number`, so any value can be traced
back to a specific page of a specific source PDF.

### Do Not Blindly Sum

The CSV intentionally keeps Header, Total, and summary rows so it stays close to the PDF. Summing
every amount row will double count. Use the additive-leaf predicate documented in the package README,
for Karnataka:

```sql
WHERE type_of_table = 'object_head'
  AND row_type = 'Data'
  AND row_level = 'Object-Head'
```

## Provenance And Validation

Each package ships its own validation output rather than a single pass/fail verdict. The check rows
and findings let you see where the extraction agreed with the source totals and where it did not,
down to the page and row. Treat the findings as a map of known weak spots, not as a list of bugs that
have already been fixed.

## Versioning And Status

Packages are versioned per state, for example `v0.2.0-draft`. A `-draft` suffix means the data has
not been finalised and may change. Pin to a specific version directory if you need a stable reference,
and re-check the package `README.md` and `known_caveats.md` when a new version lands.

This repository is currently a draft and should be cited as such.
