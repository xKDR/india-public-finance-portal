# Design: Onboarding overhaul for the India Public Finance Portal

**Date:** 2026-06-24
**Status:** Approved (design); pending implementation plan + autoplan review
**Author lens:** a young economics research scholar, new to Karnataka Demand-for-Grants
documents, who wants to compute something real in Python or R within ~10 minutes and must not be
tricked into double-counting.

## Context

The repo (`india-public-finance-portal`) already ships a mature Karnataka data package
(`karnataka-state-finance/`, v0.2.0-draft, 11 years) and a worked-examples compendium
(`examples/`) with Python/R/SQL tracks that reconcile to 0.000000 crore. This work *improves
onboarding* on top of what exists — it does not rebuild the data or the analysis pipeline.

Grounding facts (verified):
- `package_stats.json`: 11 years, **220,211** budget rows, **192,804** check rows, **77** PDFs,
  version `v0.2.0-draft`. (The "285,604" figure elsewhere is the derived tidy table, a different
  object — do not conflate.)
- Snapshot source: `karnataka-state-finance/years/2024-25/pdfs/KA_2024_25_EXPVOL1.pdf`, **page 2**
  — demand 03, major head 2039 (State Excise), detailed head "Commissioner for Excise and Other
  Establishments". The first extracted rows in `budget_2024-25.csv` (Header → Pay-Officers /
  Pay-Staff / Interim Relief / Dearness Allowance leaf Data rows → a Total row) map to it
  line-for-line. This is the PDF→data bridge.
- Public-repo gaps: no `LICENSE`, no `CITATION`, no `.gitignore`; `HANDOFF.md` and
  `docs/superpowers/` are internal artifacts in the tree; repo carries heavy binaries (77 PDFs +
  19 MB `validation_summary.csv` + 4.2 MB HTML).

## Goals

1. Re-order and restyle `examples/doc/guide.html` so a newcomer is oriented before being warned —
   lead with the documents, a real snapshot, and the data dictionary; the "don't sum the whole
   table" rule lands *after* structure is understood, not as the opener.
2. Apply the XKDR house style (from xkdr.org) to the guide.
3. Give `examples/` a clear, append-friendly **index** plus a gentle Python & R getting-started
   path that does not require Docker.
4. Add one beginner example simpler than Q0.
5. Make the repo safe to open publicly (MIT license, citation, gitignore) and document — as
   recommendations — how a second state slots in.

## Non-goals

- No change to the extraction, the data package contents, or the reconciliation pipeline's
  numbers.
- No renumbering of the existing `00_onboarding` … `03_demand_variation` examples.
- No `CONTRIBUTING.md` right now (per user). Multi-state guidance is delivered as review
  recommendations, not a committed contributor file.
- No multi-state refactor and no Git LFS migration now — both are flagged, not executed.
- SQL stays as-is and secondary; the beginner example targets Python and R only.

## XKDR style tokens (from www.xkdr.org)

- Background `#F2F1F0` (warm off-white); body text `#212529`.
- Accent **coral `#F57D6A`** for section headings, links, highlights.
- Headings in **Montserrat** (700); body in the system sans stack.
- Solid-black buttons/footer with white text. Card grids, generous whitespace, thin rule
  separators, clean academic feel.

## Deliverable 1 — `examples/doc/guide.html` rebuilt and reordered

Restyle to the XKDR tokens above. New section order:

1. **Header** — title, tagline, accurate stats (11 years · 220,211 budget rows · 192,804 check
   rows · 77 PDFs · v0.2.0-draft).
2. **Introduction to the documents** *(new)* — what Karnataka's 7 expenditure-volume PDFs are,
   who publishes them, what "Detailed Estimates of Expenditure / Demand for Grants" means, why we
   extract them. Plain-language orientation for someone new to Indian public finance.
3. **A snapshot of the budget document** *(new)* — a rendered image of EXPVOL1 p.2 beside the
   exact extracted rows, with callouts mapping a printed line → `row_type` / `row_level` / the
   amount columns. Image saved as `examples/doc/img/budget-page-2024-25-expvol1-p2.png`.
4. **The data dictionary** *(new)* — the budget-table columns rendered from
   `karnataka-state-finance/data_dictionary.csv` as a clean grouped table (identity/provenance ·
   hierarchy · amounts/measures · validation). Replaces "go read the CSV."
