#!/usr/bin/env python3
"""
run_sql.py — DuckDB/SQL runner for Karnataka budget examples.

Executes the four .sql files against the shared tidy CSV via the duckdb
Python wheel (DuckDB CLI is absent; the same SQL runs in the Dockerfile too).

Usage (from repo root or from examples/):
    python3 examples/src/sql/run_sql.py

Outputs:
    examples/out/results_sql.json   (same schema as canonical_numbers.json)

Note: analytical logic lives in the .sql files; this runner only:
  - resolves paths relative to __file__
  - loads demand_names from JSON and registers a DuckDB in-memory table
  - substitutes {CSV_PATH} in each .sql file
  - parses "-- SECTION: name" markers to split multi-section .sql files
  - executes each section, prints a readable table, and assembles the result JSON
"""

import json
import os
import sys

import duckdb

# ---------------------------------------------------------------------------
# Paths (relative to this file so it runs from repo root or examples/)
# ---------------------------------------------------------------------------
_HERE     = os.path.dirname(os.path.abspath(__file__))
_EXAMPLES = os.path.dirname(os.path.dirname(_HERE))          # examples/
_REPO     = os.path.dirname(_EXAMPLES)                       # repo root

CSV_PATH      = os.path.join(_EXAMPLES, "data", "processed", "karnataka_budget_tidy.csv")
CANONICAL_PATH = os.path.join(_EXAMPLES, "data", "processed", "canonical_numbers.json")
DEMAND_NAMES_PATH = os.path.join(_REPO, "state-finances", "karnataka", "KA_demand_names.json")
OUT_PATH      = os.path.join(_EXAMPLES, "out", "results_sql.json")

SQL_DIR = _HERE  # examples/src/sql/

