#!/usr/bin/env python3
"""
Build the visual assets for the guide (how-to-use.html) and showcase (showcase.html).

Reuses the analysis engine in budget_examples.py and the demand-name lookup in
demand_names.json (transcribed from the in-package volume covers). Writes:
  results.json                     -- all datasets, Rs crore
  chart_q1_health.svg              -- health: BE vs RE vs Actuals (lines)
  chart_q2_committed.svg           -- committed expenditure: BE vs RE vs Actuals (lines)
  chart_q3_demand.svg              -- top demands by name: BE vs RE vs Actuals (grouped bars)
  chart_total_expenditure.svg      -- total vs committed expenditure, 11 years (layered area)
  chart_demands_ranked.svg         -- all demands ranked by Actuals 2024-25 (horizontal bars)

Self-contained, stdlib only. Standalone animated SVGs (animate on open or via <img>).
"""

import json
import os
from collections import defaultdict

from budget_examples import (
    build_records, canonical, cr,
    HEALTH_MAJOR_HEADS, INTEREST_MAJOR_HEAD, PENSION_MAJOR_HEAD, SALARY_OBJECT_CODES,
)

HERE = os.path.dirname(os.path.abspath(__file__))
DEMANDS = json.load(open(os.path.join(HERE, "demand_names.json")))["demands"]
FY3 = "2024-25"

# --- fiscal-broadsheet palette --------------------------------------------------------
PAPER = "#f6f1e4"; INK = "#211e18"; MUTED = "#7a7160"; GRID = "#e0d8c4"; AXIS = "#b7ab90"
C_BE = "#243f6b"   # Budget   -> the plan (navy)
C_RE = "#c0851d"   # Revised  -> the revision (ochre)
C_AC = "#2c7361"   # Actuals  -> reality (teal)


def dname(d, key="name"):
    return DEMANDS.get(d, {}).get(key, f"Demand {d}")


# ====================================================================================
# 1. compute datasets
# ====================================================================================
def compute(canon):
    h = defaultdict(lambda: defaultdict(float))
    comm = defaultdict(lambda: defaultdict(float))
    total = defaultdict(lambda: defaultdict(float))
    dem = defaultdict(lambda: defaultdict(float))     # demand -> measure -> amt (FY3)
    for r in canon:
        m, fy = r["measure"], r["fiscal_year"]
        total[fy][m] += r["amount"]
        if r["mh_code"] in HEALTH_MAJOR_HEADS:
            h[fy][m] += r["amount"]
        if (r["mh_code"] in (PENSION_MAJOR_HEAD, INTEREST_MAJOR_HEAD)
                or r["oh_code"] in SALARY_OBJECT_CODES):
            comm[fy][m] += r["amount"]
        if fy == FY3 and r["demand"]:
            dem[r["demand"]][m] += r["amount"]

    q1 = [{"year": fy, "be": cr(h[fy]["BE"]), "re": cr(h[fy]["RE"]), "actuals": cr(h[fy]["Actuals"])}
          for fy in sorted(h) if h[fy]["BE"] > 0]
    q2 = [{"year": fy, "be": cr(comm[fy]["BE"]), "re": cr(comm[fy]["RE"]), "actuals": cr(comm[fy]["Actuals"])}
          for fy in sorted(comm) if comm[fy]["BE"] > 0]
    totals = [{"year": fy, "total_be": cr(total[fy]["BE"]), "committed_be": cr(comm[fy]["BE"])}
              for fy in sorted(total) if total[fy]["BE"] > 0]
    demands = sorted(
        ({"demand": d, "name": dname(d), "short": dname(d, "short"),
          "be": cr(dem[d]["BE"]), "re": cr(dem[d]["RE"]), "actuals": cr(dem[d]["Actuals"]),
          "act_be": (dem[d]["Actuals"] / dem[d]["BE"]) if dem[d]["BE"] else None}
         for d in dem),
        key=lambda x: x["actuals"], reverse=True)
    return q1, q2, totals, demands


