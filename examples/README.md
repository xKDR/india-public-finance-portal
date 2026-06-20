# Karnataka Budget Examples Compendium

Four worked analyses of Karnataka state budget data, implemented identically in Python, R, and
DuckDB/SQL. All three language tracks reconcile to 0.000000 crore against a shared canonical
fixture. Adopt by imitation: pick a language, start at `00_onboarding`, read through to `03`.

---

## Quick-Start

### Docker (pinned environment, one command)

```bash
docker compose -f examples/compose.yaml run --rm examples
```

### Native (Python 3, R, and pip-installable duckdb required)

```bash
make -C examples reproduce
```

Both routes run all three language tracks and assert that every output matches
`data/processed/canonical_numbers.json` within 0.01 crore (Rs 1 lakh) tolerance.

---

## Directory Map

```
examples/
├── README.md                       This file
├── src/
│   ├── python/                     Python track (stdlib only; no pandas/numpy required)
│   │   ├── 00_onboarding.py        Q0: Which 5 departments spent the most?
│   │   ├── 01_health.py            Q1: Health budget BE vs RE vs Actuals
│   │   ├── 02_committed.py         Q2: Committed expenditure share
│   │   ├── 03_demand_variation.py  Q3: Demand variation over time
│   │   └── _lib.py                 Shared loader (runs all four; writes results_python.json)
│   ├── r/                          R track (base-R primary path; no tidyverse required)
│   │   ├── 00_onboarding.R
│   │   ├── 01_health.R
│   │   ├── 02_committed.R
│   │   ├── 03_demand_variation.R
│   │   └── _lib.R                  Shared helpers
│   └── sql/                        DuckDB/SQL track
│       ├── 00_onboarding.sql
│       ├── 01_health.sql
│       ├── 02_committed.sql
│       └── 03_demand_variation.sql
├── data/
│   └── processed/
│       ├── karnataka_budget_tidy.csv     285,604-row canonical tidy table (safe to SUM)
│       └── canonical_numbers.json        Expected answers; reconciliation fixture
├── doc/
│   ├── why-ndjson.md               CSV vs NDJSON comparison + exclusion predicates
│   ├── learning-module.md          By-imitation curriculum for all four questions
│   └── guide.html                  Visual guide to the account hierarchy
├── _spec/
│   ├── scope.json                  Machine-readable scope contract (constants, filenames)
│   └── README.md                   Human-readable canonical rule + author contract
├── out/                            Generated output (gitignored in some setups)
│   ├── results_python.json
│   ├── results_r.json
│   └── results_sql.json
├── Dockerfile                      Pinned image definition
├── compose.yaml                    Docker Compose service definition
└── Makefile                        make reproduce / build / python / r / sql / check / clean
```

---

## Adopt by Imitation

Pick your language and open the `00_onboarding` file. Read it top to bottom, run it, check the
output against the canonical answers below. Then move to `01`, `02`, `03`.

| Step | File | What you learn |
|---|---|---|
| `00_onboarding` | `src/<lang>/00_onboarding.py` (or `.R`, `.sql`) | Reading the tidy table, the additive-leaf predicate, demand lookup, positional column reading |
| `01_health` | `src/<lang>/01_health.py` | Filtering by major head, BE vs RE vs Actuals, cross-year series |
| `02_committed` | `src/<lang>/02_committed.py` | Object-head and major-head classification, ratio calculation |
| `03_demand_variation` | `src/<lang>/03_demand_variation.py` | Multi-year aggregation, ranking, sorting |

All four examples read from `data/processed/karnataka_budget_tidy.csv` and write their results to
`out/results_<lang>.json`. The `make check` step then diffs every value against
`data/processed/canonical_numbers.json`.

---

## Language Tracks

| Track | Directory | Dependencies | Notes |
|---|---|---|---|
| Python | `src/python/` | Python 3 stdlib only | `_lib.py` runs all four analyses and writes `results_python.json` |
| R | `src/r/` | Base R (no tidyverse) | Each script is standalone; run individually or via `make r` |
| DuckDB / SQL | `src/sql/` | `duckdb` Python wheel | `make sql` installs it if absent; SQL files are pure SQL |

---

## The Tidy Table

`data/processed/karnataka_budget_tidy.csv` is a 285,604-row canonical tidy table derived from
the Karnataka package. It is safe to filter and SUM directly — the additive-leaf predicate has
already been applied, the canonical source rule has already been applied, and OCR outliers have
been excluded.

**Columns:** `document_year, fiscal_year, measure, demand, major_head_code, major_head_name,
object_head_code, object_head_description, amount_lakh, amount_unit`

`measure` is one of `BE`, `RE`, or `Actuals`. `amount_lakh` is in INR lakh; divide by 100 for
crore.

To regenerate: `python3 examples/src/python/00_build_tidy.py` (idempotent, stdlib only).

---

## Canonical Answers (Q0 sample)

Top 5 departments by 2024-25 actuals (from `canonical_numbers.json`):

| Rank | Demand | Department | Amount (crore) |
|---|---|---|---|
| 1 | 29 | Debt Servicing | 63,016.55 |
| 2 | 03 | Finance | 35,172.55 |
| 3 | 11 | Women and Child Development | 34,138.84 |
| 4 | 17 | Education | 33,653.21 |
| 5 | 24 | Energy | 31,437.68 |

---

## Raw Data

Raw CSV and NDJSON files live in `karnataka-state-finance/` at the repo root — they are not
duplicated here. See `karnataka-state-finance/README.md` for the full package documentation.

For the decision between CSV and NDJSON, and for the complete list of exclusions required before
naive analysis, see `doc/why-ndjson.md`.

For a walkthrough of the four questions, the method, and the canonical rule, see
`doc/learning-module.md`.
