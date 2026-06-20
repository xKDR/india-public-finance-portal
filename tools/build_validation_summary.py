#!/usr/bin/env python3
"""
Build karnataka-state-finance/validation_summary.{csv,html}
from per-year checks_<Y>.csv files. stdlib Python only.

Usage (from repo root):
    python3 tools/build_validation_summary.py

Outputs:
    karnataka-state-finance/validation_summary.csv
    karnataka-state-finance/validation_summary.html
"""

import csv
import html as html_mod
import os
from collections import defaultdict
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).parent.parent
BASE_DIR = REPO_ROOT / "karnataka-state-finance"
YEARS_DIR = BASE_DIR / "years"
OUT_CSV = BASE_DIR / "validation_summary.csv"
OUT_HTML = BASE_DIR / "validation_summary.html"

YEARS = [
    "2016-17", "2017-18", "2018-19", "2019-20", "2020-21", "2021-22",
    "2022-23", "2023-24", "2024-25", "2025-26", "2026-27",
]

CSV_COLUMNS = [
    "document_year", "fiscal_year", "level",
    "demand_number", "major_head_code", "sub_major_head_code",
    "minor_head_code", "sub_head_code", "detailed_head_code",
    "financial_column_position", "financial_column_label",
    "n_checks", "n_passed", "pass_pct",
]

HTML_CAP_LEVEL = "SubMajor"  # cap HTML tree at this level; CSV has full depth
HTML_SIZE_LIMIT_MB = 8.0

LEVEL_DISPLAY = {
    "Year": "Year",
    "Demand": "Demand",
    "MajorHead": "Major Head",
    "SubMajor": "Sub-Major",
    "Minor": "Minor Head",
    "SubHead": "Sub-Head",
    "Detailed": "Detailed",
}


# ---------------------------------------------------------------------------
# Fiscal-year label helpers
# ---------------------------------------------------------------------------
def fiscal_labels(doc_year: str, pos: str):
    """Return (fiscal_year, financial_column_label) for a position.

    Formula (from package caveats):
      y = int(doc_year[:4])
      pos 1  -> Actuals  y-2 / (y-1) mod 100
      pos 2  -> BE       y-1 / y     mod 100
      pos 3  -> RE       y-1 / y     mod 100
      pos 4  -> BE       y   / (y+1) mod 100
    """
    if pos == "ALL":
        return "ALL", "ALL"
    y = int(doc_year[:4])
    if pos == "1":
        fy = f"{y - 2}-{(y - 1) % 100:02d}"
        return fy, f"Actuals {fy}"
    if pos == "2":
        fy = f"{y - 1}-{y % 100:02d}"
        return fy, f"BE {fy}"
    if pos == "3":
        fy = f"{y - 1}-{y % 100:02d}"
        return fy, f"RE {fy}"
    if pos == "4":
        fy = f"{y}-{(y + 1) % 100:02d}"
        return fy, f"BE {fy}"
    return "", ""


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------
def build_aggregations():
    """Read all checks CSVs; return bucket dict.

    Key: (doc_year, level, demand, major, sub_major, minor, sub_head, detailed, pos)
    Value: [n_checks, n_passed]

    Each check row is attributed to ALL ancestor levels (Year, Demand, MajorHead,
    and any deeper levels for which the row has non-empty codes). This guarantees:
        Year.n_checks == sum(Demand children)
        Demand.n_checks == sum(MajorHead children)
    for those two rollups (both demand_number and major_head_code are always present).
    """
    buckets = defaultdict(lambda: [0, 0])

    for year in YEARS:
        checks_path = YEARS_DIR / year / "csv" / f"checks_{year}.csv"
        with open(checks_path, newline="") as f:
            for row in csv.DictReader(f):
                d   = row["demand_number"]
                m   = row["major_head_code"]
                sm  = row["sub_major_head_code"]
                mi  = row["minor_head_code"]
                sh  = row["sub_head_code"]
                dt  = row["detailed_head_code"]
                pos = row["financial_column_position"]
                passed = 1 if row["passed"] == "1" else 0

                def add(level, d_, m_, sm_, mi_, sh_, dt_):
                    k  = (year, level, d_, m_, sm_, mi_, sh_, dt_, pos)
                    ka = (year, level, d_, m_, sm_, mi_, sh_, dt_, "ALL")
                    buckets[k][0]  += 1
                    buckets[k][1]  += passed
                    buckets[ka][0] += 1
                    buckets[ka][1] += passed

                # Always attribute to the top three levels
                add("Year",     "", "", "", "", "", "")
                add("Demand",    d, "", "", "", "", "")
                add("MajorHead", d,  m, "", "", "", "")

                # Attribute to lower levels only when the code is present
                if sm:
                    add("SubMajor", d, m, sm, "", "", "")
                if mi:
                    add("Minor", d, m, sm, mi, "", "")
                if sh:
                    add("SubHead", d, m, sm, mi, sh, "")
                if dt:
                    add("Detailed", d, m, sm, mi, sh, dt)

    return buckets


