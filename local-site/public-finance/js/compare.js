/* Cross-state compare page.

   dist/data/compare/index.json pairs every state's chart of accounts down to
   the minor head: {v, states:[{k,name,fys},...],
   entries:[[path, lv, {tn:[name,latestBEcr]|null, ka:...}], ...]}. path is
   the dash-joined code ("2210", "2210-01", "2210-01-110"); lv is
   mj|sm|mn; the level the national List of Major and Minor Heads
   prescribes, the floor below which codes are state-specific.

   THIS FILE covers boot, controls, the search omnibox that turns a query
   into a picked head, per-card series resolution + chart + mini table, and
   hash persistence.

   ---------------------------------------------------------------------
   CARD CONTRACT

   S.cards is an array of plain objects, one per head the user has picked:
     { path: '2210-01-110', lv: 'mn', states: { tn: true, ka: false } }
   - path: the compare-index path (matches entries[i][0]); dash-joined.
   - lv:   'mj' | 'sm' | 'mn'.
   - states: map of state key -> boolean for every state whose entries[i][2]
     record was non-null when the card was added (i.e. which states print
     this head at all; not which years); true = plotted, false = toggled
     off. A state absent from this map doesn't print the head at all.

   YEARS (union fiscal-year axis, string labels) and STATE_YIX (state key ->
   Map of that state's own fy label -> that state's own fy index into its
   index.json fys array) align a state's native series onto the shared
   window axis [S.from..S.to].
   --------------------------------------------------------------------- */

