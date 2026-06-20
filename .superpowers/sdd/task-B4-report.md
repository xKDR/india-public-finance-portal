# Task B4 Report — DuckDB/SQL examples

## STATUS: COMPLETE ✅

## DuckDB version
`1.5.4` (installed via `pip install duckdb` — pure-Python wheel; DuckDB CLI is absent
in this environment; the same `.sql` files will be executed via the Dockerfile in task B6).

## Files written
| File | Description |
|------|-------------|
| `examples/src/sql/00_onboarding.sql` | 3 orientation queries (top-5 depts, health BE latest, spend vs budget) |
| `examples/src/sql/01_health.sql` | Q1 – health spending BE/RE/Actuals by year (MH 2210+2211) |
| `examples/src/sql/02_committed.sql` | Q2 – committed expenditure + total_expenditure BE (2 sections) |
| `examples/src/sql/03_demand_variation.sql` | Q3 – demand-head variation (first vs latest actuals) |
| `examples/src/sql/run_sql.py` | Thin runner: registers demand_names table, executes SQL, writes JSON |
| `examples/out/results_sql.json` | Output in same schema as canonical_numbers.json |

## Reconciliation max-diff per section
All sections: **0.000000 cr** (tolerance = 0.01 cr)

```
Max abs diff : 0.000000 cr  (tolerance=0.01 cr)
RECONCILIATION: PASS
```

Checked:
- `onboarding`: top5, health_be_latest amount, spend_vs_budget (actuals, be, ratio)
- `q1_health`: be/re/actuals for all 11 fiscal years
- `q2_committed`: salaries/pensions/interest/committed/total_exp_actuals/share_pct for all 11 Actuals years
- `q3_demand`: first_actuals/latest_actuals/latest_be for all 29 demands
- `total_expenditure`: total_be/committed_be for all 11 BE years

## How to run
```bash
pip install duckdb        # one-time; version 1.5.4
python3 examples/src/sql/run_sql.py
# reads:  examples/data/processed/karnataka_budget_tidy.csv
# reads:  karnataka-state-finance/examples/demand_names.json
# writes: examples/out/results_sql.json
```

## Design notes
- **Scope constants** are embedded inline in the SQL (e.g. `major_head_code IN ('2210','2211')`) with
  a comment citing `examples/_spec/scope.json` as the source of truth.
- **Section markers** (`-- SECTION: name`) in multi-query SQL files allow the runner to parse and
  execute each query independently and store results by name.
- **demand_names** table is registered by the runner (from `demand_names.json`) so SQL can `JOIN`
  against it — the analytical aggregation stays in SQL while only the lookup-table loading is in Python.
- **Priority rule** for committed expenditure (pension MH 2071 > interest MH 2049 > salary object codes)
  is implemented purely in SQL CASE expressions with the `NOT IN ('2071','2049')` guard for salaries.
- **Paths** are resolved relative to `__file__` so the runner works from repo root or `examples/`.
- **Reconciliation guard** now also checks for empty sections to catch section-naming bugs early.

## Concerns
None. All checks pass at 0 diff.
