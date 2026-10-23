# Handoff — Karnataka budget "examples" work

**Date:** 2026-06-20
**Repo:** `xKDR/india-public-finance-portal` (branch `main`)
**Status of my work:** done and pushed. Commit `6735c31` (`86a1cbe..6735c31 main -> main`).

This file is a working note, not part of the data package. Delete it once read, or move it
out of the repo. It is currently untracked.

---

## 1. TL;DR

I built a set of worked examples that show people how to use the Karnataka budget package,
answering three questions and packaging the method as two HTML guides. Everything lives in
`karnataka/v0.2.0-draft/examples/` and is committed + pushed. Nothing else in the repo was
touched by me.

**One thing to know before you commit anything:** there is a large **JSON → Mongo migration
staged in the git index that I did not create** (69 files: per-year `json/` deleted, `mongo/*.ndjson`
added, root + package `README.md` and `package_stats.json` modified). It is **uncommitted and
left exactly as found**. My commit was scoped with a pathspec so it contains only `examples/`.
Decide separately what to do with that migration.

---

## 2. What was delivered (commit `6735c31`)

All under `karnataka/v0.2.0-draft/examples/`:

| File | Purpose |
|---|---|
| `budget_examples.py` | Analysis engine. Builds a tidy long table and prints the three answers. Stdlib only. |
| `build_guide_assets.py` | Computes datasets, writes `results.json` + five SVG charts. Imports `budget_examples`. |
| `demand_names.json` | Demand number → department name (all 29), with provenance. |
| `results.json` | All computed series, ₹ crore. |
| `chart_q1_health.svg` … `chart_demands_ranked.svg` | Five standalone animated SVG charts. |
| `how-to-use.html` | Tutorial guide — the method, worked end to end (three exhibits). |
| `showcase.html` | Overview — "the power of the data" (scale, 11-year trend, ranked demands, drill-down). |
| `README.md` | Index for the folder. |

**Reproduce:**
```bash
cd karnataka/v0.2.0-draft
python3 examples/budget_examples.py      # prints the three analyses
python3 examples/build_guide_assets.py   # rebuilds results.json + charts
```
No dependencies. Open the two HTML files directly in a browser.

---

## 3. The three questions and headline findings

1. **Health (revenue heads 2210 + 2211), BE vs RE vs Actuals.** Health budget ~2.4× over the
   decade, but actuals have run **8–15% below the original budget** for four straight years
   (Act/BE 0.85 in 2024-25). The revised estimate trims the promise rather than chasing it.
2. **Committed expenditure** = salaries (direct pay object codes) + pensions (head 2071) +
   interest (head 2049); grants-in-aid excluded. It is **~25% of total expenditure on an
   actuals basis, and rose from 19% to 30% on a budget basis**. **Interest is the fastest-rising
   leg** (₹10,239 cr → ₹36,122 cr).
3. **Variation by demand head**, all 28 live demands named. Energy spent 1.36× its budget;
   Finance only 0.80×. **Animal Husbandry & Fisheries shows Act/BE ≈ 14× for 2024-25** — almost
   certainly a supplementary grant or reclassification; flagged in the showcase as an
   investigate-via-`validation_findings` item, NOT asserted. **Worth chasing down.**

---

## 4. Data facts the next person should not have to re-derive

These are baked into the example code and the package README, but in one place:

1. **Additive-leaf predicate (mandatory before summing):**
   `type_of_table='object_head' AND row_type='Data' AND row_level='Object-Head'`.
   Total/Header/summary rows repeat lower-level amounts.
2. **Amount columns are positional, labels lie.** The four columns are
   `Actuals(T-2), BE(T-1), RE(T-1), BE(T)` where T = the folder/document year. Files
   **2016-17 → 2022-23 all carry identical, wrong year labels**; 2023-24+ are labelled correctly.
   The code reads by position and re-dates from the folder year for all files uniformly.
3. **A year's three numbers span three documents:** `BE(Y)` from doc Y, `RE(Y)` from Y+1,
   `Actuals(Y)` from Y+2.
4. **OCR outliers:** a few rows hold impossible amounts (one ≈ ₹10¹⁹ cr). The code drops single
   leaves > ₹50,000 cr and logs them with page provenance. There are 5.
5. **Units:** `INR_lakh`, uncertified per volume. Shown as ₹ crore (÷100).
6. **Demand names:** the package ships **no demand-name column**. The 29 names in
   `demand_names.json` were transcribed from the 2024-25 volume covers
   (`years/2024-25/pdfs/KA_2024_25_EXPVOL1.pdf` … `EXPVOL7.pdf`) and cross-checked against each
   demand's dominant major heads. **Demand 16 (Housing)** is absent in 2024-25 (folded into
   Demand 19, Urban Development and Housing); 28 demands are live.

**Sanity check that passed:** total expenditure for 2024-25 reconstructs to **₹3.7 lakh crore**,
matching the published budget. Same-year BE read from two adjacent documents agrees to ~0.5%.
Pre-2018 figures come from recovered, mislabelled documents → treat as lower confidence.

---

## 5. Open items / next steps

- [ ] **Decide what to do with the staged JSON → Mongo migration** (69 files, uncommitted). If
      it lands, the example code reads the CSVs (`years/<year>/csv/`), not the JSON, so it should
      keep working — but re-run `build_guide_assets.py` and re-check `package_stats.json` numbers
      cited in `showcase.html` (220,211 rows etc.) if counts change.
- [ ] **Investigate Animal Husbandry & Fisheries Act/BE ≈ 14× (2024-25)** via
      `validation_findings.csv` + the source PDF.
- [ ] Optional: extend the same `examples/` pattern to other sectors (Education 2202, etc.) or to
      future state packages — the engine is sector-agnostic.
- [ ] Optional: the SVG charts animate on load and settle to the correct final state. If you need
      static thumbnails (PDF export, social cards), render after ~2s or strip the `<style>`
      animation block.

---

## 6. Tooling gotchas observed

- The gstack **browse** tooling re-appends `.gstack/` to `.gitignore` and drops daemon logs in the
  repo on each invocation. I reverted these each time; the working tree is clean of them now.
- A **transient `.git/index.lock`** appeared mid-session (concurrent git op, likely the migration).
  I waited rather than deleting it; it cleared on its own. If you see it and no `git` process is
  running (`ps aux | grep [g]it`), it is safe to remove.

---

## 7. Verification done

- All five SVGs validated as well-formed XML.
- Both HTML pages rendered in a headless browser with no console errors; masthead, stat band,
  area chart, ranked chart, drill ladder all confirmed visually.
- Fixed a real bug: department short names contain `&`, invalid as raw XML; added escaping.
- Commit verified to contain only the 12 `examples/` files (1,621 insertions); migration untouched.
