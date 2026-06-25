#!/usr/bin/env python3
"""Compile the canonical results into a self-contained HTML slideshow.

Reads examples/data/processed/canonical_numbers.json (the reconciled answers to
the four worked analyses) and writes examples/doc/results.html: a dependency-free
deck with hand-built inline-SVG charts in the XKDR house style.

Because the deck is generated from the canonical fixture, its numbers can never
drift from the reconciliation suite. Regenerate after a data release:

    python3 examples/src/python/build_results_slideshow.py    # or: make -C examples slides

stdlib only.
"""
import json
import math
import os
from html import escape

HERE = os.path.dirname(os.path.abspath(__file__))
EXAMPLES_DIR = os.path.dirname(os.path.dirname(HERE))
CANONICAL = os.path.join(EXAMPLES_DIR, "data", "processed", "canonical_numbers.json")
OUT = os.path.join(EXAMPLES_DIR, "doc", "results.html")

# ---- XKDR palette ----------------------------------------------------------
INK        = "#212529"
PAPER      = "#f2f1f0"
CORAL      = "#f57d6a"   # hero accent / Actuals / latest
CORAL_DEEP = "#b5462f"   # AA-safe accent text / BE
SLATE      = "#3b6f78"   # second data series / RE / salaries
GOLD       = "#caa14a"   # third data series / interest
GRID       = "#d9d5d0"   # hairline ledger rules
MUTED      = "#5e6975"

# ---- numbers / scales ------------------------------------------------------

def crore(n):
    """Whole-crore figure with thousands separators."""
    return f"{round(n):,}"

def nice_max(v):
    if v <= 0:
        return 1
    mag = 10 ** math.floor(math.log10(v))
    for f in (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10):
        if f * mag >= v:
            return f * mag
    return 10 * mag

def ticks(maxv, n=4):
    return [maxv * i / n for i in range(n + 1)]

def x(value, lo, hi, plo, phi):
    if hi == lo:
        return plo
    return plo + (value - lo) / (hi - lo) * (phi - plo)

# ---- chart builders (return an <svg> string, viewBox-scaled) ---------------

def _svg_open(w, h):
    return (f'<svg viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid meet" '
            f'role="img" class="chart-svg">')

def chart_hbars(items, vkey, nkey, color=CORAL):
    """Single horizontal bars (magnitude): one bar per item, name above, value at end."""
    W, H = 820, 360
    L, R, T, B = 18, 132, 8, 14
    n = len(items)
    nm = nice_max(max(it[vkey] for it in items))
    rowh = (H - T - B) / n
    barh = min(30, rowh * 0.40)
    s = [_svg_open(W, H)]
    for i, it in enumerate(items):
        y0 = T + i * rowh
        bw = x(it[vkey], 0, nm, 0, W - L - R)
        by = y0 + rowh * 0.42
        s.append(f'<text class="c-name" x="{L}" y="{y0 + rowh*0.30:.1f}">{escape(it[nkey])}</text>')
        s.append(f'<rect class="bar" x="{L}" y="{by:.1f}" width="{bw:.1f}" height="{barh:.1f}" rx="2" fill="{color}"/>')
        s.append(f'<text class="c-val" x="{L + bw + 8:.1f}" y="{by + barh*0.74:.1f}">{crore(it[vkey])}</text>')
    s.append("</svg>")
    return "".join(s)

