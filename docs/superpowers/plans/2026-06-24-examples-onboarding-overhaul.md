<!-- /autoplan restore point: /Users/siddarth/.gstack/projects/xKDR-india-public-finance-portal/main-autoplan-restore-20260624-212727.md -->
# Examples Onboarding Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the India Public Finance Portal genuinely easy for a first-time economics scholar to pick up in Python or R, and safe to open as a public repo.

**Architecture:** Pure documentation + static-asset + small-script work on top of an existing, working data package and reconciliation pipeline. No change to extraction, data, or reconciled numbers. Five deliverables: a rebuilt `guide.html`, an extensible examples index, one beginner example, public-readiness files, and a written public-readiness review.

**Tech Stack:** Static HTML/CSS (inline, no frameworks), Python 3 stdlib, base R, poppler (`pdftoppm`/`pdftotext`) for the snapshot image, GNU Make.

## Global Constraints

- **Style:** XKDR house style from xkdr.org — background `#F2F1F0`, body text `#212529`, accent coral `#F57D6A`, headings in Montserrat (700), system sans body, black footer/buttons, card grids, thin rule separators.
- **License:** MIT, `Copyright (c) 2026 XKDR Forum`.
- **No `CONTRIBUTING.md`.** Multi-state guidance ships as the written review only.
- **Numbers are sacred:** every figure must match `karnataka-state-finance/package_stats.json` (11 years · 220,211 budget rows · 192,804 check rows · 77 PDFs · `v0.2.0-draft`) or `examples/data/processed/canonical_numbers.json`. Do not invent stats.
- **No renumbering** of `00_onboarding` … `03_demand_variation`. No change to any reconciled value.
- **Python = stdlib only. R = base R only.** SQL track is untouched and stays secondary.
- **`guide.html` is self-contained:** inline CSS, Montserrat via one `<link>` with a system-sans fallback, opens from `file://`, responsive, no JS frameworks.
- **Commits are gated on the repo owner.** Stage logically per task; do not `git commit`/`push` unless the user asks. The "Commit" steps below are grouping markers — execute the `git add` but hold the commit for owner approval (or commit only when explicitly told).

---

### Task 1: Render the budget-document snapshot asset

**Files:**
- Create: `examples/doc/img/budget-page-2024-25-expvol1-p2.png`

**Interfaces:**
- Produces: a PNG of the detailed object-head page (demand 03, major head 2039 State Excise, "Commissioner for Excise and Other Establishments"), embedded by Task 3. This is physical page 13 of `KA_2024_25_EXPVOL1.pdf`; its printed body page number is 2.

- [ ] **Step 1: Create the image directory**

```bash
mkdir -p examples/doc/img
```

- [ ] **Step 2: Verify page 13 is the right page (leaf rows + an HOA Total)**

Run:
```bash
pdftotext -layout -f 13 -l 13 \
  karnataka-state-finance/years/2024-25/pdfs/KA_2024_25_EXPVOL1.pdf - \
  | grep -E "Commissioner for Excise|Pay-Officers|HOA Total"
```
Expected: lines for `Commissioner for Excise and Other Establishments`, `Pay-Officers`, and `HOA Total : ... 31335.31`.

- [ ] **Step 3: Render page 13 to PNG at 150 dpi**

```bash
pdftoppm -png -f 13 -l 13 -r 150 \
  karnataka-state-finance/years/2024-25/pdfs/KA_2024_25_EXPVOL1.pdf \
  examples/doc/img/_snap
mv examples/doc/img/_snap-13.png examples/doc/img/budget-page-2024-25-expvol1-p2.png
```

- [ ] **Step 4: Verify the asset exists and is a reasonable size**

Run: `ls -la examples/doc/img/budget-page-2024-25-expvol1-p2.png`
Expected: a PNG, ~300–500 KB, present at that path.

- [ ] **Step 5: Stage (hold commit for owner)**

```bash
git add examples/doc/img/budget-page-2024-25-expvol1-p2.png
# commit deferred per Global Constraints
```

