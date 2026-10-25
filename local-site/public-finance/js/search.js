/* Client-side fuzzy search over the prebuilt head index.

   core.json (majors, sub-majors, minors) loads with the page; the deeper
   shards (subheads, detailed, leaves) fetch lazily on the first keystroke in
   global mode. Entries are [code, NAME, level, [majors...], latest-BE cr].
   No inverted index; a scored linear scan over ≤30k entries runs well
   under 10ms. */

(function () {
  'use strict';

  const LV_LABEL = { mj: 'major head', sm: 'sub-major', mn: 'minor head',
    sh: 'sub-head', dh: 'detailed head', lf: 'leaf' };
  const LV_ORDER = { mj: 0, sm: 1, mn: 2, sh: 3, dh: 4, lf: 5 };

  /* substring > word-prefix > in-order subsequence (gap-penalised);
     code hits outrank name hits. */
  function score(ql, code, namel) {
    const cl = code.toLowerCase();
    if (cl === ql) return 1000;
    if (cl.startsWith(ql)) return 900 - code.length;
    /* Numeric queries are account codes. Do not return unrelated codes from
       the fuzzy subsequence fallback (for example, 2210 matching 08-202-1-05). */
    if (/^\d+$/.test(ql)) return 0;
    let s = 0;
    const at = namel.indexOf(ql);
    if (at >= 0) {
      s = 500 - at * 2 - namel.length * 0.05;
      if (at === 0 || namel[at - 1] === ' ') s += 60;
      return s;
    }
    /* every query word must word-prefix or substring somewhere */
    const words = ql.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      let tot = 0;
      for (const w of words) {
        const i = namel.indexOf(w);
        if (i < 0) return 0;
        tot += 120 - i;
      }
      return Math.max(1, tot / words.length);
    }
    /* subsequence with gap penalty */
    let i = 0, gaps = 0, last = -1;
    for (let j = 0; j < namel.length && i < ql.length; j++) {
      if (namel[j] === ql[i]) {
        if (last >= 0 && j > last + 1) gaps += j - last - 1;
        last = j; i++;
      }
    }
    if (i < ql.length || gaps > 14) return 0;
    return Math.max(1, 90 - gaps * 5);
  }

  function makeIndex(state) {
    const parts = { core: null, subheads: null, detailed: null, leaves: null };
    let deepRequested = false;
    const idx = {
      entries: [], deepReady: false,
      majorNames: {},          // major code -> name, harvested off core 'mj' rows
      ensureCore() {
        if (parts.core) return parts.core;
        parts.core = Store.search(state, 'core').then(d => {
          idx.entries.push(...d.entries);
          for (const e of d.entries) if (e[2] === 'mj') idx.majorNames[e[0]] = e[1];
        });
        return parts.core;
      },
      ensureDeep() {
        if (deepRequested) return;
        deepRequested = true;
        Promise.all(['subheads', 'detailed', 'leaves'].map(p =>
          Store.search(state, p).then(d => idx.entries.push(...d.entries))
        )).then(() => { idx.deepReady = true;
          if (idx.onDeep) idx.onDeep(); });
      },
      query(q, limit = 12) {
        const ql = q.trim().toLowerCase();
        if (ql.length < 2) return [];
        const out = [];
        for (const e of idx.entries) {
          const s = score(ql, e[0], e[1].toLowerCase());
          if (s > 0) out.push([s, e]);
        }
        out.sort((a, b) => b[0] - a[0]
          || LV_ORDER[a[1][2]] - LV_ORDER[b[1][2]]
          || (b[1][4] || 0) - (a[1][4] || 0));
        return out.slice(0, limit).map(x => x[1]);
      },
    };
    return idx;
  }

  /* Wire a .searchbox input to an index. opts:
       global()  -> bool (global vs branch mode)
       branch(q) -> [{code, name, lv, pick}] rows for branch mode
       onPick(entry) for global entries [code,name,lv,majors]  */
  function attach(box, idx, opts) {
    const input = box.querySelector('input');
    const drop = document.createElement('div');
    drop.className = 'results';
    box.append(drop);
    let hot = -1, rows = [];

    const render = list => {
      drop.innerHTML = '';
      rows = list;
      hot = -1;
      if (!list.length) {
        if (input.value.trim().length >= 2) {
          const n = document.createElement('div');
          n.className = 'note';
          n.textContent = idx.deepReady || !opts.global()
            ? 'No head matches that.'
            : 'Searching structural heads… full scheme index loading.';
          drop.append(n);
          drop.classList.add('on');
        } else drop.classList.remove('on');
        return;
      }
      list.forEach((e, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'r';
        const code = document.createElement('span');
        code.className = 'code';
        code.textContent = e.code ?? e[0];
        const nm = document.createElement('span');
        nm.className = 'nm';
        nm.textContent = (e.name ?? e[1]) || '(name not printed)';
        const lv = document.createElement('span');
        lv.className = 'lv';
        const lvk = e.lv ?? e[2];
        const mjs = e.majors ?? e[3];
        const nMajors = mjs && mjs.length > 1;
        lv.textContent = LV_LABEL[lvk] + (nMajors ? ' · ' + mjs.length + ' majors' : '');
        b.append(code, nm);
        const global = Array.isArray(e);
        if (global) {
          if (lvk !== 'mj' && mjs && mjs.length === 1) {
            const under = document.createElement('span');
            under.className = 'under';
            const mjName = idx.majorNames[mjs[0]];
            under.textContent = 'under ' + mjs[0] + (mjName ? ' ' + mjName : '');
            b.append(under);
          }
          const amt = document.createElement('span');
          amt.className = 'amt';
          const cr = e[4];
          amt.textContent = cr
            ? '₹' + (window.Engine ? Engine.nfIN(cr) : cr) + ' cr' : '';
          b.append(amt);
        }
        b.append(lv);
        b.addEventListener('mousedown', ev => { ev.preventDefault(); pick(i); });
        drop.append(b);
      });
      drop.classList.add('on');
    };

    const pick = i => {
      const e = rows[i];
      if (!e) return;
      drop.classList.remove('on');
      if (e.pick) e.pick();
      else opts.onPick({ code: e[0], name: e[1], lv: e[2], majors: e[3] });
    };

    const run = () => {
      const q = input.value;
      if (opts.global()) {
        idx.ensureCore().then(() => {
          if (q.trim().length >= 2) idx.ensureDeep();
          render(idx.query(q));
        });
      } else {
        render(opts.branch(q));
      }
    };
    idx.onDeep = () => { if (document.activeElement === input) run(); };

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
        e.preventDefault(); pick(hot);
      } else if (e.key === 'Escape') {
        drop.classList.remove('on'); input.blur();
      }
    });
    return { rerun: run };
  }

  window.Search = { makeIndex, attach, score, LV_LABEL };
})();
