#!/usr/bin/env python3
"""
Build state-finances/<state>/<PREFIX>_validation_summary.{csv,html} from that
package's per-year checks CSVs. stdlib Python only.

Usage (from repo root):
    python3 tools/build_validation_summary.py                   # Karnataka
    python3 tools/build_validation_summary.py --package tamil-nadu

Years are discovered from the package's <PREFIX>_years/ directory — never
hardcoded, so the tool stays correct when years are added or retired.

Each aggregation row reports n_checks / n_passed / pass_pct plus the
mu/sigma of the comparisons' accuracy_pct (mean and population standard
deviation), and both outputs carry a column legend explaining every field.
"""

import argparse
import csv
import gzip
import html as html_mod
import io
import math
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent

CSV_COLUMNS = [
    "document_year", "fiscal_year", "level",
    "demand_number", "major_head_code", "sub_major_head_code",
    "minor_head_code", "sub_head_code", "detailed_head_code",
    "financial_column_position", "financial_column_label",
    "n_checks", "n_passed", "pass_pct",
    "mu_accuracy_pct", "sigma_accuracy_pct",
]

# Cap the HTML tree per package (CSV always has full depth). TN has ~10× the
# check volume of KA, so its tree stops one level shallower to stay under the
# ~8 MB browser-friendly budget.
HTML_CAP_LEVELS = {
    "karnataka": "SubMajor",
    "tamil-nadu": "MajorHead",
}

LEVEL_DISPLAY = {
    "Year": "Year",
    "Demand": "Demand",
    "MajorHead": "Major Head",
    "SubMajor": "Sub-Major",
    "Minor": "Minor Head",
    "SubHead": "Sub-Head",
    "Detailed": "Detailed",
}

LEVEL_ORDER = ["Year", "Demand", "MajorHead", "SubMajor", "Minor", "SubHead", "Detailed"]
POS_ORDER = ["1", "2", "3", "4", "ALL"]

# ---------------------------------------------------------------------------
# Column legend — rendered in the HTML and kept in each package's
# data_dictionary.csv (validation_summary table). One row per CSV column.
# ---------------------------------------------------------------------------
COLUMN_LEGEND = [
    ("document_year", "Budget document year the aggregated checks belong to."),
    ("fiscal_year", "Fiscal year of the aggregated financial column "
     "(ALL on the ALL-position rollup rows)."),
    ("level", "Aggregation level: Year = the whole document year; Demand, "
     "MajorHead, SubMajor, Minor, SubHead, Detailed drill progressively "
     "deeper into the account hierarchy."),
    ("demand_number", "Demand (grant) number — populated at Demand level and below."),
    ("major_head_code", "Major head code — populated at MajorHead level and below."),
    ("sub_major_head_code", "Sub-major head code — populated at SubMajor level and below."),
    ("minor_head_code", "Minor head code — populated at Minor level and below."),
    ("sub_head_code", "Sub-head code — populated at SubHead level and below."),
    ("detailed_head_code", "Detailed head code — populated at Detailed level only."),
    ("financial_column_position", "Which of the four positional amount columns "
     "the row aggregates (1=Actuals, 2=BE, 3=RE, 4=BE of the document year); "
     "ALL aggregates the four together."),
    ("financial_column_label", "Human-readable label of that column, e.g. "
     "'Actuals 2022-23' or 'BE 2024-25'."),
    ("n_checks", "Number of individual check comparisons aggregated into this row."),
    ("n_passed", "How many of those comparisons passed (|source − target| within "
     "the package threshold)."),
    ("pass_pct", "n_passed / n_checks × 100."),
    ("mu_accuracy_pct", "Mean (mu) of accuracy_pct over the aggregated comparisons. "
     "accuracy_pct = 100 − |diff|/|target|×100 (floored at 0), so passing "
     "comparisons contribute 100 and a low mu signals large relative errors."),
    ("sigma_accuracy_pct", "Population standard deviation (sigma) of accuracy_pct "
     "over the aggregated comparisons. 0 means every comparison in the bucket "
     "is equally accurate; a large sigma means a few badly-off outliers sit "
     "among clean checks."),
]

