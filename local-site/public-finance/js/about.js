/* About page: renders the per-state extraction-quality tables from
   quality.json; the honest reconciliation record, promoted to a page. */

(function () {
  'use strict';

  const $ = s => document.querySelector(s);

  Store.states().then(sj => {
    const host = $('#quality');
    for (const s of sj.states) {
      Store.quality(s.st).then(q => {
        const box = document.createElement('div');
        const h = document.createElement('h2');
        h.textContent = s.name;
        box.append(h);
        const years = Object.keys(q.years || {}).sort();
        if (years.length) {
          const rows = years.map(dy => {
            const y = q.years[dy];
            return [dy,
              y.n != null ? Engine.nfIN(y.n) : '–',
              y.pp != null ? y.pp.toFixed(2) + '%' : '–',
              y.mu != null ? y.mu.toFixed(2) + '%' : '–'];
          });
          box.append(Engine.table(
            ['Document year', 'Printed totals checked',
             'Reproduced exactly', 'Mean accuracy'], rows));
        }
        if (q.worst && q.worst.length) {
          const h4 = document.createElement('h2');
          h4.textContent = s.name + '; largest reconciliation gaps';
          box.append(h4);
          box.append(Engine.table(
            ['Document year', 'Head', 'Checks', 'Passing', 'Mean accuracy'],
            q.worst.slice(0, 10).map(w => [
              w.dy, w.codes.join(' › '), Engine.nfIN(w.n),
              w.pp.toFixed(1) + '%',
              w.mu != null ? w.mu.toFixed(1) + '%' : '–'])));
        }
        host.append(box);
      });
    }
  });

  Common.wireTheme($('#theme'));
})();
