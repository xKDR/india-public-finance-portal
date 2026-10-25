/* Error reporting. The form builds a prefilled GitHub issue (label
   data-error); no backend, full audit trail. tools/issues_to_csv.py in the
   repo exports the accumulated issues to CSV for manual correction. */

(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const REPO_ISSUES = Common.REPO + '/issues/new';

  let states = [];
  let ix = null;
  let searchIdx = null;

  const params = new URLSearchParams(location.search);

  Store.states().then(sj => {
    states = sj.states;
    const sel = $('#rstate');
    for (const s of states) sel.append(new Option(s.name, s.st));
    const pre = params.get('state');
    if (pre && states.some(s => s.st === pre)) sel.value = pre;
    sel.addEventListener('change', onState);
    onState();
  }).catch(err => {
    $('#rnote').textContent = 'Could not load state list: ' + err.message;
  });

  function onState() {
    const st = $('#rstate').value;
    ix = null;
    Store.index(st).then(x => {
      ix = x;
      const ysel = $('#ryear');
      ysel.innerHTML = '';
      ysel.append(new Option('(not sure)', ''));
      [...x.doc_years].reverse().forEach(y => ysel.append(new Option(y, y)));
      const py = params.get('y');
      if (py && x.doc_years.includes(py)) ysel.value = py;
      const csel = $('#rcol');
      csel.innerHTML = '';
      csel.append(new Option('(not sure)', ''));
      ['Accounts (col 1)', 'BE previous year (col 2)',
       'RE previous year (col 3)', 'BE current year (col 4)']
        .forEach(c => csel.append(new Option(c, c)));
    });
    searchIdx = Search.makeIndex(st);
    searchIdx.onDeep = () => { if (idxProxy.onDeep) idxProxy.onDeep(); };
    if (params.get('code') && !$('#rcode input').value)
      $('#rcode input').value = params.get('code');
  }

  /* the state select swaps the underlying index; this proxy keeps the
     one-time attach() pointed at whichever is current */
  const idxProxy = {
    ensureCore() { return searchIdx ? searchIdx.ensureCore()
      : Promise.resolve(); },
    ensureDeep() { if (searchIdx) searchIdx.ensureDeep(); },
    query(q, n) { return searchIdx ? searchIdx.query(q, n) : []; },
    get deepReady() { return searchIdx ? searchIdx.deepReady : false; },
    set onDeep(f) { this._f = f; },
    get onDeep() { return this._f; },
  };
  Search.attach($('#rcode'), idxProxy, {
    global: () => true,
    branch: () => [],
    onPick: e => {
      $('#rcode input').value = e.code + '  ' + e.name;
    },
  });

  $('#rsubmit').addEventListener('click', () => {
    const st = $('#rstate').value;
    const sname = (states.find(s => s.st === st) || {}).name || st;
    const y = $('#ryear').value;
    const code = $('#rcode input').value.trim();
    const col = $('#rcol').value;
    const shown = $('#rshown').value.trim();
    const expected = $('#rexpected').value.trim();
    const comment = $('#rcomment').value.trim();
    if (!comment && !expected) {
      $('#rnote').textContent = 'Say what is wrong; either the expected '
        + 'value or a comment.';
      return;
    }
    const title = '[' + sname + (y ? ' ' + y : '') + '] '
      + (code ? code + '; ' : '') + 'data error report';
    const lines = [
      '### Data error report', '',
      '| Field | Value |', '|---|---|',
      `| State | ${sname} (${st}) |`,
      `| Document year | ${y || '–'} |`,
      `| Account code / head | ${code || '–'} |`,
      `| Column | ${col || '–'} |`,
      `| Value shown on the portal | ${shown || '–'} |`,
      `| Value expected (from the PDF) | ${expected || '–'} |`,
    ];
    const openHash = code
      ? '#open=' + code.split(/\s+/).join('.') : '';
    lines.push(`| Portal link | ${location.origin
      + location.pathname.replace(/report\.html$/, '')
      + st + '/explore.html' + openHash} |`);
    lines.push('', '### Comment', '', comment || '–', '',
      '_Filed from the portal report form._');
    const url = REPO_ISSUES + '?labels=data-error&title='
      + encodeURIComponent(title) + '&body='
      + encodeURIComponent(lines.join('\n'));
    $('#rnote').textContent = 'Opening GitHub with the report prefilled; '
      + 'press "Submit new issue" there to file it.';
    window.open(url, '_blank', 'noopener');
  });

  Common.wireTheme($('#theme'));
})();