# ---------------------------------------------------------------------------
# Per-package configuration
# ---------------------------------------------------------------------------

KA_TRUST_NOTES = {
    # year -> (worst volume, worst-offender check) — harvested from the
    # per-year validation_summary_<Y>.md findings.
    "2018-19": ("Vol 1 (expvol_1)", "W04 col 4 (abs_diff ≈ 2.5 million)"),
    "2019-20": ("Vol 2 (expvol_2)", "W05 col 4 (abs_diff ≈ 2.5 million)"),
    "2020-21": ("Vol 2 (expvol_2)", "W05 col 4 (abs_diff ≈ 2.6 million)"),
    "2021-22": ("Vol 1 (expvol_1)", "W05 col 4 (abs_diff ≈ 2.7 million)"),
    "2022-23": ("Vol 1 (expvol_1)", "W05 col 4 (abs_diff ≈ 2.9 million)"),
    "2023-24": ("Vol 3 (expvol_3)", "W07 col 1 (abs_diff ≈ 265 thousand)"),
    "2024-25": ("Vol 5 (expvol_5)", "W07 col 4 (abs_diff ≈ 376 thousand)"),
    "2025-26": ("Vol 1 (expvol_1)", "W07 col 4 (abs_diff ≈ 100 thousand)"),
    "2026-27": ("Vol 1 (expvol_1)", "W07 col 2 (abs_diff ≈ 90 thousand)"),
}

PACKAGES = {
    "karnataka": {
        "title": "Karnataka State Budget",
        "state": "KA",
        "pos_labels": {"1": "Actuals", "2": "BE", "3": "RE", "4": "BE"},
        "threshold_text": "₹0.01 (INR lakh, i.e. ₹1,000)",
        "trust_notes": KA_TRUST_NOTES,
        "trust_intro": (
            "Use this table to gauge how well the budget document's internal "
            "arithmetic checks out year by year. 2018-19–2022-23 used recovered "
            "historical summaries for some volumes and have significantly lower "
            "pass rates than 2023-24 onward."),
        "glossary": [
            ("W01", "in_schema", "Object Data → Minor Total (within object_head table)"),
            ("W02", "in_schema", "Object Data → Sub-Major Total (within object_head table)"),
            ("W03", "in_schema", "Minor Data → Minor Total (within minor_head table)"),
            ("W04", "in_schema", "Minor Data → Sub-Major Total (within minor_head table)"),
            ("W05", "in_schema", "Sub-Major Data → Sub-Major Total (within sub_major_head table)"),
            ("W06", "in_schema", "Object Data → Detailed-Head Total / HOA Total (within object_head table)"),
            ("W07", "in_schema", "Object Data → Major-Head Total (within object_head table)"),
            ("A01", "across_schema", "Object Minor Total → Minor Data (cross-table)"),
            ("A02", "across_schema", "Object Sub-Major Total → Sub-Major Data (cross-table)"),
            ("A03", "across_schema", "Minor Sub-Major Total → Sub-Major Data (cross-table)"),
        ],
        "glossary_note": (
            "W = within-schema (single table); A = across-schema (two table "
            "types). Checks W03–W05 and A01–A03 apply only to years that "
            "included <code>minor_head</code> and <code>sub_major_head</code> "
            "table types (2018-19–2022-23)."),
        "anomalies": (
            "<p><b>Animal Husbandry &amp; Fisheries (Demand 02), 2024-25 — "
            "Actuals/BE ratio ≈ 14×:</b> In 2024-25, Actuals (col 1) for Demand "
            "02 (Animal Husbandry &amp; Fisheries) appear approximately 14 times "
            "larger than the Budget Estimate (col 4). This is flagged here as "
            "something to investigate — it may reflect a genuine budget "
            "restructuring (the department's actual expenditure patterns changed "
            "substantially), a demand-number reassignment, or a positional "
            "labelling question. The validation checks do not flag it as a data "
            "error; the arithmetic is internally consistent. Researchers "
            "comparing across years should verify the demand-level continuity "
            "before drawing conclusions.</p>"),
    },
    "tamil-nadu": {
        "title": "Tamil Nadu State Budget",
        "state": "TN",
        "pos_labels": {"1": "Accounts", "2": "BE", "3": "RE", "4": "BE"},
        "threshold_text": "0.5 (INR thousand — TN figures are integers, so a "
                          "pass means the two figures match exactly)",
        "trust_notes": {},
        "trust_intro": (
            "Use this table to gauge how well the budget document's internal "
            "arithmetic checks out year by year. All TN years were extracted on "
            "one pipeline; 2021-22 is the interim (Revised Budget Estimate) "
            "publication and covers demands 01–37 only."),
        "glossary": [
            ("V01", "in_schema", "Σ Sub-Detailed leaves → Detailed-Head Total"),
            ("V02", "in_schema", "Σ Detailed-Head Totals → Sub-Head Total"),
            ("V03", "in_schema", "Σ Sub-Head Totals → Group (plan-band) Total"),
            ("V04", "in_schema", "Σ Group Totals → Minor-Head Total"),
            ("V05", "in_schema", "Σ Minor-Head Totals → Sub-Major Total"),
            ("V06", "in_schema", "Σ Sub-Major Totals → Major-Head Total"),
            ("V07", "in_schema", "Σ Sub-Head Totals → Minor-Head Total (group-independent bridge)"),
        ],
        "glossary_note": (
            "TN publishes one uniform detailed table, so every check is "
            "within-schema (V-series). The V ids are deliberately distinct from "
            "Karnataka's W-series: the identities tested differ because the two "
            "states print different hierarchy levels."),
        "anomalies": None,
    },
}


