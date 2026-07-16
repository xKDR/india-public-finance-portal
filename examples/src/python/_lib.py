"""
Shared helpers for the Karnataka Python examples track (task B2).

This module is imported by all four example scripts. It provides:
  - File path constants (computed relative to __file__ so scripts work from any directory)
  - load_scope()        — load examples/_spec/scope.json
  - load_tidy()         — load the canonical tidy CSV as a list of dicts
  - load_demand_names() — load demand-number -> name lookup
  - load_ndjson(path)   — load a raw .ndjson package file
  - lakh_to_crore(x)    — unit conversion
  - record_result(section, payload) — write a section into out/results_python.json
  - reconcile()         — compare results_python.json vs canonical_numbers.json
  - Running this file directly (`python3 _lib.py`) runs all four examples then reconciles.
"""

import csv
import json
import os
import sys

# ---- Path constants ---------------------------------------------------------
# Computed from __file__ so every script finds the right data regardless of
# the working directory the user chooses.
#
# Directory layout:
#   repo_root/
#     examples/
#       _spec/scope.json
#       data/processed/karnataka_budget_tidy.csv
#       data/processed/canonical_numbers.json
#       out/results_python.json          <- written by these scripts
#       src/python/_lib.py               <- this file
#     state-finances/karnataka/
#     state-finances/karnataka/KA_demand_names.json  <- read-only (package metadata)
#       years/<Y>/json/budget_leaves_<Y>.ndjson

_HERE = os.path.dirname(os.path.abspath(__file__))       # examples/src/python
EXAMPLES_DIR = os.path.dirname(os.path.dirname(_HERE))  # examples/
REPO_ROOT = os.path.dirname(EXAMPLES_DIR)               # repo root

TIDY_CSV       = os.path.join(EXAMPLES_DIR, "data", "processed", "karnataka_budget_tidy.csv")
SCOPE_JSON     = os.path.join(EXAMPLES_DIR, "_spec", "scope.json")
CANONICAL_JSON = os.path.join(EXAMPLES_DIR, "data", "processed", "canonical_numbers.json")
RESULTS_JSON   = os.path.join(EXAMPLES_DIR, "out", "results_python.json")

# Package files (read-only; used only for the formats-lesson demo)
DEMAND_NAMES_JSON = os.path.join(
    REPO_ROOT, "state-finances", "karnataka", "KA_demand_names.json"
)
NDJSON_DIR = os.path.join(REPO_ROOT, "state-finances", "karnataka", "KA_years")


# ---- Loaders ----------------------------------------------------------------

def load_scope():
    """Return the scope contract dict from examples/_spec/scope.json.

    Scope constants (health major heads, salary object codes, etc.) live here
    so every language track uses the same definitions.
    """
    with open(SCOPE_JSON, encoding="utf-8") as f:
        return json.load(f)