SQL_FILES = [
    "00_onboarding.sql",
    "01_health.sql",
    "02_committed.sql",
    "03_demand_variation.sql",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def read_sql(filename):
    """Read a .sql file and substitute {CSV_PATH}."""
    path = os.path.join(SQL_DIR, filename)
    with open(path, encoding="utf-8") as f:
        return f.read().replace("{CSV_PATH}", CSV_PATH.replace("\\", "/"))


def split_sections(sql_text):
    """
    Split a .sql file into named sections at '-- SECTION: name' markers.
    Returns a list of (name, sql_body) pairs.
    Lines before the first SECTION marker are treated as a preamble (skipped).
    If no markers, the whole text is returned as a single unnamed section.
    """
    lines = sql_text.splitlines(keepends=True)
    sections = []
    current_name = None
    current_lines = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("-- SECTION:"):
            if current_name is not None:
                sections.append((current_name, "".join(current_lines)))
            current_name = stripped[len("-- SECTION:"):].strip()
            current_lines = []
        else:
            if current_name is not None:
                current_lines.append(line)

    if current_name is not None:
        sections.append((current_name, "".join(current_lines)))

    if not sections:
        # No markers — single section, use filename stem as name
        sections = [("result", sql_text)]

    return sections


def print_table(name, rows, cols):
    """Print a human-readable ASCII table for query results."""
    print(f"\n  [{name}]")
    if not rows:
        print("  (no rows)")
        return
    widths = {c: len(c) for c in cols}
    for row in rows:
        for c in cols:
            widths[c] = max(widths[c], len(str(row[c])))
    header = "  " + "  ".join(c.ljust(widths[c]) for c in cols)
    sep    = "  " + "  ".join("-" * widths[c] for c in cols)
    print(header)
    print(sep)
    for row in rows:
        print("  " + "  ".join(str(row[c]).ljust(widths[c]) for c in cols))


def rows_to_dicts(rel):
    """Convert a DuckDB relation to a list of dicts."""
    df = rel.fetchdf()
    return df.to_dict(orient="records")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("run_sql.py — Karnataka Budget SQL examples (DuckDB)")
    print(f"  duckdb version : {duckdb.__version__}")
    print(f"  CSV            : {CSV_PATH}")
    print(f"  out            : {OUT_PATH}")

    # ------------------------------------------------------------------
    # Connect and register demand_names table
    # ------------------------------------------------------------------
    con = duckdb.connect(database=":memory:")

    with open(DEMAND_NAMES_PATH, encoding="utf-8") as f:
        dn_json = json.load(f)["demands"]

    # Register in-memory table so .sql files can JOIN against demand_names
    con.execute("CREATE TABLE demand_names (demand VARCHAR, name VARCHAR)")
    con.executemany(
        "INSERT INTO demand_names VALUES (?, ?)",
        [(k, v["name"]) for k, v in dn_json.items()],
    )

    # ------------------------------------------------------------------
    # Execute SQL files
    # ------------------------------------------------------------------
    results = {}   # section_name -> list of row dicts

    for filename in SQL_FILES:
        print(f"\n{'='*60}")
        print(f"  {filename}")
        sql_text = read_sql(filename)
        sections = split_sections(sql_text)

        for sec_name, sec_sql in sections:
            sec_sql = sec_sql.strip()
            if not sec_sql:
                continue
            rel = con.execute(sec_sql)
            cols = [d[0] for d in rel.description]
            rows = [dict(zip(cols, r)) for r in rel.fetchall()]
            print_table(sec_name, rows, cols)
            results[sec_name] = rows

    # ------------------------------------------------------------------
    # Build output JSON (same schema as canonical_numbers.json)
    # ------------------------------------------------------------------

    # --- onboarding -------------------------------------------------------
    top5_rows = results["top5_departments_latest_actuals"]
    top5_fy   = top5_rows[0]["fiscal_year"] if top5_rows else None

    hbl_rows  = results["health_be_latest"]
    hbl_fy    = hbl_rows[0]["fiscal_year"] if hbl_rows else None
    hbl_amt   = float(hbl_rows[0]["amount"]) if hbl_rows else 0.0

    svb_rows  = results["spend_vs_budget"]
    svb       = svb_rows[0] if svb_rows else {}

    onboarding = {
        "top5_departments_latest_actuals": {
            "fiscal_year": top5_fy,
            "rows": [
                {"demand": r["demand"], "name": r["name"], "amount": float(r["amount"])}
                for r in top5_rows
            ],
        },
        "health_be_latest": {
            "fiscal_year": hbl_fy,
            "amount": hbl_amt,
        },
        "spend_vs_budget": {
            "fiscal_year": svb.get("fiscal_year"),
            "actuals": float(svb.get("actuals", 0)),
            "be":      float(svb.get("be", 0)),
            "ratio":   float(svb.get("ratio", 0)),
        },
    }

    # --- q1_health --------------------------------------------------------
    q1_health = [
        {
            "fiscal_year": r["fiscal_year"],
            "be":      float(r["be"]),
            "re":      float(r["re"]),
            "actuals": float(r["actuals"]),
        }
        for r in results.get("q1_health", [])
    ]

    # --- q2_committed and total_expenditure --------------------------------
    q2_committed = [
        {
            "fiscal_year":       r["fiscal_year"],
            "salaries":          float(r["salaries"]),
            "pensions":          float(r["pensions"]),
            "interest":          float(r["interest"]),
            "committed":         float(r["committed"]),
            "total_exp_actuals": float(r["total_exp_actuals"]),
            "share_pct":         float(r["share_pct"]),
        }
        for r in results.get("q2_committed", [])
    ]

    total_expenditure = [
        {
            "fiscal_year":  r["fiscal_year"],
            "total_be":     float(r["total_be"]),
            "committed_be": float(r["committed_be"]),
        }
        for r in results.get("total_expenditure", [])
    ]

    # --- q3_demand --------------------------------------------------------
    demand_rows = results.get("q3_demand", [])
    fy_first  = demand_rows[0]["fy_first"]  if demand_rows else None
    fy_latest = demand_rows[0]["fy_latest"] if demand_rows else None

    q3_demand = {
        "fiscal_year_first":  fy_first,
        "fiscal_year_latest": fy_latest,
        "rows": [
            {
                "demand":         r["demand"],
                "name":           r["name"],
                "first_actuals":  float(r["first_actuals"]),
                "latest_actuals": float(r["latest_actuals"]),
                "latest_be":      float(r["latest_be"]),
                "act_be":         float(r["act_be"]),
            }
            for r in demand_rows
        ],
    }

    # ------------------------------------------------------------------
    # Assemble full output
    # ------------------------------------------------------------------
    output = {
        "unit":             "INR_crore",
        "tolerance_crore":  0.01,
        "onboarding":       onboarding,
        "q1_health":        q1_health,
        "q2_committed":     q2_committed,
        "q3_demand":        q3_demand,
        "total_expenditure": total_expenditure,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(f"\n  Written: {OUT_PATH}")

    # ------------------------------------------------------------------
    # Reconcile vs canonical_numbers.json
    # ------------------------------------------------------------------
    print(f"\n{'='*60}")
    print("  Reconciliation vs canonical_numbers.json")
    with open(CANONICAL_PATH, encoding="utf-8") as f:
        canon = json.load(f)

    tol = canon.get("tolerance_crore", 0.01)
    max_diff = 0.0
    max_diff_label = ""
    issues = []

    def chk(label, got, want):
        nonlocal max_diff, max_diff_label
        diff = abs(float(got) - float(want))
        if diff > max_diff:
            max_diff = diff
            max_diff_label = f"{label}  got={got}  want={want}"
        if diff > tol:
            issues.append(f"  FAIL {label}  diff={diff:.6f}  got={got}  want={want}")

    # Guard: sections that must be non-empty
    required_sections = {
        "q1_health":         output["q1_health"],
        "q2_committed":      output["q2_committed"],
        "q3_demand.rows":    output["q3_demand"]["rows"],
        "total_expenditure": output["total_expenditure"],
    }
    for sec, rows in required_sections.items():
        if not rows:
            issues.append(f"  FAIL section '{sec}' is empty — section naming mismatch?")

    # onboarding
    svb_c = canon["onboarding"]["spend_vs_budget"]
    chk("onboarding.spend_vs_budget.actuals", output["onboarding"]["spend_vs_budget"]["actuals"], svb_c["actuals"])
    chk("onboarding.spend_vs_budget.be",      output["onboarding"]["spend_vs_budget"]["be"],      svb_c["be"])
    chk("onboarding.spend_vs_budget.ratio",   output["onboarding"]["spend_vs_budget"]["ratio"],   svb_c["ratio"])
    chk("onboarding.health_be_latest.amount", output["onboarding"]["health_be_latest"]["amount"], canon["onboarding"]["health_be_latest"]["amount"])

    top5_c = {r["demand"]: r for r in canon["onboarding"]["top5_departments_latest_actuals"]["rows"]}
    for row in output["onboarding"]["top5_departments_latest_actuals"]["rows"]:
        d = row["demand"]
        if d in top5_c:
            chk(f"onboarding.top5[{d}].amount", row["amount"], top5_c[d]["amount"])

    # q1_health
    q1_c = {r["fiscal_year"]: r for r in canon["q1_health"]}
    for row in output["q1_health"]:
        fy = row["fiscal_year"]
        if fy in q1_c:
            chk(f"q1_health[{fy}].be",      row["be"],      q1_c[fy]["be"])
            chk(f"q1_health[{fy}].re",       row["re"],       q1_c[fy]["re"])
            chk(f"q1_health[{fy}].actuals",  row["actuals"],  q1_c[fy]["actuals"])

    # q2_committed
    q2_c = {r["fiscal_year"]: r for r in canon["q2_committed"]}
    for row in output["q2_committed"]:
        fy = row["fiscal_year"]
        if fy in q2_c:
            chk(f"q2_committed[{fy}].salaries",          row["salaries"],          q2_c[fy]["salaries"])
            chk(f"q2_committed[{fy}].pensions",          row["pensions"],          q2_c[fy]["pensions"])
            chk(f"q2_committed[{fy}].interest",          row["interest"],          q2_c[fy]["interest"])
            chk(f"q2_committed[{fy}].committed",         row["committed"],         q2_c[fy]["committed"])
            chk(f"q2_committed[{fy}].total_exp_actuals", row["total_exp_actuals"], q2_c[fy]["total_exp_actuals"])
            chk(f"q2_committed[{fy}].share_pct",         row["share_pct"],         q2_c[fy]["share_pct"])

    # q3_demand
    q3_c = {r["demand"]: r for r in canon["q3_demand"]["rows"]}
    for row in output["q3_demand"]["rows"]:
        d = row["demand"]
        if d in q3_c:
            chk(f"q3_demand[{d}].first_actuals",  row["first_actuals"],  q3_c[d]["first_actuals"])
            chk(f"q3_demand[{d}].latest_actuals", row["latest_actuals"], q3_c[d]["latest_actuals"])
            chk(f"q3_demand[{d}].latest_be",      row["latest_be"],      q3_c[d]["latest_be"])

    # total_expenditure
    te_c = {r["fiscal_year"]: r for r in canon["total_expenditure"]}
    for row in output["total_expenditure"]:
        fy = row["fiscal_year"]
        if fy in te_c:
            chk(f"total_expenditure[{fy}].total_be",     row["total_be"],     te_c[fy]["total_be"])
            chk(f"total_expenditure[{fy}].committed_be", row["committed_be"], te_c[fy]["committed_be"])

    print(f"\n  Max abs diff : {max_diff:.6f} cr  (tolerance={tol} cr)")
    if max_diff_label:
        print(f"  Worst case   : {max_diff_label}")

    if issues:
        print(f"\n  FAILURES ({len(issues)}):")
        for msg in issues:
            print(msg)
        print("\n  RECONCILIATION: FAIL")
        sys.exit(1)
    else:
        print("  RECONCILIATION: PASS")


if __name__ == "__main__":
    main()
