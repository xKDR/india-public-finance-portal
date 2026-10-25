/* The state budget explorer: cascading tables over the account-head
   hierarchy, four amount columns, year band or single document year, a side
   summary box, search, and data-quality badges.

   Top level draws from index.json alone; expanding a major head fetches its
   shard once, and every deeper expansion is a client-side scan (model.js). */

(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const ROOT = PORTAL.root, ST = PORTAL.state;
  const CHUNK = 40;

  let IX = null;                       // index.json
  const models = new Map();            // major code -> wrapped model
  const loading = new Set();
  const fmaps = new Map();             // major code -> badge flag map

  const S = {
    mode: 'doc',                       // 'doc' | 'band'
    pivot: 'heads',                    // 'heads' | 'dept' (demand-wise)
    dy: null,                          // document year (doc mode)
    from: 0, to: 0,                    // fy indices (band mode)
    open: new Set(), shown: new Set(),
    selKey: null, sel: null,           // sel: {mj, trail, dm}
    scope: 'global',
  };

  const crore = v => v == null ? null : v / IX.crore_div;
  const fmtAmt = v => Engine.money(crore(v));

  function cols() {
    return S.mode === 'doc' ? Model.docCols(IX, S.dy)
      : Model.bandCols(IX, S.from, S.to);
  }
  const cacheKey = () => S.mode === 'doc' ? 'd' + S.dy : 'b' + S.from + '-' + S.to;

  function rankCol(cs) {
    if (S.mode === 'doc') {
      if (Model.colExists(IX, cs[2])) return 2;
      for (let i = 0; i < cs.length; i++) if (Model.colExists(IX, cs[i])) return i;
      return 2;
    }
    return 0;
  }

  function dyIdxs() {
    if (S.mode === 'doc') return [IX.doc_years.indexOf(S.dy)];
    return Common.dyIdxsForBand(IX, S.from, S.to);
  }

  /* ------------------------------------------------------------ shards */
  function ensureModel(mj) {
    if (models.has(mj)) return Promise.resolve(models.get(mj));
    if (!loading.has(mj)) {
      loading.add(mj);
      Store.shard(ST, mj).then(sh => {
        const m = Model.wrap(sh);
        models.set(mj, m);
        fmaps.set(mj, Badges.indexFlags(sh));
        loading.delete(mj);
        draw();
      }).catch(err => {
        loading.delete(mj);
        console.error(err);
      });
    }
    return null;
  }

  /* ------------------------------------------------------------- rows */
  const rowKey = (mj, trail) => mj + '>' + trail.join('.');

  function amtCell(v, cs, i, rk) {
    const exists = Model.colExists(IX, cs[i]);
    const cls = ['amt', i === rk ? 'rank' : '', !exists ? 'off' : '',
      v < 0 ? 'neg' : ''].filter(Boolean).join(' ');
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = exists ? fmtAmt(v) : '–';
    return s;
  }

  /* The rank-column value's share of its parent: a mini bar plus a
     right-aligned percentage. No bar (just a dash) when the parent is
     zero/absent or the row itself is negative. */
  const stateTot = (cs, rk) => Model.pval({ d: IX.totals }, cs[rk]);

  function shareCell(v, parentV) {
    const s = document.createElement('span');
    s.className = 'xshare';
    if (!parentV || v < 0) {
      const d = document.createElement('span');
      d.className = 'pct dim';
      d.textContent = '–';
      s.append(d);
      return s;
    }
    const pct = v / parentV * 100;
    const track = document.createElement('span');
    track.className = 'track';
    const fill = document.createElement('span');
    fill.className = 'fill';
    fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    track.append(fill);
    const val = document.createElement('span');
    val.className = 'pct';
    val.textContent = Engine.pctf(pct);
    s.append(track, val);
    return s;
  }

  function baseRow(depth, can, open, sel) {
    const r = document.createElement(can ? 'button' : 'div');
    if (can) r.type = 'button';
    r.className = 'xrow' + (can ? ' can' : '') + (open ? ' open' : '')
      + (sel ? ' sel' : '');
    r.style.setProperty('--depth', depth);
    return r;
  }

  /* An open row with children rendered below it pins below the sticky
     column header while its children scroll past. lvl counts open
     ancestor rows above it (section=0, major=1, first node=2, ...); the
     stack caps at 3 rows (lvl 0-2) so deeper heads scroll normally. */
  function applyStick(r, open, lvl) {
    if (!open || lvl > 2) return;
    r.classList.add('stick');
    r.style.setProperty('--stick-level', lvl);
  }

  function lead(r, can, code, name, kidsTxt, chipEl) {
    const ld = document.createElement('span');
    ld.className = 'lead';
    const car = document.createElement('span');
    car.className = 'car';
    car.textContent = can ? '▶' : '';
    const cd = document.createElement('span');
    cd.className = 'code';
    cd.textContent = code;
    const nm = document.createElement('span');
    nm.className = 'name';
    nm.textContent = name;
    nm.title = name;
    ld.append(car, cd, nm);
    if (chipEl) ld.append(chipEl);
    if (kidsTxt) {
      const k = document.createElement('span');
      k.className = 'kids';
      k.textContent = kidsTxt;
      ld.append(k);
    }
    r.append(ld);
  }

  function majorChip(mjRec, mj) {
    const dys = dyIdxs();
    const fmap = fmaps.get(mj);
    if (fmap) {
      const own = Badges.flagFor(fmap, [], dys);
      if (own) return Badges.chip(own, chipCtx(mj, [], own));
    }
    let worst = 3, count = 0;
    for (const dy of dys) {
      const f = (mjRec.flagged || {})[String(dy)];
      if (f) { worst = Math.min(worst, f[0]); count += f[1]; }
    }
    if (count > 0) return Badges.countChip(count,
      ['serious', 'verify', 'notice'][worst] || 'notice');
    return null;
  }

  function nodeChip(mj, model, trail, pg) {
    const fmap = fmaps.get(mj);
    if (!fmap) return null;
    const codes = trail.map(id => model.nodes[id].code);
    const f = Badges.flagFor(fmap, codes, dyIdxs());
    if (!f) return null;
    return Badges.chip(f, chipCtx(mj, trail, f, model, pg));
  }

  function chipCtx(mj, trail, flag, model, pg) {
    const dy = IX.doc_years[flag.dy];
    let pdf = null;
    if (pg && pg[flag.dy] != null) {
      const p = pg[flag.dy];
      const key = Array.isArray(p) ? String(p[0]) : firstDm(model, trail);
      pdf = Common.pdfHref(IX, dy, key, p);
    }
    const codes = model ? trail.map(id => model.nodes[id].code) : [];
    return {
      ix: IX, dyLabel: dy, pdfHref: pdf,
      reportHref: Common.reportHref(ROOT, {
        state: ST, y: dy, code: [mj].concat(codes).join(' '),
      }),
    };
  }

  function firstDm(model, trail) {
    if (!model) return null;
    const b = Model.branch(model, trail, []);
    return b.dms.size ? [...b.dms][0] : null;
  }

  /* ---------------------------------------------- column info (T11) */
  /* Per-measure note for the popover's source list, keyed by measure so
     it stays correct however cols() orders them (doc mode: ac,bp,re,be;
     band mode reorders but the note is still sensible per-measure). */
  const COL_NOTE = {
    ac: ['', 'printed two volumes later'],
    re: ['', 'from the next volume'],
    be: ['', 'the headline estimate of this volume'],
  };

  let colPop = null;
  function closeColPop() {
    if (!colPop) return;
    colPop.remove();
    colPop = null;
    const b = $('.info-btn');
    if (b) b.setAttribute('aria-expanded', 'false');
  }
  document.addEventListener('click', e => {
    if (colPop && !colPop.contains(e.target)
        && !e.target.closest('.info-btn')) closeColPop();
  });

  function buildColPop(cs) {
    const p = document.createElement('div');
    p.className = 'popover colinfo';
    const h = document.createElement('h4');
    h.textContent = 'What the three columns mean';
    p.append(h);
    const p1 = document.createElement('p');
    p1.textContent = 'Single-year view shows three measures printed '
      + 'in that document year: accounts from two years before, the '
      + 'previous year\'s revised '
      + 'estimate, and the headline budget estimate.';
    const p2 = document.createElement('p');
    p2.textContent = 'A band sums each measure over the chosen fiscal '
      + 'years; a figure not printed yet shows as a dash, rather than zero.';
    p.append(p1, p2);
    const ul = document.createElement('ul');
    ul.className = 'collist';
    cs.forEach(c => {
      const note = COL_NOTE[c.m] || ['', ''];
      const li = document.createElement('li');
      li.textContent = c.label + note[0] + '; ' + note[1];
      ul.append(li);
    });
    p.append(ul);
    return p;
  }

  function colInfoBtn(cs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'info-btn';
    b.textContent = 'i';
    b.setAttribute('aria-label', 'What the three columns mean');
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', e => {
      e.stopPropagation();
      if (colPop) { closeColPop(); return; }
      colPop = buildColPop(cs);
      document.body.append(colPop);
      const r = b.getBoundingClientRect();
      colPop.style.left = Math.min(r.left + scrollX,
        scrollX + innerWidth - colPop.offsetWidth - 12) + 'px';
      colPop.style.top = (r.bottom + scrollY + 6) + 'px';
      b.setAttribute('aria-expanded', 'true');
    });
    return b;
  }

  /* ------------------------------------------------------------- draw */
  function drawHead() {
    const h = $('#xhead');
    h.innerHTML = '';
    const cs = cols(), rk = rankCol(cs);
    const lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = 'Account head';
    h.append(lbl);
    const shr = document.createElement('span');
    shr.className = 'amt';
    shr.textContent = '% of parent';
    h.append(shr);
    cs.forEach((c, i) => {
      const s = document.createElement('span');
      const on = Model.colExists(IX, c);
      s.className = 'amt' + (i === rk ? ' rank' : '') + (on ? '' : ' off');
      s.textContent = c.label;
      s.title = on ? '₹ crore' : c.label + '; not printed yet';
      h.append(s);
    });
    h.append(colInfoBtn(cs));
  }

  function draw() {
    Badges.closePop();
    closeColPop();
    drawHead();
    syncPivotSeg();
    const host = $('#xtree');
    host.innerHTML = '';
    const cs = cols(), rk = rankCol(cs);
    if (S.pivot === 'dept' && (IX.demands_data || []).length) {
      drawDept(host, cs, rk);
      drawSide();
      saveHash();
      return;
    }

    const majors = [...IX.majors].sort((a, b) =>
      Model.mval(b, cs[rk]) - Model.mval(a, cs[rk]));

    /* top level: the standard budget sections, majors nested inside */
    const byGroup = new Map();
    let shownCount = 0;
    for (const m of majors) {
      const vals = cs.map(c => Model.mval(m, c));
      if (S.mode === 'doc' && !vals.some(v => v !== 0)) continue;
      shownCount++;
      const g = m.g || 'other';
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push({ m, vals });
    }
    let nGroups = 0;
    for (const grp of IX.sector_groups || []) {
      const members = byGroup.get(grp.k);
      if (!members || !members.length) continue;
      nGroups++;
      host.append(...groupRows(grp, members, cs, rk));
    }
    $('#xcount').textContent = nGroups + ' sections · ' + shownCount
      + ' major heads · '
      + (S.mode === 'doc'
        ? 'document year ' + S.dy
        : 'fiscal years ' + IX.fys[S.from] + ' – ' + IX.fys[S.to])
      + ' · ₹ crore · open a section, then a head';
    drawSide();
    saveHash();
  }

  function groupRows(grp, members, cs, rk) {
    const key = 'G:' + grp.k;
    const open = S.open.has(key);
    const vals = cs.map((c, i) =>
      members.reduce((a, x) => a + x.vals[i], 0));
    const r = baseRow(0, true, open, false);
    r.classList.add('grp');
    applyStick(r, open, 0);
    r.setAttribute('aria-expanded', String(open));
    r.dataset.key = key;
    lead(r, true, '', grp.label,
      members.length + ' major head' + (members.length === 1 ? '' : 's')
      + ' · ' + grp.lo + '–' + grp.hi, null);
    r.append(shareCell(vals[rk], stateTot(cs, rk)));
    vals.forEach((v, i) => r.append(amtCell(v, cs, i, rk)));
    r.addEventListener('click', () => {
      open ? S.open.delete(key) : S.open.add(key);
      draw();
    });
    const out = [r];
    if (open) for (const { m, vals: mv } of members)
      out.push(...majorRows(m, cs, rk, mv));
    return out;
  }

  /* ------------------------------------------- the department pivot */
  function drawDept(host, cs, rk) {
    const list = [...IX.demands_data].sort((a, b) =>
      Model.pval({ d: b.d }, cs[rk]) - Model.pval({ d: a.d }, cs[rk]));
    let n = 0;
    for (const x of list) {
      const vals = cs.map(c => Model.pval({ d: x.d }, c));
      if (S.mode === 'doc' && !vals.some(v => v !== 0)) continue;
      n++;
      host.append(...deptRows(x, vals, cs, rk));
    }
    $('#xcount').textContent = n + ' demands (departments) · '
      + (S.mode === 'doc'
        ? 'document year ' + S.dy
        : 'fiscal years ' + IX.fys[S.from] + ' – ' + IX.fys[S.to])
      + ' · ₹ crore · a demand is one department\'s grant; open it to see '
      + 'its account heads';
  }

  function deptRows(x, vals, cs, rk) {
    const key = 'D:' + x.dm;
    const open = S.open.has(key);
    const r = baseRow(0, true, open, S.selKey === key);
    applyStick(r, open, 0);
    r.setAttribute('aria-expanded', String(open));
    r.dataset.key = key;
    lead(r, true, x.dm, x.n || 'Demand ' + x.dm, '', null);
    r.append(shareCell(vals[rk], stateTot(cs, rk)));
    vals.forEach((v, i) => r.append(amtCell(v, cs, i, rk)));
    r.addEventListener('click', () => {
      const wasOpen = S.open.has(key);
      if (wasOpen && S.selKey === key) S.open.delete(key);
      else S.open.add(key);
      S.selKey = key;
      S.sel = { mj: null, trail: [], dm: x.dm };
      draw();
    });
    const out = [r];
    if (open) {
      const missing = x.mjs.filter(mj => !models.has(mj));
      if (missing.length) {
        missing.forEach(ensureModel);
        const l = document.createElement('div');
        l.className = 'xloading';
        l.textContent = 'Loading ' + missing.length + ' major head'
          + (missing.length === 1 ? '' : 's') + '…';
        out.push(l);
      } else {
        const rows = x.mjs
          .map(mj => ({ mj,
            b: Model.branch(models.get(mj), [], cs, p => p.dm === x.dm) }))
          .filter(e => S.mode !== 'doc' || e.b.v.some(v => v !== 0))
          .sort((a, b) => b.b.v[rk] - a.b.v[rk]);
        const dTot = Model.pval({ d: x.d }, cs[rk]);
        for (const e of rows)
          out.push(...majorRowsDept(x.dm, e.mj, e.b, cs, rk, dTot));
      }
    }
    return out;
  }

  function majorRowsDept(dm, mj, b, cs, rk, dTot) {
    const model = models.get(mj);
    const ctx = { pred: p => p.dm === dm, ns: 'D' + dm + '|', dm };
    const key = rowKey(ctx.ns + mj, []);
    const open = S.open.has(key);
    const mrec = IX.majors.find(m => m.c === mj);
    const r = baseRow(1, true, open, S.selKey === key);
    applyStick(r, open, 1);
    r.setAttribute('aria-expanded', String(open));
    r.dataset.key = key;
    lead(r, true, mj, mrec ? mrec.n : mj, '', nodeChip(mj, model, [], b.pg));
    r.append(shareCell(b.v[rk], dTot));
    b.v.forEach((v, i) => r.append(amtCell(v, cs, i, rk)));
    r.addEventListener('click', () => toggle(key, mj, [], dm));
    const out = [r];
    if (open) out.push(...childList(mj, model, [], 2, cs, rk, ctx, 2));
    return out;
  }

  function majorRows(m, cs, rk, vals) {
    const mj = m.c;
    const key = rowKey(mj, []);
    const open = S.open.has(key);
    const model = models.get(mj);
    const r = baseRow(1, true, open, S.selKey === key);
    applyStick(r, open, 1);
    r.setAttribute('aria-expanded', String(open));
    r.dataset.key = key;
    lead(r, true, mj, m.n, '', majorChip(m, mj));
    r.append(shareCell(vals[rk], stateTot(cs, rk)));
    vals.forEach((v, i) => r.append(amtCell(v, cs, i, rk)));
    r.addEventListener('click', () => {
      toggle(key, mj, []);
    });
    const out = [r];
    if (open) {
      if (!model) {
        ensureModel(mj);
        const l = document.createElement('div');
        l.className = 'xloading';
        l.textContent = 'Loading ' + mj + '…';
        out.push(l);
      } else {
        out.push(...childList(mj, model, [], 2, cs, rk, undefined, 2));
      }
    }
    return out;
  }

  function childList(mj, model, trail, depth, cs, rk, ctx, lvl) {
    const ns = ctx ? ctx.ns : '';
    const out = [];
    const kids = [...Model.childrenOf(model, trail, cs, cacheKey() + ns,
      ctx && ctx.pred).entries()];
    const band = levelBand(model, trail, depth, cs, rk, ctx, kids);
    if (band) out.push(band);
    /* the parent for every child row's share cell: the branch total at
       this trail, NOT a sum over visible kids (chunking/negatives would
       throw that off); computed once here, not per row. */
    const parentV = Model.branch(model, trail, cs, ctx && ctx.pred).v[rk];
    const visible = kids.filter(([, rec]) =>
      S.mode !== 'doc' || rec.v.some(v => v !== 0));
    visible.sort((a, b) => b[1].v[rk] - a[1].v[rk]);
    const lkey = rowKey(ns + mj, trail) + '*';
    const showAll = S.shown.has(lkey);
    const vis = showAll ? visible : visible.slice(0, CHUNK);
    vis.forEach(([id, rec]) =>
      out.push(...nodeRows(mj, model, trail, id, rec, depth, cs, rk, ctx,
        parentV, lvl)));
    if (vis.length < visible.length) {
      const rest = visible.slice(vis.length)
        .reduce((a, [, rec]) => a + rec.v[rk], 0);
      const m = document.createElement('div');
      m.className = 'xmore';
      m.style.paddingLeft = (depth * 22 + 6) + 'px';
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Show the other ' + (visible.length - vis.length)
        + ' heads here ('
        + (Math.abs(crore(rest)) < 0.005 ? 'nothing'
          : '₹' + fmtAmt(rest) + ' crore')
        + ' under ' + cs[rk].label + ')';
      b.addEventListener('click', () => { S.shown.add(lkey); draw(); });
      m.append(b);
      out.push(m);
    }
    return out;
  }

  function nodeRows(mj, model, trail, id, rec, depth, cs, rk, ctx, parentV,
      lvl) {
    const nd = model.nodes[id];
    const t2 = trail.concat(id);
    const key = rowKey((ctx ? ctx.ns : '') + mj, t2);
    const can = rec.kids.size > 0;
    const open = can && S.open.has(key);
    const r = baseRow(depth, can, open, S.selKey === key);
    applyStick(r, open, lvl);
    if (can) r.setAttribute('aria-expanded', String(open));
    r.dataset.key = key;
    lead(r, can, nd.code, nd.name, '', nodeChip(mj, model, t2, rec.pg));
    r.append(shareCell(rec.v[rk], parentV));
    rec.v.forEach((v, i) => r.append(amtCell(v, cs, i, rk)));
    r.addEventListener('click', () => toggle(key, mj, t2, ctx && ctx.dm));
    const out = [r];
    if (open) out.push(...childList(mj, model, t2, depth + 1, cs, rk, ctx,
      lvl + 1));
    return out;
  }

  /* -------------------------------------------------------- level band */
  /* One row of mini stat-tiles under an expanded head, single-year mode
     only: over a band of years the "latest year" figures the tiles lean
     on (execution, newly-funded/vanished heads) would be misleading, so
     band-of-years mode skips the strip entirely. */
  function levelBand(model, trail, depth, cs, rk, ctx, kids) {
    if (S.mode !== 'doc') return null;
    const pred = ctx && ctx.pred;
    const rank = cs[rk];
    const ls = Stats.levelStats(model, trail, IX, rank, pred);
    const bym = {};
    for (const m of ['be', 'ac', 'bp'])
      bym[m] = Model.branchSeries(model, trail, m, IX.fys.length, pred);
    const getter = Stats.getterFromSeries(bym);
    const totGetter = Stats.getterFromD(IX.totals);
    const branchVal = Model.branch(model, trail, cs, pred).v[rk];
    const totVal = totGetter(rank.m, rank.f);

    const band = document.createElement('div');
    band.className = 'band';
    band.style.setProperty('--depth', depth);

    /* 1. % of total state budget; the leading stat at every level */
    const pctSer = Stats.seriesPct(getter, totGetter, IX, rank.m);
    band.append(bandTile('% of total budget',
      totVal ? Engine.pctf(branchVal / totVal * 100) : '–',
      [{ values: pctSer }], undefined, undefined,
      { title: '% of total budget',
        series: [{ name: '% of total budget',
          color: Engine.cssv('--s1'), values: pctSer }],
        fmt: v => Engine.pctf(v) }));

    /* 2. amount at the rank column, BE vs Actuals traced over time */
    const beSer = bym.be.map(v => v ? crore(v) : null);
    const acSer = bym.ac.map(v => v ? crore(v) : null);
    band.append(bandTile('Total · ' + rank.label,
      '₹' + fmtAmt(branchVal) + ' cr',
      [{ values: beSer },
       { values: acSer, dash: Engine.DASH.ac }], undefined, undefined,
      { title: 'Total over time', sub: '₹ crore',
        series: [
          { name: 'BE', color: Engine.cssv('--s1'), values: beSer },
          { name: 'Actuals', color: Engine.cssv('--s3'),
            dash: Engine.DASH.ac, values: acSer },
        ].filter(x => x.values.some(v => v != null)),
        fmt: Engine.money }));

    /* 3. % of the immediate parent; at a major head the parent IS the
       whole state, which tile 1 already reports, so skip it there */
    if (trail.length) {
      const childSer = bym[rank.m]
        || Model.branchSeries(model, trail, rank.m, IX.fys.length, pred);
      const parentSer = Model.branchSeries(model, trail.slice(0, -1),
        rank.m, IX.fys.length, pred);
      const pv = parentSer[rank.f];
      const ppSer = childSer.map((v, f) =>
        v && parentSer[f] ? v / parentSer[f] * 100 : null);
      band.append(bandTile('% of parent',
        pv ? Engine.pctf(branchVal / pv * 100) : '–',
        [{ values: ppSer }], undefined, undefined,
        { title: '% of parent head',
          series: [{ name: '% of parent',
            color: Engine.cssv('--s1'), values: ppSer }],
          fmt: v => Engine.pctf(v) }));
    }

    /* 4. latest execution ratio, only when actuals-vs-BE is printed */
    const st = Stats.keyStats(IX, getter);
    if (st.exec) {
      const exSer = Stats.execSeries(getter, IX);
      band.append(bandTile('Spent vs budgeted',
        Math.round(st.exec.pct) + '%', [{ values: exSer }],
        100, '\'' + IX.fys[st.exec.f].slice(2),
        { title: 'Spent vs budgeted', sub: 'actuals as % of BE',
          series: [{ name: 'Spent vs budgeted',
            color: Engine.cssv('--s1'), values: exSer }],
          fmt: v => v == null ? '–' : Math.round(v) + '%' }));
    }

    /* text tail: composition and year-on-year churn of this level */
    const tail = document.createElement('span');
    tail.className = 'tail';
    const label = bandLevelLabel(kids.map(([id]) => id), model);
    const n = ls.n, active = ls.active;
    const noun = label + (n === 1 ? '' : 's');
    const cnt = document.createElement('span');
    cnt.textContent = n === active ? n + ' ' + noun
      : active + ' of ' + n + ' ' + noun + ' active';
    tail.append(cnt);
    if (ls.top3pct != null) {
      const t3 = document.createElement('span');
      t3.textContent = '· top 3 carry ' + Engine.pctf(ls.top3pct, 0);
      tail.append(t3);
    }
    if (ls.newHeads.length)
      tail.append(bandChip(ls.newHeads.length + ' newly funded', ls.newHeads));
    if (ls.gone.length)
      tail.append(bandChip(ls.gone.length + ' vanished', ls.gone));
    band.append(tail);

    return band;
  }

  /* The level label when every id in ids shares one level, else the
     generic "head". */
  function bandLevelLabel(ids, model) {
    const lvs = new Set(ids.map(id => model.nodes[id].lv));
    const lv = lvs.size === 1 ? [...lvs][0] : null;
    const label = lv
      ? (model.levels.find(L => L.k === lv) || {}).label || 'head'
      : 'head';
    return label.toLowerCase();
  }

  function bandTile(lab, val, seriesList, ref, yr, big) {
    const d = document.createElement(big ? 'button' : 'span');
    d.className = 'bt';
    if (big) {
      d.type = 'button';
      d.title = 'Click for the full chart';
      d.setAttribute('aria-expanded', 'false');
    }
    const l = document.createElement('span');
    l.className = 'bl'; l.textContent = lab;
    if (big) {
      const cue = document.createElement('span');
      cue.className = 'bx'; cue.textContent = ' ⌄';
      l.append(cue);
    }
    const v = document.createElement('span');
    v.className = 'bv'; v.append(val);
    if (yr) {
      const y = document.createElement('span');
      y.className = 'yr'; y.textContent = ' ' + yr;
      v.append(y);
    }
    d.append(l, v);
    const sp = document.createElement('span');
    sp.className = 'spark';
    sp.append(Engine.spark(seriesList, { w: 100, h: 26, ref }));
    d.append(sp);
    if (big) d.addEventListener('click', () => toggleBandFig(d, big));
    return d;
  }

  /* Expand a band tile into a full-width chart row under the band;
     clicking the same tile again (or another tile) collapses/replaces. */
  function toggleBandFig(tile, big) {
    const band = tile.closest('.band');
    if (!band) return;
    const open = band.nextElementSibling;
    const mine = open && open.classList.contains('bandfig');
    band.querySelectorAll('.bt[aria-expanded]').forEach(b =>
      b.setAttribute('aria-expanded', 'false'));
    if (mine) {
      const same = open.dataset.k === big.title;
      open.remove();
      if (same) return;
    }
    const div = document.createElement('div');
    div.className = 'bandfig';
    div.dataset.k = big.title;
    div.style.setProperty('--depth', band.style.getPropertyValue('--depth'));
    band.after(div);
    tile.setAttribute('aria-expanded', 'true');
    Engine.figure(div, {
      title: big.title, sub: big.sub,
      render: Engine.lineChart({ years: IX.fys, series: big.series,
        fmt: big.fmt, height: 340,
        xEvery: Math.max(1, Math.ceil(IX.fys.length / 10)) }),
      table: () => Engine.table(['Fiscal year']
        .concat(big.series.map(x => x.name)),
        IX.fys.map((y, f) => [y].concat(big.series.map(x =>
          x.values[f] == null ? '–' : big.fmt(x.values[f]))))),
    });
    div.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function bandChip(txt, items) {
    const c = document.createElement('span');
    c.className = 'chip verify';           /* reuse the badge-chip look */
    c.textContent = txt;
    c.title = items.map(x => x.code + ' ' + x.name).join(', ');
    return c;
  }

  function toggle(key, mj, trail, dm) {
    const wasOpen = S.open.has(key);
    if (wasOpen && S.selKey === key) S.open.delete(key);
    else S.open.add(key);
    S.selKey = key;
    S.sel = { mj, trail, dm: dm || null };
    draw();
  }

  /* --------------------------------------------------------- overview */
  function drawOverview() {
    const get = Stats.getterFromD(IX.totals);
    const st = Stats.keyStats(IX, get);
    const items = [];
    if (st.be) items.push({ lab: 'Budget · BE ' + IX.fys[st.be.f],
      val: '₹' + fmtAmt(st.be.v) + ' cr',
      spark: { series: [{ values: IX.fys.map((_, f) => {
        const v = get('be', f); return v ? crore(v) : null; }) }] } });
    if (st.growth) items.push({ lab: 'BE growth, year on year',
      val: Stats.fmtPct(st.growth.pct, true),
      sub: 'over BE ' + IX.fys[st.growth.f - 1],
      spark: { series: [{ values: IX.fys.map((_, f) => {
        if (!f) return null;
        const bef = get('be', f), prev = get('be', f - 1);
        return bef && prev ? (bef / prev - 1) * 100 : null;
      }) }], ref: 0 } });
    if (st.exec) items.push({ lab: 'Spent vs budgeted · ' + IX.fys[st.exec.f],
      val: Stats.fmtPct(st.exec.pct),
      sub: 'accounts ₹' + fmtAmt(st.exec.ac) + ' cr against BE',
      tone: st.exec.pct < 85 ? 'warn' : null,
      spark: { series: [{ values: Stats.execSeries(get, IX) }], ref: 100 } });
    if (st.rev) items.push({ lab: 'Revised vs budgeted · ' + IX.fys[st.rev.f],
      val: Stats.fmtPct(st.rev.pct, true), sub: 'RE against BE',
      spark: { series: [{ values: IX.fys.map((_, f) => {
        const re = get('re', f), be = get('be', f);
        return re && be ? (re / be - 1) * 100 : null;
      }) }], ref: 0 } });
    if (st.cagr) items.push({ lab: st.cagr.span + '-yr growth of actuals',
      val: Stats.fmtPct(st.cagr.pct, true) + ' /yr',
      sub: IX.fys[st.cagr.f0] + ' → ' + IX.fys[st.cagr.f1],
      spark: { series: [{ values: IX.fys.map((_, f) => {
        const v = get('ac', f); return v ? crore(v) : null; }),
        dash: Engine.DASH.ac }] } });
    if (st.be) {
      const col = { m: 'be', f: st.be.f };
      const sp = Stats.sectorSplit(IX.majors, col);
      const tot = sp.revenue + sp.capital + sp.loans + sp.other;
      if (tot > 0) items.push({ lab: 'Capital share of BE',
        val: Stats.fmtPct(sp.capital / tot * 100),
        spark: { series: [{ values: IX.fys.map((_, f) => {
          if (!get('be', f)) return null;
          const s = Stats.sectorSplit(IX.majors, { m: 'be', f });
          const t = s.revenue + s.capital + s.loans + s.other;
          return t > 0 ? s.capital / t * 100 : null;
        }) }] } });
    }
    Stats.tiles($('#xoverview'), items);
    drawTopHeads(st.be ? st.be.f : IX.fys.length - 1);
  }

  function drawTopHeads(fbe) {
    const host = $('#xtop');
    host.innerHTML = '';
    const col = { m: 'be', f: fbe };
    const tot = Model.pval({ d: IX.totals }, col);
    if (!tot) return;
    const tops = [...IX.majors]
      .map(m => ({ m, v: Model.mval(m, col) }))
      .filter(x => x.v > 0)
      .sort((a, b) => b.v - a.v).slice(0, 8);
    const h3 = document.createElement('h3');
    h3.textContent = 'Largest major heads · BE ' + IX.fys[fbe]
      + ' · click to open';
    host.append(h3);
    const max = tops[0].v;
    for (const { m, v } of tops) {
      const r = document.createElement('button');
      r.type = 'button';
      r.className = 'throw';
      const nm = document.createElement('span');
      nm.className = 'nm';
      const c = document.createElement('code');
      c.textContent = m.c;
      nm.append(c, m.n);
      nm.title = m.n;
      const track = document.createElement('span');
      track.className = 'track';
      const fill = document.createElement('span');
      fill.className = 'fill';
      fill.style.width = (v / max * 100).toFixed(1) + '%';
      track.append(fill);
      const val = document.createElement('span');
      val.className = 'v';
      val.textContent = '₹' + fmtAmt(v) + ' cr';
      const sh = document.createElement('span');
      sh.className = 's';
      sh.textContent = Engine.pctf(v / tot * 100);
      r.append(nm, track, val, sh);
      r.addEventListener('click', () => expandToCode(m.c, 'mj', m.c, m.n));
      host.append(r);
    }
  }

  /* Ratio rows for the selected head (or the whole state). */
  function ratioBlock(getter) {
    const st = Stats.keyStats(IX, getter);
    const rows = [];
    if (st.exec) rows.push(['Spent vs budgeted · ' + IX.fys[st.exec.f],
      Stats.fmtPct(st.exec.pct)]);
    if (st.rev) rows.push(['Revised vs budgeted · ' + IX.fys[st.rev.f],
      Stats.fmtPct(st.rev.pct, true)]);
    if (st.growth) rows.push(['BE growth · ' + IX.fys[st.growth.f],
      Stats.fmtPct(st.growth.pct, true)]);
    if (st.cagr) rows.push([st.cagr.span + '-yr actuals growth',
      Stats.fmtPct(st.cagr.pct, true) + ' /yr']);
    if (!rows.length) return null;
    const box = document.createElement('div');
    box.className = 'ratios';
    const h = document.createElement('h4');
    h.textContent = 'Key ratios';
    box.append(h);
    const dl = document.createElement('dl');
    for (const [k, v] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      dl.append(dt, dd);
    }
    box.append(dl);
    return box;
  }

  /* "This level" composition block for the side panel: the same figures
     levelBand shows inline under an expanded row (count/active, top-3
     concentration, newly-funded/vanished heads), for whichever node is
     currently selected. Single-year mode only, and only once the node's
     shard is loaded and it actually has children; a whole-demand
     selection (no mj) and leaf heads render nothing. */
  function levelBlock(cs) {
    if (S.mode !== 'doc' || !S.sel || !S.sel.mj) return null;
    const { mj, trail, dm } = S.sel;
    const model = models.get(mj);
    if (!model) return null;
    const pred = dm ? (p => p.dm === dm) : null;
    const rank = cs[rankCol(cs)];
    const ls = Stats.levelStats(model, trail, IX, rank, pred);
    if (!ls.n) return null;

    /* mirrors Stats.levelStats' own cache key, so this just reads back
       the Map it already built rather than rescanning the shard. */
    const key = 'ls' + rank.m + rank.f + (pred ? 'p' : '');
    const ids = [...Model.childrenOf(model, trail, [rank], key, pred).keys()];
    const label = bandLevelLabel(ids, model);

    const box = document.createElement('div');
    box.className = 'ratios lvl';
    const h = document.createElement('h4');
    h.textContent = 'This level';
    box.append(h);

    const sum = document.createElement('p');
    sum.className = 'sum';
    const noun = label + (ls.n === 1 ? '' : 's');
    sum.textContent = ls.n + ' ' + noun
      + (ls.active < ls.n ? '; ' + ls.active + ' active' : '');
    box.append(sum);

    if (ls.top3.length) {
      const dl = document.createElement('dl');
      for (const t of ls.top3) {
        const dt = document.createElement('dt');
        const nm = document.createElement('span');
        nm.className = 'nm';
        const c = document.createElement('code');
        c.textContent = t.code;
        nm.append(c, ' ' + t.name);
        nm.title = t.code + ' ' + t.name;
        dt.append(nm);
        const dd = document.createElement('dd');
        dd.textContent = Engine.pctf(t.pct, 0);
        dl.append(dt, dd);
      }
      box.append(dl);
    }

    if (ls.newHeads.length) box.append(lvlChg('Newly funded', ls.newHeads));
    if (ls.gone.length) box.append(lvlChg('Vanished', ls.gone));

    return box;
  }

  function lvlChg(lab, items) {
    const p = document.createElement('p');
    p.className = 'chg';
    p.textContent = lab + ': '
      + items.map(x => x.code + ' ' + x.name).join(', ');
    p.title = p.textContent;
    return p;
  }

  /* ------------------------------------------------------------- side */
  function drawSide() {
    const box = $('#xside-body');
    if (!box) return;
    Engine.dropFigs(box);
    box.innerHTML = '';
    const cs = cols();
    const dl = document.createElement('dl');

    let title = IX.name + '; all heads';
    let bc = null, vals, links = [], chips = [], note = null;
    let getter = Stats.getterFromD(IX.totals);

    if (S.sel && S.sel.dm && !S.sel.mj) {
      /* a whole demand (department) selected */
      const rec = (IX.demands_data || []).find(x => x.dm === S.sel.dm);
      if (rec) {
        title = 'Demand ' + rec.dm + (rec.n ? ' · ' + rec.n : '');
        vals = cs.map(c => Model.pval({ d: rec.d }, c));
        getter = Stats.getterFromD(rec.d);
        note = 'This department\'s grant is carried by '
          + rec.mjs.length + ' major head'
          + (rec.mjs.length === 1 ? '' : 's') + ': ' + rec.mjs.join(', ') + '.';
        const a = document.createElement('a');
        a.href = Common.reportHref(ROOT, { state: ST,
          y: S.mode === 'doc' ? S.dy : '', code: 'Demand ' + rec.dm });
        a.textContent = 'Report an error in these numbers →';
        links = [a];
      }
    } else if (S.sel) {
      const { mj, trail, dm } = S.sel;
      const pred = dm ? (p => p.dm === dm) : null;
      const mrec = IX.majors.find(x => x.c === mj);
      const model = models.get(mj);
      if (!trail.length && !dm) {
        title = mj + ' · ' + (mrec ? mrec.n : '');
        vals = cs.map(c => Model.mval(mrec, c));
        getter = Stats.getterFromD(mrec.d);
        links = selLinks(mj, [], model);
        const ch = majorChip(mrec, mj);
        if (ch) chips.push(ch);
      } else if (model) {
        const b = Model.branch(model, trail, cs, pred);
        vals = b.v;
        const bym = {};
        for (const m of ['be', 're', 'ac', 'bp'])
          bym[m] = Model.branchSeries(model, trail, m, IX.fys.length, pred);
        getter = Stats.getterFromSeries(bym);
        if (trail.length) {
          const nd = model.nodes[trail[trail.length - 1]];
          title = nd.code + ' · ' + nd.name;
        } else {
          title = mj + ' · ' + (mrec ? mrec.n : '');
        }
        bc = [mj + ' ' + (mrec ? mrec.n : '')].concat(
          trail.map(id => model.nodes[id].code + ' '
            + model.nodes[id].name));
        if (dm) note = 'Only the part under demand ' + dm
          + (IX.demands[dm] ? ' (' + IX.demands[dm] + ')' : '')
          + '; switch to "Account heads" for the head across all demands.';
        else if (b.dms.size) note = 'Printed under demand'
          + (b.dms.size > 1 ? 's ' : ' ')
          + [...b.dms].sort().map(d =>
            d + (IX.demands[d] ? ' (' + IX.demands[d] + ')' : '')).join(', ')
          + '.';
        links = selLinks(mj, trail, model, b, dm);
        const ch = nodeChip(mj, model, trail, b.pg);
        if (ch) chips.push(ch);
      }
    }
    if (!vals) vals = cs.map(c => Model.pval({ d: IX.totals }, c));

    $('#xside-title-txt').textContent = 'Summary; ' + title;

    if (bc) {
      const p = document.createElement('p');
      p.className = 'bc';
      bc.forEach((t, i) => {
        if (i) p.append(' › ');
        const parts = t.split(' ');
        const c = document.createElement('code');
        c.textContent = parts[0];
        p.append(c, ' ' + parts.slice(1).join(' '));
      });
      box.append(p);
    }

    const stTot = cs.map(c => Model.pval({ d: IX.totals }, c));
    cs.forEach((c, i) => {
      const on = Model.colExists(IX, c);
      const dt = document.createElement('dt');
      dt.textContent = c.label;
      const dd = document.createElement('dd');
      dd.textContent = on ? '₹' + fmtAmt(vals[i]) + ' cr' : '–';
      if (!on) dd.className = 'dim';
      dl.append(dt, dd);
      if (on && S.sel && stTot[i]) {
        const dt2 = document.createElement('dt');
        dt2.textContent = '· share of state';
        dt2.style.paddingLeft = '10px';
        const dd2 = document.createElement('dd');
        dd2.className = 'dim';
        dd2.textContent = Engine.pctf(vals[i] / stTot[i] * 100);
        dl.append(dt2, dd2);
      }
    });
    box.append(dl);

    if (chips.length) {
      const cr = document.createElement('div');
      cr.className = 'chiprow';
      chips.forEach(c => cr.append(c));
      box.append(cr);
    }
    if (note) {
      const p = document.createElement('p');
      p.className = 'note';
      p.textContent = note;
      box.append(p);
    }
    const rb = ratioBlock(getter);
    if (rb) box.append(rb);
    const lb = levelBlock(cs);
    if (lb) box.append(lb);
    sideChart(box, getter, title);
    if (links.length) {
      const lk = document.createElement('div');
      lk.className = 'links';
      links.forEach(a => lk.append(a));
      box.append(lk);
    }
  }

  /* The selected head's history, drawn in place: hue carries the head
     (one head, one hue), dash carries the measure; the house rule. */
  function sideChart(box, getter, title) {
    const hue = Engine.cssv('--s1');
    const series = Engine.MEAS
      .map(([m, label]) => ({
        name: label, dash: Engine.DASH[m], color: hue,
        values: IX.fys.map((_, f) =>
          Model.colExists(IX, { m, f }) && getter(m, f)
            ? crore(getter(m, f)) : null),
      }))
      .filter(s => s.values.some(v => v != null));
    if (!series.length) return;
    const mount = document.createElement('div');
    mount.className = 'sidefig';
    box.append(mount);
    Engine.figure(mount, {
      title: 'Over time; ' + (title.length > 30
        ? title.slice(0, 29) + '…' : title),
      sub: '₹ crore',
      render: Engine.lineChart({ years: IX.fys, series,
        fmt: Engine.money, height: 200,
        margin: { l: 48, r: 42, b: 38 },
        xEvery: Math.ceil(IX.fys.length / 5) }),
      table: () => Engine.table(['Fiscal year'].concat(series.map(s => s.name)),
        IX.fys.map((y, f) => [y].concat(series.map(s =>
          s.values[f] == null ? '–' : Engine.money(s.values[f]))))),
    });
  }

  function selLinks(mj, trail, model, b, dm) {
    const codes = model ? trail.map(id => model.nodes[id].code) : [];
    const path = [mj].concat(codes).join('.');
    const out = [];
    const mk = (href, txt) => {
      const a = document.createElement('a');
      a.href = href; a.textContent = txt;
      return a;
    };
    /* the dashboard and series pages show a head across ALL demands, so
       the links would silently drop a demand filter; offer them only in
       the account-heads view */
    if (!dm) {
      out.push(mk('dashboard.html#p=' + path, 'Explore in the dashboard →'));
      out.push(mk('series.html#add=' + path, 'See over time →'));
      /* states are only comparable at major/sub-major/minor level */
      const lastLv = trail.length ? model.nodes[trail[trail.length - 1]].lv : null;
      if (!trail.length || lastLv === 'sm' || lastLv === 'mn') {
        const cpath = [mj].concat(codes).join('-');
        out.push(mk(ROOT + 'compare.html#c=' + cpath + '!' + ST,
          'Compare across states →'));
      }
    }
    let pdf = null, dyLab = null;
    const pg = b ? b.pg : null;
    if (pg) {
      const dys = dyIdxs();
      for (let i = dys.length - 1; i >= 0; i--) {
        if (pg[dys[i]] != null) {
          dyLab = IX.doc_years[dys[i]];
          const p = pg[dys[i]];
          const key2 = Array.isArray(p) ? String(p[0]) : firstDm(model, trail);
          pdf = Common.pdfHref(IX, dyLab, key2, p);
          break;
        }
      }
    }
    if (pdf) out.push(mk(pdf, 'Open the source PDF (' + dyLab + ') →'));
    out.push(mk(Common.reportHref(ROOT, {
      state: ST, y: S.mode === 'doc' ? S.dy : '',
      code: [mj].concat(codes).join(' '),
    }), 'Report an error in these numbers →'));
    return out;
  }

  /* ----------------------------------------------------------- search */
  function wireSearch() {
    const idx = Search.makeIndex(ST);
    Search.attach($('#xsearch'), idx, {
      global: () => true,
      onPick: e => {
        const mj = e.lv === 'mj' ? e.code : (e.majors && e.majors[0]);
        if (!mj) return;
        expandToCode(mj, e.lv, e.code, e.name);
      },
    });
  }

  function branchResults(q) {
    const ql = q.trim().toLowerCase();
    if (ql.length < 2) return [];
    const out = [];
    if (S.sel && models.get(S.sel.mj)) {
      const { mj, trail } = S.sel;
      const model = models.get(mj);
      const under = new Set();
      const k = trail.length;
      for (const ch of model.chains) {
        let ok = true;
        for (let a = 0; a < k; a++) if (ch[a] !== trail[a]) { ok = false; break; }
        if (ok) for (let a = k; a < ch.length; a++) under.add(ch[a]);
      }
      for (const id of under) {
        const nd = model.nodes[id];
        if (nd.code.toLowerCase().startsWith(ql)
            || nd.name.toLowerCase().includes(ql)) {
          out.push({ code: nd.code, name: nd.name, lv: nd.lv,
            pick: () => expandToId(mj, id) });
          if (out.length >= 12) break;
        }
      }
    } else {
      for (const m of IX.majors) {
        if (m.c.startsWith(ql) || m.n.toLowerCase().includes(ql)) {
          const mj = m.c;
          out.push({ code: mj, name: m.n, lv: 'mj',
            pick: () => expandToCode(mj, 'mj', mj, m.n) });
          if (out.length >= 12) break;
        }
      }
    }
    return out;
  }

  function openGroupOf(mj) {
    const m = IX.majors.find(x => x.c === mj);
    if (m) S.open.add('G:' + (m.g || 'other'));
  }

  function expandToCode(mj, lv, code, name) {
    openGroupOf(mj);
    const model = models.get(mj);
    if (!model) {
      const p = Store.shard(ST, mj).then(sh => {
        models.set(mj, Model.wrap(sh));
        fmaps.set(mj, Badges.indexFlags(sh));
        expandToCode(mj, lv, code, name);
      });
      return;
    }
    if (lv === 'mj') {
      S.open.add(rowKey(mj, []));
      S.selKey = rowKey(mj, []);
      S.sel = { mj, trail: [] };
      draw();
      scrollToKey(S.selKey);
      return;
    }
    let id = model.nodes.findIndex(n =>
      n.lv === lv && n.code === code && n.name === name);
    if (id < 0) id = model.nodes.findIndex(n =>
      n.lv === lv && n.code === code);
    if (id < 0) return;
    expandToId(mj, id);
  }

  function expandToId(mj, id) {
    openGroupOf(mj);
    const model = models.get(mj);
    for (const ch of model.chains) {
      const at = ch.indexOf(id);
      if (at < 0) continue;
      S.open.add(rowKey(mj, []));
      for (let a = 0; a < at; a++)
        S.open.add(rowKey(mj, ch.slice(0, a + 1)));
      const trail = ch.slice(0, at + 1);
      S.open.add(rowKey(mj, trail));
      /* the chunked list may hide it; show all siblings on the way down */
      for (let a = 0; a <= at; a++)
        S.shown.add(rowKey(mj, ch.slice(0, a)) + '*');
      S.selKey = rowKey(mj, trail);
      S.sel = { mj, trail };
      draw();
      scrollToKey(S.selKey);
      return;
    }
  }

  function scrollToKey(key) {
    const el2 = document.querySelector('[data-key="' + CSS.escape(key) + '"]');
    if (el2) el2.scrollIntoView({ block: 'center' });
  }

  /* ------------------------------------------------------------- hash */
  function saveHash() {
    const h = { m: S.mode };
    if (S.mode === 'doc') h.y = S.dy;
    else { h.f = IX.fys[S.from]; h.t = IX.fys[S.to]; }
    if (S.pivot === 'dept') h.v = 'dept';
    if (S.sel) {
      if (S.sel.dm && !S.sel.mj) h.open = 'dm.' + S.sel.dm;
      else if (S.sel.mj && !S.sel.dm) {
        const model = models.get(S.sel.mj);
        h.open = [S.sel.mj].concat(model
          ? S.sel.trail.map(id => model.nodes[id].code) : []).join('.');
      }
    }
    Common.writeHash(h);
  }

  function loadHash() {
    const h = Common.readHash();
    if (h.m === 'band') S.mode = 'band';
    if (h.v === 'dept') S.pivot = 'dept';
    if (h.g) h.g.split(',').forEach(k => S.open.add('G:' + k));
    if (h.y && IX.doc_years.includes(h.y)) S.dy = h.y;
    if (h.f && IX.fys.includes(h.f)) S.from = IX.fys.indexOf(h.f);
    if (h.t && IX.fys.includes(h.t)) S.to = IX.fys.indexOf(h.t);
    if (S.from > S.to) [S.from, S.to] = [S.to, S.from];
    return h.open || null;
  }

  /* Open the thing a hash names: 'dm.19' (a demand in the department
     view) or '2210.01.110' (a code path in the heads view). */
  function navigateTo(openPath) {
    if (openPath.startsWith('dm.')) {
      const dm = openPath.slice(3);
      if (!(IX.demands_data || []).some(x => x.dm === dm)) { draw(); return; }
      S.pivot = 'dept';
      S.open.add('D:' + dm);
      S.selKey = 'D:' + dm;
      S.sel = { mj: null, trail: [], dm };
      draw();
      scrollToKey('D:' + dm);
      return;
    }
    const codes = openPath.split('.');
    const mj = codes[0];
    if (!IX.majors.some(m => m.c === mj)) { draw(); return; }
    S.pivot = 'heads';
    if (codes.length === 1) { expandToCode(mj, 'mj', mj, ''); return; }
    Store.shard(ST, mj).then(sh => {
      if (!models.has(mj)) {
        models.set(mj, Model.wrap(sh));
        fmaps.set(mj, Badges.indexFlags(sh));
      }
      const model = models.get(mj);
      outer:
      for (const ch of model.chains) {
        if (ch.length < codes.length - 1) continue;
        for (let a = 0; a < codes.length - 1; a++)
          if (model.nodes[ch[a]].code !== codes[a + 1]) continue outer;
        expandToId(mj, ch[codes.length - 2]);
        return;
      }
      expandToCode(mj, 'mj', mj, '');
    });
  }

  /* starter links and shared URLs land here without a page load */
  addEventListener('hashchange', () => {
    if (!IX) return;
    const h = Common.readHash();
    if (h.v === 'dept') S.pivot = 'dept';
    else if (h.v === 'heads') S.pivot = 'heads';
    if (h.g) { S.pivot = 'heads';
      h.g.split(',').forEach(k => S.open.add('G:' + k)); }
    if (h.y && IX.doc_years.includes(h.y)) { S.mode = 'doc'; S.dy = h.y; }
    if (h.open) navigateTo(h.open);
    else draw();
  });

  /* --------------------------------------------------------- controls */
  function buildControls() {
    const pivotSeg = $('#xpivot');
    [['heads', 'Account heads'], ['dept', 'Departments']].forEach(([v, l]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = l;
      b.dataset.v = v;
      b.setAttribute('aria-pressed', String(S.pivot === v));
      b.addEventListener('click', () => {
        if (S.pivot === v) return;
        S.pivot = v;
        S.selKey = null; S.sel = null;
        draw();
      });
      pivotSeg.append(b);
    });

    const modeSeg = $('#xmode');
    [['doc', 'Single year'], ['band', 'Cumulative']].forEach(([v, l]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = l;
      b.dataset.v = v;
      b.setAttribute('aria-pressed', String(S.mode === v));
      b.addEventListener('click', () => {
        S.mode = v;
        for (const c of modeSeg.children)
          c.setAttribute('aria-pressed', String(c.dataset.v === v));
        syncYearFields();
        draw();
      });
      modeSeg.append(b);
    });

    const ysel = $('#xyear');
    [...IX.doc_years].reverse().forEach(y =>
      ysel.append(new Option(y, y)));
    ysel.value = S.dy;
    ysel.addEventListener('change', () => { S.dy = ysel.value; draw(); });

    const from = $('#xfrom'), to = $('#xto');
    IX.fys.forEach((y, i) => {
      from.append(new Option(y, i));
      to.append(new Option(y, i));
    });
    from.value = S.from; to.value = S.to;
    from.addEventListener('change', () => {
      S.from = Math.min(+from.value, S.to); from.value = S.from; draw(); });
    to.addEventListener('change', () => {
      S.to = Math.max(+to.value, S.from); to.value = S.to; draw(); });

    $('#xcollapse').addEventListener('click', () => {
      S.open = new Set(); S.shown = new Set();
      S.selKey = null; S.sel = null;
      draw();
    });
    syncYearFields();
  }

  function syncYearFields() {
    $('#xf-year').hidden = S.mode !== 'doc';
    $('#xf-from').hidden = S.mode !== 'band';
    $('#xf-to').hidden = S.mode !== 'band';
  }

  function syncPivotSeg() {
    const seg = $('#xpivot');
    if (!seg) return;
    for (const c of seg.children)
      c.setAttribute('aria-pressed', String(c.dataset.v === S.pivot));
  }

  /* --------------------------------------------------- side panel (T12) */
  /* Below 1020px the side panel sits after the tree and starts collapsed;
     tapping the header bar toggles it. Restructures h3#xside-title into a
     text span (which drawSide keeps updating) plus a caret span, so the
     caret survives repeated draws. The .closed class this adds has no
     effect above 1020px; explorer.css scopes its rule to that query. */
  function wireSidePanel() {
    const h3 = $('#xside-title');
    if (!h3) return;
    const txt = document.createElement('span');
    txt.id = 'xside-title-txt';
    txt.textContent = h3.textContent;
    const caret = document.createElement('span');
    caret.className = 'caret';
    caret.textContent = '▸';
    caret.setAttribute('aria-hidden', 'true');
    h3.textContent = '';
    h3.append(txt, caret);
    h3.setAttribute('role', 'button');
    h3.tabIndex = 0;
    h3.setAttribute('aria-expanded', 'false');
    const side = $('.xside');
    side.classList.add('closed');          /* start closed on narrow screens */
    const toggle = () => {
      const closed = side.classList.toggle('closed');
      h3.setAttribute('aria-expanded', String(!closed));
      caret.textContent = closed ? '▸' : '▾';
    };
    h3.addEventListener('click', toggle);
    h3.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggle();
    });
  }

  /* ------------------------------------------------------------- boot */
  Store.index(ST).then(ix => {
    IX = ix;
    S.dy = ix.doc_years[ix.doc_years.length - 1];
    S.from = Math.max(0, ix.fys.length - 5);
    S.to = ix.fys.length - 1;
    const openPath = loadHash();
    $('#xmeta').textContent = ix.majors.length + ' major heads · '
      + Engine.nfIN(ix.n_leaf_rows) + ' printed account lines · document '
      + 'years ' + ix.doc_years[0] + ' to '
      + ix.doc_years[ix.doc_years.length - 1] + ' · amounts in ₹ crore, '
      + 'summed from the additive leaf rows';
    buildControls();
    wireSearch();
    wireSidePanel();
    drawOverview();
    draw();
    if (openPath) navigateTo(openPath);
  }).catch(err => {
    $('#xtree').textContent = 'Could not load the data: ' + err.message;
  });

  Common.wireTheme($('#theme'));

  /* ----------------------------------------------------- keyboard (T13) */
  /* '/' jumps to search from anywhere on the page. Arrow-key row
     navigation was deliberately deferred; not implemented here. */
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeColPop(); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (e.key !== '/') return;
    e.preventDefault();
    const inp = $('#xsearch input');
    if (inp) inp.focus();
  });
})();