# ---------------------------------------------------------------------------
# CSV output
# ---------------------------------------------------------------------------
LEVEL_ORDER = ["Year", "Demand", "MajorHead", "SubMajor", "Minor", "SubHead", "Detailed"]
POS_ORDER   = ["1", "2", "3", "4", "ALL"]


def write_csv(buckets):
    """Write validation_summary.csv from aggregation buckets."""
    rows = []
    for (doc_year, level, demand, major, sub_major, minor, sub_head, detailed, pos), (nc, np) in buckets.items():
        fy, fl = fiscal_labels(doc_year, pos)
        pp = round(100 * np / nc, 2) if nc > 0 else None
        rows.append({
            "document_year":          doc_year,
            "fiscal_year":            fy,
            "level":                  level,
            "demand_number":          demand,
            "major_head_code":        major,
            "sub_major_head_code":    sub_major,
            "minor_head_code":        minor,
            "sub_head_code":          sub_head,
            "detailed_head_code":     detailed,
            "financial_column_position": pos,
            "financial_column_label": fl,
            "n_checks":               nc,
            "n_passed":               np,
            "pass_pct":               "" if pp is None else f"{pp:.2f}",
        })

    # Sort: by year, then level order, then hierarchy codes, then position
    level_idx = {l: i for i, l in enumerate(LEVEL_ORDER)}
    pos_idx   = {p: i for i, p in enumerate(POS_ORDER)}

    rows.sort(key=lambda r: (
        r["document_year"],
        level_idx.get(r["level"], 99),
        r["demand_number"],
        r["major_head_code"],
        r["sub_major_head_code"],
        r["minor_head_code"],
        r["sub_head_code"],
        r["detailed_head_code"],
        pos_idx.get(r["financial_column_position"], 99),
    ))

    with open(OUT_CSV, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"CSV: {len(rows):,} rows → {OUT_CSV}")
    return rows


# ---------------------------------------------------------------------------
# HTML helpers
# ---------------------------------------------------------------------------
def pct_class(p):
    if p is None:
        return ""
    if p >= 95:
        return " class='hi'"
    if p >= 85:
        return " class='med'"
    return " class='lo'"


def fmt_pct(nc, np_):
    if nc == 0:
        return "—"
    p = 100 * np_ / nc
    return f"{p:.1f}%"


def node_mini_table(doc_year, level, demand, major, sub_major, minor, sub_head, detailed, buckets):
    """Return a compact HTML table showing checks × position for a node."""
    lines = [
        "<table class='nt'><tr><th>Pos</th><th>Measure / Fiscal Year</th>"
        "<th>n_checks</th><th>n_passed</th><th>pass%</th></tr>"
    ]
    for pos in POS_ORDER:
        k = (doc_year, level, demand, major, sub_major, minor, sub_head, detailed, pos)
        v = buckets.get(k)
        if v is None:
            continue
        nc, np_ = v
        fy, fl = fiscal_labels(doc_year, pos)
        p = (100 * np_ / nc) if nc > 0 else None
        pc = pct_class(p)
        pstr = f"{p:.1f}%" if p is not None else "—"
        lines.append(
            f"<tr><td>{html_mod.escape(pos)}</td>"
            f"<td>{html_mod.escape(fl)}</td>"
            f"<td>{nc:,}</td><td>{np_:,}</td>"
            f"<td{pc}>{pstr}</td></tr>"
        )
    lines.append("</table>")
    return "\n".join(lines)


