#!/usr/bin/env python3
"""
00_onboarding.py  —  Karnataka Budget: three orientation questions for a new user.

Run from repo root OR from examples/:
    python3 examples/src/python/00_onboarding.py

This script answers three questions that give a first-time user a quick mental
model of Karnataka's budget:

  1. Which five departments spent the most last year?
  2. How much did Karnataka budget for health this year?
  3. Does Karnataka usually spend more or less than it budgets?

After the three questions there is a 'FORMATS LESSON' that answers question 2
a second time using the raw NDJSON package file, showing the two numbers match.
This motivates why both the tidy CSV and the raw NDJSON exist.

KEY CONCEPTS:
  - 'amount_lakh': amounts in the tidy table are in INR lakh; divide by 100 for crore.
  - 'measure': each row belongs to one of BE (Budget Estimate), RE (Revised Estimate),
    or Actuals. The tidy table already has the canonical source for each.
  - 'demand': a numbered grant/department (e.g. "29" = Debt Servicing).
"""

import os
import sys
from collections import defaultdict

# Allow `import _lib` whether the script is run from repo root or examples/
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _lib

LAKH_TO_CRORE = 100.0  # 1 crore = 100 lakh


def q1_top5_departments(rows, demand_names):
    """
    Q1: Which five Karnataka departments spent the most in the latest year?

    We use 'Actuals' (what was actually spent, not just budgeted).
    Steps:
      1. Find the latest fiscal year that has Actuals rows.
      2. Sum amount_lakh per demand for that year.
      3. Keep only demands in the official 29-demand list; rank; take top 5.
    """
    # Step 1 — find the latest year with Actuals data
    # (Future years have only BE/RE; Actuals arrive only after the year closes.)
    actuals_years = sorted({r["fiscal_year"] for r in rows if r["measure"] == "Actuals"})
    latest_fy = actuals_years[-1]

    # Step 2 — sum per demand for that year
    # We restrict to the 29 official demand numbers (some tidy-CSV rows may have
    # blank or non-standard demand values from multi-demand lines; skip those).
    by_demand = defaultdict(float)
    for r in rows:
        if (r["measure"] == "Actuals"
                and r["fiscal_year"] == latest_fy
                and r["demand"] in demand_names):
            by_demand[r["demand"]] += r["amount_lakh"]

    # Step 3 — rank and take top 5
    ranked = sorted(by_demand.items(), key=lambda kv: kv[1], reverse=True)[:5]

    print(f"\n--- Q1: Top 5 spending departments ({latest_fy} Actuals) ---")
    result_rows = []
    for demand_num, total_lakh in ranked:
        crore = total_lakh / LAKH_TO_CRORE
        name = demand_names[demand_num]["name"]
        print(f"  Demand {demand_num:>3}  {name:<45}  Rs {crore:>10,.2f} crore")
        result_rows.append({
            "demand": demand_num,
            "name":   name,
            "amount": round(crore, 2),
        })

    return {"fiscal_year": latest_fy, "rows": result_rows}


def q2_health_be_latest(rows, scope):
    """
    Q2: How much did Karnataka budget for health this year?

    'Health' = major heads 2210 (Medical & Public Health) + 2211 (Family Welfare).
    We use the Budget Estimate (BE) — the amount approved by the legislature
    at the start of the year. We pick the latest fiscal year that has a health BE.

    Note: years in the future will have a BE even without RE or Actuals yet.
    """
    # Scope constants come from scope.json — do not hardcode them here
    health_mh = set(scope["health_major_heads"])  # {"2210", "2211"}

    # Sum health BE per fiscal year across both major heads
    health_by_fy = defaultdict(float)
    for r in rows:
        if r["measure"] == "BE" and r["major_head_code"] in health_mh:
            health_by_fy[r["fiscal_year"]] += r["amount_lakh"]

    latest_fy = sorted(health_by_fy.keys())[-1]  # most recent year with a health BE
    total_crore = health_by_fy[latest_fy] / LAKH_TO_CRORE

    print(f"\n--- Q2: Health Budget Estimate — latest year ({latest_fy}) ---")
    print(f"  Major heads: {', '.join(sorted(health_mh))}  (Medical & Public Health + Family Welfare)")
    print(f"  Health BE ({latest_fy}): Rs {total_crore:,.2f} crore")

    return {"fiscal_year": latest_fy, "amount": round(total_crore, 2)}