---

### Task 2: Beginner example — `hello_budget` (Python + R) and `make hello`

**Files:**
- Create: `examples/src/python/hello_budget.py`
- Create: `examples/src/r/hello_budget.R`
- Modify: `examples/Makefile` (add a `hello` target; add it to `.PHONY`)

**Interfaces:**
- Consumes: `examples/data/processed/karnataka_budget_tidy.csv` (columns `document_year, fiscal_year, measure, demand, major_head_code, major_head_name, object_head_code, object_head_description, amount_lakh, amount_unit`).
- Produces: a runnable warm-up that prints Health (major heads 2210 + 2211) Actuals 2024-25 = **₹12,771.07 crore** and self-checks against that exact value (which equals `canonical_numbers.json` → `q1_health` → 2024-25 `actuals`).

- [ ] **Step 1: Write `examples/src/python/hello_budget.py`**

```python
#!/usr/bin/env python3
"""Warm-up: your first Karnataka budget query.

Question: What did Karnataka actually spend on Health in 2024-25?

This is the gentlest possible example: load the tidy table, keep the rows we
want, add up one column, convert the unit, print one number. It checks its own
answer against the figure used by the reconciliation suite, so you know your
environment is reading the data correctly. When you are ready for more, open
00_onboarding.py.
"""
import csv
import os

# Health = Medical and Public Health (2210) + Family Welfare (2211).
HEALTH_MAJOR_HEADS = {"2210", "2211"}
FISCAL_YEAR = "2024-25"
MEASURE = "Actuals"                 # what was actually spent (not budgeted)
EXPECTED_CRORE = 12771.07           # canonical_numbers.json -> q1_health -> 2024-25 actuals

HERE = os.path.dirname(os.path.abspath(__file__))
TIDY = os.path.join(HERE, "..", "..", "data", "processed", "karnataka_budget_tidy.csv")

def main():
    total_lakh = 0.0
    with open(TIDY, newline="") as f:
        for row in csv.DictReader(f):
            if (row["fiscal_year"] == FISCAL_YEAR
                    and row["measure"] == MEASURE
                    and row["major_head_code"] in HEALTH_MAJOR_HEADS):
                total_lakh += float(row["amount_lakh"])
    total_crore = total_lakh / 100  # amounts are in INR lakh; 100 lakh = 1 crore

    print(f"Karnataka Health spending, {FISCAL_YEAR} {MEASURE}: "
          f"Rs {total_crore:,.2f} crore")

    assert abs(total_crore - EXPECTED_CRORE) < 0.01, (
        f"self-check FAILED: got {total_crore:.2f}, expected {EXPECTED_CRORE:.2f}")
    print("self-check PASSED (matches the reconciliation fixture)")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it to verify it prints the figure and self-checks**

Run: `python3 examples/src/python/hello_budget.py`
Expected:
```
Karnataka Health spending, 2024-25 Actuals: Rs 12,771.07 crore
self-check PASSED (matches the reconciliation fixture)
```

- [ ] **Step 3: Write `examples/src/r/hello_budget.R` (base R)**

```r
#!/usr/bin/env Rscript
# Warm-up: your first Karnataka budget query.
#
# Question: What did Karnataka actually spend on Health in 2024-25?
# Load the tidy table, keep the rows we want, add up one column, convert the
# unit, print one number, and check the answer. When ready, open 00_onboarding.R.

health_major_heads <- c("2210", "2211")  # Medical & Public Health + Family Welfare
fiscal_year <- "2024-25"
measure <- "Actuals"
expected_crore <- 12771.07               # canonical q1_health 2024-25 actuals

here <- dirname(normalizePath(sub("--file=", "",
  grep("--file=", commandArgs(FALSE), value = TRUE)[1])))
tidy <- file.path(here, "..", "..", "data", "processed", "karnataka_budget_tidy.csv")

d <- read.csv(tidy, colClasses = "character")
keep <- d$fiscal_year == fiscal_year &
        d$measure == measure &
        d$major_head_code %in% health_major_heads