def summary_line(label, doc_year, level, demand, major, sub_major, minor, sub_head, detailed, buckets):
    """Return the text content for a <summary> element."""
    k_all = (doc_year, level, demand, major, sub_major, minor, sub_head, detailed, "ALL")
    v = buckets.get(k_all)
    if v:
        nc, np_ = v
        p = 100 * np_ / nc if nc else 0
        pc_text = f"{p:.1f}%"
        return f"{html_mod.escape(label)} — {pc_text} ({np_:,}/{nc:,})"
    return html_mod.escape(label)


# ---------------------------------------------------------------------------
# HTML tree builder  (recursive)
# ---------------------------------------------------------------------------
# We build a sorted, deduplicated lookup from the bucket keys for fast child lookup.

def build_index(buckets):
    """Build an index: level -> list of unique (doc_year, d, m, sm, mi, sh, dt)."""
    idx = defaultdict(set)
    for (doc_year, level, d, m, sm, mi, sh, dt, pos) in buckets.keys():
        if pos != "ALL":
            continue
        idx[(level, doc_year)].add((d, m, sm, mi, sh, dt))
    # Sort each entry
    result = {}
    for k, v in idx.items():
        result[k] = sorted(v)
    return result


def render_tree(doc_year, buckets, idx, cap_level):
    """Render the HTML tree for a single document year, capped at cap_level."""
    cap_idx = LEVEL_ORDER.index(cap_level)
    buf = []

    def _render(level, demand, major, sub_major, minor, sub_head, detailed, indent):
        li = LEVEL_ORDER.index(level)
        code_map = {
            "Year":     "",
            "Demand":   demand,
            "MajorHead": major,
            "SubMajor": sub_major,
            "Minor":    minor,
            "SubHead":  sub_head,
            "Detailed": detailed,
        }
        label = code_map[level] or f"({level})"
        pad = "  " * indent
        sl = summary_line(label, doc_year, level, demand, major, sub_major, minor, sub_head, detailed, buckets)
        buf.append(f"{pad}<details>")
        buf.append(f"{pad}<summary>{sl}</summary>")
        buf.append(node_mini_table(doc_year, level, demand, major, sub_major, minor, sub_head, detailed, buckets))

        # Children
        if li < cap_idx:
            child_level = LEVEL_ORDER[li + 1]
            children = idx.get((child_level, doc_year), [])
            # Filter to children of this node
            for (cd, cm, csm, cmi, csh, cdt) in children:
                # Check that this child belongs to this parent
                if level == "Year"     and True: pass
                elif level == "Demand" and cd != demand: continue
                elif level == "MajorHead" and (cd != demand or cm != major): continue
                elif level == "SubMajor"  and (cd != demand or cm != major or csm != sub_major): continue
                elif level == "Minor"     and (cd != demand or cm != major or csm != sub_major or cmi != minor): continue
                elif level == "SubHead"   and (cd != demand or cm != major or csm != sub_major or cmi != minor or csh != sub_head): continue

                _render(child_level, cd, cm, csm, cmi, csh, cdt, indent + 1)

        buf.append(f"{pad}</details>")

    # Kick off from Demand level (year-level node is the container for the section)
    demands = sorted(set(d for (d, m, sm, mi, sh, dt) in idx.get(("Demand", doc_year), [])))
    for d in demands:
        _render("Demand", d, "", "", "", "", "", indent=1)

    return "\n".join(buf)


# ---------------------------------------------------------------------------
# HTML generation
# ---------------------------------------------------------------------------

# Framing content harvested from per-year validation_summary_<Y>.md + validation_findings.md