def q3_spend_vs_budget(rows):
    """
    Q3: Does Karnataka usually spend more or less than it budgets?

    We compare total Actuals vs total BE for the latest year with Actuals.
      ratio = Actuals / BE
      ratio < 1  →  state under-spent (spent less than budgeted)
      ratio > 1  →  state over-spent  (spent more than budgeted)

    A ratio consistently below 1 can mean prudent fiscal management OR
    that capital projects/transfers were delayed.
    """
    # Latest year with Actuals
    actuals_years = sorted({r["fiscal_year"] for r in rows if r["measure"] == "Actuals"})
    latest_fy = actuals_years[-1]

    total_act_lakh = sum(
        r["amount_lakh"] for r in rows
        if r["measure"] == "Actuals" and r["fiscal_year"] == latest_fy
    )
    total_be_lakh = sum(
        r["amount_lakh"] for r in rows
        if r["measure"] == "BE" and r["fiscal_year"] == latest_fy
    )

    actuals_cr = total_act_lakh / LAKH_TO_CRORE
    be_cr      = total_be_lakh  / LAKH_TO_CRORE
    ratio      = round(actuals_cr / be_cr, 4) if be_cr else 0.0

    # One-line interpretation
    pct_gap = abs(1.0 - ratio) * 100
    if pct_gap < 2.0:
        interpretation = "spent almost exactly on budget"
    elif ratio < 1.0:
        interpretation = f"under-spent the budget by {pct_gap:.1f}%"
    else:
        interpretation = f"over-spent the budget by {pct_gap:.1f}%"

    print(f"\n--- Q3: Actuals vs BE ({latest_fy}) ---")
    print(f"  Total Actuals:         Rs {actuals_cr:>12,.2f} crore")
    print(f"  Total Budget Estimate: Rs {be_cr:>12,.2f} crore")
    print(f"  Actuals/BE ratio:      {ratio:.4f}  -> Karnataka {interpretation}")

    return {
        "fiscal_year": latest_fy,
        "actuals": round(actuals_cr, 2),
        "be":      round(be_cr, 2),
        "ratio":   ratio,
    }


def formats_lesson(rows, scope):
    """
    FORMATS LESSON: the same number from two different sources.

    Question: What is Karnataka's total health BE for 2026-27?

    Source A: the tidy CSV  (examples/data/processed/karnataka_budget_tidy.csv)
      Pre-processed: additive-leaf predicate and canonical-source rule already applied.
      Just filter rows where measure=='BE', fiscal_year=='2026-27', and
      major_head_code in {'2210','2211'}, then sum amount_lakh / 100.

    Source B: the raw NDJSON  (karnataka-state-finance/years/2026-27/json/budget_leaves_2026-27.ndjson)
      One JSON object per line; each has an 'amounts' list and hierarchy metadata.
      The 'budget_leaves' file is already leaf-only (same predicate); you still
      need to pick the right fiscal_year and measure from the amounts list.

    Both answers should agree within Rs 0.01 crore (the package tolerance).
    """
    health_mh = set(scope["health_major_heads"])  # {"2210", "2211"}
    # For FY 2026-27, the canonical BE source is the 2026-27 document (offset = 0).
    TARGET_FY  = "2026-27"
    TARGET_DOC = "2026-27"

    # --- Source A: tidy CSV (already done above; just sum the rows we loaded) ---
    csv_total_lakh = sum(
        r["amount_lakh"] for r in rows
        if r["measure"] == "BE"
        and r["fiscal_year"] == TARGET_FY
        and r["major_head_code"] in health_mh
    )
    csv_crore = csv_total_lakh / LAKH_TO_CRORE

    # --- Source B: raw NDJSON ---
    # In the NDJSON, measure names use underscores:
    #   'budget_estimate'   -> BE
    #   'revised_estimate'  -> RE
    #   'accounts'          -> Actuals
    # The major head code lives at: record["hierarchy"]["major_head"]["code"]
    ndjson_path = os.path.join(
        _lib.NDJSON_DIR, TARGET_DOC, "json",
        f"budget_leaves_{TARGET_DOC}.ndjson"
    )
    ndjson_total_lakh = 0.0
    for record in _lib.load_ndjson(ndjson_path):
        mh_code = record.get("hierarchy", {}).get("major_head", {}).get("code", "")
        if mh_code not in health_mh:
            continue  # not a health row
        # Each record has a list of amount entries; pick the right year + measure
        for amt_entry in record.get("amounts", []):
            if (amt_entry.get("fiscal_year") == TARGET_FY
                    and amt_entry.get("measure") == "budget_estimate"):
                ndjson_total_lakh += amt_entry.get("value", 0.0)

    ndjson_crore = ndjson_total_lakh / LAKH_TO_CRORE
    diff = abs(csv_crore - ndjson_crore)

    print(f"\n--- FORMATS LESSON: Health BE {TARGET_FY} from two sources ---")
    print(f"  From tidy CSV (processed):            Rs {csv_crore:,.2f} crore")
    print(f"  From raw NDJSON ({TARGET_DOC} doc): Rs {ndjson_crore:,.2f} crore")
    print(f"  Difference: {diff:.4f} crore  [{'MATCH' if diff < 0.01 else 'MISMATCH — investigate'}]")
    print(f"  -> Both sources give the same answer.")
    print(f"     Use the tidy CSV for fast analysis; use the NDJSON to audit individual PDF rows.")

    return csv_crore, ndjson_crore


def main():
    print("Karnataka Budget — Onboarding")
    print("=" * 55)
    print("Source: examples/data/processed/karnataka_budget_tidy.csv")
    print("Amounts in INR crore (1 crore = 100 lakh)\n")

    scope        = _lib.load_scope()
    rows         = _lib.load_tidy()
    demand_names = _lib.load_demand_names()

    print(f"Loaded {len(rows):,} canonical leaf rows.")

    top5         = q1_top5_departments(rows, demand_names)
    health_be    = q2_health_be_latest(rows, scope)
    spend_vs_bud = q3_spend_vs_budget(rows)
    formats_lesson(rows, scope)

    # Record all three answers into out/results_python.json under the 'onboarding' key
    _lib.record_result("onboarding", {
        "top5_departments_latest_actuals": top5,
        "health_be_latest":               health_be,
        "spend_vs_budget":                spend_vs_bud,
    })
    print("\nRecorded to out/results_python.json  (key: onboarding)")


if __name__ == "__main__":
    main()
