/* Client-side aggregation over a major-head shard.

   The shard ships flat nodes and paths (the prj-public-health model): a
   path's `n` is one node id per level below the major, -1 where the printed
   line skips that level. Parents/children are derived from the paths, so the
   same shard answers the explorer's cascade, the dashboard's rings and the
   series page without privileging any one aggregation.

   A "column spec" is the unit of asking: {m, f} one fiscal year of one
   measure, or {m, f0, f1} a band summed. The explorer's four printed
   columns, a doughnut's single value and a time-series point are all the
   same call with different specs. */

(function () {
  'use strict';

  function wrap(shard) {
    const chains = shard.paths.map(p => p.n.filter(x => x >= 0));
    return { shard, nodes: shard.nodes, paths: shard.paths, chains,
             levels: shard.levels, cache: new Map() };
  }

  function pval(p, col) {
    const s = p.d[col.m];
    if (!s) return 0;
    if (col.f1 === undefined) return s[col.f] || 0;
    let t = 0;
    for (let f = col.f0; f <= col.f1; f++) t += s[f] || 0;
    return t;
  }
  const pvals = (p, cols) => cols.map(c => pval(p, c));

  /* Children of a branch (trail of node ids from the top of the shard).
     Returns Map(childId -> {v: per-column sums, kids: Set of grandchildren,
     dms: Set of demand numbers, pg: {dyIdx: page|[vol,page]}}). One pass
     collects the grandchildren too, so opening a row costs one scan. */
  /* `pred` filters paths (e.g. p => p.dm === '19' for the department
     pivot); the cacheKey must encode it. */
  function childrenOf(model, trail, cols, cacheKey, pred) {
    const key = cacheKey + '|' + trail.join('>');
    const hit = model.cache.get(key);
    if (hit) return hit;
    const out = new Map();
    const k = trail.length;
    const { chains, paths } = model;
    for (let i = 0; i < chains.length; i++) {
      const ch = chains[i];
      let match = true;
      for (let a = 0; a < k; a++) if (ch[a] !== trail[a]) { match = false; break; }
      if (!match) continue;
      const c = ch[k];
      if (c === undefined) continue;
      const p = paths[i];
      if (pred && !pred(p)) continue;
      let rec = out.get(c);
      if (!rec) out.set(c, rec = { v: new Array(cols.length).fill(0),
        kids: new Set(), dms: new Set(), pg: {} });
      const v = pvals(p, cols);
      for (let j = 0; j < v.length; j++) rec.v[j] += v[j];
      const g = ch[k + 1];
      if (g !== undefined) rec.kids.add(g);
      if (p.dm) rec.dms.add(p.dm);
      if (p.pg) for (const dy in p.pg)
        if (!(dy in rec.pg)) rec.pg[dy] = p.pg[dy];
    }
    model.cache.set(key, out);
    return out;
  }

  /* Aggregate for the branch itself: column sums, demand set, page refs. */
  function branch(model, trail, cols, pred) {
    const k = trail.length;
    const { chains, paths } = model;
    const out = { v: new Array(cols.length).fill(0), dms: new Set(),
      pg: {}, nPaths: 0 };
    for (let i = 0; i < chains.length; i++) {
      const ch = chains[i];
      let match = true;
      for (let a = 0; a < k; a++) if (ch[a] !== trail[a]) { match = false; break; }
      if (!match) continue;
      const p = paths[i];
      if (pred && !pred(p)) continue;
      out.nPaths++;
      const v = pvals(p, cols);
      for (let j = 0; j < v.length; j++) out.v[j] += v[j];
      if (p.dm) out.dms.add(p.dm);
      if (p.pg) for (const dy in p.pg)
        if (!(dy in out.pg)) out.pg[dy] = p.pg[dy];
    }
    return out;
  }

  /* Per-fiscal-year series for a branch, one measure. */
  function branchSeries(model, trail, m, nFys, pred) {
    const k = trail.length;
    const out = new Array(nFys).fill(0);
    const { chains, paths } = model;
    for (let i = 0; i < chains.length; i++) {
      const ch = chains[i];
      let match = true;
      for (let a = 0; a < k; a++) if (ch[a] !== trail[a]) { match = false; break; }
      if (!match) continue;
      if (pred && !pred(paths[i])) continue;
      const s = paths[i].d[m];
      if (s) for (const f in s) out[+f] += s[f];
    }
    return out;
  }

  /* Distinct trails at a depth, ranked by a column; the series page's
     picker items. */
  function trailsAtDepth(model, depth, col) {
    const seen = new Map();
    const { chains, paths } = model;
    for (let i = 0; i < chains.length; i++) {
      const ch = chains[i];
      if (ch.length < depth) continue;
      const t = ch.slice(0, depth);
      const key = t.join('>');
      let rec = seen.get(key);
      if (!rec) seen.set(key, rec = { trail: t, v: 0 });
      rec.v += pval(paths[i], col);
    }
    return [...seen.values()].sort((a, b) => b.v - a.v);
  }

  /* ---------------- column-spec builders (need the state index) -------- */

  /* The four columns as printed in document year dy: Accounts Y-2,
     BE Y-1 (restated), RE Y-1, BE Y. */
  function docCols(ix, dy) {
    const s = parseInt(dy.slice(0, 4), 10);
    const fy = y => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
    const fi = y => ix.fys.indexOf(fy(y));
    return [
      { m: 'ac', f: fi(s - 2), label: 'Accounts ' + fy(s - 2) },
      { m: 're', f: fi(s - 1), label: 'RE ' + fy(s - 1) },
      { m: 'be', f: fi(s), label: 'BE ' + fy(s) },
    ];
  }

  /* The four measures summed over a fiscal-year band [f0..f1]. */
  function bandCols(ix, f0, f1) {
    const lab = f0 === f1 ? ix.fys[f0]
      : ix.fys[f0] + ' – ' + ix.fys[f1];
    return [
      { m: 'be', f0, f1, label: 'BE · ' + lab },
      { m: 're', f0, f1, label: 'RE · ' + lab },
      { m: 'ac', f0, f1, label: 'Accounts · ' + lab },
    ];
  }

  /* Is measure m printed for fiscal year f (or any year of [f0..f1])? */
  function colExists(ix, col) {
    const sp = ix.spans[col.m];
    if (!sp) return false;
    if (col.f1 === undefined) return col.f >= sp[0] && col.f <= sp[1];
    return col.f1 >= sp[0] && col.f0 <= sp[1];
  }

  /* Apply a column spec to a majors-list entry from index.json
     (same {m: {fyIdx: v}} shape as a path). */
  const mval = (mj, col) => pval({ d: mj.d }, col);

  window.Model = { wrap, pval, pvals, mval, childrenOf, branch, branchSeries,
    trailsAtDepth, docCols, bandCols, colExists };
})();
