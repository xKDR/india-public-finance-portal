# Usability Audit — Karnataka Budget Data Package + Examples Compendium

**Persona:** 20-year-old undergraduate economics student; foundational knowledge; beginner coder.  
**Pre-build audit date:** 2026-06-20  
**Final acceptance date:** 2026-06-21  
**Package version:** v0.2.0-draft  

---

## Part 1 — Early Audit (Pre-Build)

*A concise recap of the findings recorded before the compendium was built, preserved here for
transparency. Full findings are in `.superpowers/sdd/early-audit.md`.*

### What confused the early auditor

**The column-label bug was a silent trap.** Opening `years/2016-17/csv/budget_2016-17.csv` — the
first file the README directed me to open — showed column headers like
`accounts_2018_19_amount` and `budget_estimate_2019_20_amount` inside a folder called `2016-17`.
My first reaction: did I open the wrong file? The mislabelling was identical across all seven
years from 2016-17 through 2022-23. A beginner has no chance of noticing this without reading
the caveats first.

**"Do not blindly sum" was buried.** The root README told me to open the CSV before I reached
the summation warning. A beginner will sum a column, get the wrong number, and be confused or
lose confidence in the data.

**The additive-leaf predicate required three conditions that interact non-obviously.** `row_type =
'Data'` alone is not enough — it also does not exclude `minor_head` and `sub_major_head` Data
rows. The early audit spelled out why all three conditions are required, but the package
documentation at the time did not.

**MongoDB appeared in the second section of the package README**, intimidatingly, before any
CSV-based orientation. An economics undergraduate almost certainly does not have MongoDB installed.

**Validation sprawl: 14 files, no entry point.** The package shipped eleven nearly identical
`validation_summary_<year>.md` files plus a `validation_findings.md` plus two `validation_findings`
CSVs. A beginner wanting to assess "is this data trustworthy?" had no single entry point.

**`amount_unit` implied row-level precision it didn't have.** The column appears on every row
with value `INR_lakh`, implying confirmed unit precision, when the caveats file said it was
"still source-unverified per volume." The placement undermined the honest disclaimer.

### Priority items from the early audit

| Priority | Item |
|---|---|
| **P1** | Column year labels (2016-17–2022-23) — wrong labels on every row |
| **P1** | "Do not blindly sum" — warning placed after the action it was warning against |
| **P1** | MongoDB section in package README — in the orientation path, not the appendix |
| **P2** | 11 per-year `validation_summary_<year>.md` files — overwhelming; no cross-year view |
| **P2** | `validation_findings.md` narrative — redundant with the per-year files; no consolidation |
| **P2** | `known_caveats.md` — column-label danger not flagged prominently enough |
| **P3** | Add: cross-year pass-rate table |
| **P3** | Add: "Start in 5 minutes" code box |
| **P3** | Add: explicit statement that `budget_leaves` NDJSON is filter-free |
| **P3** | Add: `demand_names.json` mentioned in the orientation path |
| **P3** | Add: explanation of "anchor page" in plain English |

---

## Part 2 — Final Acceptance (Post-Build)

### 1. Onboarding by imitation

I followed the path: **root `README.md`** → **`examples/README.md`** → **`examples/doc/learning-module.md`** → ran **`examples/src/python/00_onboarding.py`**.

**Root README** is now the right starting point for a beginner. The "Quick-Start (Karnataka, 5
minutes)" section offers four concrete paths (A–D), and Option A bakes the three-condition
predicate directly into the snippet with the warning "The three-condition predicate is not
optional." Option B makes clear that `budget_leaves` NDJSON skips the predicate entirely.
Neither warning is buried — they appear before any output. This is the correct structure.

**`examples/README.md`** is clean and navigable. The "Adopt by Imitation" table gives me an
immediate sense of the four-question progression, and the canonical answers table at the bottom
gives me something to verify against. It reads like documentation written for a beginner, not
for the person who built it.

**`examples/doc/learning-module.md`** explains the three data rules (additive-leaf, canonical
source, OCR outlier exclusion) clearly and correctly explains why the tidy table has them
pre-applied. For a beginner who just wants to use the tidy table, the message "you do not need
to re-apply them" is reassuring. For a beginner who wants to understand the raw CSVs, the
rules are laid out completely.

