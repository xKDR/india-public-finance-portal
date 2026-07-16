# Karnataka Budget Examples Compendium

A beginner warm-up plus four worked analyses of Karnataka state budget data, implemented
identically in Python, R, and DuckDB/SQL. The four analyses reconcile to 0.000000 crore against a
shared canonical fixture. Adopt by imitation: run the warm-up, then pick a language, start at
`00_onboarding`, and read through to `03`.

---

## Getting started in 5 minutes (Python & R)

No Docker, no installs beyond Python 3 or R — most research machines already have one (check with
`python3 --version` or `Rscript --version`). Run the warm-up:

```bash
python3 examples/src/python/hello_budget.py     # or:  Rscript examples/src/r/hello_budget.R
make -C examples hello                           # or run both at once
```

It prints one number — Karnataka's actual Health spend in 2024-25 — and checks its own answer
against the canonical fixture.

**New to budget documents?** Open the visual guide first; it shows a real budget page and how it
becomes rows: `open examples/doc/guide.html` (macOS) · `xdg-open examples/doc/guide.html` (Linux)
· or double-click the file. (On GitHub the link shows raw HTML — clone or download the repo to
view it.)

**Recommended path for a first-time user**

1. Run the warm-up (`hello_budget`) — see one number.
2. Open `doc/guide.html` — understand what a budget document is and why totals double-count.
3. Read `00_onboarding` in your language, then `01` → `03`. Adopt by imitation: read one, copy it,
   change one thing. The deeper walkthrough is [`doc/learning-module.md`](doc/learning-module.md).
4. (Verifiers) Run `make reproduce` to check all three language tracks reconcile.

---

## Reproduce and verify (all three tracks)

This is the verification path, not the first thing a beginner runs: it builds the tidy table, runs
Python, R, and DuckDB/SQL, and asserts every output matches `data/processed/canonical_numbers.json`
within 0.01 crore (Rs 1 lakh) tolerance.

### Docker (pinned environment, one command)

```bash
docker compose -f examples/compose.yaml run --rm examples
```

### Native (Python 3, R, and pip-installable duckdb required)

```bash
make -C examples reproduce
```

---

## Directory Map

```
examples/
├── README.md                       This file
├── src/
│   ├── python/                     Python track (stdlib only; no pandas/numpy required)
│   │   ├── hello_budget.py         Warm-up: Health Actuals 2024-25 (start here)
│   │   ├── 00_onboarding.py        Q0: Which 5 departments spent the most?
│   │   ├── 01_health.py            Q1: Health budget BE vs RE vs Actuals
│   │   ├── 02_committed.py         Q2: Committed expenditure share
│   │   ├── 03_demand_variation.py  Q3: Demand variation over time
│   │   └── _lib.py                 Shared loader (runs all four; writes results_python.json)
│   ├── r/                          R track (base-R primary path; no tidyverse required)
│   │   ├── hello_budget.R          Warm-up: Health Actuals 2024-25 (start here)
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
│       ├── karnataka_budget_tidy.csv     234,930-row canonical tidy table (safe to SUM)
│       └── canonical_numbers.json        Expected answers; reconciliation fixture
├── doc/
│   ├── why-ndjson.md               CSV vs NDJSON comparison + exclusion predicates
│   ├── learning-module.md          By-imitation curriculum for all four questions
│   ├── guide.html                  Visual guide: the documents, a real page, the columns, totals
│   └── results.html                Slideshow of the four findings (generated; `make slides`)
├── _spec/
│   ├── scope.json                  Machine-readable scope contract (constants, filenames)
│   └── README.md                   Human-readable canonical rule + author contract
├── out/                            Generated output (gitignored in some setups)
│   ├── results_python.json
│   ├── results_r.json
│   └── results_sql.json
├── Dockerfile                      Pinned image definition
├── compose.yaml                    Docker Compose service definition
└── Makefile                        make hello / slides / reproduce / build / python / r / sql / check / clean
```

---

## Examples index

Adopt by imitation: read one, copy it, change one thing. These build on each other; the deeper
walkthrough is [`doc/learning-module.md`](doc/learning-module.md). New to the data? Read
[`doc/guide.html`](doc/guide.html) first. Prefer the highlights? Open the
[results slideshow](doc/results.html) (`make slides` rebuilds it from `canonical_numbers.json`).

| Level | Question | Concepts | Python | R | SQL | Checked |
|---|---|---|---|---|---|---|
| Warm-up | Health Actuals, 2024-25 | load, filter, sum, unit convert | `src/python/hello_budget.py` | `src/r/hello_budget.R` | — | self-check |
| Q0 | Top 5 departments by latest Actuals | additive-leaf predicate, demand lookup | `src/python/00_onboarding.py` | `src/r/00_onboarding.R` | `src/sql/00_onboarding.sql` | full reconcile |
| Q1 | Health BE vs RE vs Actuals by year | major-head filter, cross-year series | `src/python/01_health.py` | `src/r/01_health.R` | `src/sql/01_health.sql` | full reconcile |
| Q2 | Committed-expenditure share | object-head classification, ratios | `src/python/02_committed.py` | `src/r/02_committed.R` | `src/sql/02_committed.sql` | full reconcile |
| Q3 | Demand variation over time | multi-year aggregation, ranking | `src/python/03_demand_variation.py` | `src/r/03_demand_variation.R` | `src/sql/03_demand_variation.sql` | full reconcile |

**Checked:** the warm-up verifies itself against the canonical figure; Q0–Q3 read
`data/processed/karnataka_budget_tidy.csv`, write `out/results_<lang>.json`, and are cross-checked
across all three languages by `make reproduce` (reconcile to 0.000000 crore against
`data/processed/canonical_numbers.json`).

**Adding an example:** copy the next number (`04_…`), implement it in Python, R, and SQL reading
only the tidy table, add a canonical entry to `data/processed/canonical_numbers.json`, and add a
row above. The author contract is in [`_spec/README.md`](_spec/README.md).

---

## Language Tracks

| Track | Directory | Dependencies | Notes |
|---|---|---|---|
| Python | `src/python/` | Python 3 stdlib only | `_lib.py` runs all four analyses and writes `results_python.json` |
| R | `src/r/` | Base R (no tidyverse) | Each script is standalone; run individually or via `make r` |
| DuckDB / SQL | `src/sql/` | `duckdb` Python wheel | `make sql` installs it if absent; SQL files are pure SQL |

---

## The Tidy Table

`data/processed/karnataka_budget_tidy.csv` is a 234,930-row canonical tidy table derived from
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

Raw CSV and NDJSON files live in `state-finances/karnataka/` at the repo root — they are not
duplicated here. See `state-finances/karnataka/KA_README.md` for the full package documentation.

For the decision between CSV and NDJSON, and for the complete list of exclusions required before
naive analysis, see `doc/why-ndjson.md`.

For a walkthrough of the four questions, the method, and the canonical rule, see
`doc/learning-module.md`.