# ---------------------------------------------------------------------------
# Fiscal-year label helpers
# ---------------------------------------------------------------------------
def fiscal_labels(doc_year: str, pos: str, pos_labels: dict):
    """(fiscal_year, financial_column_label) for a positional column.
    Positions: 1 → doc_year−2 (Actuals/Accounts); 2, 3 → doc_year−1 (BE, RE);
    4 → doc_year (BE). Identical convention in both packages."""
    if pos == "ALL":
        return "ALL", "ALL"
    y = int(doc_year[:4])
    offsets = {"1": -2, "2": -1, "3": -1, "4": 0}
    if pos not in offsets:
        return "", ""
    start = y + offsets[pos]
    fy = f"{start}-{(start + 1) % 100:02d}"
    return fy, f"{pos_labels[pos]} {fy}"


def discover_years(years_dir: Path, prefix: str) -> list:
    """Year dirs are <PREFIX>_<YYYY-YY>; return the bare years."""
    years = []
    if years_dir.is_dir():
        for d in sorted(years_dir.iterdir()):
            if not d.name.startswith(f"{prefix}_"):
                continue
            year = d.name[len(prefix) + 1:]
            if (d / f"{prefix}_csv" / f"{prefix}_checks_{year}.csv").is_file():
                years.append(year)
    if not years:
        raise SystemExit(f"ERROR: no years with checks CSVs under {years_dir}")
    return years


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------
class Bucket:
    """n_checks / n_passed plus streaming moments of accuracy_pct."""
    __slots__ = ("n", "passed", "acc_sum", "acc_sumsq")

    def __init__(self):
        self.n = 0
        self.passed = 0
        self.acc_sum = 0.0
        self.acc_sumsq = 0.0

    def add(self, passed: int, acc: float):
        self.n += 1
        self.passed += passed
        self.acc_sum += acc
        self.acc_sumsq += acc * acc

    @property
    def pass_pct(self):
        return 100.0 * self.passed / self.n if self.n else None

    @property
    def mu(self):
        return self.acc_sum / self.n if self.n else None

    @property
    def sigma(self):
        if not self.n:
            return None
        var = self.acc_sumsq / self.n - (self.acc_sum / self.n) ** 2
        return math.sqrt(max(0.0, var))


