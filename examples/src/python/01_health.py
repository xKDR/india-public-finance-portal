#!/usr/bin/env python3
"""
01_health.py  —  Q1: Karnataka health spending (BE -> RE -> Actuals) per fiscal year.

Run from repo root OR from examples/:
    python3 examples/src/python/01_health.py

WHAT THIS SHOWS:
  Health spending covers major heads:
    2210  Medical and Public Health
    2211  Family Welfare  (nutrition, immunisation, etc.)

  For each fiscal year we show three numbers:
    BE  (Budget Estimate)    — amount approved by the legislature at year start
    RE  (Revised Estimate)   — mid-year revision after reviewing actual spending
    Actuals                  — what was actually spent

  The canonical source rule means:
    BE for year Y   comes from the Y     budget document  (as-tabled figure)
    RE for year Y   comes from the Y+1   budget document  (looking back 1 year)
    Actuals for Y   comes from the Y+2   budget document  (audited figures)

  The tidy CSV already applies this rule — you just filter and sum.

KEY READING:
  RE/BE < 1  =  budget was cut mid-year (government trimmed health allocation)
  RE/BE > 1  =  budget was increased mid-year (supplementary demand)
  Act/BE < 1 =  actual spending fell short of what was budgeted

The '-' in RE or Actuals columns means no data yet (year is in the future
relative to the latest available document).
"""

import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _lib


def main():
    scope = _lib.load_scope()
    rows  = _lib.load_tidy()

    # Health scope: major heads 2210 and 2211 (revenue only; 4210 capital excluded)
    health_mh = set(scope["health_major_heads"])
    L2C = scope["unit_lakh_to_crore"]  # 100

    # Aggregate health spending by (fiscal_year, measure).
    # Each row in the tidy CSV is already a canonical leaf — just filter and sum.
    health = defaultdict(float)  # (fiscal_year, measure) -> total lakh
    for r in rows:
        if r["major_head_code"] in health_mh:
            health[(r["fiscal_year"], r["measure"])] += r["amount_lakh"]

    # Only show years that have at least a BE (no BE = year outside tabled range)
    fy_with_be = sorted({fy for (fy, m) in health if m == "BE"})

    print("Q1: Karnataka Health Spending — MH 2210 + 2211 — INR crore")
    print("=" * 75)
    print(f"{'Fiscal Year':>12} {'BE':>12} {'RE':>12} {'Actuals':>12} {'RE/BE':>7} {'Act/BE':>7}")
    print("-" * 75)

    result_rows = []
    for fy in fy_with_be:
        be  = health.get((fy, "BE"),      0.0)
        re  = health.get((fy, "RE"),      0.0)
        ac  = health.get((fy, "Actuals"), 0.0)

        be_cr = be / L2C
        re_cr = re / L2C
        ac_cr = ac / L2C

        # Ratios only when both numerator and denominator are non-zero
        re_be_str = f"{re/be:.2f}" if be and re  else "-"
        ac_be_str = f"{ac/be:.2f}" if be and ac  else "-"

        print(
            f"{fy:>12} {be_cr:>12,.2f} {re_cr:>12,.2f} {ac_cr:>12,.2f}"
            f" {re_be_str:>7} {ac_be_str:>7}"
        )

        result_rows.append({
            "fiscal_year": fy,
            "be":      round(be_cr, 2),
            "re":      round(re_cr, 2),
            "actuals": round(ac_cr, 2),
        })

    print("-" * 75)
    print("  RE/BE < 1 = budget cut mid-year.  Act/BE < 1 = under-spent vs original.")
    print("  '-' = no data (future year or outside data range).")

    _lib.record_result("q1_health", result_rows)
    print("\nRecorded to out/results_python.json  (key: q1_health)")


if __name__ == "__main__":
    main()
