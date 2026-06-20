#!/usr/bin/env python3
"""
Worked examples for the Karnataka budget package (v0.2.0-draft).

Three example analyses that double as a "how to use this data" tutorial:
  Q1  Health spending: Budget Estimate (BE) -> Revised Estimate (RE) -> Actuals, per fiscal year.
  Q2  Committed expenditure (salaries + pensions + interest) and its share of total expenditure.
  Q3  Variation by demand head (the 29 grants).

Dependency-free (stdlib only). Run from the package root:
    python3 examples/budget_examples.py

KEY DATA RULES applied here (see README.md / known_caveats.md):
  * Additive-leaf predicate: only sum rows where
      type_of_table == 'object_head' AND row_type == 'Data' AND row_level == 'Object-Head'.
    Total/Header/summary rows repeat lower-level amounts and would double-count.
  * The 4 amount columns are POSITIONAL, not to be trusted by name:
      col1 = Actuals(T-2), col2 = BE(T-1), col3 = RE(T-1), col4 = BE(T),  where T = the folder/document year.
    Files 2016-17..2022-23 carry identical (wrong) column labels, so we read by position
    and re-derive the true fiscal year from the document year. Files 2023-24+ happen to be
    labelled correctly; reading by position handles both uniformly.
  * Canonical source per (fiscal_year, measure):
      BE(Y)      <- document Y      (col4)
      RE(Y)      <- document Y+1    (col3)
      Actuals(Y) <- document Y+2    (col1)
    (BE also appears in document Y+1 col2; we use document Y as the as-tabled figure and
     report the cross-document gap as a QA check.)
  * Amounts are INR_lakh (uncertified). Printed here in Rs crore (= lakh / 100), draft.
"""

import csv
import glob
import os
from collections import defaultdict

PKG_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAKH_TO_CRORE = 100.0

# --- scope decisions (locked with the user) -------------------------------------------
HEALTH_MAJOR_HEADS = {"2210", "2211"}            # revenue only (no 4210 capital)
INTEREST_MAJOR_HEAD = "2049"                      # interest taken once, via major head
PENSION_MAJOR_HEAD = "2071"                       # employee pensions, via major head
# Direct salary object codes; grants-in-aid (101) and GIA-pensions (118) EXCLUDED per decision.
SALARY_OBJECT_CODES = {"001", "002", "003", "004", "005", "008", "009",
                       "011", "014", "020", "033", "035"}


def add_fy(fy, n):
    """'2024-25' + n years -> '2026-27' (fiscal-year string arithmetic)."""
    start = int(fy.split("-")[0])
    s = start + n
    return f"{s}-{(s + 1) % 100:02d}"


def parse_amt(s):
    if s is None:
        return 0.0
    s = s.replace(",", "").strip()
    if s == "" or s == "-":
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def amount_columns(fieldnames):
    """Return the 4 amount columns IN FILE ORDER: [accounts, BE(T-1), RE(T-1), BE(T)]."""
    acc = [c for c in fieldnames if c.startswith("accounts_")]
    be = [c for c in fieldnames if c.startswith("budget_estimate_")]
    re_ = [c for c in fieldnames if c.startswith("revised_estimate_")]
    assert len(acc) == 1 and len(be) == 2 and len(re_) == 1, f"unexpected columns: {acc} {be} {re_}"
    return acc[0], be[0], re_[0], be[1]