total_crore <- sum(as.numeric(d$amount_lakh[keep])) / 100

cat(sprintf("Karnataka Health spending, %s %s: Rs %s crore\n",
            fiscal_year, measure, formatC(total_crore, format = "f",
            big.mark = ",", digits = 2)))

stopifnot(abs(total_crore - expected_crore) < 0.01)
cat("self-check PASSED (matches the reconciliation fixture)\n")
```

- [ ] **Step 4: Run it to verify parity with Python**

Run: `Rscript examples/src/r/hello_budget.R`
Expected: same number (`Rs 12,771.07 crore`) and `self-check PASSED`.

- [ ] **Step 5: Add a `hello` target to `examples/Makefile`**

Add to `.PHONY` and add this target (matching the file's existing tab-indented recipe style):

```make
hello: ## Run the beginner warm-up (Python + R)
	python3 src/python/hello_budget.py
	Rscript src/r/hello_budget.R
```

- [ ] **Step 6: Verify the make target**

Run: `make -C examples hello`
Expected: both scripts run and print `self-check PASSED`.

- [ ] **Step 7: Stage (hold commit for owner)**

```bash
git add examples/src/python/hello_budget.py examples/src/r/hello_budget.R examples/Makefile
```

---

### Task 3: Rebuild `examples/doc/guide.html` (XKDR style + reordered sections)

**Files:**
- Modify: `examples/doc/guide.html` (full rewrite, preserving the keep-sections' content, restyled and reordered)

**Interfaces:**
- Consumes: snapshot PNG from Task 1; column definitions from `karnataka-state-finance/data_dictionary.csv`; stats from `package_stats.json`.

- [ ] **Step 1: Replace the `:root` tokens and base styles with XKDR style**

Use these tokens (replacing the current teal `--accent`):

```css
:root{
  --ink:#212529; --muted:#5e6975; --line:#e0ddd9;
  --paper:#f2f1f0; --white:#ffffff;
  --accent:#f57d6a;            /* XKDR coral */
  --accent-soft:#fdeae6; --warn:#9b4f14; --ink-strong:#18202a;
}
body{font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
     color:var(--ink); background:var(--paper); margin:0;}
