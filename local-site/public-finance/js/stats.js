/* Researcher-facing summary statistics, derived from the be/re/ac/bp
   series of any node (state, major head, or branch).

   The ratios a public-finance reader actually asks of a head:
     execution  = Actuals / BE, same fiscal year   ("was the budget spent?")
     revision   = RE / BE − 1, same fiscal year    ("was it revised up or down?")
     growth     = BE_f / BE_{f-1} − 1              ("is it growing?")
     cagr       = n-year compound growth of Actuals
   Each is computed for the latest fiscal year where both sides exist, and
   is labelled with that year; a ratio without its year is a trap. */

(function () {
  'use strict';

  /* get(m, f) -> native-unit value for measure m at fiscal-year index f. */
  function keyStats(ix, get) {
    const nf = ix.fys.length;
    const latest = m => {
      const sp = ix.spans[m];
      if (!sp) return -1;
      for (let f = sp[1]; f >= sp[0]; f--) if (get(m, f)) return f;
      return -1;
    };

    const out = {};
    const fbe = latest('be');
    if (fbe >= 0) {
      out.be = { f: fbe, v: get('be', fbe) };
      const prev = get('be', fbe - 1);
      if (prev) out.growth = { f: fbe, pct: (get('be', fbe) / prev - 1) * 100 };
    }
    /* execution: latest year with both actuals and a BE to compare against */
    for (let f = nf - 1; f >= 0; f--) {
      const ac = get('ac', f), be = get('be', f);
      if (ac && be) { out.exec = { f, pct: ac / be * 100, ac, be }; break; }
    }
    for (let f = nf - 1; f >= 0; f--) {
      const re = get('re', f), be = get('be', f);
      if (re && be) { out.rev = { f, pct: (re / be - 1) * 100, re, be }; break; }
    }
    /* 5y CAGR of actuals (or as many years as exist, min 3). A base year
       whose figure collapses to under 60% of the next year's is almost
       always a truncated source volume, not a real halving; slide the
       base forward past it rather than quoting a growth rate off a hole. */
    const fa = latest('ac');
    if (fa >= 0) {
      let f0 = Math.max(0, fa - 5);
      while (f0 < fa - 2 && get('ac', f0) > 0 && get('ac', f0 + 1) > 0
             && get('ac', f0) < 0.6 * get('ac', f0 + 1)) f0++;
      const span = fa - f0;
      if (span >= 3 && get('ac', f0) > 0 && get('ac', fa) > 0) {
        out.cagr = { f0, f1: fa, span,
          pct: (Math.pow(get('ac', fa) / get('ac', f0), 1 / span) - 1) * 100 };
      }
    }
    return out;
  }

  const getterFromD = d => (m, f) => (d[m] || {})[f] || 0;
  const getterFromSeries = bym => (m, f) => (bym[m] || [])[f] || 0;

  /* Revenue / capital / loans split of the majors list at one column spec. */
  function sectorSplit(majors, col) {
    const out = { revenue: 0, capital: 0, loans: 0, other: 0 };
    for (const m of majors) out[m.sector] += Model.mval(m, col);
    return out;
  }

  const fmtPct = (v, signed) => v == null ? '–'
    : (signed && v > 0 ? '+' : '') + v.toFixed(1) + '%';

  /* Per-year share of totGet in measure m, for a sparkline. null outside
     m's printed span or when either side is falsy. */
  function seriesPct(get, totGet, ix, m) {
    const sp = ix.spans[m];
    return ix.fys.map((_, f) => {
      if (!sp || f < sp[0] || f > sp[1]) return null;
      const v = get(m, f), tot = totGet(m, f);
      return v && tot ? v / tot * 100 : null;
    });
  }

  /* Per-year execution % (Actuals / BE) across all fiscal years. */
  function execSeries(get, ix) {
    return ix.fys.map((_, f) => {
      const ac = get('ac', f), be = get('be', f);
      return ac && be ? ac / be * 100 : null;
    });
  }

  /* Composition/churn stats for the children of trail at one rank column
     {m, f}: how many, how many active, concentration in the top 3, and
     which heads appeared/vanished vs the prior year (when printed). */
  function levelStats(model, trail, ix, rank, pred) {
    const cols = [rank];
    if (rank.f - 1 >= 0) cols.push({ m: rank.m, f: rank.f - 1 });
    const cacheKey = 'ls' + rank.m + rank.f + (pred ? 'p' : '');
    const kids = Model.childrenOf(model, trail, cols, cacheKey, pred);

    const n = kids.size;
    let active = 0;
    for (const rec of kids.values()) if (rec.v[0]) active++;

    const ranked = [...kids.entries()].sort((a, b) => b[1].v[0] - a[1].v[0]);
    const totPos = ranked.reduce((s, [, r]) => s + (r.v[0] > 0 ? r.v[0] : 0), 0);
    const top3sum = ranked.slice(0, 3)
      .reduce((s, [, r]) => s + r.v[0], 0);
    const top3pct = totPos > 0 ? top3sum / totPos * 100 : null;
    const top3 = totPos > 0 ? ranked.slice(0, 3).map(([id, r]) => {
      const nd = model.nodes[id];
      return { code: nd.code, name: nd.name, pct: r.v[0] / totPos * 100 };
    }) : [];

    let newHeads = [], gone = [];
    if (cols.length === 2 && Model.colExists(ix, cols[1])) {
      newHeads = [...kids.entries()]
        .filter(([, r]) => r.v[0] && !r.v[1])
        .map(([id]) => ({ code: model.nodes[id].code, name: model.nodes[id].name }));
      gone = [...kids.entries()]
        .filter(([, r]) => r.v[1] && !r.v[0])
        .map(([id]) => ({ code: model.nodes[id].code, name: model.nodes[id].name }));
    }

    return { n, active, top3pct, top3, newHeads, gone };
  }

  /* Render a row of .stat tiles into host. items: {lab, val, sub, tone,
     spark: {series, ref}}. spark, when present, draws an Engine.spark
     line between the big value and the optional sub text. */
  function tiles(host, items) {
    host.innerHTML = '';
    for (const it of items) {
      const d = document.createElement('div');
      d.className = 'stat';
      const l = document.createElement('span');
      l.className = 'lab'; l.textContent = it.lab;
      const v = document.createElement('span');
      v.className = 'val'; v.textContent = it.val;
      if (it.tone) v.style.color = `var(--${it.tone})`;
      d.append(l, v);
      if (it.spark) {
        const sp = document.createElement('span');
        sp.className = 'spark';
        sp.append(Engine.spark(it.spark.series,
          { w: 120, h: 30, ref: it.spark.ref }));
        d.append(sp);
      }
      if (it.sub) {
        const s = document.createElement('span');
        s.className = 'sub'; s.textContent = it.sub;
        d.append(s);
      }
      host.append(d);
    }
  }

  window.Stats = { keyStats, getterFromD, getterFromSeries, sectorSplit,
    fmtPct, tiles, seriesPct, execSeries, levelStats };
})();
