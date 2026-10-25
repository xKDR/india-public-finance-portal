/* Shared page utilities: theme, PDF links, report links, band helpers. */

(function () {
  'use strict';

  /* ------------------------------------------------------------- theme */
  try {
    const t = localStorage.getItem('portal-theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* file:// or private mode */ }

  function wireTheme(btn) {
    if (!btn) return;
    btn.addEventListener('click', () => {
      const root = document.documentElement;
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      const now = root.getAttribute('data-theme') || (dark ? 'dark' : 'light');
      const next = now === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('portal-theme', next); } catch (e) {}
      if (window.Engine) Engine.redrawAll();
      document.dispatchEvent(new CustomEvent('themechange'));
    });
  }

  /* --------------------------------------------------------------- misc */
  const REPO_RAW = 'https://raw.githubusercontent.com/xKDR/'
    + 'india-public-finance-portal/main/';
  const REPO = 'https://github.com/xKDR/india-public-finance-portal';

  /* Link to the source PDF page. `key` is the demand number (TN) or volume
     number (KA); `pg` is a page int (TN) or [vol, page] (KA). */
  function pdfHref(ix, dy, key, pg) {
    let page = pg;
    if (Array.isArray(pg)) { key = String(pg[0]); page = pg[1]; }
    const rel = (ix.pdfs[dy] || {})[key];
    if (!rel) return null;
    return REPO_RAW + ix.package_dir + '/' + rel
      + (page ? '#page=' + page : '');
  }

  function reportHref(root, params) {
    const q = new URLSearchParams();
    for (const k in params) if (params[k] != null && params[k] !== '')
      q.set(k, params[k]);
    return root + 'report.html?' + q.toString();
  }

  /* Doc-year indices whose printed columns speak about any fiscal year in
     [f0..f1]; used to pick which flags apply to a band. */
  function dyIdxsForBand(ix, f0, f1) {
    const out = [];
    ix.doc_years.forEach((dy, i) => {
      const s = parseInt(dy.slice(0, 4), 10);
      const fy = y => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
      for (let y = s - 2; y <= s; y++) {
        const fi = ix.fys.indexOf(fy(y));
        if (fi >= f0 && fi <= f1) { out.push(i); return; }
      }
    });
    return out;
  }

  /* native units -> Rs crore */
  const crore = (ix, v) => v == null ? null : v / ix.crore_div;

  /* Read/write state in the location hash as key=value pairs. */
  function readHash() {
    const out = {};
    for (const kv of location.hash.replace(/^#/, '').split('&')) {
      if (!kv) continue;
      const i = kv.indexOf('=');
      if (i > 0) out[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
    }
    return out;
  }
  function writeHash(obj) {
    const parts = [];
    for (const k in obj) if (obj[k] != null && obj[k] !== '')
      parts.push(k + '=' + encodeURIComponent(obj[k]));
    history.replaceState(null, '', parts.length
      ? '#' + parts.join('&') : location.pathname + location.search);
  }

  window.Common = { wireTheme, pdfHref, reportHref, dyIdxsForBand, crore,
    readHash, writeHash, REPO, REPO_RAW };
})();