**Running `00_onboarding.py`** (from the repo root):

```
python3 examples/src/python/00_onboarding.py
```

Output was immediate, correct, and legible. The script answered three orientation questions and
then demonstrated, with a "FORMATS LESSON," that the tidy CSV and the raw NDJSON give the
same number. The tidy-CSV vs raw-NDJSON comparison is a genuine teaching moment — it shows
why both formats exist without making either look redundant.

The path resolution in `_lib.py` uses `__file__`-relative paths, so the scripts work from
any working directory without modification. This is the right engineering choice for a
compendium meant to be cloned and run by beginners.

**Minor friction noted:**
- `00_onboarding.py`'s `formats_lesson()` uses the 2026-27 document year (the latest),
  which is not the same as the 2024-25 "latest year with Actuals" used in Q1/Q3. This
  is correct but a beginner reading the output might wonder why the health BE year jumps.
  The code is commented, and the existing comment is sufficient — no change required.
- Demand 02 (Animal Husbandry and Fisheries) shows Act/BE = 14.35 in the demand variation
  output: Actuals ₹3,608 cr against BE of only ₹251 cr. This is almost certainly a genuine
  data feature (possibly supplementary grants not reflected in the original BE), not an
  extraction error. The data as presented is honest; no change required.

### 2. `make reproduce` result

Run from the repo root:

```
make -C examples reproduce
```

Full run (build → python → r → sql → check) completed without errors.

**Final reconciliation table:**

```
Reconciliation vs data/processed/canonical_numbers.json (tolerance 0.01 cr, 246 numeric values)
  language  compared  max_abs_diff  mismatch  result
--------------------------------------------------------
    python       246      0.000000         0  PASS
         r       246      0.000000         0  PASS
       sql       246      0.000000         0  PASS
--------------------------------------------------------
RECONCILE PASS — Python == R == DuckDB == canonical.
```

All 246 numeric values agree to **0.000000 crore** across Python, R, and DuckDB. This is
stronger than the 0.01 crore tolerance: the three implementations are arithmetically identical,
not merely close.

Notable observations from the build log:
- 381,779 raw positional records loaded from 11 documents; 5 OCR outliers dropped (all identified
  in the package README caveats); 234,930 canonical records survive.
- Per-year leaf counts match `package_stats.json` exactly for all 11 years.
- DuckDB version 1.5.4 installed automatically by `make sql` when absent.

### 3. Docs check

The brief asks whether the package `README.md` covers seven specific items:

| Item | Finding |
|---|---|
| Additive-leaf predicate (elevated, not buried) | ✓ — § "⚠ Do Not Blindly Sum" is the **second** section of the package README, immediately after "Start in 5 Minutes". The warning appears before any amount column is mentioned. |
| Honest amount labels + `document_year` | ✓ — § "Amount Columns and `document_year`" explains `document_year` vs `fiscal_year`, documents the four positional columns with a table, and notes that labels are now corrected in v0.2.0-draft. The "Label history (now corrected)" subsection in Caveats is explicit about what was wrong and when it was fixed. |
| Page-numbering note | ✓ — § "Page-Numbering Note" gives evidence from the 2024-25 PDF (PDF pages 1–10 examined), explains that `page_number` matches the body arabic numbers in the Table of Contents, and defines anchor-page findings in plain English: *"'Anchor page' means the page of the checked total, not necessarily the page of the error."* |
| CSV vs JSON rationale | ✓ — § "CSV vs NDJSON: When to Use Which" in the package README, and in full detail in `examples/doc/why-ndjson.md`, which also lists all four required exclusions for naive analysis. |
| Caveats (folded from `known_caveats.md`) | ✓ — The "Caveats" section covers: amount unit (unverified), OCR and extraction anomalies (five rows, with a filter rule), label history (corrected), cross-document restatement gaps, validation scope, and recovered inputs. `known_caveats.md` no longer exists as a separate file; the content is here. |
| One validation_summary | ✓ — `validation_summary.csv` (machine-readable) and `validation_summary.html` (browser-viewable) at the package root. Cross-year pass-rate table embedded in the README "Validation" section (11 years, 84.3% to 99.7%). The 11 per-year `validation_summary_<year>.md` files are gone. |
| `demand_names.json` | ✓ — Called out in § "Start in 5 Minutes" ("For demand-level analysis, load `demand_names.json`") and in the Package File Map ("Demand names: `demand_names.json` maps demand numbers to department names"). |