(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const MEAS = Engine.MEAS;
  const SCALES = [['cr', '₹ crore'], ['pct', '% of state total'],
    ['idx', 'Indexed']];

  let CIX = null;               // compare/index.json
  const IXS = {};                // state key -> that state's index.json
  let YEARS = [];                // union fy axis, sorted string labels
  const STATE_YIX = {};          // state key -> Map(fy label -> own index)
  const PATH2ENTRY = new Map();  // compare-index path -> [path, lv, states]

  const S = {
    cards: [],
    measures: ['be', 'ac'],
    from: 0, to: 0, scale: 'cr', free: false,
  };

  /* -------------------------------------------------- series resolution
     One shard per (state, major); a card's series is the element-wise sum
     of Model.branchSeries over EVERY distinct id-trail whose codes match
     the card's path, because states print duplicate same-code nodes (e.g.
     KA 2210 sub-major 01 spans three id chains; name variants). Cached
     per (state, path) since a shard is expensive to scan repeatedly. */
  const SCACHE = new Map();      // 'st|path' -> {name, vals} | null
  const SHARDS = {};             // st -> {mj -> Model}
  const LOADING = new Set();     // 'st|mj' shard fetches in flight

  const seriesFromD = (d, nFys) => {
    const out = {};
    for (const [mk] of MEAS) {
      out[mk] = new Array(nFys).fill(0);
      const s = d[mk] || {};
      for (const f in s) out[mk][+f] = s[f];
    }
    return out;
  };

  /* {name, vals:{be,re,ac,bp}} in native units over that state's own fys,
     or null if the state doesn't print this path at all, or the string
     'pending' while its shard is still loading (a Store.shard resolution
     triggers render() and the card repaints). */
  function resolveState(st, card) {
    const key = st + '|' + card.path;
    if (SCACHE.has(key)) return SCACHE.get(key);
    const ix = IXS[st];
    const mj = card.path.split('-')[0];
    const major = ix.majors.find(m => m.c === mj);
    if (!major) { SCACHE.set(key, null); return null; }
    if (card.lv === 'mj') {
      const rec = { name: major.n, vals: seriesFromD(major.d, ix.fys.length) };
      SCACHE.set(key, rec);
      return rec;
    }
    const models = SHARDS[st] || (SHARDS[st] = {});
    let model = models[mj];
    if (!model) {
      const lk = st + '|' + mj;
      if (!LOADING.has(lk)) {
        LOADING.add(lk);
        Store.shard(st, mj).then(sh => {
          models[mj] = Model.wrap(sh);
          LOADING.delete(lk);
          render();
        });
      }
      return 'pending';
    }
    const codes = card.path.split('-').slice(1);
    const trails = new Map();
    for (const ch of model.chains) {
      if (ch.length < codes.length) continue;
      let ok = true;
      for (let i = 0; i < codes.length; i++)
        if (model.nodes[ch[i]].code !== codes[i]) { ok = false; break; }
      if (!ok) continue;
      const t = ch.slice(0, codes.length);
      trails.set(t.join(','), t);       // dedupe distinct id-trails
    }
    if (!trails.size) { SCACHE.set(key, null); return null; }
    const nFys = ix.fys.length;
    const vals = {};
    for (const [mk] of MEAS) {
      const out = new Array(nFys).fill(0);
      for (const t of trails.values()) {
        const s = Model.branchSeries(model, t, mk, nFys);
        for (let f = 0; f < nFys; f++) out[f] += s[f];
      }
      vals[mk] = out;
    }
    let name = null;
    for (const t of trails.values())
      { name = model.nodes[t[t.length - 1]].name; break; }
    const rec = { name, vals };
    SCACHE.set(key, rec);
    return rec;
  }

  /* Toggled-on states for a card, each with its resolved series; pending
     is true while any toggled state's shard is still loading. States the
     card has no data for at all (shouldn't normally arise; a state is
     only toggled on when it's present) are silently excluded. */
  function activeStates(card) {
    const list = [];
    let pending = false;
    CIX.states.forEach((st, idx) => {
      if (card.states[st.k] !== true) return;
      const rec = resolveState(st.k, card);
      if (rec === 'pending') { pending = true; return; }
      if (!rec) return;
      list.push({ k: st.k, idx, rec });
    });
    return { list, pending };
  }

  /* Native-unit values over the current window [S.from..S.to], one state +
     measure. A year absent from that state's fys, or unprinted (outside
     ix.spans[mk]) is null. A printed zero remains a zero. */
  function windowRaw(st, rec, mk) {
    const ix = IXS[st];
    const sp = ix.spans[mk];
    return YEARS.slice(S.from, S.to + 1).map(y => {
      const yix = STATE_YIX[st].get(y);
      if (yix == null) return null;
      if (!sp || yix < sp[0] || yix > sp[1]) return null;
      const raw = (rec.vals[mk] || [])[yix];
      return Number.isFinite(raw) ? raw : null;
    });
  }

  /* Share of the same state's same-measure total in the same fiscal year.
     Changes in magnitude alone are not evidence of missing data. */
  function pctValues(l) {
    const ix = IXS[l.st];
    const totObj = ix.totals[l.mk] || {};
    const win = YEARS.slice(S.from, S.to + 1);
    return l.raw.map((v, i) => {
      if (v == null) return null;
      const yix = STATE_YIX[l.st].get(win[i]);
      const t = totObj[yix];
      if (!Number.isFinite(t) || t === 0) return null;
      const share = v / t * 100;
      return Number.isFinite(share) ? share : null;
    });
  }

  /* Indexed to 100 at the first window year where every plotted line has
     a (truthy) value; one shared base for the whole card, not per line. */
  function idxValues(lines) {
    const n = lines.length ? lines[0].raw.length : 0;
    let base = -1;
    for (let i = 0; i < n; i++)
      if (lines.length && lines.every(l => l.raw[i])) { base = i; break; }
    return lines.map(l => ({ ...l, values: l.raw.map((v, i) => {
      if (base < 0 || i < base || v == null) return null;
      return v / l.raw[base] * 100;
    }) }));
  }

  /* -------------------------------------------------------------- boot */
  Store.compareIndex().then(cix => {
    CIX = cix;
    for (const e of cix.entries) PATH2ENTRY.set(e[0], e);
    return Promise.all(cix.states.map(st =>
      Store.index(st.k).then(ix => { IXS[st.k] = ix; })));
  }).then(() => {
    const yset = new Set();
    for (const st of CIX.states) for (const y of IXS[st.k].fys) yset.add(y);
    YEARS = [...yset].sort();
    for (const st of CIX.states) {
      const m = new Map();
      IXS[st.k].fys.forEach((y, i) => m.set(y, i));
      STATE_YIX[st.k] = m;
    }
    S.from = Math.max(0, YEARS.length - 11);
    S.to = YEARS.length - 1;

    $('#cmeta').textContent = CIX.entries.length + ' comparable heads '
      + 'across ' + CIX.states.map(st => st.name).join(', ')
      + ' · states pair by code down to the minor head · ₹ crore';

    loadHash();
    buildControls();
    attachOmnibox();
    render();
  }).catch(err => {
    $('#cmeta').textContent = 'Could not load the data: ' + err.message;
  });

  Common.wireTheme($('#theme'));

  /* --------------------------------------------------------- controls */
  function buildControls() {
    const mb = $('#cmeasures');
    for (const [mk, label] of MEAS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.append(Engine.measureKey(mk), document.createTextNode(label));
      b.dataset.v = mk;
      b.setAttribute('aria-pressed', String(S.measures.includes(mk)));
      b.onclick = () => {
        const i = S.measures.indexOf(mk);
        if (i < 0) S.measures.push(mk);
        else if (S.measures.length > 1) S.measures.splice(i, 1);
        else return;
        S.measures.sort((a, c) => MEAS.findIndex(m => m[0] === a)
          - MEAS.findIndex(m => m[0] === c));
        for (const c of mb.children)
          c.setAttribute('aria-pressed',
            String(S.measures.includes(c.dataset.v)));
        render();
      };
      mb.append(b);
    }

    const from = $('#cfrom'), to = $('#cto');
    YEARS.forEach((y, i) => { from.append(new Option(y, i));
      to.append(new Option(y, i)); });
    from.value = S.from; to.value = S.to;
    from.onchange = () => { S.from = Math.min(+from.value, S.to);
      from.value = S.from; render(); };
    to.onchange = () => { S.to = Math.max(+to.value, S.from);
      to.value = S.to; render(); };

    const seg = $('#cscale');
    SCALES.forEach(([v, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.dataset.v = v;
      b.setAttribute('aria-pressed', String(S.scale === v));
      b.onclick = () => {
        S.scale = v;
        for (const c of seg.children)
          c.setAttribute('aria-pressed', String(c.dataset.v === v));
        render();
      };
      seg.append(b);
    });

    const freeBox = $('#cfree');
    const freeInput = freeBox && freeBox.querySelector('input');
    if (freeInput) freeInput.addEventListener('change', () => {
      S.free = freeInput.checked; render();
    });
  }

  /* ------------------------------------------------------------ render */
  function render() {
    drawCards();
    saveHash();
  }

  function addCard(path, lv, states) {
    if (S.cards.some(c => c.path === path)) return;
    const present = {};
    for (const st of CIX.states) if (states[st.k]) present[st.k] = true;
    S.cards.push({ path, lv, states: present });
  }

  /* ------------------------------------------------------------- cards */
  const stateName = k => (CIX.states.find(s => s.k === k) || {}).name
    || k.toUpperCase();
  const headPrimaryName = states => {
    for (const st of CIX.states) if (states[st.k]) return states[st.k][0];
    return null;
  };

  function cardFmt(v) {
    if (v == null) return '–';
    if (S.scale === 'pct') return v.toFixed(2) + '%';
    if (S.scale === 'idx') return v.toFixed(1);
    return Engine.money(v);
  }
  const cardUnitLabel = () => S.scale === 'pct'
    ? '% of that state’s own total, same measure'
    : S.scale === 'idx'
      ? 'index, first year every line has a value = 100'
      : '₹ crore, nominal; each state in its own units';

  /* Shared y-max across every card, so the eye can compare bar heights
     card to card; only meaningful (and only used) in the ₹ crore scale
     with "free scales" off. Only ever raises a card's own domain. */
  function computeSharedYMax() {
    let max = 0;
    for (const card of S.cards) {
      const { list, pending } = activeStates(card);
      if (pending) continue;
      for (const { k, rec } of list)
        for (const mk of S.measures)
          for (const v of windowRaw(k, rec, mk))
            if (v != null) max = Math.max(max, v / IXS[k].crore_div);
    }
    return max || null;
  }

  /* Latest window year every state in `list` reports (non-zero) actuals,
     the row for the mini table below the chart. */
  function tableYear(list) {
    for (let f = S.to; f >= S.from; f--) {
      const y = YEARS[f];
      if (!list.length) break;
      let ok = true;
      for (const { k, rec } of list) {
        const ix = IXS[k];
        const yix = STATE_YIX[k].get(y);
        const sp = ix.spans.ac;
        if (yix == null || !sp || yix < sp[0] || yix > sp[1]
            || !(rec.vals.ac || [])[yix]) { ok = false; break; }
      }
      if (ok) return y;
    }
    return null;
  }

  function buildMiniTable(host, list) {
    const y = tableYear(list);
    const note = document.createElement('div');
    note.className = 'cnote';
    if (!y) {
      note.textContent = 'No year in this window where every selected '
        + 'state reports actuals.';
      host.append(note);
      return;
    }
    note.textContent = 'Latest year every selected state reports actuals: '
      + y;
    host.append(note);

    const cols = ['State', 'BE', 'RE', 'AC (₹ cr)', 'Spent vs budgeted',
      '% of state total'];
    const rows = list.map(({ k, idx, rec }) => {
      const ix = IXS[k];
      const yix = STATE_YIX[k].get(y);
      const be = (rec.vals.be || [])[yix] || 0;
      const re = (rec.vals.re || [])[yix] || 0;
      const ac = (rec.vals.ac || [])[yix] || 0;
      const exec = be ? ac / be * 100 : null;
      const totAc = (ix.totals.ac || {})[yix];
      const totBe = (ix.totals.be || {})[yix];
      const share = totAc ? ac / totAc * 100 : totBe ? be / totBe * 100
        : null;
      const tone = exec == null ? null
        : exec >= 95 ? 'ctone-ok' : exec >= 85 ? 'ctone-warn' : 'ctone-bad';
      const nm = document.createElement('span');
      nm.className = 'srow';
      const sw = document.createElement('i');
      sw.className = 'sw';
      sw.style.background = `var(--s${idx + 1})`;
      nm.append(sw, document.createTextNode(stateName(k)));
      return [{ node: nm }, Engine.money(be / ix.crore_div),
        Engine.money(re / ix.crore_div), Engine.money(ac / ix.crore_div),
        { v: Engine.pctf(exec), cls: tone }, Engine.pctf(share)];
    });
    host.append(Engine.table(cols, rows, { leftCols: [0] }));
  }

  /* `sec` must already be attached under the live #cards grid before this
     runs; Engine.figure reads the chart mount's clientWidth synchronously
     to size its SVG, which is 0 for a detached subtree. */
  function buildCard(sec, card, yMax) {
    const entry = PATH2ENTRY.get(card.path);

    const head = document.createElement('div');
    head.className = 'chead';
    const code = document.createElement('span');
    code.className = 'code';
    code.textContent = card.path;
    const primary = entry ? headPrimaryName(entry[2]) : null;
    const ttl = document.createElement('span');
    ttl.className = 'ttl';
    ttl.textContent = primary || card.path;
    head.append(code, ttl);

    if (entry && primary) {
      for (const st of CIX.states) {
        const rec = entry[2][st.k];
        if (rec && rec[0]
            && rec[0].trim().toLowerCase() !== primary.trim().toLowerCase()) {
          const alt = document.createElement('span');
          alt.className = 'alt';
          alt.textContent = st.k.toUpperCase() + ' prints: ' + rec[0];
          head.append(alt);
          break;
        }
      }
    }

    const spacer = document.createElement('span');
    spacer.className = 'sp';
    head.append(spacer);

    const pills = document.createElement('span');
    pills.className = 'pills';
    CIX.states.forEach((st, i) => {
      const present = entry && entry[2][st.k];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'spill';
      const sw = document.createElement('i');
      sw.className = 'sw';
      sw.style.background = `var(--s${i + 1})`;
      b.append(sw, document.createTextNode(st.k.toUpperCase()));
      if (!present) {
        b.disabled = true;
        b.setAttribute('aria-pressed', 'false');
        b.title = st.name + ' does not print this head.';
      } else {
        b.setAttribute('aria-pressed', String(card.states[st.k] === true));
        b.title = 'Toggle ' + st.name + ' on this chart';
        b.addEventListener('click', () => {
          card.states[st.k] = !card.states[st.k];
          render();
        });
      }
      pills.append(b);
    });
    head.append(pills);

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'xrm';
    rm.title = 'Remove this card';
    rm.textContent = '✕';
    rm.addEventListener('click', () => {
      S.cards = S.cards.filter(c => c !== card);
      render();
    });
    head.append(rm);
    sec.append(head);

    const chartHost = document.createElement('div');
    chartHost.className = 'cchart';
    sec.append(chartHost);

    const { list, pending } = activeStates(card);
    if (pending) {
      chartHost.innerHTML = '<div class="xloading">Loading shard…</div>';
      return;
    }
    if (!list.length) {
      chartHost.innerHTML = '<div class="xloading">No state is toggled '
        + 'on for this head.</div>';
      return;
    }

    const lines = [];
    for (const { k, idx, rec } of list)
      for (const mk of S.measures)
        lines.push({ st: k, stIdx: idx, mk, rec, raw: windowRaw(k, rec, mk) });

    const series = S.scale === 'pct'
      ? lines.map(l => ({ ...l, values: pctValues(l) }))
      : S.scale === 'idx' ? idxValues(lines)
      : lines.map(l => ({ ...l,
          values: l.raw.map(v => v == null ? null : v / IXS[l.st].crore_div) }));

    const years = YEARS.slice(S.from, S.to + 1);
    const resolved = series.map(l => ({
      values: l.values, color: Engine.cssv('--s' + (l.stIdx + 1)),
      dash: Engine.DASH[l.mk],
      name: l.st.toUpperCase() + ' · ' + MEAS.find(m => m[0] === l.mk)[1],
      code: card.path,
    }));
    const title = MEAS.filter(m => S.measures.includes(m[0]))
      .map(m => m[1]).join(' · ')
      + ' · ' + years[0] + ' to ' + years[years.length - 1];

    Engine.figure(chartHost, {
      title, sub: cardUnitLabel(),
      render: Engine.lineChart({ years, series: resolved, fmt: cardFmt,
        height: 420, zero: S.scale !== 'idx',
        xEvery: years.length > 11 ? 2 : 1,
        yMax: S.scale === 'cr' && !S.free ? yMax : undefined }),
      table: () => {
        const cols = ['State', 'Measure'].concat(years);
        const rows = series.map(l => [{ v: l.st.toUpperCase() },
          MEAS.find(m => m[0] === l.mk)[1]].concat(l.values.map(cardFmt)));
        return Engine.table(cols, rows, { leftCols: [1] });
      },
      caption: 'Colour identifies the state; line pattern and marker identify '
        + 'the measure. Gaps mean unavailable data or a zero/missing state '
        + 'total in percentage view. A printed zero is plotted at zero. '
        + (S.scale === 'pct' ? 'Each value is divided by that state’s total '
          + 'for the same measure and fiscal year. Source coverage can vary.' : ''),
    });

    const tableHost = document.createElement('div');
    tableHost.className = 'ctable';
    sec.append(tableHost);
    buildMiniTable(tableHost, list);
  }

  function drawCards() {
    $('#cempty').hidden = S.cards.length > 0;
    const host = $('#cards');
    Engine.dropFigs(host);
    host.querySelectorAll('.ccard').forEach(c => c.remove());
    $('#cfree').hidden = !(S.cards.length > 1 && S.scale === 'cr');
    if (!S.cards.length) return;
    const yMax = S.scale === 'cr' && !S.free ? computeSharedYMax() : null;
    for (const card of S.cards) {
      const sec = document.createElement('section');
      sec.className = 'ccard';
      host.append(sec);          // attach before buildCard so Engine.figure
      buildCard(sec, card, yMax); // can read a real clientWidth
    }
  }

  /* -------------------------------------------------------------- hash */
  let lastHash = '';

  function saveHash() {
    if (!CIX) return;
    const h = {
      m: S.measures.join(','), sc: S.scale,
      f: YEARS[S.from], t: YEARS[S.to],
    };
    if (S.free) h.fr = '1';
    const parts = S.cards.map(c => c.path + '!' + CIX.states
      .filter(st => c.states[st.k] === true).map(st => st.k).join('+'));
    if (parts.length) h.c = parts.join('|');
    Common.writeHash(h);
    lastHash = location.hash;
  }

  function loadHash() {
    const h = Common.readHash();
    if (h.m) {
      const ms = h.m.split(',').filter(m => MEAS.some(x => x[0] === m));
      if (ms.length) S.measures = ms;
    }
    if (h.sc && SCALES.some(x => x[0] === h.sc)) S.scale = h.sc;
    S.free = h.fr === '1';
    if (h.f && YEARS.includes(h.f)) S.from = YEARS.indexOf(h.f);
    if (h.t && YEARS.includes(h.t)) S.to = YEARS.indexOf(h.t);
    if (S.from > S.to) [S.from, S.to] = [S.to, S.from];

    S.cards = [];
    for (const part of (h.c || '').split('|')) {
      if (!part) continue;
      const bang = part.indexOf('!');
      const path = bang < 0 ? part : part.slice(0, bang);
      const on = bang < 0 ? [] : part.slice(bang + 1).split('+').filter(Boolean);
      const entry = PATH2ENTRY.get(path);
      if (!entry) continue;                    // unknown path; drop silently
      const [, lv, states] = entry;
      const present = {};
      for (const st of CIX.states)
        if (states[st.k]) present[st.k] = on.includes(st.k);
      S.cards.push({ path, lv, states: present });
    }
  }

  function refreshControls() {
    for (const c of $('#cmeasures').children)
      c.setAttribute('aria-pressed', String(S.measures.includes(c.dataset.v)));
    for (const c of $('#cscale').children)
      c.setAttribute('aria-pressed', String(c.dataset.v === S.scale));
    $('#cfrom').value = S.from;
    $('#cto').value = S.to;
    const freeBox = $('#cfree');
    const freeInput = freeBox && freeBox.querySelector('input');
    if (freeInput) freeInput.checked = S.free;
  }

  addEventListener('hashchange', () => {
    if (!CIX || location.hash === lastHash) return;
    loadHash();
    refreshControls();
    render();
  });

  /* ------------------------------------------------------------ omnibox */
  const STATE_KEYS = () => CIX.states.map(st => st.k);
  const SEP_RE = /[\s.\-›]+/;             // space . - ›

  function maxBE(states) {
    let m = 0;
    for (const k in states) if (states[k] && states[k][1] > m) m = states[k][1];
    return m;
  }

  /* [path, lv, states] entries ranked for query `raw`. */
  function queryEntries(raw) {
    let q = raw.trim();
    if (!q) return [];
    let restrict = null;
    const stMatch = q.match(/^([a-z]{2,4}):\s*/i);
    if (stMatch && STATE_KEYS().includes(stMatch[1].toLowerCase())) {
      restrict = stMatch[1].toLowerCase();
      q = q.slice(stMatch[0].length).trim();
      /* Sub-minor single-state search (below the shared minor-head floor,
         where each state's codes diverge) is deferred to a later pass,
         for now `tn:` etc. only restricts the shared-code rows below. */
    }
    if (!q) return [];
    const ql = q.toLowerCase();
    const digitsOnly = /^\d+$/.test(q);
    const sepDigits = !digitsOnly && /^[\d\s.\-›]+$/.test(q);
    const normPath = sepDigits
      ? q.split(SEP_RE).filter(Boolean).join('-') : null;

    const hits = [];
    for (const e of CIX.entries) {
      const [path, , states] = e;
      if (restrict && !states[restrict]) continue;
      let tier = 0, sc = 0;
      if (digitsOnly) {
        const stripped = path.replace(/-/g, '');
        if (stripped === q || path === q) { tier = 3; sc = 1000; }
        else if (stripped.startsWith(q) || path.startsWith(q))
          { tier = 2; sc = 900 - path.length; }
      } else if (sepDigits) {
        if (path === normPath) { tier = 3; sc = 1000; }
        else if (path.startsWith(normPath)) { tier = 2; sc = 900 - path.length; }
      } else {
        let best = 0;
        for (const k of STATE_KEYS()) {
          const rec = states[k];
          if (!rec || !rec[0]) continue;
          const s = Search.score(ql, path, rec[0].toLowerCase());
          if (s > best) best = s;
        }
        if (best > 0) { tier = 1; sc = best; }
      }
      if (tier > 0) hits.push({ e, tier, sc, be: maxBE(states) });
    }
    hits.sort((a, b) => b.tier - a.tier || b.sc - a.sc || b.be - a.be);
    return hits.slice(0, 12).map(h => h.e);
  }

  function attachOmnibox() {
    const box = $('#csearch');
    const input = box.querySelector('input');
    const drop = document.createElement('div');
    drop.className = 'results';
    box.append(drop);
    let hot = -1, rows = [];

    function primaryName(states) {
      for (const st of CIX.states) if (states[st.k]) return states[st.k][0];
      return null;
    }

    function buildRow(entry) {
      const [path, lv, states] = entry;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'r';

      const code = document.createElement('span');
      code.className = 'code';
      code.textContent = path;

      const primary = primaryName(states);
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = primary || '(name not printed)';

      let alt = null;
      if (primary) {
        for (const st of CIX.states) {
          const rec = states[st.k];
          if (!rec || !rec[0]) continue;
          if (rec[0].trim().toLowerCase() !== primary.trim().toLowerCase()) {
            alt = document.createElement('span');
            alt.className = 'alt';
            alt.textContent = st.k.toUpperCase() + ' prints: ' + rec[0];
            break;
          }
        }
      }

      const lvSpan = document.createElement('span');
      lvSpan.className = 'lv';
      lvSpan.textContent = Search.LV_LABEL[lv] || lv;

      const pills = document.createElement('span');
      pills.className = 'pills';
      for (const st of CIX.states) {
        const rec = states[st.k];
        const p = document.createElement('span');
        p.className = 'stpill ' + (rec ? 'on' : 'off');
        p.textContent = st.k.toUpperCase() + ' '
          + (rec ? '₹' + Engine.nfIN(rec[1]) + ' cr' : '–');
        pills.append(p);
      }

      b.append(code, nm);
      if (alt) b.append(alt);
      b.append(lvSpan, pills);
      b.addEventListener('mousedown', ev => {
        ev.preventDefault(); pick(entry);
      });
      return b;
    }

    function paint(list) {
      drop.innerHTML = '';
      rows = list;
      hot = -1;
      if (!list.length) {
        if (input.value.trim().length >= 1) {
          const n = document.createElement('div');
          n.className = 'note';
          n.textContent = 'No head matches that.';
          drop.append(n);
          drop.classList.add('on');
        } else drop.classList.remove('on');
        return;
      }
      list.forEach(e => drop.append(buildRow(e)));
      drop.classList.add('on');
    }

    function pick(entry) {
      const [path, lv, states] = entry;
      addCard(path, lv, states);
      input.value = '';
      drop.classList.remove('on');
      render();
    }

    const run = () => paint(queryEntries(input.value));

    input.addEventListener('input', run);
    input.addEventListener('focus', run);
    input.addEventListener('blur', () => setTimeout(() =>
      drop.classList.remove('on'), 150));
    input.addEventListener('keydown', e => {
      const items = drop.querySelectorAll('.r');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        hot = e.key === 'ArrowDown'
          ? Math.min(items.length - 1, hot + 1) : Math.max(0, hot - 1);
        items.forEach((it, i) => it.classList.toggle('hot', i === hot));
        if (items[hot]) items[hot].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && hot >= 0) {
        e.preventDefault(); pick(rows[hot]);
      } else if (e.key === 'Escape') {
        drop.classList.remove('on'); input.blur();
      }
    });
  }
})();