# ====================================================================================
# 2. tiny SVG toolkit
# ====================================================================================
W, H = 860, 460
ML, MR, MT, MB = 74, 24, 74, 70
PW, PH = W - ML - MR, H - MT - MB
SERIES = [("Budget Estimate", "be", C_BE), ("Revised Estimate", "re", C_RE), ("Actuals", "actuals", C_AC)]
FONT = 'font-family="Georgia,\'Times New Roman\',serif"'
MONO = 'font-family="ui-monospace,\'SFMono-Regular\',Menlo,monospace"'


def _esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _nice_max(v):
    import math
    if v <= 0:
        return 1
    mag = 10 ** math.floor(math.log10(v))
    for m in (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10):
        if m * mag >= v:
            return m * mag
    return 10 * mag


def _head(title, subtitle, w=W, h=H):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" font-size="13" '
            f'role="img" aria-label="{title}"><style>'
            '@keyframes draw{to{stroke-dashoffset:0}}@keyframes grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}'
            '@keyframes growx{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes fade{from{opacity:0}to{opacity:1}}'
            '.ln{stroke-dasharray:1600;stroke-dashoffset:1600;animation:draw 1.7s cubic-bezier(.3,.7,.3,1) forwards}'
            '.dot{opacity:0;animation:fade .5s ease forwards}.ar{opacity:0;animation:fade 1.1s ease forwards}'
            '.bar{transform-origin:center bottom;animation:grow .9s cubic-bezier(.3,.8,.4,1) both}'
            '.hbar{transform-origin:left center;animation:growx .9s cubic-bezier(.3,.8,.4,1) both}'
            '.gl{opacity:0;animation:fade .8s ease forwards}</style>'
            f'<rect width="{w}" height="{h}" fill="{PAPER}"/>'
            f'<text x="{ML}" y="32" {FONT} font-size="21" font-style="italic" fill="{INK}">{_esc(title)}</text>'
            f'<text x="{ML}" y="52" {FONT} font-size="12" fill="{MUTED}">{_esc(subtitle)}</text>')


def _legend(items, y=None):
    y = y if y is not None else H - 24
    x = ML
    out = []
    for name, col in items:
        out.append(f'<rect x="{x}" y="{y-9}" width="14" height="9" rx="1.5" fill="{col}"/>'
                   f'<text x="{x+20}" y="{y}" {FONT} font-size="12" fill="{INK}">{name}</text>')
        x += 40 + len(name) * 7.2
    return "".join(out)


def _yaxis(ymax, unit="Rs crore", w=PW):
    out = []
    for i in range(6):
        v = ymax * i / 5
        y = MT + PH - PH * i / 5
        out.append(f'<line class="gl" style="animation-delay:{i*60}ms" x1="{ML}" y1="{y:.1f}" '
                   f'x2="{ML+w}" y2="{y:.1f}" stroke="{GRID}"/>')
        out.append(f'<text x="{ML-10}" y="{y+4:.1f}" {MONO} font-size="11" fill="{MUTED}" '
                   f'text-anchor="end">{v:,.0f}</text>')
    out.append(f'<text x="18" y="{MT+PH/2}" {FONT} font-size="11" fill="{MUTED}" '
               f'transform="rotate(-90 18 {MT+PH/2})" text-anchor="middle">{unit}</text>')
    return "".join(out)


def line_chart(data, title, subtitle):
    ymax = _nice_max(max(max(d["be"], d["re"], d["actuals"]) for d in data))
    n = len(data)
    xs = [ML + (PW * (i + 0.5) / n) for i in range(n)]
    svg = [_head(title, subtitle), _yaxis(ymax)]
    for i, d in enumerate(data):
        svg.append(f'<text x="{xs[i]:.1f}" y="{MT+PH+20}" {MONO} font-size="10" fill="{MUTED}" '
                   f'text-anchor="middle" transform="rotate(35 {xs[i]:.1f} {MT+PH+20})">{d["year"]}</text>')
    for si, (_, key, col) in enumerate(SERIES):
        pts = [(xs[i], MT + PH - PH * d[key] / ymax) for i, d in enumerate(data) if d[key] > 0]
        if not pts:
            continue
        path = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        svg.append(f'<path class="ln" style="animation-delay:{si*250}ms" d="{path}" fill="none" '
                   f'stroke="{col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>')
        for j, (x, y) in enumerate(pts):
            svg.append(f'<circle class="dot" style="animation-delay:{900+si*120+j*30}ms" cx="{x:.1f}" '
                       f'cy="{y:.1f}" r="3.2" fill="{PAPER}" stroke="{col}" stroke-width="2"/>')
    svg.append(_legend([(n, c) for n, _, c in SERIES]))
    svg.append("</svg>")
    return "".join(svg)


