#!/usr/bin/env python3
"""
02_committed.py  —  Q2: Committed expenditure (salaries + pensions + interest), Actuals basis.

Run from repo root OR from examples/:
    python3 examples/src/python/02_committed.py

WHAT IS COMMITTED EXPENDITURE?
  Governments have two broad kinds of spending:
    - Committed:  legally/contractually obligated (must pay regardless of budget pressure)
    - Discretionary: can be adjusted year to year

  The three committed components here are:
    Salaries  — direct pay to government employees (specific object head codes)
    Pensions  — post-retirement payments (major head 2071)
    Interest  — payments on state borrowings (major head 2049)

  All three are computed on an 'Actuals' basis (what was actually spent).

PRIORITY RULE:
  pension major head (2071) > interest major head (2049) > salary object codes

  This priority prevents double-counting. Example: a pension payment row has
  major_head_code='2071' AND its object_head_code might also be in the salary
  object codes. Without priority, it would be counted twice. With priority,
  it counts as 'pension' only.

SALARY OBJECT CODES:
  The scope.json lists the exact object head codes that constitute direct
  government salaries (basic pay, allowances, etc.). Grants-in-aid salaries
  (object codes 101, 118) are deliberately excluded — those are payments to
  third-party bodies, not the government's own payroll.

OUTPUT:
  Actuals table (one row per fiscal year) + total_expenditure BE table.
  Both sections are written to out/results_python.json.
"""

import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _lib


def main():
    scope = _lib.load_scope()
    rows  = _lib.load_tidy()

    # Scope constants (from scope.json — do not hardcode)
    PENSION_MH  = scope["pension_major_head"]            # "2071"
    INTEREST_MH = scope["interest_major_head"]           # "2049"
    SALARY_OHC  = set(scope["salary_object_codes"])      # {"001", "002", ...}
    L2C         = scope["unit_lakh_to_crore"]            # 100

    # Actuals-basis accumulators
    sal   = defaultdict(float)   # fy -> salary lakh (Actuals)
    pen   = defaultdict(float)   # fy -> pension lakh (Actuals)
    intr  = defaultdict(float)   # fy -> interest lakh (Actuals)
    total = defaultdict(float)   # fy -> total expenditure lakh (Actuals)

    # BE-basis accumulators for the total_expenditure section
    sal_be    = defaultdict(float)
    pen_be    = defaultdict(float)
    int_be    = defaultdict(float)
    total_be  = defaultdict(float)

    for r in rows:
        fy  = r["fiscal_year"]
        mh  = r["major_head_code"]
        oh  = r["object_head_code"]
        amt = r["amount_lakh"]
        m   = r["measure"]

        if m == "Actuals":
            # Every Actuals row contributes to the total
            total[fy] += amt
            # Priority: pension > interest > salary (to prevent double-counting)
            if mh == PENSION_MH:
                pen[fy] += amt
            elif mh == INTEREST_MH:
                intr[fy] += amt
            elif oh in SALARY_OHC:
                sal[fy] += amt
            # All other rows = discretionary; counted in total but not committed

        elif m == "BE":
            total_be[fy] += amt
            # Same priority logic for the BE-based committed figure
            if mh == PENSION_MH:
                pen_be[fy] += amt
            elif mh == INTEREST_MH:
                int_be[fy] += amt
            elif oh in SALARY_OHC:
                sal_be[fy] += amt

    fy_with_act = sorted(total.keys())
    fy_with_be  = sorted(total_be.keys())

    # --- Print the Actuals table ---
    print("Q2: Karnataka Committed Expenditure (Actuals basis) — INR crore")
    print("=" * 95)
    print(
        f"{'Fiscal Year':>12} {'Salaries':>12} {'Pensions':>12} {'Interest':>12}"
        f" {'Committed':>12} {'Total Exp':>12} {'%Share':>7}"
    )
    print("-" * 95)

    q2_rows = []
    for fy in fy_with_act:
        s, p, i = sal[fy], pen[fy], intr[fy]
        committed = s + p + i
        tot       = total[fy]
        share     = round(100.0 * committed / tot, 2) if tot else 0.0

        print(
            f"{fy:>12}"
            f" {s/L2C:>12,.2f}"
            f" {p/L2C:>12,.2f}"
            f" {i/L2C:>12,.2f}"
            f" {committed/L2C:>12,.2f}"
            f" {tot/L2C:>12,.2f}"
            f" {share:>6.2f}%"
        )

        q2_rows.append({
            "fiscal_year":       fy,
            "salaries":          round(s / L2C,         2),
            "pensions":          round(p / L2C,         2),
            "interest":          round(i / L2C,         2),
            "committed":         round(committed / L2C, 2),
            "total_exp_actuals": round(tot / L2C,       2),
            "share_pct":         share,
        })

    print("-" * 95)
    print("  Salaries = direct pay object codes (GIA-salaries excl.).")
    print("  Priority: pensions (MH 2071) > interest (MH 2049) > salaries (by object code).")

    # --- total_expenditure section: BE-based, for all BE years ---
    te_rows = []
    for fy in fy_with_be:
        tb = total_be[fy]
        if tb == 0.0:
            continue
        cb = sal_be[fy] + pen_be[fy] + int_be[fy]
        te_rows.append({
            "fiscal_year":  fy,
            "total_be":     round(tb / L2C, 2),
            "committed_be": round(cb / L2C, 2),
        })

    _lib.record_result("q2_committed",     q2_rows)
    _lib.record_result("total_expenditure", te_rows)
    print("\nRecorded to out/results_python.json  (keys: q2_committed, total_expenditure)")


if __name__ == "__main__":
    main()