def build_aggregations(years_dir: Path, years: list, prefix: str):
    """Read all checks CSVs; return bucket dict.

    Key: (doc_year, level, demand, major, sub_major, minor, sub_head, detailed, pos)

    Each check row is attributed to ALL ancestor levels (Year, Demand, MajorHead,
    and any deeper levels for which the row has non-empty codes). This guarantees:
        Year.n_checks == sum(Demand children)
        Demand.n_checks == sum(MajorHead children)
    for those two rollups (both demand_number and major_head_code are always present).
    """
    buckets = defaultdict(Bucket)

    for year in years:
        checks_path = (years_dir / f"{prefix}_{year}" / f"{prefix}_csv"
                       / f"{prefix}_checks_{year}.csv")
        with open(checks_path, newline="") as f:
            for row in csv.DictReader(f):
                d = row["demand_number"]
                m = row["major_head_code"]
                sm = row["sub_major_head_code"]
                mi = row["minor_head_code"]
                sh = row["sub_head_code"]
                dt = row["detailed_head_code"]
                pos = row["financial_column_position"]
                passed = 1 if row["passed"] == "1" else 0
                try:
                    acc = float(row["accuracy_pct"])
                except (ValueError, KeyError):
                    acc = 100.0 if passed else 0.0

                def add(level, d_, m_, sm_, mi_, sh_, dt_):
                    k = (year, level, d_, m_, sm_, mi_, sh_, dt_, pos)
                    ka = (year, level, d_, m_, sm_, mi_, sh_, dt_, "ALL")
                    buckets[k].add(passed, acc)
                    buckets[ka].add(passed, acc)

                # Always attribute to the top three levels
                add("Year", "", "", "", "", "", "")
                add("Demand", d, "", "", "", "", "")
                add("MajorHead", d, m, "", "", "", "")

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
def write_csv(buckets, out_csv: Path, pos_labels: dict, compress: bool = False):
    rows = []
    for (doc_year, level, demand, major, sub_major, minor, sub_head, detailed, pos), b in buckets.items():
        fy, fl = fiscal_labels(doc_year, pos, pos_labels)
        rows.append({
            "document_year": doc_year,
            "fiscal_year": fy,
            "level": level,
            "demand_number": demand,
            "major_head_code": major,
            "sub_major_head_code": sub_major,
            "minor_head_code": minor,
            "sub_head_code": sub_head,
            "detailed_head_code": detailed,
            "financial_column_position": pos,
            "financial_column_label": fl,
            "n_checks": b.n,
            "n_passed": b.passed,
            "pass_pct": "" if b.pass_pct is None else f"{b.pass_pct:.2f}",
            "mu_accuracy_pct": "" if b.mu is None else f"{b.mu:.2f}",
            "sigma_accuracy_pct": "" if b.sigma is None else f"{b.sigma:.2f}",
        })

    level_idx = {l: i for i, l in enumerate(LEVEL_ORDER)}
    pos_idx = {p: i for i, p in enumerate(POS_ORDER)}
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

    if compress:
        # Deterministic gzip (mtime=0): TN's summary is ~1.6M rows and the
        # plain CSV exceeds GitHub's 100 MB per-file limit.
        with open(out_csv, "wb") as raw, \
                gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as gz, \
                io.TextIOWrapper(gz, encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
            writer.writeheader()
            writer.writerows(rows)
    else:
        with open(out_csv, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
            writer.writeheader()
            writer.writerows(rows)

    print(f"CSV: {len(rows):,} rows → {out_csv}")
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


def node_mini_table(doc_year, level, demand, major, sub_major, minor, sub_head,
                    detailed, buckets, pos_labels):
    lines = [
        "<table class='nt'><tr><th>Pos</th><th>Measure / Fiscal Year</th>"
        "<th>n_checks</th><th>n_passed</th><th>pass%</th>"
        "<th>μ acc%</th><th>σ acc%</th></tr>"
    ]
    for pos in POS_ORDER:
        k = (doc_year, level, demand, major, sub_major, minor, sub_head, detailed, pos)
        b = buckets.get(k)
        if b is None:
            continue
        fy, fl = fiscal_labels(doc_year, pos, pos_labels)
        p = b.pass_pct
        pstr = f"{p:.1f}%" if p is not None else "—"
        mu = f"{b.mu:.2f}" if b.mu is not None else "—"
        sigma = f"{b.sigma:.2f}" if b.sigma is not None else "—"
        lines.append(
            f"<tr><td>{html_mod.escape(pos)}</td>"
            f"<td>{html_mod.escape(fl)}</td>"
            f"<td>{b.n:,}</td><td>{b.passed:,}</td>"
            f"<td{pct_class(p)}>{pstr}</td>"
            f"<td>{mu}</td><td>{sigma}</td></tr>"
        )
    lines.append("</table>")
    return "\n".join(lines)


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


def generate_html(buckets, years, cfg, cap_level):
    pos_labels = cfg["pos_labels"]
    pfx = cfg["state"]

    # index: (level, doc_year) -> sorted unique hierarchy tuples
    idx = defaultdict(set)
    for (doc_year, level, d, m, sm, mi, sh, dt, pos) in buckets.keys():
        if pos == "ALL":
            idx[(level, doc_year)].add((d, m, sm, mi, sh, dt))
    idx = {k: sorted(v) for k, v in idx.items()}

    cap_idx = LEVEL_ORDER.index(cap_level)
    depth_path = " ▸ ".join(LEVEL_DISPLAY[l] for l in LEVEL_ORDER[1:cap_idx + 1])
    parts = []

    parts.append(f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html_mod.escape(cfg['title'])} — Validation Summary</title>
<style>{CSS}</style>
<script>{JS}</script>
</head>
<body>
<h1>{html_mod.escape(cfg['title'])} — Validation Summary</h1>
<p style="color:#555;font-size:0.9em">
  Generated from <code>{pfx}_years/{pfx}_&lt;Y&gt;/{pfx}_csv/{pfx}_checks_&lt;Y&gt;.csv</code>
  ({len(years)} years, {years[0]} – {years[-1]}). Full Sub-Head and Detailed
  drill-down in <code>{pfx}_validation_summary.csv</code>.
  HTML tree depth: {depth_path}.
</p>
<p>
  <button onclick="expandAll()">Expand all</button>
  <button onclick="collapseAll()">Collapse all</button>
</p>
""")

    # ---- Trust Gradient (computed from the buckets) ----
    parts.append("<h2>Cross-Year Pass-Rate Trust Gradient</h2>")
    parts.append(f"<p>{cfg['trust_intro']}</p>")
    notes = cfg["trust_notes"]
    has_notes = any(y in notes for y in years)
    parts.append("<table>")
    header = ("<tr><th>Year</th><th>Overall pass%</th><th>n_passed</th>"
              "<th>n_checks</th><th>μ accuracy%</th><th>σ accuracy%</th>")
    if has_notes:
        header += "<th>Worst volume</th><th>Worst-offender check</th>"
    parts.append(header + "</tr>")
    for year in years:
        b = buckets.get((year, "Year", "", "", "", "", "", "", "ALL"))
        if b is None:
            continue
        pp = b.pass_pct
        p_class = "hi" if pp >= 95 else ("med" if pp >= 85 else "lo")
        row = (f"<tr><td><b>{year}</b></td>"
               f"<td class='{p_class}'>{pp:.2f}%</td>"
               f"<td>{b.passed:,}</td><td>{b.n:,}</td>"
               f"<td>{b.mu:.2f}</td><td>{b.sigma:.2f}</td>")
        if has_notes:
            wv, wc = notes.get(year, ("—", "—"))
            row += (f"<td>{html_mod.escape(wv)}</td>"
                    f"<td><small>{html_mod.escape(wc)}</small></td>")
        parts.append(row + "</tr>")
    parts.append("</table>")
    parts.append("""<p><small>μ accuracy% is the mean of every comparison's
accuracy_pct (passing checks count as 100), σ accuracy% its population standard
deviation — a high pass% with a visibly non-zero σ means the failures that do
exist are badly off, not marginal.</small></p>""")

    # ---- Column legend ----
    parts.append("<h2>Column Legend (validation_summary.csv)</h2>")
    parts.append("<table><tr><th>Column</th><th>Meaning</th></tr>")
    for col, meaning in COLUMN_LEGEND:
        parts.append(f"<tr><td><code>{html_mod.escape(col)}</code></td>"
                     f"<td>{html_mod.escape(meaning)}</td></tr>")
    parts.append("</table>")

    # ---- What a failure means ----
    parts.append("<h2>What Does a Validation Failure Mean?</h2>")
    parts.append(f"""<div class='info'>
<p>A validation failure measures <b>internal accounting consistency</b> in the printed budget
document — not line-level PDF extraction accuracy. Each check verifies that a printed subtotal
(e.g. a Minor-Head total row) equals the arithmetic sum of its component detail rows, all within
the same budget document. A failure means the two numbers disagree by more than {cfg['threshold_text']}.
Possible causes include: OCR mis-reads, table-structure parsing mismatches, historical document
corrections applied inconsistently, or genuine arithmetic discrepancies in the original printed
budget.</p>
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

    # ---- Anomalies ----
    if cfg.get("anomalies"):
        parts.append("<h2>Anomalies to Investigate (Not Errors)</h2>")
        parts.append(f"<div class='inv'>{cfg['anomalies']}</div>")

    # ---- Check-code glossary ----
    parts.append("<h2>Check-Code Glossary</h2>")
    parts.append("<table><tr><th>Code</th><th>Scope</th><th>Meaning</th></tr>")
    for code, scope, meaning in cfg["glossary"]:
        parts.append(f"<tr><td><b>{html_mod.escape(code)}</b></td><td>{html_mod.escape(scope)}</td>"
                     f"<td>{html_mod.escape(meaning)}</td></tr>")
    parts.append("</table>")
    parts.append(f"<p><small>{cfg['glossary_note']}</small></p>")

    # ---- Drill-down tree ----
    parts.append("<h2>Drill-Down by Year</h2>")
    parts.append(f"""<p>Tree depth: {depth_path}.
Each node shows pass%, μ/σ accuracy and check counts per financial-column position (1–4)
plus an ALL rollup. For Minor Head, Sub-Head, and Detailed depth, use
<code>validation_summary.csv</code> (HTML would exceed the size budget at Minor depth).</p>""")

    def cls(p):
        return "hi" if p >= 95 else ("med" if p >= 85 else "lo")

    for year in years:
        b = buckets.get((year, "Year", "", "", "", "", "", "", "ALL"))
        if b is None:
            continue
        p = b.pass_pct
        parts.append("<details>")
        parts.append(f"<summary class='{cls(p)}'>📅 {year} — {p:.2f}% pass "
                     f"({b.passed:,}/{b.n:,} checks)</summary>")
        parts.append(node_mini_table(year, "Year", "", "", "", "", "", "", buckets, pos_labels))

        demands = sorted(set(d for (d, m, sm, mi, sh, dt) in idx.get(("Demand", year), [])))
        for demand in demands:
            bd = buckets.get((year, "Demand", demand, "", "", "", "", "", "ALL"))
            if bd is None:
                continue
            pd_ = bd.pass_pct
            parts.append("  <details>")
            parts.append(f"  <summary class='{cls(pd_)}'>"
                         f"{html_mod.escape(f'Demand {demand} — {pd_:.1f}% ({bd.passed:,}/{bd.n:,})')}</summary>")
            parts.append(node_mini_table(year, "Demand", demand, "", "", "", "", "", buckets, pos_labels))

            if cap_idx >= LEVEL_ORDER.index("MajorHead"):
                majors = sorted(set(m for (d, m, sm, mi, sh, dt)
                                    in idx.get(("MajorHead", year), []) if d == demand))
                for major in majors:
                    bm = buckets.get((year, "MajorHead", demand, major, "", "", "", "", "ALL"))
                    if bm is None:
                        continue
                    pm_ = bm.pass_pct
                    parts.append("    <details>")
                    parts.append(f"    <summary class='{cls(pm_)}'>"
                                 f"{html_mod.escape(f'Major {major} — {pm_:.1f}% ({bm.passed:,}/{bm.n:,})')}</summary>")
                    parts.append(node_mini_table(year, "MajorHead", demand, major, "", "", "", "", buckets, pos_labels))

                    if cap_idx >= LEVEL_ORDER.index("SubMajor"):
                        sub_majors = sorted(set(sm for (d, m, sm, mi, sh, dt)
                                                in idx.get(("SubMajor", year), [])
                                                if d == demand and m == major))
                        for sub_major in sub_majors:
                            bsm = buckets.get((year, "SubMajor", demand, major, sub_major, "", "", "", "ALL"))
                            if bsm is None:
                                continue
                            psm_ = bsm.pass_pct
                            parts.append("      <details>")
                            parts.append(f"      <summary class='{cls(psm_)}'>"
                                         f"{html_mod.escape(f'SubMajor {sub_major} — {psm_:.1f}% ({bsm.passed:,}/{bsm.n:,})')}</summary>")
                            parts.append(node_mini_table(year, "SubMajor", demand, major, sub_major, "", "", "", buckets, pos_labels))
                            parts.append("      </details>")

                    parts.append("    </details>")

            parts.append("  </details>")

        parts.append("</details>")

    parts.append("</body></html>")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--package", default="karnataka",
                    choices=sorted(PACKAGES))
    args = ap.parse_args()

    cfg = PACKAGES[args.package]
    base_dir = REPO_ROOT / "state-finances" / args.package
    prefix = cfg["state"]
    years_dir = base_dir / f"{prefix}_years"
    # TN's summary (~1.6M rows) exceeds GitHub's 100 MB file limit uncompressed.
    compress = args.package == "tamil-nadu"
    out_csv = base_dir / (f"{prefix}_validation_summary.csv.gz" if compress
                          else f"{prefix}_validation_summary.csv")
    out_html = base_dir / f"{prefix}_validation_summary.html"

    years = discover_years(years_dir, prefix)
    print(f"Package: {args.package} — {len(years)} years ({years[0]} … {years[-1]})")

    print("Building aggregations from checks CSVs...")
    buckets = build_aggregations(years_dir, years, prefix)
    print(f"  Total buckets: {len(buckets):,}")

    print("Writing CSV...")
    write_csv(buckets, out_csv, cfg["pos_labels"], compress=compress)
    if compress:
        # Drop a stale uncompressed twin from a pre-gzip build.
        (base_dir / f"{prefix}_validation_summary.csv").unlink(missing_ok=True)

    cap_level = HTML_CAP_LEVELS[args.package]
    print(f"Generating HTML (cap at {cap_level})...")
    html_content = generate_html(buckets, years, cfg, cap_level)
    size_mb = len(html_content.encode("utf-8")) / 1e6
    with open(out_html, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"HTML: {size_mb:.2f} MB → {out_html}")

    # --- Verification: rollup invariants ---
    print("\n--- Verification ---")
    year_totals, demand_sum = {}, {}
    demand_totals, major_sum = {}, {}
    for (doc_year, level, d, m, sm, mi, sh, dt, pos), b in buckets.items():
        if pos != "ALL":
            continue
        if level == "Year":
            year_totals[doc_year] = b
        elif level == "Demand":
            demand_sum.setdefault(doc_year, [0, 0])
            demand_sum[doc_year][0] += b.n
            demand_sum[doc_year][1] += b.passed
            demand_totals[(doc_year, d)] = b
        elif level == "MajorHead":
            major_sum.setdefault((doc_year, d), [0, 0])
            major_sum[(doc_year, d)][0] += b.n
            major_sum[(doc_year, d)][1] += b.passed

    ok = True
    for year in years:
        yt = year_totals.get(year)
        ds = demand_sum.get(year, [0, 0])
        match = yt is not None and yt.n == ds[0]
        ok &= match
        print(f"  {year}: Year n_checks={yt.n if yt else 0:,} vs "
              f"sum(Demands)={ds[0]:,} → {'OK' if match else 'MISMATCH'}")
    mismatches = sum(1 for key, b in demand_totals.items()
                     if b.n != major_sum.get(key, [0, 0])[0])
    print("  Demand == sum(MajorHead): "
          + ("ALL MATCH" if mismatches == 0 else f"{mismatches} MISMATCHES"))
    if not ok or mismatches:
        raise SystemExit("ERROR: rollup invariants violated")


if __name__ == "__main__":
    main()