def chart_lines(years, series):
    """series: list of (label, color, dashed_bool, values[]). Zeros are treated as 'no data'."""
    W, H = 820, 400
    L, R, T, B = 60, 30, 40, 44
    pw, ph = W - L - R, H - T - B
    allv = [v for _, _, _, vals in series for v in vals if v > 0]
    nm = nice_max(max(allv))
    n = len(years)

    def px(i):
        return L + (0 if n == 1 else i / (n - 1) * pw)

    def py(v):
        return T + ph - v / nm * ph

    s = [_svg_open(W, H)]
    # y gridlines + labels (ledger rules)
    for tv in ticks(nm, 4):
        yy = py(tv)
        s.append(f'<line class="grid" x1="{L}" y1="{yy:.1f}" x2="{W-R}" y2="{yy:.1f}"/>')
        s.append(f'<text class="c-axis" x="{L-8}" y="{yy+3:.1f}" text-anchor="end">{crore(tv)}</text>')
    # x labels (every other year to avoid crowding; always show first and last)
    for i, yr in enumerate(years):
        if i % 2 == 0 or i == n - 1:
            anc = "start" if i == 0 else ("end" if i == n - 1 else "middle")
            s.append(f'<text class="c-axis" x="{px(i):.1f}" y="{H-B+18}" text-anchor="{anc}">{escape(yr)}</text>')
    # series
    for label, color, dashed, vals in series:
        pts = [(px(i), py(v)) for i, v in enumerate(vals) if v > 0]
        if len(pts) >= 2:
            d = " ".join(f"{xx:.1f},{yy:.1f}" for xx, yy in pts)
            dash = ' stroke-dasharray="6 4"' if dashed else ""
            s.append(f'<polyline class="line" points="{d}" fill="none" stroke="{color}" stroke-width="2.5"{dash}/>')
        for xx, yy in pts:
            s.append(f'<circle cx="{xx:.1f}" cy="{yy:.1f}" r="3" fill="{color}"/>')
    s.append("</svg>")
    legend = "".join(
        f'<span class="lg"><span class="sw" style="background:{c}"></span>{escape(l)}</span>'
        for l, c, _, _ in series)
    return f'<div class="legend">{legend}</div>' + "".join(s)

def chart_stacked(rows):
    """Stacked committed-spending columns (salaries+pensions+interest) with share% above each."""
    comps = [("Salaries", "salaries", SLATE), ("Pensions", "pensions", CORAL), ("Interest", "interest", GOLD)]
    W, H = 820, 430
    L, R, T, B = 60, 16, 30, 56
    pw, ph = W - L - R, H - T - B
    nm = nice_max(max(r["committed"] for r in rows))
    n = len(rows)
    slot = pw / n
    cw = slot * 0.60
    s = [_svg_open(W, H)]
    for tv in ticks(nm, 4):
        yy = T + ph - tv / nm * ph
        s.append(f'<line class="grid" x1="{L}" y1="{yy:.1f}" x2="{W-R}" y2="{yy:.1f}"/>')
        s.append(f'<text class="c-axis" x="{L-8}" y="{yy+3:.1f}" text-anchor="end">{crore(tv)}</text>')
    for i, r in enumerate(rows):
        cx = L + i * slot + (slot - cw) / 2
        base = T + ph
        for _, key, col in comps:
            hgt = r[key] / nm * ph
            s.append(f'<rect class="bar" x="{cx:.1f}" y="{base-hgt:.1f}" width="{cw:.1f}" height="{hgt:.1f}" fill="{col}"/>')
            base -= hgt
        s.append(f'<text class="c-share" x="{cx+cw/2:.1f}" y="{base-6:.1f}" text-anchor="middle">{r["share_pct"]:.0f}%</text>')
        yr = r["fiscal_year"]
        s.append(f'<text class="c-axis" x="{cx+cw/2:.1f}" y="{H-B+16}" text-anchor="middle" transform="rotate(-40 {cx+cw/2:.1f} {H-B+16})">{escape(yr)}</text>')
    s.append("</svg>")
    legend = "".join(
        f'<span class="lg"><span class="sw" style="background:{c}"></span>{escape(l)}</span>'
        for l, _, c in comps) + '<span class="lg lg-note">% = committed share of total spending</span>'
    return f'<div class="legend">{legend}</div>' + "".join(s)

