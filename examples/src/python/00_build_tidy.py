#!/usr/bin/env python3
"""
B0 Build script — produces the shared tidy CSV and canonical numbers from the package.

Run from repo root:
    python3 examples/src/python/00_build_tidy.py

Reads:
    karnataka-state-finance/years/*/csv/budget_*.csv
    karnataka-state-finance/demand_names.json
    karnataka-state-finance/package_stats.json

Writes:
    examples/data/processed/karnataka_budget_tidy.csv
    examples/data/processed/canonical_numbers.json

KEY DATA RULES (see examples/_spec/README.md for full explanation):
  * Additive-leaf predicate: type_of_table=='object_head' AND row_type=='Data'
      AND row_level=='Object-Head' — only these rows are additive and safe to SUM.
  * Amount columns by PREFIX (not position index):
      accounts_*   -> Actuals for (doc_year - 2)
      budget_estimate_* [first]  -> BE for (doc_year - 1)   [ignored in canonical]
      revised_estimate_*         -> RE for (doc_year - 1)
      budget_estimate_* [second] -> BE for doc_year
  * Canonical source: BE(Y)<-doc Y, RE(Y)<-doc Y+1, Actuals(Y)<-doc Y+2.
  * OCR outlier drop: single-leaf abs(amount_lakh) > 5_000_000 (> Rs 50,000 cr).
  * Blank/zero amounts: no row emitted (missing measure handled gracefully).
"""

import csv
import glob
import json
import os
from collections import defaultdict

# --- paths -------------------------------------------------------------------
_HERE = os.path.abspath(__file__)
# examples/src/python/ -> examples/src/ -> examples/ -> repo_root/
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(_HERE))))
PKG_ROOT = os.path.join(REPO_ROOT, "karnataka-state-finance")
OUT_DIR = os.path.join(REPO_ROOT, "examples", "data", "processed")

# --- constants ---------------------------------------------------------------
LAKH_TO_CRORE = 100.0
OCR_OUTLIER_MAX_LAKH = 5_000_000  # abs(amount_lakh) > this -> OCR error (> Rs 50,000 cr)

HEALTH_MAJOR_HEADS = {"2210", "2211"}
INTEREST_MAJOR_HEAD = "2049"
PENSION_MAJOR_HEAD = "2071"
SALARY_OBJECT_CODES = {"001", "002", "003", "004", "005", "008", "009",
                       "011", "014", "020", "033", "035"}

TIDY_COLS = [
    "document_year", "fiscal_year", "measure", "demand",
    "major_head_code", "major_head_name", "object_head_code",
    "object_head_description", "amount_lakh", "amount_unit",
]

# Canonical source offsets: measure -> (doc_year - fiscal_year)
# i.e., for fiscal year Y, the canonical document is add_fy(Y, -offset)
CANONICAL_OFFSET = {"BE": 0, "RE": -1, "Actuals": -2}


# --- helpers -----------------------------------------------------------------
def add_fy(fy, n):
    """Fiscal-year string arithmetic: '2024-25' + 1 = '2025-26'."""
    start = int(fy.split("-")[0])
    s = start + n
    return f"{s}-{(s + 1) % 100:02d}"