h1,h2,h3{font-family:"Montserrat",system-ui,sans-serif; font-weight:700;}
h2{color:var(--accent);}
.eyebrow{color:var(--accent); font-weight:700; letter-spacing:.08em; text-transform:uppercase; font-size:12px;}
footer{background:#111820; color:#f2f1f0; padding:28px;}
```

Add to `<head>`: `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&display=swap" rel="stylesheet">` (system-sans fallback already in the stack if the network is offline).

- [ ] **Step 2: Header — accurate stats**

Header copy: eyebrow `India public finance · Karnataka`, h1 `Karnataka budget data guide`, lead paragraph (unchanged intent). Stats grid (exact values): `v0.2.0-draft` Package version · `11` Fiscal years · `220,211` Budget rows · `192,804` Validation rows · `77` Source PDFs.

- [ ] **Step 3: Section 1 — "Introduction to the documents" (new)**

Concrete copy to include:
> Every year the Government of Karnataka publishes its Detailed Estimates of Expenditure as a set of seven volumes (EXPVOL1–EXPVOL7), the per-department backing detail behind the Demand for Grants. Each volume is a long PDF of accounting tables: for every department (a "demand"), money is broken down through a fixed hierarchy of account heads, with four money columns — prior-year Accounts, current Budget Estimate, current Revised Estimate, and next-year Budget Estimate. These PDFs are made for printing, not analysis. This package extracts them to CSV and JSON while keeping the document's shape, so you can trace any number back to the page it came from.

- [ ] **Step 4: Section 2 — "A snapshot of the budget document" (new)**

Two-column `.grid`: left = `<img src="img/budget-page-2024-25-expvol1-p2.png" alt="Karnataka 2024-25 expenditure volume, State Excise detailed page" style="width:100%;border:1px solid var(--line);border-radius:8px;">` with caption `KA_2024_25_EXPVOL1.pdf, page 2 — Demand 03 (Finance), Major Head 2039 (State Excise).`; right = the extracted rows table below, plus a one-line bridge: "Every printed line becomes a row; the extractor records what *kind* of line it is."

Extracted-rows table (exact values from the page; `budget_estimate_2024_25_amount` column shown):

| row_type | row_level | row_header | object_head_code | BE 2024-25 (lakh) |
|---|---|---|---|---|
| Header | Detailed-Head | Commissioner for Excise and Other Establishments | | |
| Data | Object-Head | Pay-Officers | 002 | 1,733.00 |
| Data | Object-Head | Pay-Staff | 003 | 13,001.00 |
| Data | Object-Head | Dearness Allowance | 011 | 7,312.00 |
| … | … | (14 more Object-Head leaf rows) | … | … |
| Total | Detailed-Head | HOA Total | | 31,335.31 |

Caption under the table: "The 17 Object-Head leaf rows add up to 31,335.31. The HOA Total row repeats that same 31,335.31. Add up everything and you count it twice."

- [ ] **Step 5: Section 3 — "The data dictionary" (new)**

Render the `budget` table columns from `data_dictionary.csv` as a styled table, grouped with sub-headings:
- **Identity & provenance:** `document_year, state_code, volume_number, page_number, row_number, source_file`
- **Row role & hierarchy:** `type_of_table, row_type, row_level, row_header, demand_number, major_head_code, major_head_name, sub_major_head_code…object_head_code, object_head_description, full_account_code, vote_charge_marker`
- **Amounts & measures:** `accounts_<year>_amount, budget_estimate_<year>_amount, revised_estimate_<year>_amount, amount_unit`
- **Validation:** `has_check, reference_check_id, pass, pass_pct, diff, diff_pct`

Each row: column name (in `<code>`), one-line description copied/condensed from `data_dictionary.csv`, controlled values where present. Add a line: "Full machine-readable definitions, including the `checks` and `validation_summary` tables, live in `karnataka-state-finance/data_dictionary.csv`."

- [ ] **Step 6: Section 4 — "The accounting ladder" (keep, restyle)**

Keep the six `.step` cards (Major Head → Object Head) verbatim; they inherit the new style. `.step strong` uses `--accent`.

- [ ] **Step 7: Section 5 — "Don't double-count" (reframed from "Safe totals")**

Lead with the snapshot example, then the rule, then the predicate:
> You just saw it: the leaf rows under "Commissioner for Excise" sum to 31,335.31, and the HOA Total row says 31,335.31 again. **Do not sum the whole table. Totals and summary rows repeat amounts already present in leaf rows.** To total safely, keep only the additive leaf rows:
```sql
WHERE type_of_table = 'object_head'
  AND row_type = 'Data'
  AND row_level = 'Object-Head'
```
> About 37% of rows are headers, totals, or summary rows — all excluded by this predicate. The `examples/` tidy table has this filter already applied, so it is safe to SUM directly.

- [ ] **Step 8: Section 6 — "Voted and charged" (keep, restyle)**

Keep current copy and the warning note about validation being an internal-consistency signal.

- [ ] **Step 9: Section 7 — "The three measures (BE / RE / Actuals)" (new, brief)**

> Each year carries three measures: **BE** (Budget Estimate, the plan), **RE** (Revised Estimate, mid-year correction), and **Actuals** (what was spent). The same fiscal year is reported across several documents; the package's canonical rule takes each measure from one document — BE from the document's own year, RE from the next year's document, Actuals from the year-after's document — so a value is never counted from two sources. The `examples/` tidy table applies this rule.

- [ ] **Step 10: Section 8 — "Validation drilldown" (keep, restyle)**

Keep the example key, the parts table, and the tolerance explanation verbatim.

- [ ] **Step 11: Section 9 — "Files to use" (keep) + footer with links**

Keep the files table. Add a closing footer linking the examples index (`../README.md`) and getting-started, styled black.

- [ ] **Step 12: Verify render in a browser**

Run (browse tool): `goto file://<abs>/examples/doc/guide.html`, then `screenshot`, then Read the PNG.
Expected: coral accents, Montserrat headings, section order Intro → Snapshot → Dictionary → Ladder → Don't double-count → Voted/charged → Measures → Validation → Files; snapshot image visible; stats read 220,211 / 192,804 / 77 / 11.

- [ ] **Step 13: Stage (hold commit for owner)**

```bash
git add examples/doc/guide.html
```

---

### Task 4: Examples index + getting-started in `examples/README.md`

**Files:**
- Modify: `examples/README.md`

- [ ] **Step 1: Add a "Getting started in 5 minutes (Python & R)" block after the intro**

```markdown
## Getting started in 5 minutes (Python & R)

No Docker, no installs beyond Python 3 or R. Run the warm-up:

    python3 examples/src/python/hello_budget.py     # or: Rscript examples/src/r/hello_budget.R

It prints one number — Karnataka's actual Health spend in 2024-25 — and checks
its own answer. Then open `00_onboarding` in your language and read down to `03`.

Want to verify all three language tracks reconcile? That's what Docker /
`make reproduce` are for (below).
```

- [ ] **Step 2: Replace "Adopt by Imitation" with an append-only Examples Index**

```markdown
## Examples index

| Level | Question | Concepts | Python | R | SQL | Reconciled |
|---|---|---|---|---|---|---|
| Warm-up | Health Actuals, 2024-25 | load, filter, sum, unit convert | `src/python/hello_budget.py` | `src/r/hello_budget.R` | — | self-check |
| Q0 | Top 5 departments by latest Actuals | additive-leaf predicate, demand lookup | `src/python/00_onboarding.py` | `src/r/00_onboarding.R` | `src/sql/00_onboarding.sql` | ✓ |
| Q1 | Health BE vs RE vs Actuals by year | major-head filter, cross-year series | `src/python/01_health.py` | `src/r/01_health.R` | `src/sql/01_health.sql` | ✓ |
| Q2 | Committed-expenditure share | object-head classification, ratios | `src/python/02_committed.py` | `src/r/02_committed.R` | `src/sql/02_committed.sql` | ✓ |
| Q3 | Demand variation over time | multi-year aggregation, ranking | `src/python/03_demand_variation.py` | `src/r/03_demand_variation.R` | `src/sql/03_demand_variation.sql` | ✓ |

*Adding an example:* copy the next number (`04_...`), implement it in Python, R, and
SQL reading only the tidy table, add a canonical entry to
`data/processed/canonical_numbers.json`, and add a row above. The author contract
is in `_spec/README.md`.
```

- [ ] **Step 3: Verify every referenced file exists**

Run:
```bash
for f in src/python/hello_budget.py src/r/hello_budget.R \
  src/python/00_onboarding.py src/r/00_onboarding.R src/sql/00_onboarding.sql \
  src/python/01_health.py src/python/02_committed.py src/python/03_demand_variation.py; do
  test -f "examples/$f" && echo "ok $f" || echo "MISSING $f"; done
```
Expected: every line `ok`.

- [ ] **Step 4: Stage (hold commit for owner)**

```bash
git add examples/README.md
```

---

### Task 5: Public-readiness files — LICENSE, CITATION.cff, .gitignore, root README

**Files:**
- Create: `LICENSE`
- Create: `CITATION.cff`
- Create or modify: `.gitignore`
- Modify: `README.md` (link the guide; add a one-line license note)

- [ ] **Step 1: Create `LICENSE` (MIT)**

Standard MIT text, first lines:
```
MIT License

Copyright (c) 2026 XKDR Forum
```
(remainder: the verbatim MIT permission and warranty paragraphs.)

- [ ] **Step 2: Create `CITATION.cff`**

```yaml
cff-version: 1.2.0
title: India Public Finance Portal — Karnataka State Finance
message: "If you use this data, please cite it."
type: dataset
authors:
  - name: XKDR Forum
repository-code: "https://github.com/<org>/india-public-finance-portal"
version: v0.2.0-draft
license: MIT
date-released: 2026-06-24
```
(Leave the `<org>` placeholder note for the owner to fill the real URL.)

- [ ] **Step 3: Create/extend `.gitignore`**

```
.DS_Store
examples/out/results_*.json
examples/doc/img/_snap-*.png
__pycache__/
*.pyc
.Rhistory
```

- [ ] **Step 4: Edit root `README.md`**

Add to the examples row / layout: a link to `examples/doc/guide.html` ("Start here: visual guide to the documents and data"). Add a `## License` section: "Code and data in this repository are released under the MIT License (see `LICENSE`)."

- [ ] **Step 5: Verify**

Run: `head -3 LICENSE && test -f CITATION.cff && grep -q "MIT" README.md && echo ok`
Expected: MIT header, file present, `ok`.

- [ ] **Step 6: Stage (hold commit for owner)**

```bash
git add LICENSE CITATION.cff .gitignore README.md
```

---

### Task 6: Public-readiness review write-up + reconciliation regression check

**Files:**
- Create: `docs/superpowers/reviews/2026-06-24-public-readiness-review.md` (internal working artifact, not part of the public surface)

- [ ] **Step 1: Confirm no reconciliation regression from the new files**

Run: `make -C examples reproduce`
Expected: all three tracks run and the check reports reconciliation to 0.000000 crore (the new `hello_budget` files and docs must not change this).

- [ ] **Step 2: Write the review with these sections**

1. **Public-readiness scorecard** — what's now in place (LICENSE, CITATION, .gitignore, guide), what's still open.
2. **How to add a new state (multi-state contract):** directory `<state>-state-finance/`; required files `README.md`, `data_dictionary.csv`, `package_stats.json`, `demand_names.json`, `years/<year>/{csv,json,pdfs}`; carry a `schema_version`; the `examples/` compendium is currently Karnataka-specific (tidy table, demand names) and would be templated per state when the second state lands.
3. **Flagged, not changed (owner decisions):** `HANDOFF.md` and `docs/superpowers/` are internal artifacts on the public surface — gitignore or remove before publishing; repo heft (77 PDFs + 19 MB `validation_summary.csv` + 4.2 MB HTML) — evaluate Git LFS or GitHub release assets.
4. **Priorities:** P0 license/secrets sanity; P1 strip internal artifacts; P2 repo-heft strategy; P3 multi-state templating.

- [ ] **Step 3: Surface the P0–P3 recommendations to the user in the final summary.**

---

## Self-Review

**Spec coverage:**
- Guide restyle + reorder → Task 3 ✓
- XKDR style → Global Constraints + Task 3 Step 1 ✓
- Intro / snapshot / data dictionary as the lead sections → Task 3 Steps 3–5 ✓
- "Don't sum the whole table" reframed and repositioned → Task 3 Step 7 ✓
- Snapshot = real PDF page + extracted rows → Task 1 + Task 3 Step 4 ✓
- Examples index, append-friendly → Task 4 ✓
- Getting-started for Python & R → Task 4 Step 1 ✓
- One beginner example → Task 2 ✓
- MIT license, CITATION, .gitignore, README → Task 5 ✓
- Public-readiness review + multi-state recommendations, no CONTRIBUTING → Task 6 ✓
- No reconciliation regression → Task 6 Step 1 ✓

**Placeholder scan:** The only intentional placeholders are `<org>` in CITATION (owner fills the real repo URL) and "(14 more Object-Head leaf rows)" in the snapshot table (an explicit elision, not a missing value — the full list is on the rendered image). No "TBD/TODO" left.

**Type/name consistency:** `hello_budget.py` / `hello_budget.R` referenced identically in Task 2, Task 4 index, Task 4 verification, and `make hello`. Snapshot path `examples/doc/img/budget-page-2024-25-expvol1-p2.png` identical in Task 1 and Task 3 Step 4. Expected value `12771.07` consistent with the computed and canonical figure.

---

## GSTACK REVIEW REPORT (/autoplan, 2026-06-24)

**Pipeline:** CEO → Design → Eng → DX, dual voices each (Claude subagent + Codex). UI + DX scope detected.

**Premise gate:** Both CEO voices flagged the plan as "competent execution at the wrong altitude" — the binding constraint for a researcher is discovery/access/citation (hosting, citable download, 884 MB clone), not guide polish. **Owner decision: HOLD approved scope.** Altitude items deferred to the public-readiness review.

**Consensus:** Design — coral-as-text WCAG fail (2.32:1) + no nav + dictionary-as-wall. Eng — code verified correct (ran it); `.gitignore` premise wrong + tracked `results_*.json`; hardcoded check value. DX — TTHW 10–20 min → ~2 min; 4th onboarding surface needs consolidation. Codex corroborated all; its one numeric claim ("~46%") was wrong — verified 37% correct.

**Taste decision (resolved by owner):** data-dictionary placement → **synthesis** (essential columns early + full reference at the end).

### Decision audit trail (18 auto-decided fixes, all applied)
| # | Phase | Decision | Principle |
|---|---|---|---|
| 1 | Design | Coral → accent only; dark-ink Montserrat headings + coral rules; AA eyebrow `#b5462f` | P5 explicit |
| 2 | Design | No-JS anchor TOC + section ids + back-to-top | P1 completeness |
| 3 | Design | Snapshot: tint additive rows + ✓/✗ legend; verify 17 leaves = 31,335.31 vs CSV; substantive alt + full-res link; expand "HOA" | P1 |
| 4 | Design | Dictionary: grouped collapsible sub-tables, drop duplicated ladder, controlled-value chips, scroll wrapper | P5 |
| 5 | Design | Preserve "document-shaped by design" callout; demand-03-Finance clause; scope=col; @media print; h1 700 / h2 600; plain measures heading | P5 |
| 6 | DX | Warm-up = single canonical path; "recommended path" sequence; surface no-Docker above Docker | P3 pragmatic |
| 7 | DX | README↔guide cross-links + literal open command + GitHub-raw warning | P1 |
| 8 | DX | Friendly missing-CSV guards in both scripts | P1 |
| 9 | DX | Preserve "adopt by imitation" + learning-module link; unified "Checked" legend; additive-leaf bridge note; Python/R assumption | P5 |
| 10 | Eng | Python derives check value from `canonical_numbers.json`; R literal + provenance comment | P5 |
| 11 | Eng | R warm-up uses guarded `.get_script_dir()` resolver | P5 |
| 12 | Eng | `make hello` uses `$(PY)/$(RSCRIPT)`, skips R gracefully | P3 |
| 13 | Eng | "not part of reconciliation suite" header in both scripts | P5 |
| 14 | Eng | `.gitignore` append-only (no clobber); stage `git rm --cached results_*.json` | P5 |
| 15 | Eng | Guide stats: source comment (no generator); keep verified "37%" | P3 |
| 16 | Codex | Complete index verification loop (all Py/R/SQL paths) | P1 |
| 17 | Codex | Update "four"→"warm-up + four"; `make hello` primary in getting-started | P5 |
| 18 | All | Reconciliation regression gate: `make reproduce` → 0.000000 ✓ | P1 |

### Deferred to `docs/superpowers/reviews/2026-06-24-public-readiness-review.md`
Hosting/Pages + citable CSV download (P2), repo heft/LFS (P2), strip internal artifacts (P1), multi-state structure + researcher-native notebook/Stata tracks (P3), license/citation depth (P3), `results_*.json` fixture-vs-artifact confirmation, package-README redundancy.

**Status: APPROVED and IMPLEMENTED.** Reconciliation PASS (0.000000 cr). Nothing committed — staged for owner review.
