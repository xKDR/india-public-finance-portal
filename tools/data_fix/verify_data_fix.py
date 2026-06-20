#!/usr/bin/env python3
"""
verify_data_fix.py — Gate verification for Task A2.

Two modes:
  --snapshot  Capture pre-transform baseline (run BEFORE relabel_and_annotate.py).
  --verify    Check all 4 gate conditions (run AFTER relabel_and_annotate.py).

Gates:
  1. Counts unchanged vs package_stats.json.
  2. Every numeric value byte-identical (pre/post comparison via hashes).
  3. Label truth (CSV headers + ndjson fiscal_year sets).
  4. Canary: 2024-25 additive-leaf col4 sum ≈ 37,065,844 INR_lakh (±0.1%).
  + Consistency: checks-CSV labels == checks-NDJSON labels (per year, per position).

Run from repo root:
    python3 tools/data_fix/verify_data_fix.py --snapshot
    python3 tools/data_fix/relabel_and_annotate.py
    python3 tools/data_fix/verify_data_fix.py --verify
"""

import csv
import hashlib
import json
import os
import sys

YEARS = [
    "2016-17", "2017-18", "2018-19", "2019-20", "2020-21",
    "2021-22", "2022-23", "2023-24", "2024-25", "2025-26", "2026-27",
]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# tools/data_fix/ -> tools/ -> repo root -> karnataka-state-finance/
PKG_ROOT = os.path.join(os.path.dirname(os.path.dirname(SCRIPT_DIR)), "karnataka-state-finance")
SNAPSHOT_PATH = os.path.join(SCRIPT_DIR, "baseline_snapshot.json")
CANARY_YEAR = "2024-25"
CANARY_EXPECTED_LAKH = 37_065_844  # INR_lakh
CANARY_TOLERANCE = 0.001  # 0.1%


# ── file-path helpers ─────────────────────────────────────────────────────────

def csv_path(Y, kind):
    return os.path.join(PKG_ROOT, "years", Y, "csv", f"{kind}_{Y}.csv")


def ndjson_path(Y, kind):
    return os.path.join(PKG_ROOT, "years", Y, "json", f"{kind}_{Y}.ndjson")


# ── hashing helpers ───────────────────────────────────────────────────────────

def _sha256_of_values(values):
    """SHA256 of repr(v) for each v in values, joined by '|'."""
    blob = "|".join(repr(v) for v in values)
    return hashlib.sha256(blob.encode()).hexdigest()


def budget_csv_amount_positions(path):
    """
    Return (col_indices, count) where col_indices is the 0-based indices of the
    4 amount columns (by prefix matching), and count is the number of data rows.
    Works on both pre-transform (without document_year) and post-transform (with it).
    """
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        headers = next(reader)
        # Find the 4 amount column positions by prefix
        acc = [i for i, h in enumerate(headers) if h.startswith("accounts_")]
        be = [i for i, h in enumerate(headers) if h.startswith("budget_estimate_")]
        re_ = [i for i, h in enumerate(headers) if h.startswith("revised_estimate_")]
        assert len(acc) == 1 and len(be) == 2 and len(re_) == 1, \
            f"unexpected columns: {acc} {be} {re_} in {path}"
        indices = [acc[0], be[0], re_[0], be[1]]
        rows = list(reader)
    return indices, len(rows), headers, rows


def hash_budget_csv_amounts(path):
    """Hash of all 4 positional amount values per row (pre or post transform)."""
    indices, count, headers, rows = budget_csv_amount_positions(path)
    values = []
    for row in rows:
        for idx in indices:
            values.append(row[idx] if idx < len(row) else "")
    return _sha256_of_values(values), count * 4


def collect_all_ndjson_amounts(obj):
    """Recursively collect all amounts[].value from a nested dict/list."""
    values = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "amounts" and isinstance(v, list):
                for a in v:
                    values.append(a.get("value"))
            else:
                values.extend(collect_all_ndjson_amounts(v))
    elif isinstance(obj, list):
        for item in obj:
            values.extend(collect_all_ndjson_amounts(item))
    return values


def hash_ndjson_amounts(path):
    """Hash of all amounts[].value in file order."""
    values = []
    count = 0
    with open(path, encoding="utf-8") as f:
        for line in f:
            count += 1
            doc = json.loads(line)
            values.extend(collect_all_ndjson_amounts(doc))
    return _sha256_of_values(values), len(values), count


