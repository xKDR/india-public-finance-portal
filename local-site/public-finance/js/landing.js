/* Landing: clickable India map + one card per state with data. */

(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';

  Promise.all([Store.states(), Store.asset('india_states.json')])
    .then(([sj, map]) => {
      const live = new Map(sj.states.map(s => [s.code, s]));
      drawMap(map, live);
      drawCards(map, sj.states);
      const total = sj.states.reduce((a, s) => a + (s.be ? s.be.cr : 0), 0);
      $('#lmeta').textContent = sj.states.length + ' states so far · '
        + Engine.nfIN(sj.states.reduce((a, s) => a + s.leaf_rows, 0))
        + ' printed budget lines · latest budgets together ₹'
        + Engine.nfIN(total) + ' crore';
    })
    .catch(err => { $('#lmeta').textContent = 'Could not load: ' + err.message; });

  function drawMap(map, live) {
    const host = $('#imap-host');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', map.viewBox);
    svg.setAttribute('class', 'imap');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Map of India; states with data are '
      + 'highlighted');
    const tip = document.createElement('div');
    tip.className = 'maptip';
    host.style.position = 'relative';

    const fills = ['var(--b3)', 'var(--b4)', 'var(--b2)', 'var(--b5)'];
    let li = 0;
    for (const [code, st] of Object.entries(map.states)) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', st.d);
      const rec = live.get(code);
      if (rec) {
        p.setAttribute('class', 'live');
        p.style.fill = fills[li++ % fills.length];
        p.setAttribute('tabindex', 0);
        p.setAttribute('role', 'link');
        p.setAttribute('aria-label', st.name + '; open the budget explorer');
        p.addEventListener('click', () => {
          location.href = rec.st + '/explore.html'; });
        p.addEventListener('keydown', e => {
          if (e.key === 'Enter') location.href = rec.st + '/explore.html'; });
      }
      p.addEventListener('mousemove', ev => {
        p.classList.toggle('hot', !!rec);
        tip.innerHTML = '';
        const b = document.createElement('b');
        b.textContent = st.name;
        tip.append(b);
        const d = document.createElement('span');
        d.className = 'd';
        d.textContent = rec
          ? rec.n_years + ' years · ' + rec.first + ' → ' + rec.last
            + (rec.be ? ' · BE ' + rec.be.fy + ' ₹'
               + Engine.nfIN(rec.be.cr) + ' cr' : '')
          : 'coming soon';
        tip.append(d);
        tip.classList.add('on');
        const hr = host.getBoundingClientRect();
        tip.style.left = Math.min(ev.clientX - hr.left + 14,
          hr.width - 220) + 'px';
        tip.style.top = (ev.clientY - hr.top + 8) + 'px';
      });
      p.addEventListener('mouseleave', () => {
        p.classList.remove('hot');
        tip.classList.remove('on');
      });
      svg.append(p);
    }
    host.append(svg, tip);
  }

  function drawCards(map, states) {
    const host = $('#cards');
    for (const s of states) {
      const card = document.createElement('div');
      card.className = 'scard';
      const top = document.createElement('div');
      top.className = 'top';
      const shape = map.states[s.code];
      if (shape) {
        const svg = document.createElementNS(NS, 'svg');
        const [x0, y0, x1, y1] = shape.bbox;
        svg.setAttribute('viewBox',
          `${x0 - 2} ${y0 - 2} ${x1 - x0 + 4} ${y1 - y0 + 4}`);
        svg.setAttribute('class', 'mini');
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', shape.d);
        svg.append(p);
        top.append(svg);
      }
      const tt = document.createElement('div');
      const h2 = document.createElement('h2');
      h2.textContent = s.name;
      const yrs = document.createElement('div');
      yrs.className = 'yrs';
      yrs.textContent = s.n_years + ' budget years · ' + s.first + ' → '
        + s.last + ' · ' + s.majors + ' major heads';
      tt.append(h2, yrs);
      top.append(tt);
      card.append(top);

      const stats = document.createElement('div');
      stats.className = 'stats';
      const tile = (lab, val, sub) => {
        const d = document.createElement('div');
        d.className = 'stat';
        d.innerHTML = '<span class="lab"></span><span class="val"></span>'
          + (sub ? '<span class="sub"></span>' : '');
        d.children[0].textContent = lab;
        d.children[1].textContent = val;
        if (sub) d.children[2].textContent = sub;
        return d;
      };
      if (s.be) stats.append(tile('Budget · BE ' + s.be.fy,
        '₹' + Engine.nfIN(s.be.cr) + ' cr'));
      if (s.exec) stats.append(tile('Spent vs budgeted',
        s.exec.pct.toFixed(1) + '%', s.exec.fy));
      if (s.pass) stats.append(tile('Checks passing',
        s.pass.pct.toFixed(1) + '%', 'extraction quality, ' + s.pass.dy));
      card.append(stats);

      const links = document.createElement('div');
      links.className = 'links';
      const mk = (href, label, primary) => {
        const a = document.createElement('a');
        a.className = 'btn sm' + (primary ? ' primary' : '');
        a.href = href;
        a.textContent = label;
        return a;
      };
      links.append(
        mk(s.st + '/explore.html', 'Explore', true),
        mk(s.st + '/dashboard.html', 'Dashboard'),
        mk(s.st + '/series.html', 'Time series'));
      card.append(links);
      host.append(card);
    }

    const soon = document.createElement('div');
    soon.className = 'scard soon';
    soon.innerHTML = '<div class="top"><div><h2>More states</h2>'
      + '<div class="yrs">The portal is built to take any state\'s '
      + 'detailed expenditure volumes; greyed states on the map are '
      + 'waiting on data.</div></div></div>';
    host.append(soon);
  }

  Common.wireTheme($('#theme'));
})();
