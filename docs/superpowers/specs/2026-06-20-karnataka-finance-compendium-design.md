# Design — Karnataka public-finance data package + examples compendium

**Date:** 2026-06-20
**Repo:** `india-public-finance-portal` (branch `main`)
**Author/orchestrator:** Opus (orchestration + review only)
**Implementation:** Sonnet subagents, dispatched in parallel where independent
**Status:** Draft for user review (no implementation started)

---

## 1. Context

The repo currently holds one data package at `karnataka/v0.2.0-draft/`: 11 fiscal years
(2016-17 … 2026-27) of Karnataka expenditure-volume budget tables extracted from PDFs, shipped
as per-year CSV + `.ndjson` + source PDFs, plus package-level docs (`README.md`, `guide.html`,
`known_caveats.md`, `data_dictionary.csv`), validation artifacts, and a worked-examples folder.

The working tree is **clean** (the JSON→Mongo migration noted in `HANDOFF.md` was committed as
`5eaf7b8`). Only `HANDOFF.md` is untracked.

**Goal:** turn this into a sparse, reproducible, open-research-grade repository that a beginner
(target persona: a 20-year-old economics undergraduate with foundational knowledge) can adopt by
imitation — answering real questions about Karnataka's public finances in Python, R, and DuckDB,
from CSV and from JSON — while the underlying data is made honest (correct year labels) and the
validation story is collapsed to a single drill-down.

## 2. Decisions locked with the user

| # | Decision |
|---|---|
| D1 | **Two top-level trees:** `karnataka-state-finance/` (the data package) and `examples/` (the research compendium). A portal-level `README.md` at repo root. |
| D2 | **Add the year to the data:** add an explicit `document_year` column/field, **and** rewrite the mislabelled 2016–2022 amount-column year labels to their positional truth. |
| D3 | **Validation:** drop `validation_findings.csv` (it is only the failed subset of the per-year checks), `validation_findings_summary.csv`, `validation_findings.md`, and the 11 per-year `validation_summary_<year>.md`. Build **one** summary computed from the per-year `checks_<year>.csv`, emitted as `validation_summary.csv` (tidy, hierarchical) **and** one interactive `validation_summary.html` (click `(+)` to drill down). |
| D4 | **`known_caveats.md` is folded into the package `README.md`** (Caveats section) and the file is deleted. |
| D5 | **Examples:** keep the three existing analyses (health BE→RE→Actuals; committed expenditure; variation by demand) and add a beginner **onboarding** set; port all to Python, R, and DuckDB; demonstrate both CSV and JSON; explain why NDJSON. |
| D6 | **README explains page numbering:** the source budget volumes paginate front matter in roman numerals (i, ii, iii …); our `page_number` is the arabic body pagination (1, 2, 3 …). |
| D7 | **Independent economics-undergrad usability audit** (persona), run early (informs cuts) and final (acceptance test); findings saved in the compendium. |
| D8 | **Docker** image (R + Python + DuckDB) so the examples are reproducible in one command. |
| D9 | **Validation cell metric:** each hierarchy node × financial column shows **number of checks** and **pass %**. |
| D10 | **Method:** `subagent-driven-development` + `dispatching-parallel-agents`; Sonnet does the work, Opus orchestrates/reviews only. |

## 3. Target structure