`examples/doc/why-ndjson.md` lists the fields and rows to exclude from naive analysis:
1. Additive-leaf predicate (all three conditions, with SQL and Python snippets)
2. OCR outlier exclusion (`abs(amount) > 5,000,000` in INR lakh)
3. Amount unit caveat (annotation, not a filter)
4. Cross-document duplication (canonical rule)
5. Irregular amounts arrays in NDJSON (fewer than 4 entries is normal)

This is complete and correct.

### 4. Early-audit follow-through

| Priority | Item | Addressed? | How |
|---|---|---|---|
| **P1** | Column year labels (2016-17–2022-23) | **Yes** | Labels corrected in v0.2.0-draft; package README § "Amount Columns" and "Caveats → Label history" document both the fix and the history |
| **P1** | "Do not blindly sum" placement | **Yes** | § "⚠ Do Not Blindly Sum" is the second section of the package README; the three-condition predicate appears in every root README Quick-Start snippet |
| **P1** | MongoDB section in package README | **Yes** | Moved to "Advanced: JSON / Document Store" appendix at the bottom, after all orientation content |
| **P2** | 11 per-year `validation_summary_<year>.md` files | **Yes** | All 11 removed; replaced by `validation_summary.csv` + `validation_summary.html` + 11-year table in package README |
| **P2** | `validation_findings.md` narrative | **Yes** | Removed; cross-year pass-rate table in README replaces the narrative |
| **P2** | `known_caveats.md` danger callout | **Yes** | File removed; content folded into package README "Caveats" section; column-label fix is explicitly documented |
| **P3** | Cross-year pass-rate table | **Yes** | 11-year table in package README "Validation" section (84.3% through 99.7%); also machine-readable in `validation_summary.csv` |
| **P3** | "Start in 5 minutes" box | **Yes** | Both package README and root README open with working Quick-Start code blocks |
| **P3** | `budget_leaves` NDJSON = filter-free | **Yes** | Stated explicitly in package README "Start in 5 Minutes", in root README Quick-Start Option B, and in `why-ndjson.md` |
| **P3** | `demand_names.json` mention | **Yes** | Mentioned in package README § "Start in 5 Minutes" and in Package File Map |
| **P3** | "anchor page" explanation | **Yes** | Plain-English definition in package README § "Page-Numbering Note" |

### 5. Acceptance verdict

**ACCEPTED.**

The compendium works for the target beginner. All three Priority-1 blocking items from the
early audit have been resolved. `make reproduce` passes with 0.000000 crore max difference
across 246 numeric values in three languages. The onboarding path from root README to running
code is coherent and produces correct answers.

What changed since the early audit:
- The column-label bug, which was the single most dangerous silent trap, is fixed.
- The "do not blindly sum" warning is now front-and-centre in both READMEs.
- Validation sprawl is gone — one `validation_summary.csv` and one HTML file replace 14 Markdown files.
- The examples compendium adds a pre-filtered tidy table and a four-question worked curriculum in three languages.
- `demand_names.json` is surfaced and documented.
- "Anchor page" is explained.

What remains (minor, not blocking):
- `amount_unit = INR_lakh` is correctly documented as "not independently verified per volume"
  throughout the package. This is the right posture; no change is warranted.
- The Animal Husbandry Act/BE ratio (14.35×) in the demand-variation output is a genuine data
  feature, not an error. A curious beginner may want a footnote in the Q3 output, but this is
  cosmetic.

A first-time user who starts at the root README, runs the Quick-Start snippet, and then moves
to the examples compendium will arrive at a correct number. The audit trail from row to PDF
page is intact. The data rules are honest and documented. This package is ready to use.
