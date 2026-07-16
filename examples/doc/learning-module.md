# By-Imitation Learning Module: Karnataka Budget Analysis

This module explains the four worked examples in the compendium: what question each one answers,
what method it uses, and how the three language tracks (Python, R, DuckDB/SQL) line up. Read
this document, then open the corresponding source file and follow along.

---

## The Core Idea

The best way to learn a new dataset is to answer a concrete question using it, then look at how
someone else answered a slightly harder question, and so on. These four examples form a
progression: each one introduces one new concept while reusing everything from the previous one.

**The shared foundation:** every example reads `data/processed/karnataka_budget_tidy.csv`,
filters rows, groups them, and sums `amount_lakh` (dividing by 100 for crore). The tidy table
has the additive-leaf predicate and canonical source rule already applied — you do not need to
re-apply them.

---

## The Data Rules (Applied Upstream — Know Them Anyway)

Before any analysis, three rules must hold. The tidy table applies them so you do not have to,
but understanding them is essential for working with the raw CSVs directly.

### Rule 1: Additive-leaf predicate

Only rows satisfying all three conditions are additive:

```
type_of_table = 'object_head'
AND row_type  = 'Data'
AND row_level = 'Object-Head'
```

Approximately 37% of rows in a given year are non-additive (Header, Total, or summary-table
rows). Summing without this filter double-counts.

### Rule 2: Canonical source rule

Each fiscal year's amounts appear in multiple document years. The canonical rule picks one source:

| Measure | Source document | Column position |
|---|---|---|
| BE(Y) | document Y (as-tabled) | 4 |
| RE(Y) | document Y + 1 | 3 |
| Actuals(Y) | document Y + 2 | 1 |

The tidy table applies this so each (fiscal_year, measure, leaf) appears exactly once. In the
raw CSVs, you must implement this logic yourself when combining years.

### Rule 3: OCR outlier exclusion

Drop any leaf where `abs(amount_lakh) > 5,000,000` (> ₹50,000 crore). Five such rows exist
across all years; the tidy table already excludes them.

---

## The Four Questions

### Q0 — Onboarding: Which five departments spent the most in the latest year?

**Files:** `src/python/00_onboarding.py`, `src/r/00_onboarding.R`, `src/sql/00_onboarding.sql`

**Method:**
1. Filter tidy table to `fiscal_year = '2024-25'` and `measure = 'Actuals'`
2. Group by `demand`
3. Sum `amount_lakh` per demand
4. Sort descending; take the top 5
5. Join demand number to department name using `state-finances/karnataka/KA_demand_names.json`

**Concepts introduced:** reading the tidy table, filtering by year and measure, demand-level
grouping, the demand-name lookup.

**Expected answers (from `canonical_numbers.json`):**

| Rank | Demand | Department | Actuals 2024-25 (crore) |
|---|---|---|---|
| 1 | 29 | Debt Servicing | 63,016.55 |
| 2 | 03 | Finance | 35,172.55 |
| 3 | 11 | Women and Child Development | 34,138.84 |
| 4 | 17 | Education | 33,653.21 |
| 5 | 24 | Energy | 31,437.68 |

---

### Q1 — Health: How has Karnataka's health budget changed year by year?

**Files:** `src/python/01_health.py`, `src/r/01_health.R`, `src/sql/01_health.sql`

**Method:**
1. Filter tidy table to `major_head_code IN ('2210', '2211')` (revenue health only)
2. Group by `fiscal_year` and `measure`
3. Sum `amount_lakh` per group
4. Pivot to produce BE, RE, and Actuals columns per fiscal year
5. Compute RE/BE and Actuals/BE ratios

**Concepts introduced:** filtering by major head code; multi-year series; three-measure
comparison (BE vs RE vs Actuals shows whether the budget was expanded, trimmed, or under-spent).

**Scope constants:** health major heads = `2210` (Medical and Public Health) and `2211` (Family
Welfare). Capital head `4210` is excluded from this analysis.

---

### Q2 — Committed Expenditure: What share of spending is committed?

**Files:** `src/python/02_committed.py`, `src/r/02_committed.R`, `src/sql/02_committed.sql`

**Method:**
1. Filter tidy table to `measure = 'Actuals'`
2. Classify each row into: pension (`major_head_code = '2071'`), interest
   (`major_head_code = '2049'`), salary (`object_head_code IN (001-005, 008-009, 011, 014, 020,
   033, 035)`) — with pensions taking priority over interest, which takes priority over salaries
   (to avoid double-counting a row that matches multiple rules)
3. Sum total expenditure and each category per fiscal year
4. Compute the committed share (pensions + interest + salaries) / total

**Concepts introduced:** object-head classification codes as functional categories; priority
logic to avoid double-counting; the ratio between committed and discretionary expenditure.

**Scope constants:** pension major head = `2071`; interest major head = `2049`; salary object
codes = `001, 002, 003, 004, 005, 008, 009, 011, 014, 020, 033, 035` (direct pay only;
GIA-salary codes 101 and 118 are excluded).

---

### Q3 — Demand Variation: Which demands grew or shrank most?

**Files:** `src/python/03_demand_variation.py`, `src/r/03_demand_variation.R`,
`src/sql/03_demand_variation.sql`

**Method:**
1. Filter tidy table to a consistent measure (e.g. Actuals where available, BE otherwise)
2. Group by `demand` and `fiscal_year`; sum `amount_lakh`
3. Compute growth or rank change across years
4. Join to department names for labelling

**Concepts introduced:** multi-year demand-level analysis; dealing with incomplete actuals
series (Actuals for the most recent years are not yet available); ranking and sorting across
time.

---

## How the Three Language Tracks Line Up

All three tracks read the same tidy table and produce output with the same schema as
`data/processed/canonical_numbers.json`. The `make check` step (`src/check_reconcile.py`)
verifies that every value agrees within 0.01 crore (Rs 1 lakh).

| Language | Files | How to run | Output file |
|---|---|---|---|
| Python | `src/python/*.py` | `python3 src/python/_lib.py` (runs all four) | `out/results_python.json` |
| R | `src/r/*.R` | `Rscript src/r/00_onboarding.R` … (each separately), or `make r` | `out/results_r.json` |
| DuckDB/SQL | `src/sql/*.sql` | `python3 src/sql/run_sql.py`, or `make sql` | `out/results_sql.json` |

The three outputs are compared against `data/processed/canonical_numbers.json` by
`make check`. If all checks pass, the run ends with `0.000000 cr max diff` for all languages.

---

## How to Extend

To add a new analysis question:

1. **Copy the pattern:** take the closest existing example for your language and copy it.
2. **Filter and group:** start from `karnataka_budget_tidy.csv`, filter the rows you need, group
   and sum `amount_lakh`.
3. **Add your result to `out/results_<lang>.json`** following the schema conventions in
   `data/processed/canonical_numbers.json`.
4. **Add a canonical entry** to `canonical_numbers.json` (or to a separate fixture) so you can
   write a reconciliation assertion.
5. **Read `_spec/README.md`** if you want to add a new language track or register new scope
   constants in `_spec/scope.json`.

The key discipline: **do not re-apply the additive-leaf predicate** or the canonical rule to
the tidy table — they were applied once at build time. Your analysis code should only filter,
group, and sum. If you need to work from the raw package CSVs, see `doc/why-ndjson.md` for the
complete list of required exclusions.
