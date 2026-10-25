/* Time series at any level of the hierarchy.

   An "item" is a plottable head: a major (series straight from index.json)
   or a branch inside one (codes trail; series summed from the shard). Items
   can be combined into a named GROUP whose line is the element-wise sum of
   its members; one palette slot, ungroup splits it back.

   Encoding: hue = head (8 palette slots, never cycled), dash = measure.
   Scales: ₹ crore · % of state total (same measure, same year) ·
   indexed (first plotted year = 100). */

(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const ROOT = PORTAL.root, ST = PORTAL.state;
  const MAX = 8;
  const MEAS = Engine.MEAS;
  const DEPTH = { sm: 1, mn: 2, sh: 3, dh: 4, lf: 5 };

  let IX = null;
  const models = new Map();
  const items = new Map();          // key -> item
  let gcount = 0;

  const S = {
    level: 'mj', mjScope: null,
    measures: ['be', 'ac'],
    from: 0, to: 0, scale: 'cr', tab: 'chart',
    sel: [], slot: new Map(),
    groups: new Map(),              // gkey -> {name, members:[key]}
    marked: new Set(), q: '',
  };

  const crore = v => v == null ? null : v / IX.crore_div;

  function fmtV(v) {
    if (v == null) return '–';
    if (S.scale === 'pct') return v.toFixed(2) + '%';
    if (S.scale === 'idx') return v.toFixed(1);
    return Engine.money(v);
  }
  const unitLabel = () => S.scale === 'pct'
    ? '% of ' + IX.name + ' total, same measure'
    : S.scale === 'idx' ? 'index, first plotted year = 100'
    : '₹ crore, nominal';

  /* ------------------------------------------------------------- items */
  function itemKey(mj, codes) {
    return codes && codes.length ? mj + '/' + codes.join('.') : mj;
  }

  function makeItem(mj, codes, name) {
    const key = itemKey(mj, codes);
    if (items.has(key)) return items.get(key);
    const m = IX.majors.find(x => x.c === mj);
    const it = {
      key, mj, codes: codes || [],
      code: codes && codes.length ? codes[codes.length - 1] : mj,
      name: name || (m ? m.n : mj),
      label: (codes && codes.length ? mj + ' › ' + codes.join(' › ') : mj),
      vals: null,
    };
    if (!it.codes.length && m) it.vals = seriesFromD(m.d);
    items.set(key, it);
    return it;
  }

  const seriesFromD = d => {
    const out = {};
    for (const [mk] of MEAS) {
      out[mk] = new Array(IX.fys.length).fill(0);
      const s = d[mk] || {};
      for (const f in s) out[mk][+f] = s[f];
    }
    return out;
  };

  /* Resolve a branch item's series; loads its shard if needed. Returns true
     when ready. */
  function resolveItem(it) {
    if (it.vals) return true;
    const md = models.get(it.mj);
    if (!md) { ensureShard(it.mj); return false; }
    /* codes -> id trail */
    let trail = null;
    outer:
    for (const ch of md.chains) {
      if (ch.length < it.codes.length) continue;
      for (let a = 0; a < it.codes.length; a++)
        if (md.nodes[ch[a]].code !== it.codes[a]) continue outer;
      trail = ch.slice(0, it.codes.length);
      break;
    }
    if (!trail) { it.vals = {}; return true; }
    it.name = md.nodes[trail[trail.length - 1]].name;
    it.vals = {};
    for (const [mk] of MEAS)
      it.vals[mk] = Model.branchSeries(md, trail, mk, IX.fys.length);
    return true;
  }

  const loadingShards = new Set();
  function ensureShard(mj, cb) {
    if (models.has(mj)) { if (cb) cb(); return; }
    if (loadingShards.has(mj)) return;
    loadingShards.add(mj);
    Store.shard(ST, mj).then(sh => {
      models.set(mj, Model.wrap(sh));
      loadingShards.delete(mj);
      if (cb) cb();
      render();
    });
  }

  /* --------------------------------------------------------- selection */
  function assignSlot(key) {
    if (S.slot.has(key)) return true;
    const used = new Set(S.sel.map(k => S.slot.get(k)));
    for (let i = 0; i < MAX; i++)
      if (!used.has(i)) { S.slot.set(key, i); return true; }
    return false;
  }

  function toggleSel(key) {
    const i = S.sel.indexOf(key);
    if (i >= 0) {
      S.sel.splice(i, 1); S.slot.delete(key); S.marked.delete(key);
      if (S.groups.has(key)) S.groups.delete(key);
    } else {
      if (!assignSlot(key)) { capNote(); return; }
      S.sel.push(key);
    }
    render();
  }

  function capNote() {
    $('#pnote').textContent = 'Eight lines is the cap; the palette has '
      + 'eight slots. Unpick one, or combine some into a group.';
    clearTimeout(capNote.t);
    capNote.t = setTimeout(() => { $('#pnote').textContent = ''; }, 5200);
  }

  function makeGroup() {
    const members = S.sel.filter(k => S.marked.has(k) && !S.groups.has(k));
    if (members.length < 2) {
      $('#pnote').textContent =
        'Tick at least two heads in the tray, then combine.';
      return;
    }
    const gkey = 'g' + (++gcount);
    S.groups.set(gkey, {
      name: 'Group ' + String.fromCharCode(64 + gcount)
        + ' (' + members.length + ' heads)',
      members,
    });
    S.sel = S.sel.filter(k => !members.includes(k));
    members.forEach(k => { S.slot.delete(k); S.marked.delete(k); });
    assignSlot(gkey);
    S.sel.push(gkey);
    render();
  }

  function ungroup(gkey) {
    const g = S.groups.get(gkey);
    if (!g) return;
    S.groups.delete(gkey);
    S.sel = S.sel.filter(k => k !== gkey);
    S.slot.delete(gkey);
    for (const k of g.members) {
      if (!S.sel.includes(k) && assignSlot(k)) S.sel.push(k);
    }
    render();
  }

  /* Values (native) for a sel key, one measure. null if a shard is loading. */
  function rawSeries(key, mk) {
    if (S.groups.has(key)) {
      const g = S.groups.get(key);
      const out = new Array(IX.fys.length).fill(0);
      for (const k of g.members) {
        const it = items.get(k);
        if (!it || !resolveItem(it)) return null;
        const v = it.vals[mk];
        if (v) for (let f = 0; f < out.length; f++) out[f] += v[f];
      }
      return out;
    }
    const it = items.get(key);
    if (!it || !resolveItem(it)) return null;
    return it.vals[mk] || new Array(IX.fys.length).fill(0);
  }

  function displayName(key) {
    if (S.groups.has(key)) return S.groups.get(key).name;
    const it = items.get(key);
    if (it && !it.vals) resolveItem(it);   // pick up the real branch name
    return it ? it.name : key;
  }
  function displayCode(key) {
    if (S.groups.has(key)) return 'Σ';
    const it = items.get(key);
    return it ? (it.codes.length ? it.mj + '›' + it.codes.join('›') : it.mj)
      : key;
  }

  /* Scaled values over the plotted window (window-length array). */
  function plotSeries(key, mk) {
    const raw = rawSeries(key, mk);
    if (!raw) return null;
    const sp = IX.spans[mk];
    const out = [];
    let base;
    for (let f = S.from; f <= S.to; f++) {
      const exists = sp && f >= sp[0] && f <= sp[1];
      let v = exists && raw[f] ? raw[f] : null;
      if (v == null) { out.push(null); continue; }
      if (S.scale === 'pct') {
        const t = (IX.totals[mk] || {})[f];
        out.push(t ? v / t * 100 : null);
      } else if (S.scale === 'idx') {
        if (base === undefined) base = v;
        out.push(base ? v / base * 100 : null);
      } else out.push(crore(v));
    }
    return out;
  }

  /* ------------------------------------------------------------ render */
  function activeSeries() {
    const out = [];
    let pending = false;
    for (const key of S.sel) {
      for (const mk of S.measures) {
        const vals = plotSeries(key, mk);
        if (!vals) { pending = true; continue; }
        out.push({
          key, mk, values: vals,
          name: displayName(key) + ' · ' + MEAS.find(m => m[0] === mk)[1], code: displayCode(key),
          color: `var(--s${(S.slot.get(key) ?? 0) + 1})`,
          dash: Engine.DASH[mk],
        });
      }
    }
    return { series: out, pending };
  }

  function render() {
    drawTray();
    drawPicker();
    drawChart();
    saveHash();
  }

  function drawChart() {
    const host = $('#splot');
    Engine.dropFigs(host);
    host.innerHTML = '';
    const { series, pending } = activeSeries();
    if (pending) {
      host.innerHTML = '<div class="xloading">Loading shard…</div>';
      return;
    }
    if (!series.length) {
      host.innerHTML = '<div class="xloading">Pick a head below to plot it.'
        + '</div>';
      return;
    }
    const years = IX.fys.slice(S.from, S.to + 1);
    const resolved = series.map(s => ({ ...s,
      color: Engine.cssv('--s' + ((S.slot.get(s.key) ?? 0) + 1)) }));
    const title = MEAS.filter(m => S.measures.includes(m[0]))
      .map(m => m[1]).join(' · ')
      + ' · ' + years[0] + ' to ' + years[years.length - 1];
    Engine.figure(host, {
      title,
      sub: unitLabel(),
      render: Engine.lineChart({ years, series: resolved, fmt: fmtV,
        height: 430, zero: S.scale !== 'idx',
        xEvery: years.length > 11 ? 2 : 1 }),
      table: () => {
        const cols = ['Head', 'Measure'].concat(years);
        const rows = [];
        for (const s of resolved) {
          rows.push([{ v: s.code + '  ' + s.name },
            MEAS.find(m => m[0] === s.mk)[1]]
            .concat(s.values.map(v => fmtV(v))));
        }
        return Engine.table(cols, rows, { leftCols: [1] });
      },
      caption: Engine.MEASURE_HELP + ' Colour identifies the head. Gaps indicate unavailable data.',
    });
  }

  function drawTray() {
    const host = $('#tray');
    host.innerHTML = '';
    if (!S.sel.length) {
      const s = document.createElement('span');
      s.className = 'hint';
      s.textContent = 'Nothing plotted yet; pick heads from the list below.';
      host.append(s);
      return;
    }
    for (const key of S.sel) {
      const chip = document.createElement('span');
      chip.className = 'schip';
      const sw = document.createElement('i');
      sw.className = 'sw';
      sw.style.background = `var(--s${(S.slot.get(key) ?? 0) + 1})`;
      chip.append(sw);
      if (S.groups.has(key)) {
        const g = S.groups.get(key);
        const inp = document.createElement('input');
        inp.className = 'gname';
        inp.type = 'text';
        inp.value = g.name;
        inp.title = g.members.map(displayCode).join(', ');
        inp.addEventListener('change', () => { g.name = inp.value || g.name;
          render(); });
        chip.append(inp);
        const un = document.createElement('button');
        un.type = 'button';
        un.className = 'x';
        un.title = 'Ungroup';
        un.textContent = '⇢';
        un.addEventListener('click', () => ungroup(key));
        chip.append(un);
      } else {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = S.marked.has(key);
        cb.title = 'Tick to combine into a group';
        cb.addEventListener('change', () => {
          cb.checked ? S.marked.add(key) : S.marked.delete(key);
        });
        chip.append(cb);
        const cd = document.createElement('span');
        cd.className = 'code';
        cd.textContent = displayCode(key);
        chip.append(cd);
        chip.append(document.createTextNode(
          displayName(key).length > 26
            ? displayName(key).slice(0, 25) + '…' : displayName(key)));
      }
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'x';
      x.title = 'Remove';
      x.textContent = '×';
      x.addEventListener('click', () => toggleSel(key));
      chip.append(x);
      host.append(chip);
    }
    const gb = document.createElement('button');
    gb.type = 'button';
    gb.className = 'btn sm';
    gb.textContent = 'Combine ticked into one line';
    gb.addEventListener('click', makeGroup);
    host.append(gb);
  }

  /* ------------------------------------------------------------ picker */
  function pickerItems() {
    const rank = { m: 'be', f0: S.from, f1: S.to };
    if (S.level === 'mj') {
      return IX.majors.map(m => ({
        mj: m.c, codes: [], code: m.c, name: m.n,
        v: Model.mval(m, rank),
      })).sort((a, b) => b.v - a.v);
    }
    const md = models.get(S.mjScope);
    if (!md) { ensureShard(S.mjScope); return null; }
    const depth = DEPTH[S.level];
    return Model.trailsAtDepth(md, depth, rank)
      .slice(0, 400)
      .map(t => {
        const last = md.nodes[t.trail[t.trail.length - 1]];
        return { mj: S.mjScope,
          codes: t.trail.map(id => md.nodes[id].code),
          code: last.code, name: last.name, v: t.v };
      });
  }

  function drawPicker() {
    const host = $('#plist');
    host.innerHTML = '';
    const list = pickerItems();
    if (!list) {
      host.innerHTML = '<div class="xloading">Loading ' + S.mjScope + '…</div>';
      return;
    }
    const q = S.q.trim().toLowerCase();
    const vis = q ? list.filter(x => x.code.toLowerCase().includes(q)
      || x.name.toLowerCase().includes(q)
      || x.codes.join('.').toLowerCase().includes(q)) : list;
    let shown = 0;
    for (const x of vis) {
      if (shown >= 80) break;
      shown++;
      const key = itemKey(x.mj, x.codes);
      const on = S.sel.includes(key);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'h';
      b.setAttribute('aria-pressed', String(on));
      if (on) b.style.setProperty('--sw',
        `var(--s${(S.slot.get(key) ?? 0) + 1})`);
      const box = document.createElement('span'); box.className = 'box';
      const cd = document.createElement('span'); cd.className = 'code';
      cd.textContent = x.codes.length ? x.codes.join('›') : x.code;
      const nm = document.createElement('span'); nm.className = 'nm';
      nm.textContent = x.name; nm.title = x.name;
      const v = document.createElement('span'); v.className = 'v';
      v.textContent = Engine.money(crore(x.v));
      b.append(box, cd, nm, v);
      b.addEventListener('click', () => {
        makeItem(x.mj, x.codes, x.name);
        toggleSel(key);
      });
      host.append(b);
    }
    $('#pcount').textContent = shown
      + (vis.length > shown ? ' of ' + vis.length : '')
      + ' heads · ranked by BE over the window · '
      + S.sel.length + ' of ' + MAX + ' lines used';
  }

  /* ---------------------------------------------------------- controls */
  function buildControls() {
    const lsel = $('#slevel');
    const LV = [['mj', 'Major head']].concat(
      IX.levels.map(L => [L.k, L.label]));
    LV.forEach(([k, label]) => lsel.append(new Option(label, k)));
    lsel.value = S.level;
    lsel.onchange = () => {
      S.level = lsel.value;
      $('#sf-scope').hidden = S.level === 'mj';
      render();
    };

    const msel = $('#smajor');
    IX.majors.forEach(m => msel.append(
      new Option(m.c + '  ' + m.n, m.c)));
    S.mjScope = S.mjScope || IX.majors[0].c;
    msel.value = S.mjScope;
    msel.onchange = () => { S.mjScope = msel.value; render(); };
    $('#sf-scope').hidden = S.level === 'mj';

    const from = $('#sfrom'), to = $('#sto');
    IX.fys.forEach((y, i) => { from.append(new Option(y, i));
      to.append(new Option(y, i)); });
    from.value = S.from; to.value = S.to;
    from.onchange = () => { S.from = Math.min(+from.value, S.to);
      from.value = S.from; render(); };
    to.onchange = () => { S.to = Math.max(+to.value, S.from);
      to.value = S.to; render(); };

    const mb = $('#smeasures');
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

    const seg = $('#sscale');
    [['cr', '₹ crore'], ['pct', '% of state total'], ['idx', 'Indexed']]
      .forEach(([v, label]) => {
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

    $('#pfilter').addEventListener('input', e => {
      S.q = e.target.value; drawPicker(); });
  }

  /* -------------------------------------------------------------- hash */
  function saveHash() {
    const h = {
      lv: S.level, f: IX.fys[S.from], t: IX.fys[S.to],
      m: S.measures.join(','), sc: S.scale,
      sel: S.sel.filter(k => !S.groups.has(k)).join(','),
    };
    if (S.level !== 'mj') h.mj = S.mjScope;
    const gs = [...S.groups.entries()].filter(([k]) => S.sel.includes(k))
      .map(([, g]) => g.name.replace(/[~;,]/g, ' ') + '~'
        + g.members.join('+'));
    if (gs.length) h.g = gs.join(';');
    Common.writeHash(h);
  }

  function loadHash() {
    const h = Common.readHash();
    if (h.lv && (h.lv === 'mj' || DEPTH[h.lv])) S.level = h.lv;
    if (h.mj) S.mjScope = h.mj;
    if (h.f && IX.fys.includes(h.f)) S.from = IX.fys.indexOf(h.f);
    if (h.t && IX.fys.includes(h.t)) S.to = IX.fys.indexOf(h.t);
    if (h.m) {
      const ms = h.m.split(',').filter(m => MEAS.some(x => x[0] === m));
      if (ms.length) S.measures = ms;
    }
    if (h.sc && ['cr', 'pct', 'idx'].includes(h.sc)) S.scale = h.sc;
    const addKeys = [];
    for (const part of (h.sel || '').split(',')) {
      if (part) addKeys.push(part);
    }
    if (h.add) addKeys.push(h.add.split('.').length > 1
      ? h.add.split('.')[0] + '/' + h.add.split('.').slice(1).join('.')
      : h.add);
    for (const key of addKeys) {
      const [mj, rest] = key.split('/');
      if (!IX.majors.some(m => m.c === mj)) continue;
      makeItem(mj, rest ? rest.split('.') : []);
      if (assignSlot(key) && !S.sel.includes(key)) S.sel.push(key);
    }
    if (h.g) for (const gsrc of h.g.split(';')) {
      const [name, mem] = gsrc.split('~');
      if (!mem) continue;
      const members = mem.split('+').filter(k => {
        const [mj, rest] = k.split('/');
        if (!IX.majors.some(m => m.c === mj)) return false;
        makeItem(mj, rest ? rest.split('.') : []);
        return true;
      });
      if (members.length < 2) continue;
      const gkey = 'g' + (++gcount);
      S.groups.set(gkey, { name: name || 'Group', members });
      if (assignSlot(gkey)) S.sel.push(gkey);
    }
    /* default: top 4 majors */
    if (!S.sel.length) {
      const rank = { m: 'be', f0: S.from, f1: S.to };
      [...IX.majors].sort((a, b) => Model.mval(b, rank) - Model.mval(a, rank))
        .slice(0, 4).forEach(m => {
          const it = makeItem(m.c, []);
          if (assignSlot(it.key)) S.sel.push(it.key);
        });
    }
  }

  /* -------------------------------------------------------------- boot */
  Store.index(ST).then(ix => {
    IX = ix;
    S.from = Math.max(0, ix.fys.length - 10);
    S.to = ix.fys.length - 1;
    loadHash();
    buildControls();
    $('#sfrom').value = S.from; $('#sto').value = S.to;
    $('#smeta').textContent = 'Fiscal years ' + ix.fys[0] + ' to '
      + ix.fys[ix.fys.length - 1] + ' · BE, RE and Actuals each cover a '
      + 'different span; a missing stretch of line is a year not printed '
      + 'yet, not a zero.';
    render();
  }).catch(err => {
    $('#splot').textContent = 'Could not load the data: ' + err.message;
  });

  Common.wireTheme($('#theme'));
})();