5. **The accounting ladder** *(keep, restyle)* — Major Head → Object Head, six tiers.
6. **Don't double-count** *(reframed from "Safe totals")* — opens with the Total-row example from
   the snapshot, then verbatim: *"Do not sum the whole table. Totals and summary rows repeat
   amounts already present in leaf rows,"* then the three-condition additive-leaf predicate.
7. **Voted and charged** *(keep, restyle)*.
8. **The three measures (BE / RE / Actuals) and the canonical source rule** *(new, brief)* — every
   example depends on it.
9. **Validation drilldown** *(keep, restyle)*.
10. **Files to use** *(keep, restyle)* + links to the examples index and getting-started.

Constraints: self-contained HTML (inline CSS, Montserrat via a single web-font link or system
fallback), opens from `file://`, responsive, no external JS frameworks. All numbers must match the
package/canonical sources.

## Deliverable 2 — Examples index built to grow

In `examples/README.md`:
- **"Getting started in 5 minutes (Python & R)"** block near the top: run the warm-up, then
  `00_onboarding`, *no Docker required* (stdlib / base-R). Docker + `make reproduce` reframed as
  "verify all language tracks."
- A proper **Examples Index** table, append-only by design:
  `Level | Question | Concepts | Python | R | SQL | Reconciled?`. Rows: Warm-up, Q0–Q3, plus a
  one-line note showing how the next entry slots in.
- A short **"How to add an example"** recipe pointing at `_spec/README.md`.

## Deliverable 3 — One beginner example simpler than Q0

`examples/src/python/hello_budget.py` and `examples/src/r/hello_budget.R`: a self-contained warm-up
answering one question — *"What did Karnataka actually spend on Health in 2024-25?"* — with one
filter (major heads 2210 + 2211, `measure = Actuals`, `fiscal_year = 2024-25`) + one sum +
lakh→crore, printing a single number. It self-verifies with an internal assertion against the
canonical Health 2024-25 Actuals figure (sourced from `canonical_numbers.json` `q1_health`, so it
cannot drift from the reconciliation fixture). No JSON/results machinery. Added as a `make hello`
target and the first row of the index. Reads only the tidy table.

## Deliverable 4 — Public-readiness: review + low-risk fixes

Implement now:
- `LICENSE` — **MIT**, attributed to XKDR.
- `CITATION.cff` — for research citability.
- `.gitignore` — ignore `examples/out/results_*.json`, `.DS_Store`, and other local artifacts.
- Minor root `README.md` edits — link the guide, add a one-line license note.

Deliver as written recommendations in the plan (not as repo changes):
- "How to add a new state" contract: directory naming `<state>-state-finance/`, required files
  (README, `data_dictionary.csv`, `package_stats.json`, `demand_names.json`,
  `years/<year>/{csv,json,pdfs}`), `schema_version`, and how `examples/` relate.
- Flag, do not delete: `HANDOFF.md` and `docs/superpowers/` as internal artifacts on the public
  surface.
- Flag, do not execute: repo heft (77 PDFs + 19 MB CSV + 4.2 MB HTML) — evaluate Git LFS or
  release-asset hosting.

## Files touched

`examples/doc/guide.html`, new `examples/doc/img/budget-page-2024-25-expvol1-p2.png`,
`examples/README.md`,
`examples/Makefile`, new `examples/src/python/hello_budget.py`, new
`examples/src/r/hello_budget.R`, `LICENSE`, `CITATION.cff`, `.gitignore`, minor `README.md`.

## Verification criteria

- `guide.html` opens from `file://`, renders in XKDR style, sections appear in the order above,
  the snapshot image displays, and every figure matches `package_stats.json` /
  `canonical_numbers.json`.
- `python3 examples/src/python/hello_budget.py` and `Rscript examples/src/r/hello_budget.R` each
  print the Health 2024-25 Actuals figure and pass their internal self-check.
- `make -C examples reproduce` still reconciles to 0.000000 crore (no regression).
- Every link in the examples index resolves to a real file.
- `LICENSE`, `CITATION.cff`, `.gitignore` present and valid.

## Resolved decisions

- License: **MIT** (single license, XKDR attribution).
- No `CONTRIBUTING.md`.
- Snapshot: a real rendered PDF page (EXPVOL1 p.2) beside the extracted rows.
- Scope: restructure + index + getting-started + one beginner example; repo review + low-risk
  fixes.