# ── snapshot capture ──────────────────────────────────────────────────────────

def capture_snapshot():
    print("Capturing pre-transform baseline snapshot...")
    snap = {"csv_amounts": {}, "ndjson_amounts": {}}

    for Y in YEARS:
        # Budget CSV amounts
        path = csv_path(Y, "budget")
        h, cnt = hash_budget_csv_amounts(path)
        snap["csv_amounts"][Y] = {"hash": h, "value_count": cnt}
        print(f"  {Y} budget CSV: {cnt} amount values hashed")

        # NDJSON files
        for kind in ["budget_leaves", "summaries", "budget_nodes", "checks"]:
            p = ndjson_path(Y, kind)
            h, vcnt, lcnt = hash_ndjson_amounts(p)
            snap["ndjson_amounts"][f"{kind}_{Y}"] = {
                "hash": h, "value_count": vcnt, "line_count": lcnt
            }
        print(f"  {Y} ndjson hashed")

    with open(SNAPSHOT_PATH, "w") as f:
        json.dump(snap, f, indent=2)
    print(f"\nSnapshot saved to {SNAPSHOT_PATH}")


# ── fiscal-year truth helpers (for gate 3) ────────────────────────────────────

def fy(start, end_offset=1):
    return f"{start}-{(start + end_offset) % 100:02d}"


def expected_amount_headers(y):
    return [
        f"accounts_{y - 2}_{(y - 1) % 100:02d}_amount",
        f"budget_estimate_{y - 1}_{y % 100:02d}_amount",
        f"revised_estimate_{y - 1}_{y % 100:02d}_amount",
        f"budget_estimate_{y}_{(y + 1) % 100:02d}_amount",
    ]


def expected_leaves_fy_set(y):
    """Set of (measure, fiscal_year) expected in budget_leaves for doc year y."""
    return {
        ("accounts", fy(y - 2)),
        ("budget_estimate", fy(y - 1)),
        ("revised_estimate", fy(y - 1)),
        ("budget_estimate", fy(y)),
    }


# ── gate checks ───────────────────────────────────────────────────────────────

def gate1_counts(snap):
    """Gate 1: row/line counts match package_stats.json."""
    stats_path = os.path.join(PKG_ROOT, "package_stats.json")
    with open(stats_path) as f:
        stats = json.load(f)

    failures = []
    for Y in YEARS:
        expected = stats["per_year"][Y]

        # Budget CSV data rows
        _, csv_cnt, _, _ = budget_csv_amount_positions(csv_path(Y, "budget"))
        if csv_cnt != expected["budget_rows"]:
            failures.append(f"{Y} budget CSV: got {csv_cnt}, expected {expected['budget_rows']}")

        # Checks CSV data rows
        with open(csv_path(Y, "checks"), newline="", encoding="utf-8") as f:
            chk_cnt = sum(1 for _ in f) - 1  # subtract header
        if chk_cnt != expected["check_rows"]:
            failures.append(f"{Y} checks CSV: got {chk_cnt}, expected {expected['check_rows']}")

        # NDJSON line counts
        for kind, key in [
            ("budget_leaves", "json_budget_leaves"),
            ("budget_nodes", "json_budget_nodes"),
            ("checks", "json_checks"),
            ("summaries", "json_summaries"),
        ]:
            # Read from snapshot (pre-transform) for the line count
            snap_key = f"{kind}_{Y}"
            actual = snap["ndjson_amounts"][snap_key]["line_count"]
            if actual != expected[key]:
                failures.append(f"{Y} {kind} ndjson: got {actual}, expected {expected[key]}")

    return failures