def build_records():
    """Load every year's budget CSV, keep only additive leaf rows, emit positional records.

    Each record: (document_year, fiscal_year, measure, demand, mh_code, mh_name, oh_code, amount)
    """
    records = []
    outliers = []
    files = sorted(glob.glob(os.path.join(PKG_ROOT, "years", "*", "csv", "budget_*.csv")))
    for path in files:
        doc_year = os.path.basename(os.path.dirname(os.path.dirname(path)))  # e.g. 2024-25
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            acc_c, be1_c, re_c, be2_c = amount_columns(reader.fieldnames)
            # (measure, fiscal_year offset relative to doc_year, source column)
            mapping = [
                ("Actuals", -2, acc_c),
                ("BE", -1, be1_c),
                ("RE", -1, re_c),
                ("BE", 0, be2_c),
            ]
            for row in reader:
                if not (row["type_of_table"] == "object_head"
                        and row["row_type"] == "Data"
                        and row["row_level"] == "Object-Head"):
                    continue
                common = dict(
                    demand=row["demand_number"].strip(),
                    mh_code=row["major_head_code"].strip(),
                    mh_name=row["major_head_name"].strip(),
                    oh_code=row["object_head_code"].strip(),
                )
                for measure, off, col in mapping:
                    amt = parse_amt(row.get(col, ""))
                    if amt == 0.0:
                        continue
                    # Drop implausible single-leaf values (> Rs 50,000 cr) -- OCR errors per
                    # known_caveats.md (e.g. 2022-23 expvol_1 p.153). Recorded for the QA report.
                    if abs(amt) > 5_000_000:
                        outliers.append((doc_year, measure, amt, row.get("source_file", ""),
                                         row.get("page_number", "")))
                        continue
                    rec = dict(common)
                    rec.update(document_year=doc_year,
                               fiscal_year=add_fy(doc_year, off),
                               measure=measure,
                               amount=amt)
                    records.append(rec)
    return records, outliers


def canonical(records):
    """Keep only the canonical source per (fiscal_year, measure): BE<-Y, RE<-Y+1, Actuals<-Y+2."""
    offset = {"BE": 0, "RE": -1, "Actuals": -2}  # document_year = fiscal_year + (-offset)
    out = []
    for r in records:
        want_doc = add_fy(r["fiscal_year"], -offset[r["measure"]])
        if r["document_year"] == want_doc:
            out.append(r)
    return out


def cr(x):
    return x / LAKH_TO_CRORE


def fmt(x):
    return f"{cr(x):>12,.1f}"


# --------------------------------------------------------------------------------------
def q1_health(canon):
    print("\n" + "=" * 78)
    print("Q1  HEALTH (revenue: major heads 2210 + 2211) -- BE vs RE vs Actuals, Rs crore")
    print("=" * 78)
    agg = defaultdict(lambda: defaultdict(float))  # fy -> measure -> amt
    for r in canon:
        if r["mh_code"] in HEALTH_MAJOR_HEADS:
            agg[r["fiscal_year"]][r["measure"]] += r["amount"]
    print(f"{'fiscal_year':>12} {'BE':>12} {'RE':>12} {'Actuals':>12} {'RE/BE':>7} {'Act/BE':>7}")
    for fy in sorted(agg):
        be, re_, ac = agg[fy]["BE"], agg[fy]["RE"], agg[fy]["Actuals"]
        if be == 0.0:  # show only years with an as-tabled budget estimate
            continue
        re_be = f"{re_/be:.2f}" if be else "  -"
        ac_be = f"{ac/be:.2f}" if be and ac else "  -"
        print(f"{fy:>12} {fmt(be)} {fmt(re_)} {fmt(ac)} {re_be:>7} {ac_be:>7}")
    print("  RE/BE < 1 = budget trimmed mid-year; Act/BE < 1 = under-spent vs original budget.")


def q2_committed(canon):
    print("\n" + "=" * 78)
    print("Q2  COMMITTED EXPENDITURE (salaries + pensions[2071] + interest[2049]), Rs crore")
    print("=" * 78)
    # per fiscal year, by component, plus total expenditure for the share
    sal = defaultdict(float)
    pen = defaultdict(float)
    intr = defaultdict(float)
    total = defaultdict(float)
    for r in canon:
        if r["measure"] != "Actuals":
            continue
        fy = r["fiscal_year"]
        total[fy] += r["amount"]
        if r["mh_code"] == PENSION_MAJOR_HEAD:
            pen[fy] += r["amount"]
        elif r["mh_code"] == INTEREST_MAJOR_HEAD:
            intr[fy] += r["amount"]
        elif r["oh_code"] in SALARY_OBJECT_CODES:
            sal[fy] += r["amount"]
    print("  (Actuals basis; years with complete actuals only)")
    print(f"{'fiscal_year':>12} {'Salaries':>12} {'Pensions':>12} {'Interest':>12} {'Committed':>12} {'TotalExp':>12} {'%share':>7}")
    for fy in sorted(total):
        c = sal[fy] + pen[fy] + intr[fy]
        share = f"{100*c/total[fy]:.1f}%" if total[fy] else "  -"
        print(f"{fy:>12} {fmt(sal[fy])} {fmt(pen[fy])} {fmt(intr[fy])} {fmt(c)} {fmt(total[fy])} {share:>7}")
    print("  Salaries = direct pay object codes (GIA-salaries excluded). Interest/pensions via major head (no double count).")


