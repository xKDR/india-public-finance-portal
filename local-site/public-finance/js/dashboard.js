/* The drill-down dashboard: a flat doughnut of the current node's children,
   click a slice to descend, breadcrumbs to climb back. Starts at the state
   (majors ring, from index.json); everything deeper comes from one shard. */

(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const ROOT = PORTAL.root, ST = PORTAL.state;
  const MAXSLICE = 8;

  let IX = null;
  const models = new Map();
  const fmaps = new Map();

  const S = { mj: null, trail: [], f: 0, m: 'be', showAll: false };

  const crore = v => v == null ? null : v / IX.crore_div;
  const fmt = v => '₹' + Engine.money(crore(v)) + ' cr';
  const col = () => ({ m: S.m, f: S.f });

  const MEAS = Engine.MEAS;

  function model() { return S.mj ? models.get(S.mj) : null; }

  function ensure(mj, then) {
    if (models.has(mj)) { then(); return; }
    Store.shard(ST, mj).then(sh => {
      models.set(mj, Model.wrap(sh));
      fmaps.set(mj, Badges.indexFlags(sh));
      then();
    }).catch(e => { $('#ring').textContent = 'Could not load ' + mj
      + ': ' + e.message; });
  }

  /* ------------------------------------------------- children of current */
  function children() {
    if (!S.mj) {
      return IX.majors.map(m => ({
        id: m.c, code: m.c, name: m.n, value: Model.mval(m, col()),
        kids: m.np > 0, rec: m,
      })).filter(x => x.value !== 0);
    }
    const md = model();
    if (!md) return null;
    const kids = Model.childrenOf(md, S.trail, [col()], 'db' + S.m + S.f);
    return [...kids.entries()].map(([id, rec]) => ({
      id, code: md.nodes[id].code, name: md.nodes[id].name,
      value: rec.v[0], kids: rec.kids.size > 0, rec,
    })).filter(x => x.value !== 0);
  }

  function currentName() {
    if (!S.mj) return IX.name;
    const md = model();
    if (!S.trail.length) {
      const m = IX.majors.find(x => x.c === S.mj);
      return S.mj + ' ' + (m ? m.n : '');
    }
    const nd = md.nodes[S.trail[S.trail.length - 1]];
    return nd.code + ' ' + nd.name;
  }

  /* ------------------------------------------------------------- render */
  function draw() {
    drawCrumbs();
    drawRing();
    drawSide();
    saveHash();
  }

  function drawRing() {
    const host = $('#ring');
    Engine.dropFigs(host);
    const kids = children();
    if (kids === null) {
      host.innerHTML = '<div class="empty xloading">Loading…</div>';
      ensure(S.mj, draw);
      return;
    }
    host.querySelectorAll('.xloading').forEach(e => e.remove());
    kids.sort((a, b) => b.value - a.value);
    const pos = kids.filter(k => k.value > 0);
    const top = pos.slice(0, S.showAll ? 24 : MAXSLICE);
    const rest = pos.slice(top.length);
    const items = top.map((k, i) => ({
      code: k.code, name: k.name, value: k.value,
      color: Engine.seriesColor(i), drill: k.kids, ref: k,
    }));
    if (rest.length) {
      items.push({ code: 'Other',
        name: 'Other; ' + rest.length + ' smaller heads (click to expand)',
        value: rest.reduce((a, k) => a + k.value, 0),
        color: Engine.cssv('--ground-2'), drill: true, other: true });
    }
    const neg = kids.filter(k => k.value < 0);
    neg.forEach(k => items.push({ code: k.code, name: k.name,
      value: k.value, color: Engine.cssv('--bad'), drill: false }));

    const mlabel = MEAS.find(x => x[0] === S.m)[1];
    const levelNames = !S.mj ? ['Major head'] : [...new Set(kids.map(k => {
      const node = model().nodes[k.id];
      return IX.levels.find(l => l.k === node.lv)?.label || node.lv;
    }))];
    Engine.figure(host, {
      title: currentName(),
      sub: 'Displayed level: ' + (levelNames.join(' / ') || 'No lower level')
        + ' · ' + mlabel + ' · ' + IX.fys[S.f],
      render: Engine.donutChart({
        items,
        fmt: v => Engine.money(crore(v)),
        centreTitle: currentName(),
        centreSub: mlabel + ' ' + IX.fys[S.f] + ' · ₹ cr, before recoveries',
        height: 540,
        onSlice: it => {
          if (it.other) { S.showAll = true; draw(); return; }
          if (!it.ref || !it.ref.kids) return;
          drill(it.ref);
        },
      }),
      table: () => {
        const tot = pos.reduce((a, k) => a + k.value, 0);
        let cum = 0;
        return Engine.table(
          ['Code', 'Head', mlabel + ' (₹ cr)', 'Share', 'Cumulative'],
          kids.map(k => {
            if (k.value > 0) cum += k.value;
            return [k.code, k.name, Engine.money(crore(k.value)),
              k.value > 0 ? Engine.pctf(k.value / tot * 100) : '–',
              k.value > 0 ? Engine.pctf(cum / tot * 100) : '–'];
          }), { leftCols: [1] });
      },
      caption: 'Shares within '
        + currentName() + '. Negative amounts, including recoveries, are excluded from the ring '
        + 'and retained in the table. Click a head to show its next available '
        + 'account level; breadcrumbs identify the selected branch. '
        + (rest.length ? 'Other groups smaller heads; use the table for the complete list.' : ''),
    });
  }

  function drill(ref) {
    if (!S.mj) {
      S.mj = ref.code;
      S.trail = [];
    } else {
      S.trail = S.trail.concat(ref.id);
    }
    S.showAll = false;
    draw();
  }

  function drawCrumbs() {
    const host = $('#crumbs');
    host.innerHTML = '';
    const mk = (label, code, cb, current) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'crumb';
      if (current) b.setAttribute('aria-current', 'true');
      if (code) {
        const c = document.createElement('span');
        c.className = 'code';
        c.textContent = code;
        b.append(c);
      }
      b.append(document.createTextNode(label));
      if (cb && !current) b.addEventListener('click', cb);
      host.append(b);
    };
    mk(IX.name, null, () => { S.mj = null; S.trail = []; S.showAll = false;
      draw(); }, !S.mj);
    if (S.mj) {
      const m = IX.majors.find(x => x.c === S.mj);
      mk(m ? m.n : '', S.mj, () => { S.trail = []; S.showAll = false; draw(); },
        !S.trail.length);
      const md = model();
      if (md) S.trail.forEach((id, i) => {
        const nd = md.nodes[id];
        mk(nd.name, nd.code, () => { S.trail = S.trail.slice(0, i + 1);
          S.showAll = false; draw(); }, i === S.trail.length - 1);
      });
    }
  }

  /* --------------------------------------------------------------- side */
  function drawSide() {
    const box = $('#dside-body');
    if (!box) return;
    box.innerHTML = '';
    Engine.dropFigs(box);
    let getter, codesPath, pg = null, dms = null;
    const md = model();
    if (!S.mj) {
      getter = Stats.getterFromD(IX.totals);
      codesPath = null;
    } else if (!S.trail.length) {
      const m = IX.majors.find(x => x.c === S.mj);
      getter = Stats.getterFromD(m.d);
      codesPath = [S.mj];
    } else if (md) {
      const bym = {};
      for (const m of ['be', 're', 'ac', 'bp'])
        bym[m] = Model.branchSeries(md, S.trail, m, IX.fys.length);
      getter = Stats.getterFromSeries(bym);
      codesPath = [S.mj].concat(S.trail.map(id => md.nodes[id].code));
      const b = Model.branch(md, S.trail, []);
      pg = b.pg; dms = b.dms;
    } else return;

    $('#dside-title').textContent = currentName();

    /* the four measures at the chosen fiscal year */
    const dl = document.createElement('dl');
    dl.className = 'measures';
    for (const [m, label] of MEAS) {
      const on = Model.colExists(IX, { m, f: S.f });
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = on ? fmt(getter(m, S.f)) : '–';
      if (!on) dd.className = 'dim';
      dl.append(dt, dd);
    }
    box.append(dl);

    /* key ratios */
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
    if (rows.length) {
      const r = document.createElement('div');
      r.className = 'ratios';
      const h = document.createElement('h4');
      h.textContent = 'Key ratios';
      r.append(h);
      const dl2 = document.createElement('dl');
      for (const [k, v] of rows) {
        const dt = document.createElement('dt'); dt.textContent = k;
        const dd = document.createElement('dd'); dd.textContent = v;
        dl2.append(dt, dd);
      }
      r.append(dl2);
      box.append(r);
    }

    /* badge */
    if (codesPath && fmaps.get(S.mj)) {
      const f = Badges.flagFor(fmaps.get(S.mj), codesPath.slice(1),
        IX.doc_years.map((_, i) => i));
      if (f) {
        const cr2 = document.createElement('div');
        cr2.className = 'chiprow';
        const dy = IX.doc_years[f.dy];
        let pdf = null;
        if (pg && pg[f.dy] != null) {
          const p = pg[f.dy];
          const key = Array.isArray(p) ? String(p[0])
            : (dms && dms.size ? [...dms][0] : null);
          pdf = Common.pdfHref(IX, dy, key, p);
        }
        cr2.append(Badges.chip(f, { ix: IX, dyLabel: dy, pdfHref: pdf,
          reportHref: Common.reportHref(ROOT, { state: ST, y: dy,
            code: codesPath.join(' ') }) }));
        box.append(cr2);
      }
    }

    /* the head's history: one hue, dash per measure */
    const hue = Engine.cssv('--s1');
    const hist = Engine.MEAS
      .map(([m, label]) => ({
        name: label, dash: Engine.DASH[m], color: hue,
        values: IX.fys.map((_, f2) =>
          Model.colExists(IX, { m, f: f2 }) && getter(m, f2)
            ? crore(getter(m, f2)) : null),
      }))
      .filter(s => s.values.some(v => v != null));
    if (hist.length) {
      const mount = document.createElement('div');
      box.append(mount);
      Engine.figure(mount, {
        title: 'Over time',
        sub: '₹ crore',
        render: Engine.lineChart({ years: IX.fys, series: hist,
          fmt: Engine.money, height: 200,
          margin: { l: 48, r: 42, b: 38 },
          xEvery: Math.ceil(IX.fys.length / 5) }),
      });
    }

    /* links */
    const lk = document.createElement('div');
    lk.className = 'links';
    const mk = (href, txt) => {
      const a = document.createElement('a');
      a.href = href; a.textContent = txt;
      return a;
    };
    if (codesPath) {
      lk.append(mk('explore.html#open=' + codesPath.join('.'),
        'Open in the explorer →'));
      lk.append(mk('series.html#add=' + codesPath.join('.'),
        'See over time →'));
      lk.append(mk(Common.reportHref(ROOT, { state: ST,
        code: codesPath.join(' ') }), 'Report an error →'));
    }
    box.append(lk);
  }

  /* ------------------------------------------------------------ controls */
  function buildControls() {
    const ysel = $('#dyear');
    IX.fys.forEach((y, i) => ysel.append(new Option(y, i)));
    ysel.value = S.f;
    ysel.onchange = () => { S.f = +ysel.value; S.showAll = false; draw(); };

    const seg = $('#dmeasure');
    MEAS.forEach(([k, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.append(Engine.measureKey(k), document.createTextNode(label));
      b.dataset.v = k;
      b.setAttribute('aria-pressed', String(S.m === k));
      b.onclick = () => {
        S.m = k;
        for (const c of seg.children)
          c.setAttribute('aria-pressed', String(c.dataset.v === k));
        S.showAll = false;
        draw();
      };
      seg.append(b);
    });
  }

  /* --------------------------------------------------------------- hash */
  function saveHash() {
    const md = model();
    const h = { f: IX.fys[S.f], m: S.m };
    if (S.mj) h.p = [S.mj].concat(md
      ? S.trail.map(id => md.nodes[id].code) : []).join('.');
    Common.writeHash(h);
  }

  function loadHash() {
    const h = Common.readHash();
    if (h.m && ['be', 're', 'ac'].includes(h.m)) S.m = h.m;
    if (h.f && IX.fys.includes(h.f)) S.f = IX.fys.indexOf(h.f);
    return h.p || null;
  }

  /* --------------------------------------------------------------- boot */
  Store.index(ST).then(ix => {
    IX = ix;
    const sp = ix.spans.be;
    S.f = sp ? sp[1] : ix.fys.length - 1;
    const p = loadHash();
    buildControls();
    $('#dyear').value = S.f;
    if (p) {
      const codes = p.split('.');
      S.mj = codes[0];
      ensure(S.mj, () => {
        const md = models.get(S.mj);
        if (codes.length > 1) {
          outer:
          for (const ch of md.chains) {
            if (ch.length < codes.length - 1) continue;
            for (let a = 0; a < codes.length - 1; a++)
              if (md.nodes[ch[a]].code !== codes[a + 1]) continue outer;
            S.trail = ch.slice(0, codes.length - 1);
            break;
          }
        }
        draw();
      });
    } else draw();
  }).catch(err => {
    $('#ring').textContent = 'Could not load the data: ' + err.message;
  });

  Common.wireTheme($('#theme'));
})();