def grouped_bars(data, title, subtitle):
    ymax = _nice_max(max(max(d["be"], d["re"], d["actuals"]) for d in data))
    n = len(data)
    gw = PW / n
    bw = gw * 0.24
    svg = [_head(title, subtitle), _yaxis(ymax)]
    for i, d in enumerate(data):
        gx = ML + gw * i + gw * 0.14
        for si, (_, key, col) in enumerate(SERIES):
            v = max(d[key], 0)
            bh = PH * v / ymax
            svg.append(f'<rect class="bar" style="animation-delay:{i*70+si*60}ms" x="{gx+si*bw:.1f}" '
                       f'y="{MT+PH-bh:.1f}" width="{bw:.1f}" height="{bh:.1f}" fill="{col}" rx="1"/>')
        svg.append(f'<text x="{gx+1.5*bw:.1f}" y="{MT+PH+18}" {FONT} font-size="10.5" fill="{INK}" '
                   f'text-anchor="end" transform="rotate(35 {gx+1.5*bw:.1f} {MT+PH+18})">{_esc(d["short"])}</text>')
    svg.append(_legend([(n, c) for n, _, c in SERIES]))
    svg.append("</svg>")
    return "".join(svg)


def area_chart(totals, title, subtitle):
    ymax = _nice_max(max(t["total_be"] for t in totals))
    n = len(totals)
    xs = [ML + (PW * (i + 0.5) / (n - 1 + 0.0001) if n > 1 else ML) for i in range(n)]
    xs = [ML + PW * i / (n - 1) for i in range(n)]
    svg = [_head(title, subtitle), _yaxis(ymax)]
    base = MT + PH

    def area(key, col, op, delay):
        pts = [(xs[i], MT + PH - PH * totals[i][key] / ymax) for i in range(n)]
        d = f'M{xs[0]:.1f},{base:.1f} ' + " ".join(f"L{x:.1f},{y:.1f}" for x, y in pts) + f' L{xs[-1]:.1f},{base:.1f} Z'
        line = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        return (f'<path class="ar" style="animation-delay:{delay}ms" d="{d}" fill="{col}" fill-opacity="{op}"/>'
                f'<path class="ln" style="animation-delay:{delay}ms" d="{line}" fill="none" stroke="{col}" stroke-width="2.4"/>')

    svg.append(area("total_be", C_BE, 0.13, 0))
    svg.append(area("committed_be", C_AC, 0.5, 300))
    for i in range(n):
        svg.append(f'<text x="{xs[i]:.1f}" y="{MT+PH+20}" {MONO} font-size="10" fill="{MUTED}" '
                   f'text-anchor="middle" transform="rotate(35 {xs[i]:.1f} {MT+PH+20})">{totals[i]["year"]}</text>')
    # annotate discretionary gap at last point
    svg.append(_legend([("Total expenditure (Budget)", C_BE), ("Committed: salary+pension+interest (Budget)", C_AC)]))
    svg.append("</svg>")
    return "".join(svg)


