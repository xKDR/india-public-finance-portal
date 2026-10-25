/* Hand-rolled SVG chart engine. No external libraries.

   Ported from prj-public-health's slides_engine.js, with three portal
   additions: a flat doughnut chart (donutChart), SVG/PNG download on every
   figure, and colours resolved from CSS custom properties at draw time so a
   downloaded SVG is self-contained.

   Encoding rules carried over: hue identifies the head, dash identifies the
   measure (solid, long dash, dot, dash-dot), reinforced by markers; lines
   break at missing years rather than bridging them. */

(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const SVG_TAGS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'line',
    'text', 'defs', 'clipPath', 'polyline', 'polygon', 'tspan', 'title']);

  const $ = s => typeof s === 'string' ? document.querySelector(s) : s;

  function el(tag, attrs = {}, kids = []) {
    const e = document.createElementNS(
      SVG_TAGS.has(tag) ? SVG_NS : 'http://www.w3.org/1999/xhtml', tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
    for (const k of [].concat(kids)) e.append(k);
    return e;
  }

  const cssv = n => getComputedStyle(document.documentElement)
    .getPropertyValue(n).trim();
  const SERIES = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7', '--s8'];
  const seriesColor = i => cssv(SERIES[i % SERIES.length]);

  /* Dash per measure; the portal-wide rule. */
  const DASH = { be: '', re: '12,6', ac: '1,7', bp: '12,4,2,4' };
  const MEAS = [['be', 'BE'], ['re', 'RE'], ['ac', 'Actuals']];
  const MEASURE_HELP = 'BE: solid line and circles; RE: long dashes and triangles; Actuals: dotted line and squares.';
  function measureKey(m) {
    const key = el('svg', { class: 'key', viewBox: '0 0 44 12',
      width: 44, height: 12, 'aria-hidden': 'true' });
    key.append(el('line', { x1: 1, y1: 6, x2: 43, y2: 6,
      stroke: 'currentColor', 'stroke-width': 2.3,
      'stroke-linecap': 'round', 'stroke-dasharray': DASH[m] || null }));
    key.append(measureMarker(DASH[m], 22, 6, 'currentColor', cssv('--surface'), 3));
    return key;
  }

  // Redundant measure encoding, shared by plots, legends and controls.
  function measureMarker(dash, x, y, color, surface, r = 3.5) {
    const attrs = { fill: color, stroke: surface, 'stroke-width': 1.2 };
    if (dash === DASH.re) return el('polygon', { ...attrs,
      points: `${x},${y-r-1} ${x+r+1},${y+r} ${x-r-1},${y+r}` });
    if (dash === DASH.ac) return el('rect', { ...attrs,
      x: x-r, y: y-r, width: 2*r, height: 2*r });
    if (dash === DASH.bp) return el('polygon', { ...attrs,
      points: `${x},${y-r-1} ${x+r+1},${y} ${x},${y+r+1} ${x-r-1},${y}` });
    return el('circle', { ...attrs, cx: x, cy: y, r });
  }

  /* ---------------------------------------------------------- formatting */
  const nfIN = (v, d = 0) => v == null ? '–' :
    v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

  /* Rs crore with adaptive precision. */
  function money(v) {
    if (v == null) return '–';
    const a = Math.abs(v);
    if (a === 0) return '0';
    if (a < 0.01) return v.toFixed(3);
    if (a < 1) return v.toFixed(2);
    if (a < 100) return v.toFixed(1);
    return nfIN(Math.round(v));
  }
  const pctf = (v, d = 1) => v == null ? '–' : v.toFixed(d) + '%';

  /* ------------------------------------------------------------- colours */
  const hex2rgb = h => { h = h.trim().replace('#', '');
    if (h.length === 3) h = [...h].map(c => c + c).join('');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  const rgb2hex = c => '#' + c.map(v =>
    Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const lerpHex = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); };
  const lum = h => { const [r, g, b] = hex2rgb(h).map(v => { v /= 255;
    return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * r + .7152 * g + .0722 * b; };

  /* ---------------------------------------------------------- figures */
  const FIGS = [];

  function figure(mount, spec) {
    const host = $(mount);
    if (!host) return null;
    const fig = el('figure', { class: 'fig' });
    const head = el('div', { class: 'fig-head' });
    head.append(el('span', { class: 'fig-title' }, [spec.title || '']));
    if (spec.sub) head.append(el('span', { class: 'fig-sub' }, [spec.sub]));
    head.append(el('span', { class: 'fig-sp' }));
    const dlS = el('button', { class: 'fig-btn', type: 'button',
      title: 'Download this chart as SVG' }, ['↓ SVG']);
    const dlP = el('button', { class: 'fig-btn', type: 'button',
      title: 'Download this chart as PNG' }, ['↓ PNG']);
    head.append(dlS, dlP);
    let btn = null;
    if (spec.table) {
      btn = el('button', { class: 'fig-btn', type: 'button' }, ['Table']);
      head.append(btn);
    }
    const plot = el('div', { class: 'plot' });
    const tip = el('div', { class: 'tip' });
    plot.append(tip);
    const legend = el('div', { class: 'legend' });
    const tbl = el('div', { class: 'hidden' });
    fig.append(head, plot, legend, tbl);
    if (spec.caption) fig.append(el('div', { class: 'tbl-cap' }, [spec.caption]));
    host.append(fig);

    if (btn) btn.onclick = () => {
      const showing = tbl.classList.toggle('hidden');
      plot.classList.toggle('hidden', !showing);
      legend.classList.toggle('hidden', !showing);
      btn.textContent = showing ? 'Table' : 'Chart';
    };
    const rec = { host, fig, plot, tip, legend, tbl, spec };
    dlS.onclick = () => download(rec, 'svg');
    dlP.onclick = () => download(rec, 'png');
    FIGS.push(rec);
    drawFig(rec);
    return rec;
  }

  function drawFig(rec) {
    const { plot, tip, legend, tbl, spec } = rec;
    [...plot.children].forEach(c => { if (c !== tip) c.remove(); });
    legend.innerHTML = ''; tbl.innerHTML = '';
    const w = Math.max(320, plot.clientWidth - 4);
    spec.render(plot, tip, legend, w);
    if (spec.table) tbl.append(spec.table());
  }

  /* Drop every figure a host owns (a panel that rebuilds its charts). */
  function dropFigs(host) {
    host = $(host);
    for (let i = FIGS.length - 1; i >= 0; i--)
      if (FIGS[i].host === host || host.contains(FIGS[i].host)) FIGS.splice(i, 1);
    host.querySelectorAll('.fig').forEach(f => f.remove());
  }

  let rt;
  addEventListener('resize', () => {
    clearTimeout(rt); rt = setTimeout(() => FIGS.forEach(drawFig), 140); });
  const redrawAll = () => FIGS.forEach(drawFig);

  /* ---------------------------------------------------------- download */
  function download(rec, kind) {
    const svg = rec.plot.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', SVG_NS);
    const w = +svg.getAttribute('width') || svg.clientWidth;
    const h = +svg.getAttribute('height') || svg.clientHeight;
    clone.setAttribute('width', w); clone.setAttribute('height', h);
    clone.insertBefore(el('rect', { x: 0, y: 0, width: w, height: h,
      fill: cssv('--surface') }), clone.firstChild);
    clone.setAttribute('font-family', '"Computer Modern Serif", Georgia, serif');
    const name = (rec.spec.title || 'chart').toLowerCase()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'chart';
    const src = new XMLSerializer().serializeToString(clone);
    if (kind === 'svg') {
      save(new Blob([src], { type: 'image/svg+xml' }), name + '.svg');
      return;
    }
    const img = new Image();
    img.onload = () => {
      const k = 2;
      const cv = el('canvas', { width: w * k, height: h * k });
      const cx = cv.getContext('2d');
      cx.scale(k, k);
      cx.drawImage(img, 0, 0, w, h);
      cv.toBlob(b => save(b, name + '.png'), 'image/png');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  }
  function save(blob, name) {
    const a = el('a', { download: name });
    a.href = URL.createObjectURL(blob);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* -------------------------------------------------------- table builder */
  function table(cols, rows, opts = {}) {
    const wrap = el('div', { class: 'tw' });
    const t = el('table');
    const trh = el('tr');
    cols.forEach((c, i) => trh.append(el('th',
      { class: i === 0 || (opts.leftCols || []).includes(i) ? 'l' : null }, [c])));
    t.append(el('thead', {}, [trh]));
    const tb = el('tbody');
    rows.forEach(r => {
      const tr = el('tr', r.cls ? { class: r.cls } : {});
      (r.cells || r).forEach((c, i) => {
        const cell = (c && typeof c === 'object' && !Array.isArray(c)) ? c : { v: c };
        const cls = [cell.cls, i === 0 || (opts.leftCols || []).includes(i) ? 'l' : null]
          .filter(Boolean).join(' ') || null;
        tr.append(el('td', cls ? { class: cls } : {},
          [cell.node || String(cell.v ?? '–')]));
      });
      tb.append(tr);
    });
    t.append(tb); wrap.append(t);
    return wrap;
  }

  /* ------------------------------------------------------------ chart core */
  const scaleBand = (n, x0, x1) => { const step = (x1 - x0) / n;
    return i => x0 + step * (i + 0.5); };

  function niceTicks(lo, hi, n = 5) {
    if (hi === lo) hi = lo + 1;
    const raw = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5
      : norm <= 5 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 0.01; v += step)
      out.push(+v.toFixed(10));
    return out;
  }

  function frame(w, h, opts = {}) {
    const m = Object.assign({ t: 14, r: 16, b: 44, l: 62 }, opts.margin || {});
    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h,
      role: 'img' });
    const iw = w - m.l - m.r, ih = h - m.t - m.b;
    return { svg, m, iw, ih, x0: m.l, x1: m.l + iw, y0: m.t, y1: m.t + ih };
  }

  function axes(f, { years, lo, hi, fmt = money, xEvery = 1, yTitle }) {
    const { svg, x0, x1, y0, y1 } = f;
    const gridC = cssv('--grid'), axisC = cssv('--axis'), mut = cssv('--muted');
    const ys = v => y1 - (v - lo) / (hi - lo) * (y1 - y0);
    niceTicks(lo, hi).forEach(t => {
      const y = ys(t);
      svg.append(el('line', { x1: x0, x2: x1, y1: y, y2: y, stroke: gridC,
        'stroke-width': 1 }));
      svg.append(el('text', { x: x0 - 9, y: y + 4, 'text-anchor': 'end',
        'font-size': 13, fill: mut,
        'font-variant-numeric': 'tabular-nums' }, [fmt(t)]));
    });
    const zy = ys(Math.max(lo, Math.min(hi, 0)));
    svg.append(el('line', { x1: x0, x2: x1, y1: zy, y2: zy, stroke: axisC,
      'stroke-width': 1 }));
    const xs = scaleBand(years.length, x0, x1);
    years.forEach((y, i) => {
      if (i % xEvery && i !== years.length - 1) return;
      svg.append(el('text', { x: xs(i), y: y1 + 18, 'text-anchor': 'middle',
        'font-size': 12.5, fill: mut,
        transform: `rotate(-40 ${xs(i)} ${y1 + 18})` }, [y]));
    });
    if (yTitle) svg.append(el('text', { x: x0 - 9, y: y0 - 4,
      'text-anchor': 'end', 'font-size': 12.5, fill: mut }, [yTitle]));
    return { ys, xs };
  }

  function legendItems(legend, items, kind = 'line') {
    items.forEach(it => {
      const s = el('span', { class: 'lg-it' });
      if (kind === 'sq') s.append(el('i', { class: 'sw sq',
        style: `background:${it.color}` }));
      else {
        const key = el('svg', { viewBox: '0 0 44 12', width: 44, height: 12,
          'aria-hidden': 'true', style: 'flex:none;vertical-align:middle' });
        key.append(el('line', { x1: 1, y1: 6, x2: 43, y2: 6,
          stroke: it.color, 'stroke-width': 2.3,
          'stroke-linecap': 'round', 'stroke-dasharray': it.dash || null }));
        key.append(measureMarker(it.dash, 22, 6, it.color, cssv('--surface'), 3));
        s.append(key);
      }
      if (it.code) s.append(el('code', { class: 'hcode',
        title: it.codeTitle || null }, [it.code]));
      s.append(document.createTextNode(it.name));
      if (it.onClick) { s.classList.add('click'); s.onclick = it.onClick; }
      legend.append(s);
    });
  }

  function attachCrosshair(f, plot, tip, years, xs, rows) {
    const { svg, x0, x1, y0, y1 } = f;
    const cross = el('line', { x1: 0, x2: 0, y1: y0, y2: y1,
      stroke: cssv('--axis'), 'stroke-width': 1, opacity: 0 });
    svg.append(cross);
    const hit = el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0,
      fill: 'transparent', tabindex: 0 });
    svg.append(hit);
    let cur = -1;
    const show = (best, clientY) => {
      cur = best;
      cross.setAttribute('x1', xs(best)); cross.setAttribute('x2', xs(best));
      cross.setAttribute('opacity', .55);
      tip.innerHTML = '';
      tip.append(el('div', { class: 'th' }, [years[best]]));
      rows(best).forEach(rw => {
        const d = el('div', { class: 'r' });
        const lft = el('span', { class: 'k' });
        if (rw.color) lft.append(el('i', { class: 'dot',
          style: `background:${rw.color}` }));
        if (rw.code) lft.append(el('code', { class: 'hcode' }, [rw.code]),
          document.createTextNode(' '));
        lft.append(document.createTextNode(rw.k));
        d.append(lft, el('b', {}, [rw.v]));
        tip.append(d);
      });
      tip.classList.add('on');
      const r = svg.getBoundingClientRect();
      const pr = plot.getBoundingClientRect();
      const relx = (xs(best) / (+svg.getAttribute('width'))) * r.width
        + (r.left - pr.left);
      const tw = tip.offsetWidth || 150;
      tip.style.left = Math.min(Math.max(6, relx + 14), pr.width - tw - 6) + 'px';
      tip.style.top = Math.max(6, (clientY ?? (r.top + 40)) - pr.top - 20) + 'px';
    };
    const nearest = ev => {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width * (+svg.getAttribute('width'));
      let best = 0, bd = 1e9;
      years.forEach((_, i) => { const d = Math.abs(xs(i) - px);
        if (d < bd) { bd = d; best = i; } });
      return best;
    };
    const hide = () => { tip.classList.remove('on');
      cross.setAttribute('opacity', 0); cur = -1; };
    hit.addEventListener('mousemove', ev => show(nearest(ev), ev.clientY));
    hit.addEventListener('mouseleave', hide);
    hit.addEventListener('focus', () => show(cur < 0 ? years.length - 1 : cur));
    hit.addEventListener('blur', hide);
    hit.addEventListener('keydown', e => {
      const at = cur < 0 ? years.length - 1 : cur;
      if (e.key === 'ArrowLeft') { show(Math.max(0, at - 1)); e.preventDefault(); }
      if (e.key === 'ArrowRight') { show(Math.min(years.length - 1, at + 1));
        e.preventDefault(); }
    });
  }

  /* ---- line chart ---------------------------------------------------- */
  function lineChart({ years, series, fmt = money, yTitle, height = 380,
                       zero = true, xEvery = 1, margin, yMax }) {
    return (plot, tip, legend, w) => {
      const f = frame(w, height, { margin:
        Object.assign({ t: 14, r: 60, b: 46, l: 62 }, margin || {}) });
      const vals = series.flatMap(s => s.values.filter(v => v != null));
      if (!vals.length) {
        plot.append(el('div', { class: 'empty' },
          ['Nothing to plot for this selection.']));
        return;
      }
      let lo = Math.min(...vals), hi = Math.max(...vals);
      /* yMax only ever raises the domain (a shared axis across cards)
         a card whose own values exceed it still gets its own headroom. */
      if (yMax != null) hi = Math.max(hi, yMax);
      if (zero) lo = Math.min(0, lo);
      const pad = (hi - lo) * 0.08 || 1; hi += pad; if (!zero) lo -= pad;
      const { ys, xs } = axes(f, { years, lo, hi, fmt, yTitle, xEvery });
      const surf = cssv('--surface');

      series.forEach(s => {
        let d = '', pen = false;
        s.values.forEach((v, i) => {
          if (v == null) { pen = false; return; }
          d += (pen ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(v).toFixed(1);
          pen = true;
        });
        if (d) f.svg.append(el('path', { d, fill: 'none', stroke: s.color,
          'stroke-width': 2.3,
          'stroke-dasharray': s.dash || null,
          'stroke-linejoin': 'round', 'stroke-linecap': 'round',
          opacity: s.dash ? .9 : 1 }));
        s.values.forEach((v, i) => { if (v != null)
          f.svg.append(measureMarker(s.dash, xs(i), ys(v), s.color, surf)); });
      });

      /* end labels on solid series, nudged apart */
      const solid = series.filter(s => !s.dash);
      if (solid.length && solid.length <= 5) {
        const labs = [];
        solid.forEach(s => {
          let li = -1; s.values.forEach((v, i) => { if (v != null) li = i; });
          if (li >= 0) labs.push({ x: xs(li) + 7, y: ys(s.values[li]) + 4,
            t: fmt(s.values[li]), c: s.color });
        });
        labs.sort((a, b) => a.y - b.y);
        for (let i = 1; i < labs.length; i++)
          if (labs[i].y - labs[i - 1].y < 13) labs[i].y = labs[i - 1].y + 13;
        const spill = labs.length ? labs[labs.length - 1].y - (f.y1 - 1) : 0;
        if (spill > 0) labs.forEach(l => l.y -= spill);
        labs.forEach(l => f.svg.append(el('text', { x: l.x,
          y: Math.max(f.y0 + 8, l.y), 'font-size': 12.5, fill: l.c,
          'font-weight': 650 }, [l.t])));
      }
      plot.append(f.svg);
      if (series.length > 1) legendItems(legend, series.map(s =>
        ({ name: s.name, color: s.color, dash: s.dash, code: s.code,
           codeTitle: s.codeTitle })));
      attachCrosshair(f, plot, tip, years, xs, i =>
        series.filter(s => s.values[i] != null).map(s =>
          ({ k: s.name, v: fmt(s.values[i]), color: s.color, code: s.code })));
    };
  }

  /* ---- bars ---------------------------------------------------------- */
  function barChart({ years, values, colors, color, fmt = money, yTitle,
                      height = 220, xEvery = 1, name = 'Value' }) {
    return (plot, tip, legend, w) => {
      const f = frame(w, height, { margin: { t: 12, r: 16, b: 42, l: 62 } });
      const vs = values.filter(v => v != null);
      if (!vs.length) {
        plot.append(el('div', { class: 'empty' }, ['No data.']));
        return;
      }
      let lo = Math.min(0, ...vs), hi = Math.max(0, ...vs);
      const pad = (hi - lo) * .12 || 1; hi += pad; if (lo < 0) lo -= pad;
      const { ys, xs } = axes(f, { years, lo, hi, fmt, yTitle, xEvery });
      const bw = Math.min(38, (f.iw / years.length) * 0.62);
      values.forEach((v, i) => {
        if (v == null) return;
        const y = ys(Math.max(0, v)), hgt = Math.abs(ys(v) - ys(0));
        f.svg.append(el('rect', { x: xs(i) - bw / 2, y, width: bw,
          height: Math.max(1, hgt),
          fill: colors ? colors[i] : color || cssv('--s1') }));
      });
      plot.append(f.svg);
      attachCrosshair(f, plot, tip, years, xs, i =>
        values[i] == null ? [] : [{ k: name, v: fmt(values[i]) }]);
    };
  }

  /* ---- doughnut ------------------------------------------------------ */
  /* Flat 2D ring. Slices are focusable buttons; hover lifts a slice 3px
     outward along its bisector and shows the tooltip; labels with leader
     lines only for slices >= 4%; everything is in the clickable legend. */
  function donutChart({ items, fmt = money, centreTitle, centreSub,
                        height = 380, onSlice }) {
    return (plot, tip, legend, w) => {
      const h = height;
      const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h,
        role: 'list', 'aria-label': centreTitle || 'Composition' });
      const cx = w / 2, cy = h / 2;
      const R = Math.min(w, h) / 2 - 58;
      const R0 = R * 0.62;
      const pos = items.filter(it => it.value > 0);
      const skipped = items.filter(it => it.value < 0);
      const total = pos.reduce((a, it) => a + it.value, 0);
      if (!total) {
        plot.append(el('div', { class: 'empty' },
          ['Nothing with a positive amount here.']));
        return;
      }
      const surf = cssv('--surface'), ground = cssv('--ground');
      const TAU = Math.PI * 2;
      let a0 = -Math.PI / 2;

      const arcPath = (a, b, r0, r1) => {
        const large = (b - a) > Math.PI ? 1 : 0;
        const p = (ang, r) => `${cx + r * Math.cos(ang)} ${cy + r * Math.sin(ang)}`;
        return `M${p(a, r1)}A${r1} ${r1} 0 ${large} 1 ${p(b, r1)}` +
               `L${p(b, r0)}A${r0} ${r0} 0 ${large} 0 ${p(a, r0)}Z`;
      };

      const showTip = (it, ev) => {
        tip.innerHTML = '';
        tip.append(el('div', { class: 'th' },
          [(it.code ? it.code + ' · ' : '') + it.name]));
        const d = el('div', { class: 'r' });
        d.append(el('span', { class: 'k' }, ['Amount']),
          el('b', {}, [fmt(it.value)]));
        const d2 = el('div', { class: 'r' });
        d2.append(el('span', { class: 'k' }, ['Share']),
          el('b', {}, [pctf(it.value / total * 100)]));
        tip.append(d, d2);
        if (it.drill === false) tip.append(el('div', { class: 'note' },
          ['Deepest level; see the table for detail']));
        else if (onSlice) tip.append(el('div', { class: 'note' },
          ['Click to open']));
        tip.classList.add('on');
        const pr = plot.getBoundingClientRect();
        const tw = tip.offsetWidth || 160;
        tip.style.left = Math.min(Math.max(6, ev.clientX - pr.left + 14),
          pr.width - tw - 6) + 'px';
        tip.style.top = Math.max(6, ev.clientY - pr.top - 46) + 'px';
      };

      pos.forEach(it => {
        const frac = it.value / total;
        const a1 = a0 + frac * TAU;
        const mid = (a0 + a1) / 2;
        const canDrill = onSlice && it.drill !== false;
        const path = el('path', {
          d: arcPath(a0, Math.min(a1, a0 + TAU - 1e-4), R0, R),
          fill: it.color, stroke: surf, 'stroke-width': 2,
          tabindex: canDrill ? 0 : null, role: 'listitem',
          'aria-label': `${it.code || ''} ${it.name}: ${fmt(it.value)}, `
            + pctf(frac * 100),
          style: canDrill ? 'cursor:pointer' : null });
        path.addEventListener('mousemove', ev => showTip(it, ev));
        path.addEventListener('mouseenter', () => {
          path.setAttribute('transform',
            `translate(${3 * Math.cos(mid)} ${3 * Math.sin(mid)})`);
        });
        path.addEventListener('mouseleave', () => {
          path.removeAttribute('transform'); tip.classList.remove('on');
        });
        if (canDrill) {
          path.addEventListener('click', () => onSlice(it));
          path.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault();
              onSlice(it); } });
        }
        svg.append(path);

        if (frac >= 0.04) {
          const tr = (R + R0) / 2;
          svg.append(el('text', { x: cx + tr * Math.cos(mid),
            y: cy + tr * Math.sin(mid) + 4, 'font-size': 13,
            fill: '#151515', stroke: '#ffffff', 'stroke-width': 3,
            'paint-order': 'stroke', 'stroke-linejoin': 'round',
            'pointer-events': 'none', 'font-weight': 700,
            'text-anchor': 'middle' }, [pctf(frac * 100)]));
        }
        a0 = a1;
      });

      /* Keep the hole free of long labels. Full names are in the figure
         heading and wrapping legend; only a fitted amount and unit go here. */
      const totalLabel = fmt(total);
      const fontSize = Math.min(40, (R0 * 1.65) / Math.max(1, totalLabel.length * .65));
      svg.append(el('text', { x: cx, y: cy - 8, 'text-anchor': 'middle',
        'font-size': fontSize, 'font-weight': 750, fill: cssv('--ink'),
        'font-variant-numeric': 'tabular-nums' }, [totalLabel]));
      svg.append(el('text', { x: cx, y: cy + 18, 'text-anchor': 'middle',
        'font-size': Math.min(12, R0 / 7), fill: cssv('--muted') },
        ['₹ crore']));
      plot.append(svg);

      legendItems(legend, pos.map(it => ({
        name: it.name + ' · ' + pctf(it.value / total * 100),
        color: it.color, code: it.code, kind: 'sq',
        onClick: (onSlice && it.drill !== false) ? () => onSlice(it) : null,
      })), 'sq');
      if (skipped.length) legend.append(el('span', { class: 'lg-note' },
        [`${skipped.length} negative (recoveries) item`
         + (skipped.length > 1 ? 's' : '') + ' not drawn; see the table']));
    };
  }

  /* ---- sparkline ------------------------------------------------------ */
  /* Tiny inline trend: no axes, no labels, no interactivity. seriesList is
     [{values, color?, dash?}]; nulls break the line like lineChart does. */
  function spark(seriesList, opts = {}) {
    const w = opts.w || 150, h = opts.h || 36, ref = opts.ref;
    const pad = 3;
    let vals = seriesList.flatMap(s => s.values.filter(v => v != null));
    if (ref != null) vals = vals.concat(ref);
    let lo = vals.length ? Math.min(...vals) : 0;
    let hi = vals.length ? Math.max(...vals) : 1;
    if (hi === lo) { lo -= 1; hi += 1; } else {
      const p = (hi - lo) * 0.08; lo -= p; hi += p;
    }
    const n = Math.max(1, ...seriesList.map(s => s.values.length));
    const xs = i => n <= 1 ? w / 2 : pad + (w - 2 * pad) * i / (n - 1);
    const ys = v => h - pad - (v - lo) / (hi - lo) * (h - 2 * pad);
    const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h,
      'aria-hidden': 'true' });

    if (ref != null) svg.append(el('line', { x1: pad, x2: w - pad,
      y1: ys(ref), y2: ys(ref), stroke: cssv('--hair'), 'stroke-width': 1 }));

    seriesList.forEach(s => {
      const color = s.color || 'var(--s1)';
      let d = '', pen = false, li = -1;
      s.values.forEach((v, i) => {
        if (v == null) { pen = false; return; }
        d += (pen ? 'L' : 'M') + xs(i).toFixed(1) + ' ' + ys(v).toFixed(1);
        pen = true; li = i;
      });
      if (d) svg.append(el('path', { d, fill: 'none', stroke: color,
        'stroke-width': 1.5, 'stroke-dasharray': s.dash || null,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      s.values.forEach((v, i) => { if (v != null)
        svg.append(measureMarker(s.dash, xs(i), ys(v), color, cssv('--surface'), 1.7)); });
    });
    return svg;
  }

  window.Engine = { el, cssv, seriesColor, SERIES, DASH, MEAS, MEASURE_HELP, measureKey, measureMarker, nfIN, money, pctf,
    lerpHex, lum, figure, drawFig, dropFigs, redrawAll, table, niceTicks,
    lineChart, barChart, donutChart, legendItems, spark };
})();
