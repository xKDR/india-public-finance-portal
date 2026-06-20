#!/usr/bin/env python3
"""
check_reconcile.py — cross-language reconciliation harness.

Asserts that the three language tracks produce identical numbers, all matching
the canonical fixture:

    data/processed/canonical_numbers.json   (the single source of truth, from B0)
    out/results_python.json                  (B2)
    out/results_r.json                       (B3)
    out/results_sql.json                     (B4)

Every numeric value in each results file must agree with the canonical value
within `tolerance_crore` (declared inside canonical_numbers.json). Prints a
PASS/FAIL table (per language: numeric values compared, max abs diff, mismatches)
and exits non-zero if any language is missing or any value is out of tolerance.

Run:  python3 examples/src/check_reconcile.py
(invoked by `make reproduce`). Pure stdlib.
"""

import json
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
EXAMPLES = os.path.dirname(_HERE)                      # examples/
CANON = os.path.join(EXAMPLES, "data", "processed", "canonical_numbers.json")
OUT = os.path.join(EXAMPLES, "out")
LANGS = ("python", "r", "sql")

# Keys that are labels/metadata, not comparable monetary numbers.
_SKIP_KEYS = {
    "unit", "tolerance_crore", "name", "demand", "fiscal_year",
    "fiscal_year_first", "fiscal_year_latest", "level",
}


def flatten(obj, prefix=""):
    """Flatten nested dict/list into {dotted_path: number}, keeping only numbers."""
    out = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in _SKIP_KEYS:
                continue
            out.update(flatten(v, f"{prefix}.{k}"))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            out.update(flatten(v, f"{prefix}[{i}]"))
    elif isinstance(obj, bool):
        pass  # not a monetary value
    elif isinstance(obj, (int, float)):
        out[prefix] = float(obj)
    return out


def main():
    if not os.path.exists(CANON):
        print(f"FAIL: canonical fixture missing: {CANON}", file=sys.stderr)
        print("      run `make build` first.", file=sys.stderr)
        return 2
    canon = json.load(open(CANON))
    tol = float(canon.get("tolerance_crore", 0.01))
    cflat = flatten(canon)

    print(f"Reconciliation vs {os.path.relpath(CANON, EXAMPLES)} "
          f"(tolerance {tol} cr, {len(cflat)} numeric values)")
    print(f"{'language':>10} {'compared':>9} {'max_abs_diff':>13} {'mismatch':>9}  result")
    print("-" * 56)

    ok = True
    for lang in LANGS:
        path = os.path.join(OUT, f"results_{lang}.json")
        if not os.path.exists(path):
            print(f"{lang:>10} {'-':>9} {'-':>13} {'-':>9}  MISSING ({path})")
            ok = False
            continue
        rflat = flatten(json.load(open(path)))
        keys = set(cflat) | set(rflat)
        maxd, nbad = 0.0, 0
        for k in keys:
            a, b = cflat.get(k), rflat.get(k)
            if a is None or b is None:
                nbad += 1
                continue
            d = abs(a - b)
            maxd = max(maxd, d)
            if d > tol:
                nbad += 1
        passed = (nbad == 0 and maxd <= tol)
        ok = ok and passed
        print(f"{lang:>10} {len(rflat):>9} {maxd:>13.6f} {nbad:>9}  "
              f"{'PASS' if passed else 'FAIL'}")

    print("-" * 56)
    if ok:
        print("RECONCILE PASS — Python == R == DuckDB == canonical.")
        return 0
    print("RECONCILE FAIL — see rows above.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