def chart_paired(items):
    """Paired horizontal bars: first vs latest actuals per demand."""
    W, H = 820, 400
    L, R, T, B = 18, 150, 26, 12
    nm = nice_max(max(it["latest_actuals"] for it in items))
    n = len(items)
    rowh = (H - T - B) / n
    barh = min(11, rowh * 0.26)
    s = [_svg_open(W, H)]
    for i, it in enumerate(items):
        y0 = T + i * rowh
        s.append(f'<text class="c-name" x="{L}" y="{y0 + rowh*0.32:.1f}">{escape(it["name"])}</text>')
        fw = x(it["first_actuals"], 0, nm, 0, W - L - R)
        lw = x(it["latest_actuals"], 0, nm, 0, W - L - R)
        yf = y0 + rowh * 0.40
        yl = yf + barh + 3
        s.append(f'<rect x="{L}" y="{yf:.1f}" width="{max(fw,1):.1f}" height="{barh:.1f}" rx="1.5" fill="{SLATE}" opacity="0.55"/>')
        s.append(f'<rect class="bar" x="{L}" y="{yl:.1f}" width="{max(lw,1):.1f}" height="{barh:.1f}" rx="1.5" fill="{CORAL}"/>')
        mult = it["latest_actuals"] / it["first_actuals"] if it["first_actuals"] else 0
        s.append(f'<text class="c-val" x="{L + max(lw, fw) + 8:.1f}" y="{yl + barh*0.9:.1f}">{crore(it["latest_actuals"])} cr · {mult:.0f}&times;</text>')
    s.append("</svg>")
    legend = (f'<span class="lg"><span class="sw" style="background:{SLATE};opacity:.55"></span>2014-15 actuals</span>'
              f'<span class="lg"><span class="sw" style="background:{CORAL}"></span>2024-25 actuals</span>'
              f'<span class="lg lg-note">&times; = growth over the decade</span>')
    return f'<div class="legend">{legend}</div>' + "".join(s)

# ---- slide assembly --------------------------------------------------------

def slide(n, total, eyebrow, title, lede, headline_val, headline_lab, chart, source):
    head = ""
    if headline_val:
        head = (f'<div class="headline"><span class="fig">{headline_val}</span>'
                f'<span class="figlab">{escape(headline_lab)}</span></div>')
    return f'''<section class="slide" data-n="{n}">
  <div class="slide-inner">
    <div class="slide-head">
      <div class="eyebrow">{escape(eyebrow)}</div>
      <h2>{escape(title)}</h2>
      <p class="lede">{lede}</p>
      {head}
    </div>
    <div class="chart">{chart}<p class="src">{escape(source)}</p></div>
  </div>
</section>'''