def gate2_numeric_values(snap):
    """Gate 2: all numeric values byte-identical pre/post."""
    failures = []
    total_csv_values = 0
    total_ndjson_values = 0

    for Y in YEARS:
        # Budget CSV
        h_post, cnt = hash_budget_csv_amounts(csv_path(Y, "budget"))
        h_pre = snap["csv_amounts"][Y]["hash"]
        cnt_pre = snap["csv_amounts"][Y]["value_count"]
        total_csv_values += cnt
        if h_post != h_pre:
            failures.append(f"{Y} budget CSV amounts hash mismatch (pre={h_pre[:8]}, post={h_post[:8]})")
        if cnt != cnt_pre:
            failures.append(f"{Y} budget CSV value count changed: {cnt_pre} -> {cnt}")

        # NDJSON files
        for kind in ["budget_leaves", "summaries", "budget_nodes", "checks"]:
            p = ndjson_path(Y, kind)
            h_post_nd, vcnt, lcnt = hash_ndjson_amounts(p)
            snap_key = f"{kind}_{Y}"
            h_pre_nd = snap["ndjson_amounts"][snap_key]["hash"]
            vcnt_pre = snap["ndjson_amounts"][snap_key]["value_count"]
            total_ndjson_values += vcnt
            if h_post_nd != h_pre_nd:
                failures.append(f"{Y} {kind} ndjson value hash mismatch")
            if vcnt != vcnt_pre:
                failures.append(f"{Y} {kind} ndjson value count changed: {vcnt_pre} -> {vcnt}")

    return failures, total_csv_values, total_ndjson_values


def gate3_label_truth():
    """Gate 3: CSV headers and ndjson fiscal_years match positional truth."""
    failures = []

    for Y in YEARS:
        y = int(Y[:4])
        expected_hdrs = expected_amount_headers(y)

        # CSV: check 4 amount column headers at expected positions
        _, _, headers, _ = budget_csv_amount_positions(csv_path(Y, "budget"))
        # After transform, document_year is first so amount cols shift by 1
        # But budget_csv_amount_positions finds them by prefix, so order is maintained
        acc = [h for h in headers if h.startswith("accounts_")]
        be = [h for h in headers if h.startswith("budget_estimate_")]
        re_ = [h for h in headers if h.startswith("revised_estimate_")]
        actual_hdrs = [acc[0], be[0], re_[0], be[1]]
        if actual_hdrs != expected_hdrs:
            failures.append(f"{Y} CSV headers: got {actual_hdrs}, expected {expected_hdrs}")

        # NDJSON budget_leaves: distinct (measure, fiscal_year) set
        expected_set = expected_leaves_fy_set(y)
        actual_set = set()
        with open(ndjson_path(Y, "budget_leaves"), encoding="utf-8") as f:
            for line in f:
                doc = json.loads(line)
                for a in doc.get("amounts", []):
                    actual_set.add((a["measure"], a["fiscal_year"]))
        if actual_set != expected_set:
            failures.append(
                f"{Y} budget_leaves fiscal_year set mismatch:\n"
                f"  expected: {sorted(expected_set)}\n"
                f"  actual:   {sorted(actual_set)}"
            )

    return failures


def gate4_canary():
    """Gate 4: 2024-25 additive-leaf col4 sum ≈ 37,065,844 INR_lakh."""
    path = csv_path(CANARY_YEAR, "budget")
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        be2_cols = [c for c in reader.fieldnames if c.startswith("budget_estimate_")]
        assert len(be2_cols) == 2, f"Expected 2 budget_estimate cols, got {be2_cols}"
        be2_col = be2_cols[1]  # second one = BE(T) = col4

        total = 0.0
        for row in reader:
            if (row.get("type_of_table") == "object_head"
                    and row.get("row_type") == "Data"
                    and row.get("row_level") == "Object-Head"):
                val = row.get(be2_col, "").replace(",", "").strip()
                try:
                    total += float(val) if val and val != "-" else 0.0
                except ValueError:
                    pass

    rel_err = abs(total - CANARY_EXPECTED_LAKH) / CANARY_EXPECTED_LAKH
    passed = rel_err <= CANARY_TOLERANCE
    return passed, total, rel_err


# ── consistency check ─────────────────────────────────────────────────────────

