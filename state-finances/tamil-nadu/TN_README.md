# Tamil Nadu Budget Data Package (v0.1.0-draft)

Machine-readable Tamil Nadu **Detailed Budget Estimates (Demands for Grants)**
data for **13 budget years, 2014-15 through 2026-27**, extracted from the
official per-demand PDFs, validated arithmetically, and published in the same
two-table format as the Karnataka package in this repository — if you have used
`state-finances/karnataka/`, everything here works the same way, with the
TN-specific differences called out explicitly below.

Schema version: `tn-public-two-table-v1`.

## Start in 5 Minutes

Every year folder has the same layout:

```
TN_years/TN_<YYYY-YY>/
├── csv/budget_<YYYY-YY>.csv      every printed row, one line each
├── csv/checks_<YYYY-YY>.csv      every validation comparison, one line each
├── json/*.ndjson                 the same data, document-shaped
└── pdfs/TN_*_DN##_*.pdf          the official per-demand source PDFs
```

Load a year and sum the additive leaves (see the warning below):

```python
import csv

with open("TN_years/TN_2024-25/TN_csv/TN_budget_2024-25.csv") as f:
    rows = [r for r in csv.DictReader(f)]

leaves = [r for r in rows
          if r["type_of_table"] == "detailed_expenditure"
          and r["row_type"] == "Data"
          and r["row_level"] == "Sub-Detailed-Head"]

total = sum(float(r["budget_estimate_2024_25_amount_inThous"]) for r in leaves)
print(f"BE 2024-25 total: {total / 1e5:,.1f} INR crore")   # thousands → crore
```

**Units: all amounts are INR thousand (`amount_unit = INR_thousand`).**
Divide by 100 for INR lakh, by 100,000 for INR crore. This differs from
Karnataka (INR lakh); the four amount column names carry an explicit
`_inThous` suffix so the two states can never be silently confused.

## ⚠ Do Not Blindly Sum

The budget CSV reproduces **every printed row** — leaves, headers-as-data, and
eight kinds of printed subtotal. Summing a whole column double-counts.

**The additive-leaf predicate** (the only rows safe to sum):

```
type_of_table = 'detailed_expenditure'
AND row_type  = 'Data'
AND row_level = 'Sub-Detailed-Head'
```

Everything else is either a printed subtotal (`row_type = 'Total'`) or a
hierarchy name-carrier row (`row_type = 'Data'` at a coarser `row_level`,
usually with zero amounts). The `json/budget_leaves_*.ndjson` files contain
exactly the additive leaves, pre-filtered.

Row levels, top to bottom:

```
Demand → HOD → Major-Head → Sub-Major-Head → Minor-Head
       → Group-Sub-Head → Sub-Head → Detailed-Head → Sub-Detailed-Head (leaf)
```

Three TN-only levels have no Karnataka analogue:

* **`hod_code`** — Head of Department (e.g. `005 03`); a demand spans several.
* **`group_sub_head`** — the printed plan-band / funding-source label
  (e.g. `State's Expenditure`, `I.Non-Plan`, `Central Sector Schemes`).
* **`Sub-Detailed-Head`** — the object-level leaf (fills KA's `object_head`
  slot).

`Major-Head-Net`, `Major-Head-Gross`, and `Major-Head-Grand` totals are the
**recoveries ladder** (they reconcile `Deduct – Recoveries` entries); they are
reproduced but are not check targets.

## Amount Columns and `document_year`

### `document_year`

The budget-publication year (equal to the year folder). Each document prints
four financial columns for three fiscal years — identical convention to
Karnataka:

### Four positional amount columns

| Pos | Column pattern | Content | Fiscal year |
|-----|----------------|---------|-------------|
| 1 | `accounts_<Y-2>_amount_inThous` | Accounts (actuals) | document year − 2 |
| 2 | `budget_estimate_<Y-1>_amount_inThous` | Budget Estimate (restated) | document year − 1 |
| 3 | `revised_estimate_<Y-1>_amount_inThous` | Revised Estimate | document year − 1 |
| 4 | `budget_estimate_<Y>_amount_inThous` | Budget Estimate (headline) | document year |

For the 2024-25 document these are `accounts_2022_23_amount_inThous`,
`budget_estimate_2023_24_amount_inThous`,
`revised_estimate_2023_24_amount_inThous`,
`budget_estimate_2024_25_amount_inThous`.

### Canonical source rule