```
india-public-finance-portal/
├── README.md                          # NEW portal-level: what this is, repo map, states↔examples
├── karnataka-state-finance/           # DATA PACKAGE (git mv from karnataka/v0.2.0-draft)
│   ├── README.md                      # high-level + Caveats (folds known_caveats) + page-numbering note + format rationale + repo map
│   ├── data_dictionary.csv            # updated: document_year col; amount labels now honest
│   ├── validation_summary.csv         # THE ONE summary (tidy, hierarchical, per financial column)
│   ├── validation_summary.html        # THE ONE drilldown (interactive, click (+))
│   ├── package_stats.json             # regenerated (row/doc counts unchanged; coverage years corrected)
│   └── years/<year>/
│       ├── csv/{budget,checks}_<year>.csv      # + document_year column; amount labels corrected
│       ├── json/{budget_leaves,budget_nodes,checks,summaries}_<year>.ndjson  # + document_year; fiscal_year corrected
│       └── pdfs/KA_<y>_EXPVOL{1..7}.pdf         # unchanged (provenance)
└── examples/                          # RESEARCH COMPENDIUM
    ├── README.md                      # learning-module index + repo map + "adopt by imitation" path
    ├── Dockerfile, compose.yaml       # R + Python + duckdb, pinned
    ├── Makefile                       # `make reproduce` runs every example in Py + R + SQL and checks outputs
    ├── data/
    │   ├── processed/karnataka_budget_tidy.csv   # built from ../karnataka-state-finance (shared long table)
    │   └── README.md                  # provenance: how processed is derived; raw stays in the package (no duplication)
    ├── src/
    │   ├── python/    # 00_onboarding, 01_health, 02_committed, 03_demand_variation, _lib
    │   ├── r/         # same set (base R + jsonlite-in-Docker)
    │   └── sql/       # same set (duckdb)
    ├── doc/
    │   ├── learning-module.md         # the by-imitation curriculum
    │   ├── why-ndjson.md              # NDJSON rationale; CSV vs JSON; when to use which
    │   ├── guide.html                 # MOVED from the package
    │   └── usability-audit.md         # econ-undergrad persona findings
    └── out/                           # generated charts + results.json (reproducible)
```

**Inference flagged for confirmation:** `examples/data/` holds a *processed* tidy table plus a
pointer to the raw package; it does **not** duplicate the 77 PDFs / 44 ndjson. Raw is read from
`../karnataka-state-finance/years/`. If a physically self-contained `examples/years/` is wanted
instead, that is a one-line change to this design.

## 4. Components

### C1 — Repo restructure
- `git mv karnataka/v0.2.0-draft → karnataka-state-finance` (history preserved); remove the now-empty `karnataka/` wrapper.
- Move `guide.html` into `examples/doc/`.
- Create the `examples/` skeleton (`data/ src/ doc/ out/`).
- Remove stray `.DS_Store`; confirm `.gitignore` hygiene.
- Version (`v0.2.0-draft`) is retained in the package `README.md` and `package_stats.json` (`release_version`), not in the directory name.