def check_csv_ndjson_label_consistency():
    """
    Assert that, for every year, every checks-CSV financial_column_label value
    equals the corresponding checks-NDJSON financial_column.label for the same
    (year, position). Covers all 11 years.
    """
    failures = []
    for Y in YEARS:
        # Collect CSV labels by position
        csv_labels = {}
        with open(csv_path(Y, "checks"), newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                pos = row.get("financial_column_position")
                label = row.get("financial_column_label")
                if pos and pos not in csv_labels:
                    csv_labels[pos] = label

        # Collect NDJSON labels by position
        ndjson_labels = {}
        with open(ndjson_path(Y, "checks"), encoding="utf-8") as f:
            for line in f:
                doc = json.loads(line)
                fc = doc.get("financial_column", {})
                pos = str(fc.get("position", ""))
                label = fc.get("label")
                if pos and pos not in ndjson_labels:
                    ndjson_labels[pos] = label

        # Compare
        all_positions = set(csv_labels.keys()) | set(ndjson_labels.keys())
        for pos in sorted(all_positions):
            csv_lbl = csv_labels.get(pos)
            ndjson_lbl = ndjson_labels.get(pos)
            if csv_lbl != ndjson_lbl:
                failures.append(
                    f"{Y} pos {pos}: CSV='{csv_lbl}' vs NDJSON='{ndjson_lbl}'"
                )

    return failures


# ── main ──────────────────────────────────────────────────────────────────────

def run_verify():
    if not os.path.exists(SNAPSHOT_PATH):
        print(f"ERROR: Snapshot not found at {SNAPSHOT_PATH}")
        print("Run with --snapshot first.")
        sys.exit(1)

    with open(SNAPSHOT_PATH) as f:
        snap = json.load(f)

    all_pass = True
    print("=" * 72)
    print("GATE 1: Counts unchanged")
    print("=" * 72)
    g1_failures = gate1_counts(snap)
    if g1_failures:
        all_pass = False
        for f_ in g1_failures:
            print(f"  FAIL: {f_}")
    else:
        print("  PASS: all row/line counts match package_stats.json")

    print()
    print("=" * 72)
    print("GATE 2: Every numeric value byte-identical")
    print("=" * 72)
    g2_failures, csv_vals, ndjson_vals = gate2_numeric_values(snap)
    if g2_failures:
        all_pass = False
        for f_ in g2_failures:
            print(f"  FAIL: {f_}")
    else:
        print(f"  PASS: {csv_vals:,} CSV amount values unchanged; {ndjson_vals:,} NDJSON values unchanged")

    print()
    print("=" * 72)
    print("GATE 3: Label truth")
    print("=" * 72)
    g3_failures = gate3_label_truth()
    if g3_failures:
        all_pass = False
        for f_ in g3_failures:
            print(f"  FAIL: {f_}")
    else:
        print("  PASS: all CSV amount headers and ndjson fiscal_year sets match positional truth")

    print()
    print("=" * 72)
    print("GATE 4: Canary (2024-25 additive-leaf col4 sum)")
    print("=" * 72)
    g4_pass, canary_total, canary_err = gate4_canary()
    canary_cr = canary_total / 100
    print(f"  Computed col4 sum: {canary_total:,.0f} INR_lakh ({canary_cr:,.0f} cr)")
    print(f"  Expected:          {CANARY_EXPECTED_LAKH:,} INR_lakh ({CANARY_EXPECTED_LAKH / 100:,.0f} cr)")
    print(f"  Relative error:    {canary_err * 100:.4f}% (tolerance: 0.1%)")
    if g4_pass:
        print("  PASS")
    else:
        all_pass = False
        print("  FAIL: canary sum out of tolerance")

    print()
    print("=" * 72)
    print("CONSISTENCY: checks-CSV labels == checks-NDJSON labels (per year, per position)")
    print("=" * 72)
    g_consistency_failures = check_csv_ndjson_label_consistency()
    if g_consistency_failures:
        all_pass = False
        for f_ in g_consistency_failures:
            print(f"  FAIL: {f_}")
    else:
        print("  PASS: checks-CSV financial_column_label == checks-NDJSON financial_column.label"
              " for all years and positions")

    print()
    print("=" * 72)
    if all_pass:
        print("ALL 4 GATE CHECKS + CONSISTENCY CHECK PASS")
    else:
        print("GATE CHECKS FAILED — do not commit")
    print("=" * 72)
    sys.exit(0 if all_pass else 1)


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("--snapshot", "--verify"):
        print("Usage: verify_data_fix.py --snapshot | --verify")
        sys.exit(1)
    if sys.argv[1] == "--snapshot":
        capture_snapshot()
    else:
        run_verify()


if __name__ == "__main__":
    main()