def hbar_chart(items, title, subtitle):
    """items: list of dicts with 'short' and 'actuals'. Horizontal bars, sorted desc."""
    left = 150
    row_h = 21
    top = 70
    h = top + row_h * len(items) + 40
    pw = W - left - 90
    ymax = _nice_max(max(it["actuals"] for it in items))
    svg = [_head(title, subtitle, w=W, h=h)]
    for i, it in enumerate(items):
        y = top + i * row_h
        bw = pw * it["actuals"] / ymax
        col = C_BE if i > 0 else C_AC
        svg.append(f'<text x="{left-8}" y="{y+row_h*0.7:.1f}" {FONT} font-size="11.5" fill="{INK}" '
                   f'text-anchor="end">{_esc(it["short"])}</text>')
        svg.append(f'<rect class="hbar" style="animation-delay:{i*35}ms" x="{left}" y="{y+3:.1f}" '
                   f'width="{bw:.1f}" height="{row_h-7}" fill="{col}" rx="1.5"/>')
        svg.append(f'<text x="{left+bw+6:.1f}" y="{y+row_h*0.7:.1f}" {MONO} font-size="10.5" '
                   f'fill="{MUTED}">{it["actuals"]:,.0f}</text>')
    svg.append(f'<text x="{left}" y="{h-14}" {MONO} font-size="11" fill="{MUTED}">Rs crore, Actuals {FY3}</text>')
    svg.append("</svg>")
    return "".join(svg)


# ====================================================================================
def drilldown(canon):
    """Example granularity ladder: Demand 22 (Health & FW) -> head 2210 -> top object heads, BE 2024-25."""
    rows = [r for r in canon if r["fiscal_year"] == FY3 and r["measure"] == "BE" and r["demand"] == "22"]
    d_total = sum(r["amount"] for r in rows)
    mh2210 = sum(r["amount"] for r in rows if r["mh_code"] == "2210")
    oh = defaultdict(float)
    for r in rows:
        if r["mh_code"] == "2210":
            oh[r["oh_code"]] += r["amount"]
    return d_total, mh2210, sorted(oh.items(), key=lambda kv: kv[1], reverse=True)[:6]


def main():
    records, _ = build_records()
    canon = canonical(records)
    q1, q2, totals, demands = compute(canon)

    json.dump({"unit": "INR_crore", "q1_health": q1, "q2_committed": q2,
               "total_expenditure": totals, "demand_year": FY3, "demands": demands},
              open(os.path.join(HERE, "results.json"), "w"), indent=2)

    out = {
        "chart_q1_health.svg": line_chart(q1, "Health spending: plan vs reality",
            "Revenue heads 2210 + 2211 · Budget → Revised → Actuals, Rs crore"),
        "chart_q2_committed.svg": line_chart(q2, "Committed expenditure: the locked-in core",
            "Salaries + pensions (2071) + interest (2049) · Budget → Revised → Actuals, Rs crore"),
        "chart_q3_demand.svg": grouped_bars(demands[:10], f"Variation by demand head, {FY3}",
            "Top 10 demands by Actuals · Budget vs Revised vs Actuals, Rs crore"),
        "chart_total_expenditure.svg": area_chart(totals, "Eleven years of one state's budget",
            "Total vs committed expenditure (Budget Estimate), Rs crore"),
        "chart_demands_ranked.svg": hbar_chart(demands, f"All {len(demands)} departments, ranked",
            f"Every demand by Actuals, {FY3} · named from the volume covers"),
    }
    for fn, svg in out.items():
        open(os.path.join(HERE, fn), "w").write(svg)

    d_total, mh2210, oh = drilldown(canon)
    print("wrote results.json + 5 SVG charts")
    print(f"  q1 health yrs={len(q1)} | q2 committed yrs={len(q2)} | demands={len(demands)} ({FY3})")
    print(f"\nDrill-down (Demand 22 Health & FW, BE {FY3}): total={d_total/100:,.0f}cr "
          f"-> head 2210={mh2210/100:,.0f}cr")
    for code, v in oh:
        print(f"    object {code}: {v/100:,.0f}cr")
    print("\nDemands ranked (name / Act / Act_BE):")
    for it in demands:
        ab = f"{it['act_be']:.2f}" if it['act_be'] else "  -"
        print(f"  D{it['demand']:>2} {it['name'][:42]:<42} {it['actuals']:>10,.0f}  {ab}")


if __name__ == "__main__":
    main()