Same as Karnataka: take BE for year Y from document Y, RE for year Y from
document Y+1, Accounts for year Y from document Y+2. Later documents restate
earlier estimates; the canonical figure is the freshest printing.

Amounts are integers (the PDFs print whole thousands) and may be negative
(`Deduct – Recoveries` entries).

## NDJSON Files

Same four files as Karnataka, one JSON document per line:

* **`TN_budget_leaves_<Y>.ndjson`** — exactly the additive leaves (safe to sum).
  `_id = TN.<year>.sdh.dn<demand>.r<row_number>`.
* **`TN_budget_nodes_<Y>.ndjson`** — one document per demand with the full nested
  hierarchy (major → … → sub-detailed leaves). `_id = TN.<year>.<demand>`.
* **`TN_summaries_<Y>.ndjson`** — one document per printed Total row, with a
  `reconciliation` block (`checks_passed`, `pass_pct`, `abs_diff`, `diff_pct`)
  where checks anchor on it. Same `_id` scheme as leaves.
* **`TN_checks_<Y>.ndjson.gz`** — one document per validation comparison.
  `_id = <reference_check_id>::<check_id>::<position>`.
  **Gzip-compressed**: TN has ~10× Karnataka's comparison volume and the
  uncompressed files exceed GitHub's 100 MB per-file limit. Standard tools
  read them directly (`gzcat … | jq`, `pandas.read_json(..., compression=
  "gzip", lines=True)`, `mongoimport --gzip`); the same comparisons are in
  the plain `csv/checks_<Y>.csv`.

Amount arrays hold `{fiscal_year, measure, value}` entries with
`measure ∈ accounts | budget_estimate | revised_estimate`; zero values are
kept (a printed 0 is data in TN).

## Validation — Errors Are Reported Exactly Like Karnataka's

Three layers, same shapes, same semantics:

1. **Per-comparison** — `csv/checks_<Y>.csv` / `json/checks_<Y>.ndjson.gz`: one
   row per (check, account key, financial column position 1–4) with
   `source_amount` (the summed children), `target_amount` (the printed total),
   signed `diff = source − target`, `abs_diff`, `accuracy_pct`,
   `passed`/`failed`, and `threshold`.
   **A comparison passes iff `abs_diff < 0.5` (INR thousand)** — TN figures
   are integers, so a pass means the two figures match exactly. (Karnataka's
   threshold is 0.01 INR lakh = 1 INR thousand; the semantics are the same.)
2. **Rolled up onto budget rows** — the anchoring printed-Total row in
   `TN_budget_<Y>.csv` carries `has_check`, `reference_check_id`, `pass`,
   `pass_pct`, `diff`, `diff_pct`; `TN_summaries_<Y>.ndjson` carries the
   `reconciliation` block. A Charged/Voted **split total shares one
   `reference_check_id`** — the check compares the summed pair, so both
   sibling rows point at the same comparisons.
3. **Aggregated** — `TN_validation_summary.csv.gz` / `.html` at the package root:
   pass rates and μ/σ accuracy per year → demand → hierarchy level →
   financial column, with a column legend. Rebuild with
   `python3 tools/build_validation_summary.py --package tamil-nadu`.

### Check glossary (V-series)

TN prints one uniform detailed table, so every check is `in_schema` within
`detailed_expenditure` — a vertical roll-up chain:

| ID | check_type | Verifies |
|----|------------|----------|
| V01 | `sub_detailed_data_to_detailed_head_total` | Σ Sub-Detailed leaves = Detailed-Head Total |
| V02 | `detailed_head_total_to_sub_head_total` | Σ Detailed-Head Totals = Sub-Head Total |
| V03 | `sub_head_total_to_group_total` | Σ Sub-Head Totals = Group (plan-band) Total |
| V04 | `group_total_to_minor_head_total` | Σ Group Totals = Minor-Head Total |
| V05 | `minor_head_total_to_sub_major_total` | Σ Minor-Head Totals = Sub-Major Total |
| V06 | `sub_major_total_to_major_head_total` | Σ Sub-Major Totals = Major-Head Total |
| V07 | `sub_head_total_to_minor_head_total_group_independent` | Σ Sub-Head Totals = Minor-Head Total (bridges past the group level) |

The V ids are deliberately **not** named W01… like Karnataka's: the identities
tested differ (different printed hierarchy levels), and reusing the ids would
suggest a false equivalence. The reporting model — columns, pass semantics,
reference ids — is identical.