TRUST_GRADIENT = [
    # (year, pass_pct, n_passed, n_total, worst_volume, worst_check)
    ("2016-17", 84.32,  16826, 19956, "Vol 5 (expvol_5)", "W01 col 1 (abs_diff ≈ 2.4 billion)"),
    ("2017-18", 74.83,  14322, 19140, "Vol 2 (expvol_2)", "W07 col 4 (OCR-scale diff ≈ 2.4×10²² — likely OCR error in recovered summary)"),
    ("2018-19", 86.78,  17998, 20740, "Vol 1 (expvol_1)", "W04 col 4 (abs_diff ≈ 2.5 million)"),
    ("2019-20", 89.53,  19206, 21452, "Vol 2 (expvol_2)", "W05 col 4 (abs_diff ≈ 2.5 million)"),
    ("2020-21", 89.55,  19632, 21924, "Vol 2 (expvol_2)", "W05 col 4 (abs_diff ≈ 2.6 million)"),
    ("2021-22", 89.88,  19787, 22016, "Vol 1 (expvol_1)", "W05 col 4 (abs_diff ≈ 2.7 million)"),
    ("2022-23", 83.36,  16606, 19920, "Vol 1 (expvol_1)", "W05 col 4 (abs_diff ≈ 2.9 million)"),
    ("2023-24", 99.45,  11990, 12056, "Vol 3 (expvol_3)", "W07 col 1 (abs_diff ≈ 265 thousand)"),
    ("2024-25", 99.00,  11745, 11864, "Vol 5 (expvol_5)", "W07 col 4 (abs_diff ≈ 376 thousand)"),
    ("2025-26", 99.62,  11823, 11868, "Vol 1 (expvol_1)", "W07 col 4 (abs_diff ≈ 100 thousand)"),
    ("2026-27", 99.68,  11830, 11868, "Vol 1 (expvol_1)", "W07 col 2 (abs_diff ≈ 90 thousand)"),
]

CHECK_GLOSSARY = [
    ("W01", "in_schema",    "Object Data → Minor Total (within object_head table)"),
    ("W02", "in_schema",    "Object Data → Sub-Major Total (within object_head table)"),
    ("W03", "in_schema",    "Minor Data → Minor Total (within minor_head table)"),
    ("W04", "in_schema",    "Minor Data → Sub-Major Total (within minor_head table)"),
    ("W05", "in_schema",    "Sub-Major Data → Sub-Major Total (within sub_major_head table)"),
    ("W06", "in_schema",    "Object Data → Detailed-Head Total / HOA Total (within object_head table)"),
    ("W07", "in_schema",    "Object Data → Major-Head Total (within object_head table)"),
    ("A01", "across_schema","Object Minor Total → Minor Data (cross-table)"),
    ("A02", "across_schema","Object Sub-Major Total → Sub-Major Data (cross-table)"),
    ("A03", "across_schema","Minor Sub-Major Total → Sub-Major Data (cross-table)"),
]

CSS = """
body{font-family:system-ui,sans-serif;max-width:1200px;margin:0 auto;padding:1em 1.5em;color:#1a1a1a}
h1{color:#1a5276}
h2{color:#2e4057;border-bottom:1px solid #ccc;padding-bottom:0.2em}
h3{color:#2e4057}
table{border-collapse:collapse;font-size:0.9em;margin:0.5em 0}
th,td{border:1px solid #bbb;padding:4px 10px;text-align:left}
th{background:#e8edf2}
tr:nth-child(even){background:#f7f9fc}
.hi{color:#1a7a1a;font-weight:bold}
.med{color:#b35900;font-weight:bold}
.lo{color:#c0392b;font-weight:bold}
details{margin:3px 0}
summary{cursor:pointer;padding:3px 6px;border-radius:3px;user-select:none;list-style:none}
summary::-webkit-details-marker{display:none}
summary::before{content:"▶ ";font-size:0.75em;color:#888}
details[open]>summary::before{content:"▼ ";font-size:0.75em;color:#888}
summary:hover{background:#f0f4f8}
.nt{margin:4px 0 4px 24px;font-size:0.82em}
.nt th{background:#f0f4f8}
.tg{background:#fff3cd;padding:0.5em;border-left:4px solid #f0ad4e;margin:0.5em 0}
.info{background:#d1ecf1;padding:0.5em;border-left:4px solid #17a2b8;margin:0.5em 0}
.inv{background:#fff8dc;padding:0.5em;border-left:4px solid #cca000;margin:0.5em 0;font-style:italic}
code{background:#f4f4f4;padding:1px 4px;border-radius:2px;font-family:monospace}
"""

