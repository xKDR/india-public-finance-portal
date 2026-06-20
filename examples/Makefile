# Makefile — reproduce the Karnataka examples compendium in Python, R and DuckDB.
#
#   make reproduce   build the tidy table, run all three language tracks,
#                    and assert every track matches the canonical numbers.
#   make build       regenerate data/processed/{karnataka_budget_tidy.csv,canonical_numbers.json}
#   make python|r|sql run one language track  (writes out/results_<lang>.json)
#   make check       cross-language reconciliation only (needs the out/ files)
#   make clean       remove generated out/results_*.json
#
# Runs natively (python3 + Rscript on PATH; the duckdb python wheel is pip-installed
# by `make sql`). The same commands run inside the pinned Docker image (see Dockerfile).

PY      ?= python3
RSCRIPT ?= Rscript
PIP     ?= $(PY) -m pip

.PHONY: reproduce build python r sql check clean

reproduce: build python r sql check

build:
	$(PY) src/python/00_build_tidy.py

python:
	$(PY) src/python/_lib.py

r:
	$(RSCRIPT) src/r/00_onboarding.R
	$(RSCRIPT) src/r/01_health.R
	$(RSCRIPT) src/r/02_committed.R
	$(RSCRIPT) src/r/03_demand_variation.R

sql:
	@$(PY) -c "import duckdb" 2>/dev/null || $(PIP) install 'duckdb==1.5.4'
	$(PY) src/sql/run_sql.py

check:
	$(PY) src/check_reconcile.py

clean:
	rm -f out/results_python.json out/results_r.json out/results_sql.json