def parse_amt(s):
    """Parse a CSV amount string; return float or 0.0 for blank/dash/missing."""
    if s is None:
        return 0.0
    s = s.replace(",", "").strip()
    if s in ("", "-"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def amount_columns(fieldnames):
    """
    Identify the 4 amount columns by prefix; return (acc, be_old, re_, be_new).

    Positional semantics (from col order in file):
      acc     = Actuals for doc_year - 2
      be_old  = BE for doc_year - 1  (cross-doc QA only; not in canonical tidy)
      re_     = RE for doc_year - 1
      be_new  = BE for doc_year
    """
    acc = [c for c in fieldnames if c.startswith("accounts_")]
    be  = [c for c in fieldnames if c.startswith("budget_estimate_")]
    re_ = [c for c in fieldnames if c.startswith("revised_estimate_")]
    if not (len(acc) == 1 and len(be) == 2 and len(re_) == 1):
        raise ValueError(f"Unexpected amount columns: acc={acc}, be={be}, re={re_}")
    # be is ordered oldest-first in the CSV header, so be[0]=fy-1, be[1]=fy
    return acc[0], be[0], re_[0], be[1]


# --- core loading ------------------------------------------------------------
def build_raw_records():
    """
    Load every year's budget CSV, apply the additive-leaf predicate, and emit
    positional records — one per non-zero (non-blank) measure value.

    Returns (records, outliers, leaf_counts_per_doc).
      records     : list of dicts with TIDY_COLS keys
      outliers    : list of dicts with OCR-dropped entries
      leaf_counts : dict  doc_year -> count of additive-leaf rows in that CSV
    """
    records = []
    outliers = []
    leaf_counts = {}

    files = sorted(glob.glob(os.path.join(PKG_ROOT, "years", "*", "csv", "budget_*.csv")))
    if not files:
        raise FileNotFoundError(f"No budget CSVs found under {PKG_ROOT}/years/")

    for path in files:
        doc_year = os.path.basename(os.path.dirname(os.path.dirname(path)))
        leaf_count = 0

        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            acc_c, be1_c, re_c, be2_c = amount_columns(reader.fieldnames)

            # (measure, fy_offset_from_doc_year, source_column)
            # be1_c contributes BE for fy=doc_year-1 but is NOT canonical (we include
            # it in raw_records so the canonical filter can discard it cleanly).
            mapping = [
                ("Actuals", -2, acc_c),
                ("BE",      -1, be1_c),
                ("RE",      -1, re_c),
                ("BE",       0, be2_c),
            ]

            for row in reader:
                if not (row.get("type_of_table") == "object_head"
                        and row.get("row_type") == "Data"
                        and row.get("row_level") == "Object-Head"):
                    continue
                leaf_count += 1

                common = dict(
                    demand=row.get("demand_number", "").strip(),
                    major_head_code=row.get("major_head_code", "").strip(),
                    major_head_name=row.get("major_head_name", "").strip(),
                    object_head_code=row.get("object_head_code", "").strip(),
                    object_head_description=row.get("object_head_description", "").strip(),
                    amount_unit=row.get("amount_unit", "INR_lakh").strip() or "INR_lakh",
                )

                for measure, offset, col in mapping:
                    amt = parse_amt(row.get(col, ""))
                    if amt == 0.0:
                        continue  # blank/zero -> no row (missing measure)
                    if abs(amt) > OCR_OUTLIER_MAX_LAKH:
                        outliers.append(dict(
                            document_year=doc_year,
                            measure=measure,
                            amount_lakh=amt,
                            source_file=row.get("source_file", ""),
                            page_number=row.get("page_number", ""),
                        ))
                        continue
                    rec = dict(common)
                    rec["document_year"] = doc_year
                    rec["fiscal_year"] = add_fy(doc_year, offset)
                    rec["measure"] = measure
                    rec["amount_lakh"] = amt
                    records.append(rec)

        leaf_counts[doc_year] = leaf_count

    return records, outliers, leaf_counts


def apply_canonical(records):
    """
    Keep only the canonical source per (fiscal_year, measure):
      BE(Y)      <- document Y     (canonical_offset 0)
      RE(Y)      <- document Y+1   (canonical_offset -1)
      Actuals(Y) <- document Y+2   (canonical_offset -2)

    For measure M and fiscal year Y:
      want_doc = add_fy(Y, -CANONICAL_OFFSET[M])
    A record is canonical iff document_year == want_doc.
    """
    out = []
    for r in records:
        want_doc = add_fy(r["fiscal_year"], -CANONICAL_OFFSET[r["measure"]])
        if r["document_year"] == want_doc:
            out.append(r)
    return out


# --- tidy CSV writer ---------------------------------------------------------
def write_tidy_csv(canon_records, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=TIDY_COLS, extrasaction="ignore")
        w.writeheader()
        for r in canon_records:
            w.writerow(r)
    return len(canon_records)


# --- canonical numbers -------------------------------------------------------
def compute_canonical_numbers(canon, demand_names):
    """
    Compute the canonical_numbers dict from canonical records.
    All monetary outputs in INR_crore, rounded to 2 decimals.
    """
    # Aggregate by (fiscal_year, measure)
    fy_m_total    = defaultdict(float)  # (fy, measure) -> total lakh
    health_fy_m   = defaultdict(float)  # (fy, measure) -> health lakh
    demand_fy_m   = defaultdict(float)  # (demand, fy, measure) -> lakh

    # Committed expenditure accumulators
    sal_act  = defaultdict(float)  # fy -> salary actuals lakh
    pen_act  = defaultdict(float)  # fy -> pension actuals lakh
    int_act  = defaultdict(float)  # fy -> interest actuals lakh
    sal_be   = defaultdict(float)  # fy -> salary BE lakh
    pen_be   = defaultdict(float)  # fy -> pension BE lakh
    int_be   = defaultdict(float)  # fy -> interest BE lakh

    for r in canon:
        fy  = r["fiscal_year"]
        m   = r["measure"]
        d   = r["demand"]
        mh  = r["major_head_code"]
        oh  = r["object_head_code"]
        amt = r["amount_lakh"]

        fy_m_total[(fy, m)] += amt

        if mh in HEALTH_MAJOR_HEADS:
            health_fy_m[(fy, m)] += amt

        if d:
            demand_fy_m[(d, fy, m)] += amt

        # Committed: priority pension MH > interest MH > salary OH codes
        if m == "Actuals":
            if mh == PENSION_MAJOR_HEAD:
                pen_act[fy] += amt
            elif mh == INTEREST_MAJOR_HEAD:
                int_act[fy] += amt
            elif oh in SALARY_OBJECT_CODES:
                sal_act[fy] += amt
        elif m == "BE":
            if mh == PENSION_MAJOR_HEAD:
                pen_be[fy] += amt
            elif mh == INTEREST_MAJOR_HEAD:
                int_be[fy] += amt
            elif oh in SALARY_OBJECT_CODES:
                sal_be[fy] += amt

    # Fiscal years with data
    fy_with_be  = sorted({fy for (fy, m) in fy_m_total if m == "BE"})
    fy_with_act = sorted({fy for (fy, m) in fy_m_total if m == "Actuals"})
    fy_health_be = sorted({fy for (fy, m) in health_fy_m if m == "BE"})

    fy_latest_act      = fy_with_act[-1]  if fy_with_act  else None
    fy_first_act       = fy_with_act[0]   if fy_with_act  else None
    fy_latest_health_be = fy_health_be[-1] if fy_health_be else None

    def cr2(x):
        return round(x / LAKH_TO_CRORE, 2)

    # --- onboarding ----------------------------------------------------------
    # Top 5 departments by latest Actuals
    demands_latest_act = {
        d: demand_fy_m[(d, fy_latest_act, "Actuals")]
        for d in demand_names
        if demand_fy_m[(d, fy_latest_act, "Actuals")] > 0
    }
    top5 = sorted(demands_latest_act.items(), key=lambda kv: kv[1], reverse=True)[:5]
    top5_rows = [
        {"demand": d, "name": demand_names[d]["name"], "amount": cr2(amt)}
        for d, amt in top5
    ]

    health_be_latest = health_fy_m.get((fy_latest_health_be, "BE"), 0.0)
    total_act_latest = fy_m_total.get((fy_latest_act, "Actuals"), 0.0)
    total_be_for_act = fy_m_total.get((fy_latest_act, "BE"), 0.0)
    ratio = round(total_act_latest / total_be_for_act, 4) if total_be_for_act else 0.0

    onboarding = {
        "top5_departments_latest_actuals": {
            "fiscal_year": fy_latest_act,
            "rows": top5_rows,
        },
        "health_be_latest": {
            "fiscal_year": fy_latest_health_be,
            "amount": cr2(health_be_latest),
        },
        "spend_vs_budget": {
            "fiscal_year": fy_latest_act,
            "actuals": cr2(total_act_latest),
            "be": cr2(total_be_for_act),
            "ratio": ratio,
        },
    }

    # --- q1_health -----------------------------------------------------------
    q1_rows = []
    for fy in sorted({fy for (fy, m) in health_fy_m if m == "BE"}):
        be = health_fy_m.get((fy, "BE"), 0.0)
        if be == 0.0:
            continue
        q1_rows.append({
            "fiscal_year": fy,
            "be":      cr2(be),
            "re":      cr2(health_fy_m.get((fy, "RE"),      0.0)),
            "actuals": cr2(health_fy_m.get((fy, "Actuals"), 0.0)),
        })

    # --- q2_committed --------------------------------------------------------
    q2_rows = []
    for fy in fy_with_act:
        sal  = sal_act.get(fy, 0.0)
        pen  = pen_act.get(fy, 0.0)
        intr = int_act.get(fy, 0.0)
        committed  = sal + pen + intr
        total_act  = fy_m_total.get((fy, "Actuals"), 0.0)
        share = round(100 * committed / total_act, 2) if total_act else 0.0
        q2_rows.append({
            "fiscal_year":       fy,
            "salaries":          cr2(sal),
            "pensions":          cr2(pen),
            "interest":          cr2(intr),
            "committed":         cr2(committed),
            "total_exp_actuals": cr2(total_act),
            "share_pct":         share,
        })

    # --- q3_demand -----------------------------------------------------------
    q3_rows = []
    for d_num in sorted(demand_names.keys()):
        first_act  = demand_fy_m.get((d_num, fy_first_act,  "Actuals"), 0.0)
        latest_act = demand_fy_m.get((d_num, fy_latest_act, "Actuals"), 0.0)
        latest_be  = demand_fy_m.get((d_num, fy_latest_act, "BE"),      0.0)
        if first_act == 0.0 and latest_act == 0.0 and latest_be == 0.0:
            continue  # skip demands with no data at all
        act_be = round(latest_act / latest_be, 10) if latest_be else 0.0
        q3_rows.append({
            "demand":         d_num,
            "name":           demand_names[d_num]["name"],
            "first_actuals":  cr2(first_act),
            "latest_actuals": cr2(latest_act),
            "latest_be":      cr2(latest_be),
            "act_be":         act_be,
        })
    q3_rows.sort(key=lambda r: r["latest_actuals"], reverse=True)

    q3 = {
        "fiscal_year_first":  fy_first_act,
        "fiscal_year_latest": fy_latest_act,
        "rows": q3_rows,
    }

    # --- total_expenditure ---------------------------------------------------
    te_rows = []
    for fy in fy_with_be:
        total_be = fy_m_total.get((fy, "BE"), 0.0)
        if total_be == 0.0:
            continue
        comm_be = (sal_be.get(fy, 0.0) + pen_be.get(fy, 0.0) + int_be.get(fy, 0.0))
        te_rows.append({
            "fiscal_year":  fy,
            "total_be":     cr2(total_be),
            "committed_be": cr2(comm_be),
        })

    return {
        "unit": "INR_crore",
        "tolerance_crore": 0.01,
        "onboarding": onboarding,
        "q1_health": q1_rows,
        "q2_committed": q2_rows,
        "q3_demand": q3,
        "total_expenditure": te_rows,
    }


# --- main --------------------------------------------------------------------
def main():
    print("B0 Build: Karnataka Budget Tidy + Canonical Numbers")
    print("=" * 62)

    # Load demand names
    dn_path = os.path.join(PKG_ROOT, "demand_names.json")
    with open(dn_path, encoding="utf-8") as f:
        demand_names = json.load(f)["demands"]

    # Load package stats for leaf-count verification
    ps_path = os.path.join(PKG_ROOT, "package_stats.json")
    with open(ps_path, encoding="utf-8") as f:
        per_year = json.load(f).get("per_year", {})

    # 1. Load raw leaf records
    print("\n[1/4] Loading raw leaf records...")
    raw_records, outliers, leaf_counts = build_raw_records()
    n_docs = len(leaf_counts)
    print(f"  {len(raw_records):,} raw positional records from {n_docs} documents")
    print(f"  OCR outliers dropped: {len(outliers)}")
    for o in outliers:
        print(f"    doc={o['document_year']} {o['measure']}"
              f"  Rs {o['amount_lakh']/LAKH_TO_CRORE:,.0f} cr"
              f"  src={o['source_file']} p.{o['page_number']}")

    # 2. Per-year leaf count vs package_stats
    print("\n[2/4] Per-year leaf count vs package_stats (json_budget_leaves):")
    all_ok = True
    for yr in sorted(per_year.keys()):
        expected = per_year[yr]["json_budget_leaves"]
        actual   = leaf_counts.get(yr, 0)
        status   = "OK" if actual == expected else "MISMATCH"
        if status == "MISMATCH":
            all_ok = False
        print(f"  {yr}: csv={actual:,}  pkg={expected:,}  [{status}]")
    if all_ok:
        print("  All leaf counts match.")
    else:
        print("  WARNING: some leaf counts differ — investigate.")

    # 3. Apply canonical filter
    print("\n[3/4] Applying canonical filter...")
    canon = apply_canonical(raw_records)
    print(f"  {len(canon):,} canonical records (from {len(raw_records):,} raw)")

    # 4. Write tidy CSV
    tidy_path = os.path.join(OUT_DIR, "karnataka_budget_tidy.csv")
    n_rows = write_tidy_csv(canon, tidy_path)
    print(f"  Written: {tidy_path}  ({n_rows:,} rows)")

    # 5. Compute + write canonical_numbers.json
    print("\n[4/4] Computing canonical numbers...")
    cn = compute_canonical_numbers(canon, demand_names)
    cn_path = os.path.join(OUT_DIR, "canonical_numbers.json")
    with open(cn_path, "w", encoding="utf-8") as f:
        json.dump(cn, f, indent=2)
    print(f"  Written: {cn_path}")

    # --- Sanity checks -------------------------------------------------------
    print("\n--- Sanity checks ---")
    q1_idx = {r["fiscal_year"]: r for r in cn["q1_health"]}
    te_idx = {r["fiscal_year"]: r for r in cn["total_expenditure"]}
    if "2024-25" in q1_idx:
        print(f"  q1 health 2024-25 BE:      {q1_idx['2024-25']['be']:>12,.2f} cr  (expect ~15046.69)")
        print(f"  q1 health 2024-25 Actuals: {q1_idx['2024-25']['actuals']:>12,.2f} cr  (expect ~12771.07)")
    if "2024-25" in te_idx:
        print(f"  total_be 2024-25:          {te_idx['2024-25']['total_be']:>12,.2f} cr  (expect ~370658.45)")

    ob = cn["onboarding"]
    print(f"\n  health_be_latest ({ob['health_be_latest']['fiscal_year']}): "
          f"{ob['health_be_latest']['amount']:,.2f} cr")
    print(f"  spend_vs_budget ({ob['spend_vs_budget']['fiscal_year']}): "
          f"actuals={ob['spend_vs_budget']['actuals']:,.2f} cr  "
          f"be={ob['spend_vs_budget']['be']:,.2f} cr  "
          f"ratio={ob['spend_vs_budget']['ratio']:.4f}")
    print(f"  top5 departments ({ob['top5_departments_latest_actuals']['fiscal_year']}):")
    for row in ob["top5_departments_latest_actuals"]["rows"]:
        print(f"    {row['demand']:>3}  {row['name']:<42} {row['amount']:>12,.2f} cr")

    print("\nDone.")


if __name__ == "__main__":
    main()