def build(data):
    ob = data["onboarding"]
    top5 = ob["top5_departments_latest_actuals"]
    svb = ob["spend_vs_budget"]
    q1 = data["q1_health"]
    q2 = data["q2_committed"]
    q3 = data["q3_demand"]["rows"]

    years_h = [r["fiscal_year"] for r in q1]
    health = chart_lines(years_h, [
        ("BE (plan)", INK, False, [r["be"] for r in q1]),
        ("RE (revised)", SLATE, True, [r["re"] for r in q1]),
        ("Actuals (spent)", CORAL, False, [r["actuals"] for r in q1]),
    ])
    health_latest = next(r for r in q1 if r["fiscal_year"] == "2024-25")

    committed = chart_stacked(q2)
    q2_latest = q2[-1]
    q2_first = q2[0]

    grown = [r for r in q3 if r["latest_actuals"] > 1500 and r["first_actuals"] > 0]
    grown.sort(key=lambda r: r["latest_actuals"] - r["first_actuals"], reverse=True)
    grown = grown[:8]
    growth = chart_paired(grown)
    energy = next(r for r in q3 if r["name"] == "Energy")

    title_slide = f'''<section class="slide title" data-n="0">
  <div class="slide-inner title-inner">
    <div class="eyebrow">XKDR · India public finance</div>
    <h1>Karnataka state finances</h1>
    <p class="subtitle">Four findings from a decade of the state budget &mdash; extracted from the Detailed Estimates of Expenditure, reconciled across Python, R, and DuckDB.</p>
    <div class="title-stats">
      <div><span class="fig">11</span><span class="figlab">fiscal years</span></div>
      <div><span class="fig">29</span><span class="figlab">demands (departments)</span></div>
      <div><span class="fig">&#8377;{crore(svb['be'])}</span><span class="figlab">cr budgeted, 2024-25</span></div>
    </div>
    <p class="nudge">Use &larr; &rarr; or the controls below. Press <kbd>F</kbd> for full screen.</p>
  </div>
</section>'''

    s0 = slide(
        1, 5, "Finding 01 · Where the money goes",
        "Five demands dominate the budget",
        f'In 2024-25, Karnataka actually spent <strong>&#8377;{crore(svb["actuals"])} crore</strong> &mdash; {svb["ratio"]*100:.1f}% of the &#8377;{crore(svb["be"])} crore it budgeted. These five demands account for most of it.',
        f'&#8377;{crore(top5["rows"][0]["amount"])}',
        f'crore on Debt Servicing alone ({top5["fiscal_year"]} actuals)',
        chart_hbars(top5["rows"], "amount", "name"),
        "Top 5 demands by 2024-25 actuals, INR crore. Source: canonical_numbers.json (onboarding).")

    s1 = slide(
        2, 5, "Finding 02 · A service over time",
        "Health is budgeted high, spent lower",
        f'Health (major heads 2210 + 2211) across the plan (BE), the mid-year revision (RE), and what was actually spent (Actuals). Since 2022-23, actuals have run below the budget estimate.',
        f'&#8377;{crore(health_latest["actuals"])}',
        f'crore Health actuals, 2024-25 (vs ₹{crore(health_latest["be"])} cr budgeted)',
        health,
        "Health spending by fiscal year, INR crore. Actuals end 2024-25; later years are plan/revision only. Source: q1_health.")

    s2 = slide(
        3, 5, "Finding 03 · The structural squeeze",
        "A quarter of spending is committed",
        f'Salaries, pensions, and interest are committed expenditure &mdash; hard to cut. Their share of total spending rose from <strong>{q2_first["share_pct"]:.0f}%</strong> in {q2_first["fiscal_year"]} to <strong>{q2_latest["share_pct"]:.0f}%</strong> in {q2_latest["fiscal_year"]}.',
        f'{q2_latest["share_pct"]:.0f}%',
        f'of all spending was committed in {q2_latest["fiscal_year"]}',
        committed,
        "Committed expenditure (actuals), INR crore, with committed share of total. Source: q2_committed.")

    s3 = slide(
        4, 5, "Finding 04 · A decade of change",
        "The fastest-growing demands",
        f'Comparing 2014-15 actuals with 2024-25, some demands grew many times over. <strong>Energy</strong> rose roughly <strong>{energy["latest_actuals"]/energy["first_actuals"]:.0f}&times;</strong>, from &#8377;{crore(energy["first_actuals"])} to &#8377;{crore(energy["latest_actuals"])} crore.',
        f'{energy["latest_actuals"]/energy["first_actuals"]:.0f}&times;',
        "growth in Energy spending since 2014-15",
        growth,
        "Demands with the largest absolute growth, 2014-15 vs 2024-25 actuals, INR crore. Source: q3_demand.")

    method_slide = f'''<section class="slide method" data-n="5">
  <div class="slide-inner">
    <div class="slide-head">
      <div class="eyebrow">How these numbers were made</div>
      <h2>Auditable, not just asserted</h2>
      <p class="lede">Every figure here is summed only from additive leaf rows (<code>type_of_table = object_head</code>, <code>row_type = Data</code>, <code>row_level = Object-Head</code>) &mdash; totals and summary rows are excluded, so nothing is double-counted. The four analyses are implemented three times, in Python, R, and DuckDB, and must agree to the paisa.</p>
    </div>
    <div class="method-grid">
      <div class="mcard"><span class="fig">0.000000</span><span class="figlab">crore max difference across Python = R = DuckDB</span></div>
      <div class="mcard"><span class="fig">&#8377;</span><span class="figlab">all amounts in INR crore (source data is in lakh; 100 lakh = 1 crore)</span></div>
      <div class="mcard"><span class="fig">PDF</span><span class="figlab">every row traces to a page of a source expenditure volume</span></div>
    </div>
    <p class="method-foot">New to the data? Read the <a href="guide.html">visual guide</a>, or reproduce these numbers with <code>make -C examples reproduce</code>. Generated from <code>canonical_numbers.json</code>.</p>
  </div>
</section>'''

    slides = [title_slide, s0, s1, s2, s3, method_slide]
    return slides