`reference_check_id` format:
`TN.<year>.dn_<demand>.in_schema.detailed_expenditure.<level>.<compared_key>`
(the `dn_<demand>` token fills the slot Karnataka uses for `expvol_<n>`;
`compared_key` components are underscore-joined with internal spaces as `-`,
e.g. HOD `001 01` → `001-01`).

These checks were computed by a line-for-line port of the extraction
pipeline's validators (`SRC/TN/validation/TN_run_validation_*.py` in the
PRJ-India-s-state-budgets-with-LLMs repository); the port reproduces the
pipeline's published 2014-15 arithmetic details exactly (23,281 comparisons,
key-for-key).

## Page-Numbering Note

`page_number` is the **printed page number inside the per-demand PDF** named
in `source_file`. As in Karnataka, a check's anchor page is where the *checked
printed total* appears — the contributing detail rows may sit on earlier
pages.

## Caveats

### Interim / revised publications
* **2021-22 is the Revised Budget Estimate (RBE) publication** issued after
  the 2021 election, and covers **demands 01–37 only** (~50k rows vs ~75k in
  neighbouring years). Treat cross-year demand comparisons accordingly.
* **2016-17 is also from the RBE variant** (same election-year pattern). The
  copied PDFs keep their original `_RBE_` filenames as provenance.

### Era split
* **2014-15 … 2018-19 (pre-IFHRMS)**: 15-character D P codes with 4-digit
  serial suffixes; plan bands like `I.Non-Plan` / `II.State Plan`.
* **2020-21 … 2026-27 (IFHRMS)**: 16-character D P codes with 5-digit object
  suffixes; funding-source bands like `State's Expenditure`.
* **2019-20 is a hybrid**: pre-IFHRMS D P codes with IFHRMS-style band labels.
  The arithmetic checks are era-neutral; only code-format expectations differ.

### Extraction conventions ("flag, never invent")
* Demand numbers are zero-padded to two digits (`1` → `01`; 2019-20 printed
  both forms).
* `vote_charge_marker` is kept verbatim — alongside `Charged`/`Voted`/
  `Combined` a few stray printed labels leak through (e.g. a band label);
  they were deliberately not repaired.
* A `group_sub_head` label carried across a page break is kept verbatim on
  the row; the **checks** re-attribute such rows to the correct printed band
  positionally (so V03 tests what the document meant, while the CSV shows
  what it printed).
* Negative amounts are genuine `Deduct – Recoveries` entries, not errors.
* One demand is split across two PDF volumes (2020-21, Demand 40 — Water
  Resources): its rows list both files in `source_file`, `;`-joined.

### Validation scope
Checks verify the **internal arithmetic consistency of the printed budget**
(does the printed subtotal equal the sum of its printed children), not
extraction accuracy against the PDF. The extraction pipeline separately
verified structural and dictionary consistency and repaired failing keys by
re-extraction before this package was built.

## Package File Map

```
state-finances/tamil-nadu/
├── README.md                 this file
├── TN_data_dictionary.csv       column-by-column definitions (budget / checks / validation_summary)
├── TN_demand_names.json         demand → name (canonical + per-year printed variants)
├── TN_package_stats.json        row/doc/PDF counts per year, schema & release version
├── TN_validation_summary.csv.gz aggregated pass rates + μ/σ accuracy (gzip; ~1.6M rows)
├── TN_validation_summary.html   same, browser-viewable drill-down with column legend
└── TN_years/TN_<YYYY-YY>/          2014-15 … 2026-27
    ├── csv/budget_<Y>.csv
    ├── csv/checks_<Y>.csv
    ├── json/budget_leaves_<Y>.ndjson
    ├── json/budget_nodes_<Y>.ndjson
    ├── json/summaries_<Y>.ndjson
    ├── json/checks_<Y>.ndjson.gz   (gzip — see NDJSON section)
    └── pdfs/TN_YYYY_YY[_RBE]_DN##_<department>.pdf
```

## Provenance

Extracted from the official Tamil Nadu Detailed Budget Estimates PDFs with the
LLM pipeline in the `PRJ-India-s-state-budgets-with-LLMs` repository (combined
outputs `OUT/TN/complete_TN/`), then converted to this package format by
`SRC/TN/portal_export/convert_tn.py` in that same repository. The converter
lives with the pipeline that feeds it rather than here, because this repository
is the published dataset. The conversion is deterministic: rerunning it
reproduces the package byte-for-byte.