DEMAND_TOP_N = 12


def q3_by_demand(canon):
    print("\n" + "=" * 78)
    print(f"Q3  VARIATION BY DEMAND HEAD -- top {DEMAND_TOP_N} demands by latest Actuals, Rs crore")
    print("=" * 78)
    # latest fiscal year with actuals
    actual_years = sorted({r["fiscal_year"] for r in canon if r["measure"] == "Actuals"})
    fy_latest = actual_years[-1]
    fy_first = actual_years[0]
    first_act = defaultdict(float)
    last_act = defaultdict(float)
    last_be = defaultdict(float)
    for r in canon:
        d = r["demand"]
        if not d:
            continue
        if r["measure"] == "Actuals" and r["fiscal_year"] == fy_latest:
            last_act[d] += r["amount"]
        if r["measure"] == "Actuals" and r["fiscal_year"] == fy_first:
            first_act[d] += r["amount"]
        if r["measure"] == "BE" and r["fiscal_year"] == fy_latest:
            last_be[d] += r["amount"]
    n_years = int(fy_latest.split("-")[0]) - int(fy_first.split("-")[0])
    print(f"  first actuals year = {fy_first}, latest actuals year = {fy_latest}  ({n_years}-year span)")
    print(f"{'demand':>7} {'Act_'+fy_first[:7]:>12} {'Act_'+fy_latest[:7]:>12} {'BE_'+fy_latest[:7]:>12} {'CAGR':>7} {'Act/BE':>7}")
    ranked = sorted(last_act.items(), key=lambda kv: kv[1], reverse=True)[:DEMAND_TOP_N]
    for d, la in ranked:
        fa = first_act[d]
        cagr = f"{(la/fa)**(1/n_years)-1:+.1%}" if fa > 0 and n_years > 0 else "  -"
        acbe = f"{la/last_be[d]:.2f}" if last_be[d] else "  -"
        print(f"{d:>7} {fmt(fa)} {fmt(la)} {fmt(last_be[d])} {cagr:>7} {acbe:>7}")
    print("  (No demand-name column exists in the package; label demands from any year's Vol-1 contents page.)")


def qa_checks(records, outliers):
    print("\n" + "=" * 78)
    print("QA / RECONCILIATION")
    print("=" * 78)
    # Cross-document BE agreement for health 2023-24 (doc 2023-24 col4 vs doc 2024-25 col2)
    def health_be(doc):
        return sum(r["amount"] for r in records
                   if r["measure"] == "BE" and r["fiscal_year"] == "2023-24"
                   and r["document_year"] == doc and r["mh_code"] in HEALTH_MAJOR_HEADS)
    a, b = health_be("2023-24"), health_be("2024-25")
    if a and b:
        print(f"  Health BE 2023-24: from doc 2023-24 = Rs {cr(a):,.1f} cr | from doc 2024-25 = Rs {cr(b):,.1f} cr"
              f"  (gap {100*abs(a-b)/a:.1f}%)")
        print("  -> small gaps = restatement/reclassification or extraction noise; investigate via validation_findings.csv.")
    print(f"  Implausible single-leaf amounts (> Rs 50,000 cr) flagged: {len(outliers)}")
    for o in outliers[:5]:
        print(f"    doc={o[0]} {o[1]} = Rs {cr(o[2]):,.0f} cr  src={o[3]} p.{o[4]}")


def main():
    records, outliers = build_records()
    canon = canonical(records)
    print(f"Loaded {len(records):,} positional leaf records; {len(canon):,} canonical (BE<-Y, RE<-Y+1, Act<-Y+2).")
    q1_health(canon)
    q2_committed(canon)
    q3_by_demand(canon)
    qa_checks(records, outliers)


if __name__ == "__main__":
    main()