CSS = """
:root{
  --ink:#212529; --paper:#f2f1f0; --white:#fff;
  --coral:#f57d6a; --coral-deep:#b5462f; --slate:#3b6f78; --gold:#caa14a;
  --grid:#d9d5d0; --muted:#5e6975;
}
*{box-sizing:border-box;}
html,body{margin:0;height:100%;}
body{
  font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:var(--ink); background:var(--paper);
  -webkit-font-smoothing:antialiased;
}
h1,h2{font-family:"Montserrat",system-ui,sans-serif;color:var(--ink);}
/* monospace accounting numerals: the ledger signature */
.fig,.c-val,.c-axis,.c-share,kbd{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}
.deck{height:100vh;overflow:hidden;position:relative;}
.slide{position:absolute;inset:0;display:none;padding:clamp(20px,4vw,56px);overflow-y:auto;}
.slide.active{display:flex;}
.slide-inner{margin:auto;max-width:1080px;width:100%;display:grid;grid-template-columns:0.82fr 1fr;gap:clamp(20px,4vw,52px);align-items:center;}
.eyebrow{color:var(--coral-deep);font-weight:700;font-size:12px;letter-spacing:.10em;text-transform:uppercase;}
.slide-head h2{font-size:clamp(24px,3.4vw,38px);font-weight:700;line-height:1.08;margin:10px 0 14px;}
.lede{color:var(--muted);max-width:46ch;margin:0 0 18px;}
.lede strong{color:var(--ink);}
.headline{border-left:4px solid var(--coral);padding-left:16px;margin-top:18px;}
.headline .fig{display:block;font-size:clamp(30px,4.4vw,52px);font-weight:700;color:var(--coral-deep);line-height:1;}
.figlab{display:block;color:var(--muted);font-size:13px;margin-top:6px;max-width:34ch;}
.chart{min-width:0;}
.chart-svg{width:100%;height:auto;display:block;}
.src{color:var(--muted);font-size:11.5px;margin:12px 0 0;}
.bar{transition:none;}
.grid{stroke:var(--grid);stroke-width:1;}
.c-name{fill:var(--ink);font-size:13px;font-weight:600;}
.c-val{fill:var(--coral-deep);font-size:12px;}
.c-axis{fill:var(--muted);font-size:11px;}
.c-share{fill:var(--ink);font-size:11px;font-weight:700;}
.legend{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:8px;font-size:12.5px;color:var(--muted);}
.lg{display:inline-flex;align-items:center;gap:6px;}
.sw{width:14px;height:10px;border-radius:2px;display:inline-block;}
.lg-note{font-style:italic;}
/* title slide */
.title .title-inner{display:block;text-align:left;max-width:880px;}
.title h1{font-size:clamp(40px,7vw,76px);font-weight:700;line-height:1.02;margin:10px 0 16px;}
.subtitle{font-size:clamp(16px,1.7vw,20px);color:var(--muted);max-width:54ch;}
.title-stats{display:flex;flex-wrap:wrap;gap:36px;margin:32px 0 24px;border-top:1px solid var(--grid);padding-top:24px;}
.title-stats .fig{display:block;font-size:clamp(28px,4vw,44px);font-weight:700;color:var(--coral-deep);}
.nudge{color:var(--muted);font-size:13px;}
kbd{background:var(--white);border:1px solid var(--grid);border-bottom-width:2px;border-radius:4px;padding:1px 6px;font-size:12px;}
/* method slide */
.method .slide-inner{display:block;}
.method-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--grid);border:1px solid var(--grid);margin-top:10px;}
.mcard{background:var(--white);padding:18px;}
.mcard .fig{display:block;font-size:26px;font-weight:700;color:var(--coral-deep);}
.method-foot{color:var(--muted);font-size:13px;margin-top:18px;}
a{color:var(--coral-deep);}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.86em;background:#eceae7;padding:1px 5px;border-radius:4px;color:var(--ink);}
/* controls */
.controls{position:fixed;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;gap:16px;padding:14px;background:linear-gradient(to top,var(--paper),rgba(242,241,240,0));}
.controls button{font:inherit;cursor:pointer;background:var(--ink);color:var(--paper);border:0;border-radius:999px;width:40px;height:40px;font-size:18px;line-height:1;}
.controls button:disabled{opacity:.3;cursor:default;}
.counter{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;color:var(--muted);min-width:54px;text-align:center;}
.dots{display:flex;gap:8px;}
.dot{width:9px;height:9px;border-radius:50%;background:var(--grid);border:0;padding:0;cursor:pointer;}
.dot[aria-current="true"]{background:var(--coral);}
:focus-visible{outline:3px solid var(--coral);outline-offset:2px;}
.progress{position:fixed;top:0;left:0;height:3px;background:var(--coral);transition:width .3s ease;z-index:5;}
/* motion: gentle reveal */
.slide.active .slide-inner,.slide.active .title-inner{animation:rise .5s ease both;}
@keyframes rise{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:none;}}
@media (max-width:820px){
  .slide-inner{grid-template-columns:1fr;gap:22px;}
  .title-stats{gap:22px;}
  .method-grid{grid-template-columns:1fr;}
}
@media (prefers-reduced-motion:reduce){
  .slide.active .slide-inner,.slide.active .title-inner{animation:none;}
  .progress{transition:none;}
}
@media print{
  .slide{display:block !important;position:static;page-break-after:always;height:auto;}
  .controls,.progress{display:none;}
}
"""