JS = """
function expandAll(){document.querySelectorAll('details').forEach(d=>d.open=true)}
function collapseAll(){document.querySelectorAll('details').forEach(d=>d.open=false)}
"""


def generate_html(buckets, cap_level="SubMajor"):
    idx = build_index(buckets)
    parts = []

    # Build readable tree-depth path up to cap_level
    cap_idx = LEVEL_ORDER.index(cap_level)
    depth_path = " ▸ ".join(LEVEL_DISPLAY[l] for l in LEVEL_ORDER[1:cap_idx + 1])

    parts.append(f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Karnataka Budget — Validation Summary</title>
<style>{CSS}</style>
<script>{JS}</script>
</head>
<body>
<h1>Karnataka State Budget — Validation Summary</h1>
<p style="color:#555;font-size:0.9em">
  Generated from <code>karnataka-state-finance/years/&lt;Y&gt;/csv/checks_&lt;Y&gt;.csv</code>
  (11 years, 2016-17 – 2026-27). Full Sub-Head and Detailed drill-down in
  <code>validation_summary.csv</code>.
  HTML tree depth: {depth_path}.
</p>
<p>
  <button onclick="expandAll()">Expand all</button>
  <button onclick="collapseAll()">Collapse all</button>
</p>
""")

    # ---- Trust Gradient ----
    parts.append("<h2>Cross-Year Pass-Rate Trust Gradient</h2>")
    parts.append("""<p>Use this table to gauge how well the budget document's internal arithmetic
checks out year by year. 2016-17–2022-23 used recovered historical summaries for
some volumes and have significantly lower pass rates than 2023-24 onward.</p>""")
    parts.append("<table>")
    parts.append("<tr><th>Year</th><th>Overall pass%</th><th>n_passed</th><th>n_checks</th><th>Worst volume</th><th>Worst-offender check</th></tr>")
    for year, pp, np_, nc, wv, wc in TRUST_GRADIENT:
        p_class = "hi" if pp >= 95 else ("med" if pp >= 85 else "lo")
        parts.append(f"<tr><td><b>{year}</b></td>"
                     f"<td class='{p_class}'>{pp:.2f}%</td>"
                     f"<td>{np_:,}</td><td>{nc:,}</td>"
                     f"<td>{html_mod.escape(wv)}</td>"
                     f"<td><small>{html_mod.escape(wc)}</small></td></tr>")
    parts.append("</table>")

    # ---- What a failure means ----
    parts.append("<h2>What Does a Validation Failure Mean?</h2>")
    parts.append("""<div class='info'>
<p>A validation failure measures <b>internal accounting consistency</b> in the printed budget
document — not line-level PDF extraction accuracy. Each check verifies that a printed subtotal
(e.g. a Minor-Head total row) equals the arithmetic sum of its component detail rows, all within
the same budget document. A failure means the two numbers disagree by more than ₹0.01 (INR lakh).
Possible causes include: OCR mis-reads, table-structure parsing mismatches, historical document
corrections applied inconsistently across volumes, or genuine arithmetic discrepancies in the
original printed budget. Pass rates above 99% (2023-24 onward) indicate high internal consistency.
Pass rates around 84-90% (2016-17–2022-23) indicate that some printed subtotals do not reconcile
with their detail rows — treat sums in those years with appropriate caution.</p>
</div>""")

    # ---- Anchor page ----
    parts.append("<h2>What Is the \"Anchor Page\"?</h2>")
    parts.append("""<div class='info'>
<p>The <b>anchor page</b> is the PDF page where the <em>checked printed total or summary row</em>
appears — for example, the Minor-Head total row at the bottom of a table. It is <em>not</em>
necessarily the page where the extraction error originates (that may be an earlier page containing
the contributing detail rows). Think of it as: "this is the page where you would see the mismatch
if you looked up the number in the printed budget."</p>
</div>""")

    # ---- How to chase a failing check ----
    parts.append("<h2>How to Chase a Failing Check into the PDF</h2>")
    parts.append("""<ol>
<li>Open <code>validation_summary.csv</code> (or <code>years/&lt;Y&gt;/csv/checks_&lt;Y&gt;.csv</code>)
    and filter to the failing check (passed = 0).</li>
<li>Note <code>check_id</code>, <code>reference_check_id</code>, <code>source_file</code>,
    <code>financial_column_position</code>, and the hierarchy codes.</li>
<li>In <code>years/&lt;Y&gt;/csv/budget_&lt;Y&gt;.csv</code>, filter by the hierarchy codes and
    <code>row_type='Total'</code> to find the anchor row; its <code>page_number</code> gives the
    anchor page in the corresponding PDF under <code>years/&lt;Y&gt;/pdfs/</code>.</li>
<li>Open the PDF at that page to see the printed total. Compare the surrounding detail rows (on
    earlier pages) to understand the discrepancy.</li>
</ol>""")

    # ---- Anomalies to investigate ----
    parts.append("<h2>Anomalies to Investigate (Not Errors)</h2>")
    parts.append("""<div class='inv'>
<p><b>Animal Husbandry &amp; Fisheries (Demand 02), 2024-25 — Actuals/BE ratio ≈ 14×:</b>
In 2024-25, Actuals (col 1) for Demand 02 (Animal Husbandry &amp; Fisheries) appear approximately
14 times larger than the Budget Estimate (col 4). This is flagged here as something to investigate —
it may reflect a genuine budget restructuring (the department's actual expenditure patterns changed
substantially), a demand-number reassignment, or a positional labelling question. The validation
checks do not flag it as a data error; the arithmetic is internally consistent. Researchers comparing
across years should verify the demand-level continuity before drawing conclusions.</p>
</div>""")

    # ---- Check-code glossary ----
    parts.append("<h2>Check-Code Glossary</h2>")
    parts.append("<table><tr><th>Code</th><th>Scope</th><th>Meaning</th></tr>")
    for code, scope, meaning in CHECK_GLOSSARY:
        parts.append(f"<tr><td><b>{html_mod.escape(code)}</b></td><td>{html_mod.escape(scope)}</td>"
                     f"<td>{html_mod.escape(meaning)}</td></tr>")
    parts.append("</table>")
    parts.append("""<p><small>W = within-schema (single table); A = across-schema (two table types).
Checks W03–W05 and A01–A03 apply only to 2016-17–2022-23 which included
<code>minor_head</code> and <code>sub_major_head</code> table types.</small></p>""")

    # ---- Drill-down tree ----
    cap_idx = LEVEL_ORDER.index(cap_level)
    parts.append(f"<h2>Drill-Down by Year</h2>")
    parts.append(f"""<p>Tree depth: {depth_path}.
Each node shows pass% and check counts per financial-column position (1–4) plus an ALL rollup.
For Minor Head, Sub-Head, and Detailed depth, use <code>validation_summary.csv</code>
(HTML would exceed 8 MB at Minor depth).</p>""")

    for year in YEARS:
        k_all = (year, "Year", "", "", "", "", "", "", "ALL")
        v = buckets.get(k_all, [0, 0])
        nc, np_ = v
        p = 100 * np_ / nc if nc else 0
        p_class = "hi" if p >= 95 else ("med" if p >= 85 else "lo")

        parts.append(f"<details>")
        parts.append(f"<summary class='{p_class}'>📅 {year} — {p:.2f}% pass ({np_:,}/{nc:,} checks)</summary>")
        parts.append(node_mini_table(year, "Year", "", "", "", "", "", "", buckets))

        # Demand-level children
        demands = sorted(set(d for (d, m, sm, mi, sh, dt) in idx.get(("Demand", year), [])))
        for demand in demands:
            k_d = (year, "Demand", demand, "", "", "", "", "", "ALL")
            vd = buckets.get(k_d, [0, 0])
            nc_d, np_d = vd
            pd_ = 100 * np_d / nc_d if nc_d else 0
            pc_d = "hi" if pd_ >= 95 else ("med" if pd_ >= 85 else "lo")
            sl_d = f"Demand {demand} — {pd_:.1f}% ({np_d:,}/{nc_d:,})"

            parts.append(f"  <details>")
            parts.append(f"  <summary class='{pc_d}'>{html_mod.escape(sl_d)}</summary>")
            parts.append(node_mini_table(year, "Demand", demand, "", "", "", "", "", buckets))

            if cap_idx >= LEVEL_ORDER.index("MajorHead"):
                majors = sorted(set(m for (d, m, sm, mi, sh, dt) in idx.get(("MajorHead", year), []) if d == demand))
                for major in majors:
                    k_m = (year, "MajorHead", demand, major, "", "", "", "", "ALL")
                    vm = buckets.get(k_m, [0, 0])
                    nc_m, np_m = vm
                    pm_ = 100 * np_m / nc_m if nc_m else 0
                    pc_m = "hi" if pm_ >= 95 else ("med" if pm_ >= 85 else "lo")
                    sl_m = f"Major {major} — {pm_:.1f}% ({np_m:,}/{nc_m:,})"

                    parts.append(f"    <details>")
                    parts.append(f"    <summary class='{pc_m}'>{html_mod.escape(sl_m)}</summary>")
                    parts.append(node_mini_table(year, "MajorHead", demand, major, "", "", "", "", buckets))

                    if cap_idx >= LEVEL_ORDER.index("SubMajor"):
                        sub_majors = sorted(set(sm for (d, m, sm, mi, sh, dt)
                                                 in idx.get(("SubMajor", year), [])
                                                 if d == demand and m == major))
                        for sub_major in sub_majors:
                            k_sm = (year, "SubMajor", demand, major, sub_major, "", "", "", "ALL")
                            vsm = buckets.get(k_sm, [0, 0])
                            nc_sm, np_sm = vsm
                            psm_ = 100 * np_sm / nc_sm if nc_sm else 0
                            pc_sm = "hi" if psm_ >= 95 else ("med" if psm_ >= 85 else "lo")
                            sl_sm = f"SubMajor {sub_major} — {psm_:.1f}% ({np_sm:,}/{nc_sm:,})"

                            parts.append(f"      <details>")
                            parts.append(f"      <summary class='{pc_sm}'>{html_mod.escape(sl_sm)}</summary>")
                            parts.append(node_mini_table(year, "SubMajor", demand, major, sub_major, "", "", "", buckets))

                            if cap_idx >= LEVEL_ORDER.index("Minor"):
                                minors = sorted(set(mi for (d, m, sm, mi, sh, dt)
                                                     in idx.get(("Minor", year), [])
                                                     if d == demand and m == major and sm == sub_major))
                                for minor in minors:
                                    k_mi = (year, "Minor", demand, major, sub_major, minor, "", "", "ALL")
                                    vmi = buckets.get(k_mi, [0, 0])
                                    nc_mi, np_mi = vmi
                                    pmi_ = 100 * np_mi / nc_mi if nc_mi else 0
                                    pc_mi = "hi" if pmi_ >= 95 else ("med" if pmi_ >= 85 else "lo")
                                    sl_mi = f"Minor {minor} — {pmi_:.1f}% ({np_mi:,}/{nc_mi:,})"

                                    parts.append(f"        <details>")
                                    parts.append(f"        <summary class='{pc_mi}'>{html_mod.escape(sl_mi)}</summary>")
                                    parts.append(node_mini_table(year, "Minor", demand, major, sub_major, minor, "", "", buckets))
                                    parts.append(f"        </details>")

                            parts.append(f"      </details>")  # SubMajor

                    parts.append(f"    </details>")  # MajorHead

            parts.append(f"  </details>")  # Demand

        parts.append(f"</details>")  # Year

    parts.append("</body></html>")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("Building aggregations from checks CSVs...")
    buckets = build_aggregations()
    print(f"  Total buckets: {len(buckets):,}")

    print("Writing CSV...")
    rows = write_csv(buckets)

    print(f"Generating HTML (cap at {HTML_CAP_LEVEL})...")
    html_content = generate_html(buckets, cap_level=HTML_CAP_LEVEL)
    size_mb = len(html_content.encode("utf-8")) / 1e6
    print(f"  HTML size: {size_mb:.2f} MB")

    with open(OUT_HTML, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"HTML: {size_mb:.2f} MB → {OUT_HTML}")

    # --- Verification spot-checks ---
    print("\n--- Verification ---")

    # 1. Year == sum of demands
    year_totals = {}
    demand_sum  = {}
    for (doc_year, level, d, m, sm, mi, sh, dt, pos), (nc, np_) in buckets.items():
        if pos != "ALL":
            continue
        if level == "Year":
            year_totals[doc_year] = (nc, np_)
        if level == "Demand":
            demand_sum[doc_year] = demand_sum.get(doc_year, [0, 0])
            demand_sum[doc_year][0] += nc
            demand_sum[doc_year][1] += np_
    for year in YEARS:
        yt = year_totals.get(year, (0, 0))
        ds = demand_sum.get(year, [0, 0])
        match = "OK" if yt[0] == ds[0] else "MISMATCH"
        print(f"  {year}: Year n_checks={yt[0]:,} vs sum(Demands)={ds[0]:,} → {match}")

    # 2. Demand == sum of majors
    major_sum = {}
    for (doc_year, level, d, m, sm, mi, sh, dt, pos), (nc, np_) in buckets.items():
        if pos != "ALL" or level != "MajorHead":
            continue
        key = (doc_year, d)
        if key not in major_sum:
            major_sum[key] = [0, 0]
        major_sum[key][0] += nc
        major_sum[key][1] += np_
    demand_totals = {}
    for (doc_year, level, d, m, sm, mi, sh, dt, pos), (nc, np_) in buckets.items():
        if pos != "ALL" or level != "Demand":
            continue
        demand_totals[(doc_year, d)] = (nc, np_)
    mismatches = 0
    for key in demand_totals:
        dt_nc = demand_totals[key][0]
        ms_nc = major_sum.get(key, [0, 0])[0]
        if dt_nc != ms_nc:
            mismatches += 1
            print(f"  MISMATCH demand {key}: demand={dt_nc:,}, sum(majors)={ms_nc:,}")
    if mismatches == 0:
        print("  Demand == sum(MajorHead): ALL MATCH")

    # 3. Compare to harvested per-year pass rates
    print("\n--- Pass rate vs. harvested .md values ---")
    md_rates = {
        "2016-17": (84.32, 16826, 19956),
        "2017-18": (74.83, 14322, 19140),
        "2018-19": (86.78, 17998, 20740),
        "2019-20": (89.53, 19206, 21452),
        "2020-21": (89.55, 19632, 21924),
        "2021-22": (89.88, 19787, 22016),
        "2022-23": (83.36, 16606, 19920),
        "2023-24": (99.45, 11990, 12056),
        "2024-25": (99.00, 11745, 11864),
        "2025-26": (99.62, 11823, 11868),
        "2026-27": (99.68, 11830, 11868),
    }
    for year in YEARS:
        yt = year_totals.get(year, (0, 0))
        nc, np_ = yt
        computed_pct = round(100 * np_ / nc, 2) if nc else 0
        md_pct, md_np, md_nc = md_rates[year]
        pct_match = "OK" if (nc == md_nc and np_ == md_np) else "DISCREPANCY"
        if pct_match == "DISCREPANCY":
            print(f"  {year}: computed={computed_pct:.2f}% ({np_}/{nc})  vs  md={md_pct:.2f}% ({md_np}/{md_nc}) → {pct_match}")
        else:
            print(f"  {year}: {computed_pct:.2f}% ({np_}/{nc}) → {pct_match}")


if __name__ == "__main__":
    main()
