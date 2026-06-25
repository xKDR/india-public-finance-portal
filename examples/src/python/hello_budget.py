#!/usr/bin/env python3
"""Warm-up: your first Karnataka budget query.

Question: What did Karnataka actually spend on Health in 2024-25?

The gentlest example in this compendium: load the tidy table, keep the rows we
want, add up one column, convert the unit, print one number. It then checks its
own answer against the project's canonical figure, so you know your environment
reads the data correctly.

This warm-up is NOT part of the reconciliation suite (`make reproduce`); it is a
standalone first-contact script. When you are ready for more, open
00_onboarding.py and read through to 03_demand_variation.py.

Run it (no Docker, no extra installs):
    python3 examples/src/python/hello_budget.py
"""
import csv
import json
import os

# Health = Medical and Public Health (2210) + Family Welfare (2211).
HEALTH_MAJOR_HEADS = {"2210", "2211"}
FISCAL_YEAR = "2024-25"
MEASURE = "Actuals"          # what was actually spent, not what was budgeted

# Paths are computed from this file's location, so the script works from any
# working directory (repo root, examples/, or src/python/).
HERE = os.path.dirname(os.path.abspath(__file__))
PROCESSED = os.path.join(HERE, "..", "..", "data", "processed")
TIDY = os.path.join(PROCESSED, "karnataka_budget_tidy.csv")
CANONICAL = os.path.join(PROCESSED, "canonical_numbers.json")


def expected_crore():
    """The known-good answer, read from the project's canonical fixture so this
    script can never drift from the reconciliation numbers."""
    with open(CANONICAL, encoding="utf-8") as f:
        canon = json.load(f)
    for row in canon["q1_health"]:
        if row["fiscal_year"] == FISCAL_YEAR:
            return row["actuals"]
    raise SystemExit(f"No canonical Health figure for {FISCAL_YEAR}")


def main():
    if not os.path.exists(TIDY):
        raise SystemExit(
            f"Can't find the data file:\n  {TIDY}\n"
            "Run `make -C examples build` to generate it, or check that you "
            "cloned the full repository.")

    # The tidy table is already filtered to additive leaf rows, so summing is
    # safe with no predicate. (Q0 in 00_onboarding.py shows what that means and
    # why the raw CSV needs a filter first.)
    total_lakh = 0.0
    with open(TIDY, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if (row["fiscal_year"] == FISCAL_YEAR
                    and row["measure"] == MEASURE
                    and row["major_head_code"] in HEALTH_MAJOR_HEADS):
                total_lakh += float(row["amount_lakh"])
    total_crore = total_lakh / 100      # amounts are in INR lakh; 100 lakh = 1 crore

    print(f"Karnataka Health spending, {FISCAL_YEAR} {MEASURE}: "
          f"Rs {total_crore:,.2f} crore")

    want = expected_crore()
    if abs(total_crore - want) >= 0.01:
        raise SystemExit(
            f"self-check FAILED: got {total_crore:.2f}, expected {want:.2f} crore")
    print("self-check PASSED (matches the project's canonical figure)")


if __name__ == "__main__":
    main()
