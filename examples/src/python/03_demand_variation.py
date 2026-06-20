#!/usr/bin/env python3
"""
03_demand_variation.py  —  Q3: Variation by demand head over the full data span.

Run from repo root OR from examples/:
    python3 examples/src/python/03_demand_variation.py

WHAT IS A 'DEMAND'?
  The Karnataka state budget is organised into 29 'grants' (called demands).
  Each demand corresponds to a department or thematic area (e.g. demand 22 =
  Health and Family Welfare, demand 17 = Education, demand 29 = Debt Servicing).

  Think of a demand as the top-level bucket. Major heads (like 2210, 2211) sit
  within a demand, and object heads (like '001' for basic pay) sit within major heads.

WHAT THIS SHOWS:
  For each of the 29 demands:
    first_actuals  — actual spending in the earliest year we have Actuals data for
    latest_actuals — actual spending in the most recent Actuals year
    latest_be      — Budget Estimate for the most recent year (may differ from actuals)
    act_be         — Actuals / BE ratio (a measure of budget execution quality)

  Rows are ranked by latest_actuals descending (biggest spenders first).

HOW TO READ THE TABLE:
  act_be > 1  =  the department spent MORE than it budgeted (supplementary demands, etc.)
  act_be < 1  =  the department spent LESS than it budgeted (under-utilisation, delays)
  act_be = 0  =  no BE data for that year (demand merged or renamed)
"""

import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _lib


def main():
    scope        = _lib.load_scope()
    rows         = _lib.load_tidy()
    demand_names = _lib.load_demand_names()

    L2C = scope["unit_lakh_to_crore"]  # 100

    # Find the first and latest fiscal years that have any Actuals rows
    act_years = sorted({r["fiscal_year"] for r in rows if r["measure"] == "Actuals"})
    fy_first  = act_years[0]
    fy_latest = act_years[-1]

    # Aggregate by (demand, fiscal_year, measure).
    # We only need three slices: first Actuals, latest Actuals, latest BE.
    agg = defaultdict(float)  # (demand, fy, measure) -> lakh
    for r in rows:
        d = r["demand"]
        if not d:
            continue  # skip rows with no demand label
        key = (d, r["fiscal_year"], r["measure"])
        agg[key] += r["amount_lakh"]

    # Build result rows for all 29 known demands
    result_rows = []
    for d_num in sorted(demand_names.keys()):
        first_act  = agg.get((d_num, fy_first,  "Actuals"), 0.0)
        latest_act = agg.get((d_num, fy_latest, "Actuals"), 0.0)
        latest_be  = agg.get((d_num, fy_latest, "BE"),      0.0)

        # Skip demands with no data at all (e.g. demand 16 had zero in latest year)
        if first_act == 0.0 and latest_act == 0.0 and latest_be == 0.0:
            continue

        # act_be rounded to 10dp to match the canonical fixture exactly
        act_be = round(latest_act / latest_be, 10) if latest_be else 0.0

        result_rows.append({
            "demand":         d_num,
            "name":           demand_names[d_num]["name"],
            "first_actuals":  round(first_act  / L2C, 2),
            "latest_actuals": round(latest_act / L2C, 2),
            "latest_be":      round(latest_be  / L2C, 2),
            "act_be":         act_be,
        })

    # Rank by latest_actuals descending (biggest spenders first)
    result_rows.sort(key=lambda r: r["latest_actuals"], reverse=True)

    print(f"Q3: Karnataka Spending by Demand — {fy_first} vs {fy_latest} Actuals — INR crore")
    print("=" * 102)
    print(
        f"{'Demand':>7} {'Name':<45}"
        f" {'Act '+fy_first[:4]:>12} {'Act '+fy_latest[:4]:>12}"
        f" {'BE '+fy_latest[:4]:>12} {'Act/BE':>8}"
    )
    print("-" * 102)

    for r in result_rows:
        act_be_str = f"{r['act_be']:.4f}" if r["act_be"] else "-"
        print(
            f"{r['demand']:>7} {r['name']:<45}"
            f" {r['first_actuals']:>12,.2f}"
            f" {r['latest_actuals']:>12,.2f}"
            f" {r['latest_be']:>12,.2f}"
            f" {act_be_str:>8}"
        )

    print("-" * 102)
    print("  Act/BE > 1 = overspent budget;  Act/BE < 1 = under-spent.")

    _lib.record_result("q3_demand", {
        "fiscal_year_first":  fy_first,
        "fiscal_year_latest": fy_latest,
        "rows":               result_rows,
    })
    print("\nRecorded to out/results_python.json  (key: q3_demand)")


if __name__ == "__main__":
    main()
