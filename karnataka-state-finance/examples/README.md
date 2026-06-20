# Examples — using the Karnataka budget data

Worked, reproducible examples that double as a tutorial for the package. Everything here is
generated from the CSVs in `../years/<year>/csv/` with the Python standard library only — no
dependencies to install.

## Start here

| If you want to… | Open |
|---|---|
| See what the data makes possible (overview) | [`showcase.html`](showcase.html) |
| Learn the method, worked end to end | [`how-to-use.html`](how-to-use.html) |
| Read/modify the analysis | [`budget_examples.py`](budget_examples.py) |

Open the HTML files in any browser (no server needed).

## The three questions answered

1. **Health — plan vs reality.** All revenue health rows (major heads `2210` + `2211`) per year,
   showing Budget Estimate → Revised Estimate → Actuals and the execution gap.
2. **Committed expenditure.** Salaries (direct pay object codes), pensions (head `2071`) and
   interest (head `2049`), and their share of total expenditure. Grants-in-aid excluded.
3. **Variation by demand head.** All 28 live demands, named, with BE / RE / Actuals and Act/BE.

## Files

| File | What it is |
|---|---|
| `budget_examples.py` | The analysis engine. Builds the tidy long table and prints the three answers. Run: `python3 examples/budget_examples.py` |
| `build_guide_assets.py` | Computes the datasets and writes `results.json` + the five SVG charts. Run: `python3 examples/build_guide_assets.py` |
| `demand_names.json` | Demand number → department name, transcribed from the 2024-25 volume covers (`KA_2024_25_EXPVOL1–7.pdf`) and cross-checked against the data. |
| `results.json` | All computed datasets (₹ crore): health, committed, total expenditure, per-demand. |
| `chart_*.svg` | Five standalone animated charts (zero-dependency). |
| `how-to-use.html` | The tutorial guide (embeds the three question charts). |
| `showcase.html` | The overview ("the power of the data"). |

Regenerate everything:

```bash
cd ..                                   # package root (karnataka/v0.2.0-draft)
python3 examples/budget_examples.py     # prints the three analyses
python3 examples/build_guide_assets.py  # rebuilds results.json + charts
```

## The rules these examples follow

These come from the package [`README.md`](../README.md) and [`known_caveats.md`](../known_caveats.md).
Get them wrong and the numbers are wrong.

1. **Sum only additive leaves.** Filter `type_of_table='object_head'`, `row_type='Data'`,
   `row_level='Object-Head'`. Total/Header/summary rows repeat lower-level amounts.
2. **Read amount columns positionally.** The four columns are `Actuals(T-2), BE(T-1), RE(T-1), BE(T)`
   where T is the document year. Files **2016-17 → 2022-23 carry identical, wrong year labels** — the
   code ignores the labels and re-dates from the folder year. Files 2023-24+ are labelled correctly.
3. **A year's three numbers come from three documents.** `BE(Y)` from document Y, `RE(Y)` from Y+1,
   `Actuals(Y)` from Y+2.
4. **Drop OCR outliers.** A few rows hold impossible amounts (one is ~₹10¹⁹ cr). The code excludes
   single leaves above ₹50,000 cr and logs them with page-level provenance.
5. **Units are `INR_lakh`, uncertified.** Shown here as ₹ crore (÷100). Treat unit-sensitive results as draft.

## What was checked

- Total expenditure for 2024-25 reconstructs to **₹3.7 lakh crore**, matching the published budget.
- The same year's BE read from two adjacent documents agrees to within ~0.5%.
- Pre-2018 figures derive from recovered, mislabelled documents — lower confidence; 2021-22 onward is
  from correctly-labelled volumes.

Draft data — cite the package version (`v0.2.0-draft`) with any derived analysis.
