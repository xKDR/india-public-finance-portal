/* Data-quality badges.

   Tier thresholds mirror portal/build/config.py BADGE_TIERS; keep in step.
   pp = pass share of the printed-total checks under a node,
   mu = mean accuracy of those checks (per the validation summary).

   A chip on a row says the printed totals under that head did not fully
   reconcile with the rows beneath them in the source PDF; the popover
   carries the numbers, a link to the PDF page, and a prefilled error-report
   link. */

(function () {
  'use strict';

  const TIER_LABEL = {
    notice: '±',
    verify: 'verify against PDF',
    serious: 'extraction gap',
  };
  const TIER_TITLE = {
    notice: 'Small reconciliation gap in the source (≤ tolerance concerns)',
    verify: 'Checks under this head disagree; verify against the PDF',
    serious: 'Large extraction gap; trust the PDF over these numbers',
  };

  function tier(pp, mu) {
    if (pp < 80 || (mu != null && mu < 95)) return 'serious';
    if (pp < 95 || (mu != null && mu < 99.5)) return 'verify';
    if (pp < 100) return 'notice';
    return null;
  }
  const RANK = { serious: 0, verify: 1, notice: 2 };

  /* shard.flags -> Map('code/code/..' -> {dyIdx: flag}) */
  function indexFlags(shard) {
    const m = new Map();
    for (const f of shard.flags || []) {
      const key = f.p.join('/');
      let rec = m.get(key);
      if (!rec) m.set(key, rec = {});
      rec[f.dy] = f;
    }
    return m;
  }

  /* Worst flag for a code-trail over a set of document-year indices. */
  function flagFor(fmap, codes, dyIdxs) {
    const rec = fmap.get(codes.join('/'));
    if (!rec) return null;
    let best = null;
    for (const dy of dyIdxs) {
      const f = rec[dy];
      if (!f) continue;
      const t = tier(f.pp, f.mu);
      if (!t) continue;
      if (!best || RANK[t] < RANK[best.t]) best = { ...f, t };
    }
    return best;
  }

  let openPop = null;
  function closePop() {
    if (openPop) { openPop.remove(); openPop = null; }
  }
  document.addEventListener('click', e => {
    if (openPop && !openPop.contains(e.target)
        && !e.target.closest('.chip')) closePop();
  });

  /* flag: {t, pp, mu, n, dy}; ctx: {ix, dyLabel, pdfHref, reportHref} */
  function chip(flag, ctx) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip ' + flag.t;
    b.textContent = TIER_LABEL[flag.t];
    b.title = TIER_TITLE[flag.t];
    b.addEventListener('click', e => {
      e.stopPropagation();
      if (openPop) { closePop(); return; }
      const p = document.createElement('div');
      p.className = 'popover';
      p.innerHTML = '';
      const h = document.createElement('h4');
      h.textContent = TIER_TITLE[flag.t];
      p.append(h);
      const rows = [
        ['Document year', ctx.dyLabel || ''],
        ['Checks under this head', Engine.nfIN(flag.n)],
        ['Share passing', flag.pp.toFixed(1) + '%'],
      ];
      if (flag.mu != null) rows.push(['Mean accuracy', flag.mu.toFixed(1) + '%']);
      for (const [k, v] of rows) {
        const r = document.createElement('div');
        r.className = 'row';
        r.innerHTML = `<span></span><b></b>`;
        r.firstChild.textContent = k;
        r.lastChild.textContent = v;
        p.append(r);
      }
      const note = document.createElement('p');
      note.textContent = 'The printed totals in the source do not fully '
        + 'reconcile with the rows beneath them. The gap is in the source '
        + 'or its extraction, not introduced by this site.';
      p.append(note);
      const links = document.createElement('p');
      if (ctx.pdfHref) {
        const a = document.createElement('a');
        a.href = ctx.pdfHref; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = 'Open the source PDF';
        links.append(a);
      }
      if (ctx.reportHref) {
        if (ctx.pdfHref) links.append(document.createTextNode(' · '));
        const a2 = document.createElement('a');
        a2.href = ctx.reportHref;
        a2.textContent = 'Report an error';
        links.append(a2);
      }
      p.append(links);
      document.body.append(p);
      const r = b.getBoundingClientRect();
      p.style.left = Math.min(r.left + scrollX,
        scrollX + innerWidth - p.offsetWidth - 12) + 'px';
      p.style.top = (r.bottom + scrollY + 6) + 'px';
      openPop = p;
    });
    return b;
  }

  function countChip(n, worstTier) {
    const s = document.createElement('span');
    s.className = 'chip count';
    s.textContent = n + ' flagged below';
    s.title = 'Heads under this one carry reconciliation flags '
      + '(worst: ' + worstTier + ')';
    return s;
  }

  window.Badges = { tier, RANK, indexFlags, flagFor, chip, countChip, closePop };
})();