def load_tidy():
    """Load the canonical tidy CSV and return it as a list of dicts.

    The CSV is already filtered to:
      - additive-leaf rows only (type_of_table='object_head', row_type='Data',
        row_level='Object-Head') — so you can SUM without double-counting.
      - canonical source per (fiscal_year, measure): BE from its own document,
        RE from the next document, Actuals from two documents later.

    As an example author you just filter the columns you care about and sum
    amount_lakh. Divide by 100 to get INR crore.

    Columns: document_year, fiscal_year, measure, demand, major_head_code,
             major_head_name, object_head_code, object_head_description,
             amount_lakh (float), amount_unit.
    """
    rows = []
    with open(TIDY_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            row["amount_lakh"] = float(row["amount_lakh"])
            rows.append(row)
    return rows


def load_demand_names():
    """Return a dict mapping demand number -> {name, short, volume}.

    Example: demand_names["29"]["name"] == "Debt Servicing"

    Source: state-finances/karnataka/KA_demand_names.json (read-only).
    """
    with open(DEMAND_NAMES_JSON, encoding="utf-8") as f:
        return json.load(f)["demands"]


def load_ndjson(path):
    """Load a raw .ndjson package file; return a list of dicts (one per line).

    Used only in the formats-lesson demo to show that the raw package and the
    tidy CSV give the same answer.
    """
    records = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


# ---- Unit conversion --------------------------------------------------------

def lakh_to_crore(lakh):
    """Convert INR lakh to INR crore (1 crore = 100 lakh)."""
    return lakh / 100.0


# ---- Output -----------------------------------------------------------------

def record_result(section, payload):
    """Merge payload into out/results_python.json under the key `section`.

    Creates the file with unit/tolerance metadata on first call.
    Subsequent calls for different sections accumulate without overwriting.
    Idempotent: re-running a script updates its section in place.
    """
    out_dir = os.path.dirname(RESULTS_JSON)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    # Load whatever is already there, or start fresh with the metadata header
    try:
        with open(RESULTS_JSON, encoding="utf-8") as f:
            existing = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        existing = {"unit": "INR_crore", "tolerance_crore": 0.01}

    existing[section] = payload

    with open(RESULTS_JSON, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2)


# ---- Reconciliation ---------------------------------------------------------

def reconcile(verbose=True):
    """Compare results_python.json against canonical_numbers.json.

    Checks every monetary value in every section against the canonical fixture.
    Returns (max_abs_diff_crore, worst_label).
    Prints a summary when verbose=True.
    """
    with open(RESULTS_JSON, encoding="utf-8") as f:
        mine = json.load(f)
    with open(CANONICAL_JSON, encoding="utf-8") as f:
        canon = json.load(f)

    tolerance = canon.get("tolerance_crore", 0.01)
    max_diff = 0.0
    worst_label = ""
    failures = []

    def check(label, a, b):
        nonlocal max_diff, worst_label
        d = abs(a - b)
        if d > max_diff:
            max_diff = d
            worst_label = label
        if d > tolerance:
            failures.append(
                f"  FAIL  {label}: mine={a:.4f}  canon={b:.4f}  diff={d:.6f}"
            )

    # onboarding
    mo = mine.get("onboarding", {})
    co = canon.get("onboarding", {})
    if mo and co:
        check("onboarding.health_be_latest",
              mo["health_be_latest"]["amount"],
              co["health_be_latest"]["amount"])
        check("onboarding.spend_vs_budget.actuals",
              mo["spend_vs_budget"]["actuals"],
              co["spend_vs_budget"]["actuals"])
        check("onboarding.spend_vs_budget.be",
              mo["spend_vs_budget"]["be"],
              co["spend_vs_budget"]["be"])
        check("onboarding.spend_vs_budget.ratio",
              mo["spend_vs_budget"]["ratio"],
              co["spend_vs_budget"]["ratio"])
        for mr, cr_ in zip(
            mo["top5_departments_latest_actuals"]["rows"],
            co["top5_departments_latest_actuals"]["rows"],
        ):
            check(f"onboarding.top5[{mr['demand']}]", mr["amount"], cr_["amount"])

    # q1_health
    c_q1 = {r["fiscal_year"]: r for r in canon.get("q1_health", [])}
    for row in mine.get("q1_health", []):
        fy = row["fiscal_year"]
        if fy in c_q1:
            for k in ("be", "re", "actuals"):
                check(f"q1_health[{fy}].{k}", row[k], c_q1[fy][k])

    # q2_committed
    c_q2 = {r["fiscal_year"]: r for r in canon.get("q2_committed", [])}
    for row in mine.get("q2_committed", []):
        fy = row["fiscal_year"]
        if fy in c_q2:
            for k in ("salaries", "pensions", "interest", "committed",
                      "total_exp_actuals", "share_pct"):
                check(f"q2_committed[{fy}].{k}", row[k], c_q2[fy][k])

    # q3_demand rows (monetary fields only; act_be ratio is not tolerance-checked here)
    c_q3 = {r["demand"]: r for r in canon.get("q3_demand", {}).get("rows", [])}
    for row in mine.get("q3_demand", {}).get("rows", []):
        d = row["demand"]
        if d in c_q3:
            for k in ("first_actuals", "latest_actuals", "latest_be"):
                check(f"q3_demand[{d}].{k}", row[k], c_q3[d][k])

    # total_expenditure
    c_te = {r["fiscal_year"]: r for r in canon.get("total_expenditure", [])}
    for row in mine.get("total_expenditure", []):
        fy = row["fiscal_year"]
        if fy in c_te:
            for k in ("total_be", "committed_be"):
                check(f"total_expenditure[{fy}].{k}", row[k], c_te[fy][k])

    if verbose:
        status = "PASS" if max_diff <= tolerance else "FAIL"
        print(f"\nReconciliation: max abs diff = {max_diff:.6f} cr  [{status}]")
        print(f"  Worst case: {worst_label}")
        print(f"  Tolerance:  {tolerance} cr")
        if failures:
            print("\nFailing checks:")
            for msg in failures:
                print(msg)

    return max_diff, worst_label


# ---- Runner -----------------------------------------------------------------
# `python3 examples/src/python/_lib.py` runs all four examples in order,
# then prints the reconciliation summary. The Makefile (task B6) can use this.

def _run_all():
    scripts = [
        "00_onboarding.py",
        "01_health.py",
        "02_committed.py",
        "03_demand_variation.py",
    ]
    for script in scripts:
        print(f"\n{'='*62}\nRunning {script}\n{'='*62}")
        import subprocess
        subprocess.run(
            [sys.executable, os.path.join(_HERE, script)],
            check=True,
        )

    print(f"\n{'='*62}\nReconciliation vs canonical_numbers.json\n{'='*62}")
    reconcile(verbose=True)


if __name__ == "__main__":
    _run_all()