### C2 — Data fix (D2) — highest-risk, pure-metadata, fully verifiable
The four amount columns are positional: `col1=Actuals(Y-2), col2=BE(Y-1), col3=RE(Y-1), col4=BE(Y)`
for document year `Y`. Files 2016-17…2022-23 carry **identical** labels (which are in fact
*2020-21's* correct labels), wrongly stamped. The `.ndjson` `fiscal_year` fields inherited the same
error.

**Transform (deterministic, derived from the folder year `Y`, start year `y`):**
- Rename amount columns → `accounts_{y-2}_{y-1}`, `budget_estimate_{y-1}_{y}`, `revised_estimate_{y-1}_{y}`, `budget_estimate_{y}_{y+1}` (idempotent — a no-op for 2020-21 and 2023-27).
- Add `document_year` = `Y` to every budget and checks CSV row.
- In every `.ndjson` doc: add `document_year`; recompute each `amounts[].fiscal_year` from `Y` by role (accounts=Y-2; the two budget_estimate entries are T-1 and T, distinguished by their old labels; revised_estimate=Y-1). Patch in place — do **not** rebuild structure.
- Values are **never** modified; only labels/added fields.

**Verification gate (must pass before the change is accepted):**
1. Per-file row counts and per-file `.ndjson` doc counts equal `package_stats.json` (unchanged).
2. Every numeric value is byte-identical to pre-change (diff only on header names, the new column, and `fiscal_year` strings).
3. For each relabelled year, the distinct set of `fiscal_year` labels equals the positional truth `{y-2, y-1, y}`.
4. 2024-25 total expenditure (additive-leaf predicate) still reconstructs to ≈ ₹3.7 lakh crore (this year was never mislabelled — a regression canary).
5. The example engine still runs and prints the three analyses.

### C3 — Validation summary (D3, D9)
Computed from `years/*/csv/checks_<year>.csv` (the evidence layer that stays).
- **Hierarchy / drill path:** `Year ▸ Demand ▸ Major Head ▸ Sub-Major ▸ Minor ▸ Sub-Head ▸ Detailed`.
- **Column-wise:** the 4 financial columns, keyed by `financial_column_position` (1–4, reliable) and labelled with the corrected fiscal year.
- **Cell:** `n_checks` and `pass_pct` (passed / total).
- `validation_summary.csv`: tidy — one row per `(node path, level, financial_column_position)` with `n_checks, n_passed, pass_pct`; rollups present at every level so CSV users get the same drill-down without recomputation.
- `validation_summary.html`: self-contained (no network deps), nested rows expand/collapse via `(+)` using `<details>`/minimal JS; headline anomalies (e.g. Animal Husbandry & Fisheries Act/BE ≈ 14× for 2024-25) surfaced as *investigate*, not asserted; includes the check-code glossary and a short "how to chase a failing check into the PDF" note.
- **Deletions:** `validation_findings.csv`, `validation_findings_summary.csv`, `validation_findings.md`, 11× `years/*/validation_summary_<year>.md`.

### C4 — Examples compendium (D5)
- **Shared build (`00_build_tidy`)** reads the corrected package and writes `examples/data/processed/karnataka_budget_tidy.csv` (additive leaves, long format: `document_year, fiscal_year, measure, demand, major_head_code/name, object_head_code, amount`), plus a small JSON of **canonical expected numbers** for every example. This is the single source of truth all three languages reconcile against.
- **Onboarding (new, beginner-flavored)** — 2–3 five-line questions, e.g.:
  - "Karnataka's five biggest spending departments, latest actuals."
  - "How much did Karnataka budget for health this year?"
  - "Does the state usually spend more or less than it budgets?"
- **The three analyses (kept, polished):** health (MH 2210+2211) BE→RE→Actuals; committed expenditure (salaries + pensions[2071] + interest[2049]); variation by demand head.
- **Each example in Python, R, DuckDB**, producing identical numbers; outputs to `examples/out/`.
- **Formats lesson:** answer one question from CSV *and* from `.ndjson`; `why-ndjson.md` explains the rationale (one self-describing typed document per line; streamable; `jq`/Mongo/DuckDB-friendly; vs CSV's flat, universal simplicity) and **which fields a beginner should exclude from naive analysis** (Header/Total/summary rows; non-leaf rows; uncertified `amount_unit`; OCR outliers).
- **Language/tooling reality:** Python uses stdlib `csv` (+ `duckdb` via pip for the SQL track); R uses **base R + CSV** natively, with the JSON-in-R demo via `jsonlite` (pinned in Docker).

### C5 — Docs (D4, D6)
- **Portal `README.md`** (repo root): what the portal is, the repo map, how state packages and `examples/` relate, quick start.
- **Package `README.md`:** coverage; **page-numbering note** (roman front matter vs arabic `page_number` — exact wording verified against a sample PDF before finalizing); the additive-leaf predicate; honest amount-column labels + `document_year`; CSV vs JSON format rationale; **Caveats** section (folds `known_caveats.md`); pointer to the one `validation_summary`.
- `data_dictionary.csv` updated: add `document_year`; rewrite the amount-label note to reflect honest labels; **drop** the `validation_findings` and `validation_findings_summary` table rows (those files are deleted); **add** a `validation_summary` table section. The `checks` and `budget` table rows stay (with `document_year` added to `budget`).

### C6 — Usability audit (D7)
A Sonnet subagent adopts the persona ("20-year-old economics undergraduate, foundational knowledge"). Run twice:
- **Early:** audits the *current* repo + README + examples → surfaces "do we really need this / won't this confuse," and "which fields to exclude from analysis." Feeds C3/C5 cuts.
- **Final:** re-audits the finished compendium as an acceptance test; confirms onboarding-by-imitation works and that examples run in Python + R + SQL.
- Output: `examples/doc/usability-audit.md` (kept, as reproducibility/transparency).

### C7 — Docker + reproducibility (D8)
- `examples/Dockerfile` + `compose.yaml`: a base image with Python 3, `duckdb`, R 4.x, and `jsonlite`, pinned.
- `examples/Makefile` (`make reproduce`): runs every example in all three languages and asserts outputs match the canonical numbers from `00_build_tidy`.
- Docker is **not installable in this environment**, so the image is authored and inspected, but "confirm it works" is satisfied by running the same example code **natively** (see §6).

## 5. Execution model (D10)

Opus orchestrates and reviews; **all implementation is by Sonnet subagents.** Dependency DAG:

- **Phase A (sequential; Opus gates each):**
  - **A0** — early usability audit (C6 early) — *can run concurrently with A1*.
  - **A1** — restructure (C1).
  - **A2** — data fix + verification script (C2). Gates everything that reads data.
- **Phase B0 (gates B1–B4):** shared tidy build + canonical expected numbers + example spec (part of C4).
- **Phase B (parallel Sonnet):**
  - **B1** validation summary csv+html (C3)
  - **B2** Python examples (C4)
  - **B3** R examples (C4)
  - **B4** DuckDB examples (C4)
  - **B5** docs/READMEs (C5)
  - **B6** Docker + Makefile (C7)
- **Phase C (verify):**
  - **C-recon** cross-language reconciliation: Python == R == DuckDB == canonical.
  - **C-audit** final usability audit (C6 final).
  - **C-review** Opus review of full diff; stage commits.

Parallel batches are dispatched in a single message each; each subagent returns a structured
result (files changed, verification output) that Opus reviews before accepting.

## 6. Environment constraints & what "confirm it works" means

| Tool | State | Plan |
|---|---|---|
| `python3` | present, **no pandas** | stdlib `csv`; examples run natively |
| `duckdb` | **absent** | `pip install duckdb` (pure-python wheel); SQL track runs natively |
| `R`/`Rscript` 4.4 | present, **no add-on pkgs** | base R + CSV runs natively; `jsonlite` for the JSON-in-R demo via Docker (and a CRAN-install attempt, degraded honestly if offline) |
| `docker` | **absent** | Dockerfile authored + inspected; not built here |

"Confirm it works" = the Python and base-R/CSV examples **execute natively and reconcile to the
canonical numbers**; the DuckDB track runs natively after `pip install duckdb`; the Docker image is
provided and inspected (its Python/SQL code is the same code verified natively). Any gap is stated
plainly, not papered over.

## 7. Acceptance criteria

1. Repo matches §3; `git log --follow` shows preserved history across the move.
2. Data fix verification gate (§C2) passes; the three analyses still reproduce.
3. Exactly one validation summary exists (`.csv` + `.html`); the four deleted validation artifacts and `known_caveats.md` are gone; caveats live in the package README.
4. Onboarding + three analyses run in Python, R, and DuckDB and produce identical numbers (cross-checked).
5. Package README explains page numbering (roman vs arabic), honest amount labels + `document_year`, CSV/JSON rationale, caveats, and the repo map.
6. `why-ndjson.md`, the learning module, and `usability-audit.md` exist; a beginner can follow the onboarding by imitation.
7. Dockerfile + `make reproduce` present; native verification evidence recorded.
8. File count is net-lower than today (sparseness): the per-year validation md's, the findings CSVs/md, and `known_caveats.md` are removed.

## 8. Non-goals
- No re-extraction from PDFs; no change to any numeric value.
- No new fiscal years or sectors beyond the existing three analyses (+ onboarding).
- No web app / portal frontend; static HTML only.
- PDFs are retained (provenance) — not pruned for "sparseness."

## 9. Open risks
- **Data fix on `.ndjson`** is the main risk; mitigated by patch-in-place (not rebuild), the §C2 verification gate, and Opus diff review.
- **Page-numbering wording** must be checked against a real PDF before the README asserts it.
- **R-with-JSON** native verification depends on CRAN reachability; the CSV path (primary) has no such dependency.
- **Cross-language identical numbers** require a single shared scope spec (object codes, major heads) — owned by B0 so all three languages consume one definition.