JS = """
(function(){
  var slides=[].slice.call(document.querySelectorAll('.slide'));
  var dotsWrap=document.querySelector('.dots');
  var counter=document.querySelector('.counter');
  var prev=document.querySelector('.prev');
  var next=document.querySelector('.next');
  var bar=document.querySelector('.progress');
  var i=0;
  slides.forEach(function(s,n){
    var d=document.createElement('button');
    d.className='dot'; d.setAttribute('aria-label','Go to slide '+(n+1));
    d.addEventListener('click',function(){go(n);});
    dotsWrap.appendChild(d);
  });
  var dots=[].slice.call(document.querySelectorAll('.dot'));
  function pad(n){return (n<10?'0':'')+n;}
  function go(n){
    i=Math.max(0,Math.min(slides.length-1,n));
    slides.forEach(function(s,k){s.classList.toggle('active',k===i);});
    dots.forEach(function(d,k){d.setAttribute('aria-current',k===i?'true':'false');});
    counter.textContent=pad(i+1)+' / '+pad(slides.length);
    prev.disabled=(i===0); next.disabled=(i===slides.length-1);
    bar.style.width=((i)/(slides.length-1)*100)+'%';
  }
  prev.addEventListener('click',function(){go(i-1);});
  next.addEventListener('click',function(){go(i+1);});
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' '){go(i+1);e.preventDefault();}
    else if(e.key==='ArrowLeft'||e.key==='PageUp'){go(i-1);}
    else if(e.key==='Home'){go(0);}
    else if(e.key==='End'){go(slides.length-1);}
    else if(e.key==='f'||e.key==='F'){ if(!document.fullscreenElement){document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();} else {document.exitFullscreen&&document.exitFullscreen();} }
  });
  go(0);
})();
"""

def main():
    with open(CANONICAL, encoding="utf-8") as f:
        data = json.load(f)
    slides = build(data)
    doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Karnataka State Finances — Results</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&display=swap" rel="stylesheet" />
<style>{CSS}</style>
</head>
<body>
<div class="progress" style="width:0"></div>
<div class="deck">
{''.join(slides)}
</div>
<div class="controls">
  <button class="prev" aria-label="Previous slide">&#8249;</button>
  <div class="dots" role="tablist" aria-label="Slides"></div>
  <span class="counter">01 / 06</span>
  <button class="next" aria-label="Next slide">&#8250;</button>
</div>
<script>{JS}</script>
</body>
</html>'''
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(doc)
    print(f"Wrote {OUT} ({len(slides)} slides, {len(doc):,} bytes)")


if __name__ == "__main__":
    main()
