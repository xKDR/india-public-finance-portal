# Public-Readiness Review — India Public Finance Portal

**Date:** 2026-06-24
**Scope of this round:** onboarding overhaul (guide, examples index, beginner example, public-readiness files). Hosting / multi-state / notebooks were deliberately held out of this round (owner decision at the autoplan premise gate). This document is the written record of what was deferred, with priorities.

This review is an internal working artifact. It is **not** part of the public surface — see "Strip internal artifacts" below before publishing.

---

## 1. Public-readiness scorecard

| Item | State after this round |
|---|---|
| Open-source license | ✅ `LICENSE` (MIT, XKDR Forum) |
| Citation metadata | ✅ `CITATION.cff` (real repo URL, v0.2.0-draft) |
| `.gitignore` | ✅ extended (generated outputs, R cruft); `results_*.json` removal staged |
| Onboarding guide | ✅ rebuilt `examples/doc/guide.html` (oriented, accessible, XKDR style) |
| Beginner on-ramp | ✅ `hello_budget` warm-up (Python + R), one canonical first path |
| Reconciliation integrity | ✅ `make reproduce` still 0.000000 cr across Python/R/DuckDB |
| Discoverability / hosting | ❌ deferred (see P2) |
| Citable download (no clone) | ❌ deferred (see P2) |
| Multi-state structure | ❌ deferred (see P3) |
| Internal artifacts on public surface | ⚠️ present (see P1) |

---

## 2. How to add a new state (multi-state contract)

When the second state lands, follow the shape Karnataka already sets:

- **Directory:** `<state>-state-finance/` at the repo root (e.g. `maharashtra-state-finance/`).
- **Required files** (mirror Karnataka):
  - `README.md` — package overview, summation rules, caveats, schema version.
  - `data_dictionary.csv` — column definitions + controlled values for every table.
  - `package_stats.json` — row counts, PDF counts, `release_version`, `schema_version`, `years_count`.
  - `demand_names.json` — demand-number → department-name lookup (keyed under a `demands` object).
  - `years/<year>/{csv,json,pdfs}/` — `budget_<year>.csv`, `checks_<year>.csv`, the four NDJSON files, and the source PDFs.
- **Carry a `schema_version`** (Karnataka is `ka-public-two-table-v3`). If a new state deviates from the two-table object-head/minor-head/sub-major-head shape, bump or fork the schema and document the deviation in that package's README.
- **Examples:** the `examples/` compendium is currently **Karnataka-specific** (the tidy table, `demand_names`, scope constants in `_spec/scope.json`). To make it multi-state, templatize: a per-state tidy build, a `STATE=` switch in the Makefile (e.g. `make STATE=ka hello`), and a `states.json` manifest (`state_code`, `state_slug`, schema version, source-doc profile, years, quality status). Do this when the second state actually arrives, not before — premature generalization on a sample size of one is risky.

---

## 3. Deferred from the CEO review (both models flagged; held by owner decision)

These are real and worth doing later. Listed because both the Claude and Codex CEO voices independently rated them high-impact for the target user (a young economics researcher), and the binding constraint they identified is **discovery + access**, not guide aesthetics.

- **Hosted access (P2).** A `file://` guide has no URL — it can't be found, shared, or cited. Publish via **GitHub Pages** (or XKDR's own web property) so the guide and a one-page data landing page live at a real URL. *Note:* XKDR already runs xkdr.org, so Pages may be the wrong channel — this is a publishing decision only the owner can make.
- **Citable download without a 884 MB clone (P2).** The repo is ~884 MB (77 PDFs + a 19 MB validation CSV + a 27 MB tidy CSV). A researcher should be able to grab the tidy CSV without cloning everything — publish it (and per-state CSVs) as a **GitHub Release asset** or a hosted download.
- **Researcher-native tracks (P3).** Stdlib-only Python and base-R are the right *zero-dependency* baseline, but economists work in **pandas / tidyverse / Stata** and in **Jupyter / Quarto** notebooks. Add at least one runnable notebook (renders on GitHub, doubles as guide + example) and a Stata `.do` pointer.
- **License/citation depth (P3).** MIT covers code and data this round (owner's call). For a research dataset, consider later: a data-vs-code split (e.g. data under CC-BY), a source-attribution + disclaimer note, and a versioned **DOI (Zenodo)** so papers can cite a frozen release.
- **Competitive positioning (note).** Open Budgets India, PRS, RBI "Study of Budgets", and CBGA set a "hosted + downloadable" expectation. This repo's real differentiator is **row-level PDF provenance + validation checks** — make that the headline of any hosted page.

---

## 4. Flagged, not changed (owner decisions)

- **Strip internal artifacts before publishing (P1).** `HANDOFF.md` (untracked) and `docs/superpowers/` (specs, plans, this review) are internal working artifacts. Gitignore or remove them before the repo goes public — they should not ship.
- **Repo heft (P2).** See "citable download" above; evaluate Git LFS or release-asset hosting for the PDFs and large CSVs.
- **`results_*.json` (low).** `examples/out/results_python.json` / `_r.json` / `_sql.json` were tracked; this round **stages their removal** (`git rm --cached`) and ignores them, treating them as regenerated artifacts (consistent with the `.gitkeep` placeholder and the README's "generated output" note). **Confirm** they were not intentionally committed as known-good baselines before committing the removal; if they were, `git reset` the deletion and drop the ignore line.
- **Onboarding redundancy (low).** After this round the warm-up is the single canonical beginner path, and the root README defers to it. The **package** README (`karnataka-state-finance/README.md`) still has its own "Start in 5 Minutes" snippet (outside this round's file list) — consider pointing it at the examples warm-up to avoid three competing "5-minute" entry points.

---

## 5. Verified during review (no action)

- **"About 37%" of rows are non-additive is correct.** Computed against `budget_2024-25.csv`: 6,000 of 16,389 rows = 36.6%. (Codex claimed ~46%; that was wrong.)
- **The guide's headline stats** (220,211 / 192,804 / 77 / 11 / v0.2.0-draft) all match `package_stats.json`; a source comment above the stats grid points future editors at the canonical source. A generator was judged overkill for a doc that changes once per data release.
- **The snapshot's central claim** (17 object-head leaves sum to 31,335.31 = the HOA Total) was verified against the CSV.

---

## Priorities

- **P0** — Open-source hygiene (license, no secrets): ✅ done this round.
- **P1** — Strip internal artifacts (`HANDOFF.md`, `docs/superpowers/`) before publishing.
- **P2** — Hosting + citable download + repo-heft strategy.
- **P3** — Multi-state templating; researcher-native tracks; license/citation depth.
