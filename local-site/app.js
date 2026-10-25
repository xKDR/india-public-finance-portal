/* Landing page for India State Budget Data.

   The dataset statistics come from the Karnataka package files that ship
   with the site (index.json, quality.json). The explorer reuses the portal's
   own engine, store, model, and search modules instead of a second copy of
   the data. window.PORTAL points at ./public-finance/, so Store resolves to
   ./public-finance/data/. */

let STATE = new URLSearchParams(location.search).get('exploreState') === 'tn' ? 'tn' : 'ka';
const TABLE_FILES = [
  ["budget_<year>.csv", "Document-shaped budget rows with account codes, financial amounts, and source page references."],
  ["checks_<year>.csv", "One arithmetic comparison per account key and financial column."],
  ["validation_findings.csv", "Failed comparisons with their checked total or summary-row page references."],
  ["data_dictionary.csv", "Definitions for package columns and controlled values."],
  ["known_caveats.md", "Limits on amount units, financial-column mapping, summation, and check scope."],
  ["guide.html", "Reference guide for the account hierarchy, additive-row filter, and check IDs."]
];

const CHECKS = [
  ["Within-table reconciliation", "Printed totals only", "Lower-level extracted rows are summed and compared with the corresponding printed total in the same table."],
  ["Across-table reconciliation", "Matching summaries only", "Extracted totals from one table are compared with the corresponding extracted row in a minor-head or sub-major-head summary table."],
  ["Pass threshold", "Each financial column", "A comparison passes when its absolute difference is less than 0.01 in the package's stated INR-lakh unit."]
];

const SQL_RECIPE = `-- One year of Karnataka budget rows, safe detail rows only.
CREATE TABLE ka_budget_2024_25 AS
SELECT *
FROM read_csv_auto(
  'karnataka-state-finance/years/2024-25/csv/budget_2024-25.csv'
);

SELECT
  demand_number,
  SUM(TRY_CAST(REPLACE(budget_estimate_2024_25_amount::VARCHAR, ',', '') AS DOUBLE)) AS amount_in_inr_lakh
FROM ka_budget_2024_25
WHERE type_of_table = 'object_head'
  AND row_type = 'Data'
  AND row_level = 'Object-Head'
GROUP BY 1
ORDER BY amount_in_inr_lakh DESC;`;

const $ = (s) => document.querySelector(s);
const exploreTemplate = document.querySelector('.pf-explore')?.innerHTML || '';
let stateSwitchToken=0;
const crore = (v) => v == null ? null : v / IX.crore_div;

let IX = null;                 // the Karnataka index
let DY = null;                 // selected document year
let STATE_META = null;         // Karnataka entry from states.json
let QUALITY = null;            // per-year reconciliation summary
const models = new Map();      // major code -> wrapped shard
const open = new Set();        // expanded row keys
let filterQuery = "";
let renderToken = 0;
const selectedHeads = new Map();
let selectedYear = null;
let selectedAllYears = false;
let selectedYears = new Set();
const levelLabels = {mj:'Major head',sm:'Sub-major head',mn:'Minor head',sh:'Sub-head',dh:'Detailed head',lf:STATE==='tn'?'Sub-detailed head':'Object head'};
const normalizeHead = s => String(s || '').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();

function aggregateSelectedHead(model, entry, specs) {
  const ids = new Set(model.nodes.filter(n => n.lv === entry.lv && n.code === entry.code
    && normalizeHead(n.name) === normalizeHead(entry.name)).map(n => n.i));
  const values = specs.map(() => 0);
  const available = specs.map(() => false);
  let matched = 0;
  model.paths.forEach((p,i) => {
    if(entry.lv !== 'mj' && !model.chains[i].some(id => ids.has(id))) return;
    matched++;
    specs.forEach((c,j) => {
      if(Object.prototype.hasOwnProperty.call(p.d[c.m] || {},c.f))available[j]=true;
      values[j] += Model.pval(p,c);
    });
  });
  return {values, available, matched};
}

function selectedSpecs(year=selectedYear) {
  return ['be','re','ac'].map(m => ({m,f:IX.fys.indexOf(year)}));
}

function selectedTableRows() {
  const years=IX.fys.filter(year=>selectedYears.has(year));
  return [...selectedHeads.entries()].flatMap(([id,r])=>years.map(year=>({
    ...r,id,year,...aggregateSelectedHead(r.model,r,selectedSpecs(year))
  })));
}

function renderSelectedHeads() {
  $('#selectedHeads').hidden = selectedHeads.size === 0;
  $('#selectedRows').innerHTML=selectedTableRows().map(r => {
    const specs=selectedSpecs(r.year);
    const major=IX.majors.find(m => m.c===r.major);
    const amounts=r.values.map((v,j)=>Model.colExists(IX,specs[j]) && r.available[j]
      ? Number(crore(v)).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}) : '–');
    return `<tr><th scope="row">${esc(r.code)} · ${esc(r.name)}<small class="selected-level">${esc(levelLabels[r.lv]||r.lv)}</small></th><td>${esc(r.major)} · ${esc(major?.n || '')}</td><td>${esc(r.year)}</td>${amounts.map(v=>`<td class="pf-num">${v}</td>`).join('')}<td><button type="button" class="tool-button" data-remove-head="${esc(r.id)}" aria-label="Remove ${esc(r.name)} under ${esc(r.major)} from all years">Remove head</button></td></tr>`;
  }).join('');
}

async function addSelectedHead(entry, major) {
  const requestedState=STATE;
  const id=JSON.stringify([major,entry.lv,entry.code,normalizeHead(entry.name)]);
  if(selectedHeads.has(id)){$('#selectedStatus').textContent='This head is already in the table.';return;}
  $('#selectedHeads').hidden=false;
  $('#selectedStatus').textContent=`Loading ${entry.name} under ${major}…`;
  try {
    const model=await ensureModel(major);
    if(STATE!==requestedState)return;
    const result=aggregateSelectedHead(model,entry,selectedSpecs());
    if(!result.matched)throw Error('No matching repository detail lines were found.');
    selectedHeads.set(id,{...entry,major,model,...result});
    renderSelectedHeads();
    $('#selectedStatus').textContent=`${selectedHeads.size} selected head${selectedHeads.size===1?'':'s'}. Search again to add another.`;
    $('#selectedHeads').scrollIntoView({block:'nearest',behavior:'smooth'});
  } catch(e) {$('#selectedStatus').textContent=`Could not add this head: ${e.message}`;}
}

function setupSelectedHeads() {
  // Start at the latest year with all three measures available.
  const last=Math.min(IX.spans.be[1],IX.spans.re[1],IX.spans.ac[1]);
  selectedYear=IX.fys[last];
  selectedYears=new Set([selectedYear]);
  $('#yearPickerOptions').innerHTML='<label><input type="checkbox" data-year="all"> All years</label>'
    + IX.fys.map(y=>`<label><input type="checkbox" data-year="${y}"${y===selectedYear?' checked':''}> ${y}</label>`).join('');
  const syncYearPicker=()=>{
    selectedAllYears=selectedYears.size===IX.fys.length;
    $('#yearPickerSummary').textContent=selectedAllYears?'All years':selectedYears.size===1?[...selectedYears][0]:selectedYears.size?`${selectedYears.size} years selected`:'Select years';
    $('#downloadSelected').disabled=selectedYears.size===0;
    $('#yearPickerOptions').querySelectorAll('input').forEach(input=>{
      input.checked=input.dataset.year==='all'?selectedAllYears:selectedYears.has(input.dataset.year);
      if(input.dataset.year==='all')input.indeterminate=selectedYears.size>0&&!selectedAllYears;
    });
  };
  syncYearPicker();
  $('#yearPickerOptions').addEventListener('change',e=>{
    const year=e.target.dataset.year;if(!year)return;
    if(year==='all')selectedYears=e.target.checked?new Set(IX.fys):new Set();
    else if(e.target.checked)selectedYears.add(year);else selectedYears.delete(year);
    syncYearPicker();
    renderSelectedHeads();
    $('#selectedStatus').textContent=selectedYears.size?`Showing ${selectedYears.size} fiscal year${selectedYears.size===1?'':'s'} for each selected head.`:'Select at least one fiscal year.';
  });
  $('#selectedRows').addEventListener('click',e=>{
    const b=e.target.closest('[data-remove-head]');if(!b)return;
    selectedHeads.delete(b.dataset.removeHead);renderSelectedHeads();
  });
  $('#clearSelected').addEventListener('click',()=>{selectedHeads.clear();renderSelectedHeads();});
  $('#downloadSelected').addEventListener('click',()=>{
    const rows=[['state','fiscal_year','major_head_code','major_head_name','head_code','head_name','level','BE_INR_crore','RE_INR_crore','Actuals_INR_crore','repository_commit']];
    for(const r of selectedTableRows()){
      const specs=selectedSpecs(r.year);
      rows.push([STATE,r.year,r.major,IX.majors.find(m=>m.c===r.major)?.n,r.code,r.name,levelLabels[r.lv],...r.values.map((v,j)=>Model.colExists(IX,specs[j])&&r.available[j]?v/IX.crore_div:''),'371c1e5d79a7f2dfcb8d55f21867330384093910']);
    }
    const csv=rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`selected-heads-${STATE}-${selectedAllYears?'all-years':'selected-years'}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('#selectedStatus').textContent=`CSV prepared: ${rows.length-1} rows for ${selectedHeads.size} selected heads.`;
  });
}

const key = (mj, trail) => mj + ":" + trail.join(">");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* --------------------------------------------------------------- static */
function renderMetrics() {
  const latestYear = IX.doc_years[IX.doc_years.length - 1];
  const latestPass = QUALITY?.years?.[latestYear]?.pp ?? STATE_META?.pass?.pct;
  const leafRows = STATE_META?.leaf_rows ?? IX.n_leaf_rows;
  const metrics = [
    [Engine.nfIN(IX.doc_years.length), "document years in the explorer"],
    [Engine.nfIN(leafRows), "detail rows in the explorer index"],
    [latestPass == null ? Engine.nfIN(IX.majors.length) : `${Number(latestPass).toFixed(2)}%`,
      latestPass == null ? "major heads in the explorer" : `checks passed in ${latestYear}`]
  ];
  $("#metrics").innerHTML = metrics
    .map(([value, label]) => `<div class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`)
    .join("");
}

function renderTables() {
  $("#tableList").innerHTML = TABLE_FILES
    .map(([name, detail]) => `<div class="table-item"><strong>${esc(name)}</strong><span>${esc(detail)}</span></div>`)
    .join("");
}

function renderChecks() {
  $("#validationList").innerHTML = CHECKS
    .map(([check, status, detail]) => `<div class="validation-row"><strong>${esc(check)}</strong><span>${esc(status)}</span><span>${esc(detail)}</span></div>`)
    .join("");
}

function setupSql() {
  $("#sqlRecipe code").textContent = SQL_RECIPE;
  $("#copySql").addEventListener("click", async () => {
    const status = $("#copyStatus");
    try {
      await navigator.clipboard.writeText(SQL_RECIPE);
      status.textContent = "Copied";
    } catch {
      status.textContent = "Select the SQL text to copy";
    }
  });
  const citation = $("#projectCitation")?.textContent || "";
  $("#copyCitation")?.addEventListener("click", async () => {
    const status = $("#citationStatus");
    try {
      await navigator.clipboard.writeText(citation);
      status.textContent = "Citation copied";
    } catch {
      status.textContent = "Select the citation text to copy";
    }
  });
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function exportVisibleAccounts() {
  if (!IX) return;
  const query = filterQuery.trim().toLowerCase();
  const specs = cols();
  const exportYear=DY;
  const rows=[];
  for(const tr of document.querySelectorAll('#pfRows tr[data-mj]')){
    const mj=tr.dataset.mj;
    const trail=tr.dataset.trail?tr.dataset.trail.split(',').map(Number):[];
    const major=IX.majors.find(m=>m.c===mj);
    if(!trail.length){rows.push({c:mj,n:major.n,values:specs.map(c=>Model.mval(major,c))});continue;}
    const model=await ensureModel(mj);
    rows.push({c:[mj,...trail.map(id=>model.nodes[id].code)].join('-'),
      n:model.nodes[trail.at(-1)].name,values:Model.branch(model,trail,specs).v});
  }
  const header = ["state", "document_year", "account_code", "account_name", ...specs.map((c) => c.label)];
  const body = rows.map((m) => [STATE, exportYear, m.c, m.n || "", ...specs.map((c,i) => {
    if (!Model.colExists(IX, c)) return "";
    const raw = m.values[i];
    return Number.isFinite(raw) ? raw / IX.crore_div : "";
  })]);
  const csv = [header, ...body].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `india-public-finance-${STATE}-${exportYear}-visible-heads.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  const status = $("#exportStatus");
  if (status) status.textContent = `${rows.length} visible rows prepared as CSV`;
}

/* --------------------------------------------------------------- data */
function renderHeatmap(qualityError = false) {
  if (!$("#coverageHeatmap")) return;
  const cells = [];
  for (const year of IX.doc_years) {
    const rec = QUALITY?.years?.[year];
    const pp = Number.isFinite(rec?.pp) ? rec.pp : null;
    const title = pp == null
      ? `${year}: reconciliation quality unavailable`
      : `${year}: ${pp.toFixed(2)}% of ${Engine.nfIN(rec.n)} printed-total checks passed`;
    cells.push(`<div class="heat-cell quality${pp == null ? " unavailable" : ""}"${pp == null ? "" : ` style="--quality:${pp}%"`} title="${esc(title)}">
      <span>${esc(year)}</span><strong>${pp == null ? "–" : `${pp.toFixed(1)}%`}</strong>
    </div>`);
  }
  $("#coverageHeatmap").innerHTML = cells.join("");
  const subtitle = document.querySelector(".heatmap-shell .section-heading small");
  if (subtitle) subtitle.textContent = "printed-total checks by document year";
  const legend = document.querySelector(".heatmap-shell .legend");
  if (legend) {
    legend.innerHTML = `<span>${qualityError
      ? "Quality data is unavailable. Document years come from the explorer index."
      : "Each percentage is the share of printed-total checks that passed."}</span>`;
  }
}

function renderCoverageList(qualityError = false) {
  const rows = IX.doc_years.map((year) => {
    const rec = QUALITY?.years?.[year];
    const pass = Number.isFinite(rec?.pp) ? `${rec.pp.toFixed(2)}%` : "–";
    const agreement = Number.isFinite(rec?.mu) ? `${rec.mu.toFixed(2)}%` : "–";
    const count = Number.isFinite(rec?.n) ? Engine.nfIN(rec.n) : "–";
    return `<tr><th scope="row">${esc(year)}</th><td>${count}</td><td>${pass}</td><td>${agreement}</td></tr>`;
  }).join("");
  const host = $("#coverageTable");
  host.innerHTML = `<table class="coverage-data">
    <thead><tr><th scope="col">Document year</th><th scope="col">Comparisons</th><th scope="col">Checks passed</th><th scope="col">Mean amount agreement</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  let note = host.querySelector(".coverage-note");
  if (!note) {
    note = document.createElement("p");
    note.className = "coverage-note";
    host.append(note);
  }
  note.textContent = qualityError
    ? "Per-year quality data could not be loaded. The explorer and its document-year index remain available."
    : "Checks passed is the share of comparisons within tolerance. Each comparison also scores 100% minus its percentage difference from the extracted total, with a minimum score of zero. Mean amount agreement averages these scores. Source-page accuracy requires a separate check.";
}

/* ------------------------------------------------------------- helper */
const fmt = (v) => v == null ? "–" : Engine.money(v);

function cols() {
  return Model.docCols(IX, DY);
}

async function ensureModel(mj) {
  const requestedState=STATE;
  let model = models.get(mj);
  if (model) return model;
  const shard = await Store.shard(STATE, mj);
  model = Model.wrap(shard);
  if(requestedState===STATE)models.set(mj, model);
  return model;
}

function findNode(model, lv, code, name) {
  let id = model.nodes.findIndex((n) => n.lv === lv && n.code === code && n.name === name);
  if (id < 0) id = model.nodes.findIndex((n) => n.lv === lv && n.code === code);
  return id;
}

/* ------------------------------------------------------------ explorer */
function rowCells(values) {
  return values.map((v) => {
    const cr = crore(v);
    return `<td class="pf-num${cr == null ? " nil" : ""}">${fmt(cr)}</td>`;
  }).join("");
}

function rowHtml({ mj, trail, code, name, depth, values, hasKids }) {
  const isOpen = open.has(key(mj, trail));
  const caret = hasKids
    ? `<button class="pf-care" type="button" aria-expanded="${isOpen}" aria-label="${isOpen ? "Collapse" : "Expand"} ${esc(name)}">${isOpen ? "▾" : "▸"}</button>`
    : '<span class="pf-care pf-care-empty" aria-hidden="true"></span>';
  return `<tr class="pf-row${hasKids ? " pf-can" : ""}${isOpen ? " pf-open" : ""}" data-key="${esc(key(mj, trail))}" data-mj="${esc(mj)}" data-trail="${esc(trail.join(","))}">
    <td class="l pf-name"><span class="pf-indent" style="padding-left:${depth * 18}px"></span>${caret}<span class="pf-code">${esc(code)}</span><span class="pf-label">${esc(name || "(name not printed)")}</span></td>
    ${rowCells(values)}
  </tr>`;
}

function walk(mj, model, trail, depth, colSpecs, out) {
  const children = Model.childrenOf(model, trail, colSpecs, DY);
  const items = [...children.entries()].sort((a, b) => b[1].v[2] - a[1].v[2] || a[1].v[0] - b[1].v[0]);
  for (const [id, rec] of items) {
    const node = model.nodes[id];
    const childTrail = trail.concat(id);
    out.push(rowHtml({
      mj, trail: childTrail, code: node.code, name: node.name, depth,
      values: rec.v.map((v) => v), hasKids: rec.kids.size > 0
    }));
    if (open.has(key(mj, childTrail))) walk(mj, model, childTrail, depth + 1, colSpecs, out);
  }
}

async function renderTree() {
  const token = ++renderToken;
  const colSpecs = cols();
  const body = $("#pfRows");
  const note = $("#pfNote");
  const q = filterQuery.trim().toLowerCase();

  const majors = IX.majors
    .filter((m) => !q || m.c.includes(q) || (m.n || "").toLowerCase().includes(q))
    .sort((a, b) => Model.mval(b, colSpecs[2]) - Model.mval(a, colSpecs[2]));

  const out = [];
  for (const m of majors) {
    const values = colSpecs.map((c) => Model.colExists(IX, c) ? Model.mval(m, c) : null);
    out.push(rowHtml({ mj: m.c, trail: [], code: m.c, name: m.n, depth: 0, values, hasKids: true }));
    if (open.has(key(m.c, []))) {
      const model = await ensureModel(m.c);
      walk(m.c, model, [], 1, colSpecs, out);
    }
  }
  if (token !== renderToken) return;

  const total = IX.majors.length;
  const shown = majors.length;
  note.textContent = q
    ? `${shown} of ${total} major heads match "${filterQuery.trim()}".`
    : `${total} major heads · document year ${DY}. Open one to see the levels beneath it.`;
  body.innerHTML = out.join("") || '<tr><td class="l pf-empty" colspan="5">No account head matches that.</td></tr>';
}

function setHeaders(colSpecs) {
  const head = document.getElementById("pfHeadRow");
  if (!head) return;
  head.innerHTML = '<th class="l">Account head</th>'
    + colSpecs.map((c) => `<th class="pf-num">${esc(c.label)}</th>`).join("");
}

function toggleRow(tr) {
  const mj = tr.dataset.mj;
  const trail = tr.dataset.trail ? tr.dataset.trail.split(",").filter((s) => s !== "").map(Number) : [];
  const rowKey = key(mj, trail);
  if (open.has(rowKey)) open.delete(rowKey); else open.add(rowKey);
  renderTree();
}

async function pickSearchEntry(entry) {
  const mj = entry.lv === "mj" ? entry.code : (entry.majors && entry.majors[0]);
  if (!mj) return;
  await addSelectedHead(entry,mj);
  filterQuery='';
  $('#pfSearch').querySelector('input').value='';
  renderTree();
}

function setupUseCase() {
  if(!$('#seeUseCase'))return;
  $('#seeUseCase').addEventListener('click',()=>{
    const button=$('#seeUseCase'),body=$('#drugUseCase');
    body.hidden=!body.hidden;button.setAttribute('aria-expanded',String(!body.hidden));
    button.textContent=body.hidden?'See use case':'Hide use case';
  });
  $('#collapseUseCase').addEventListener('click',()=>{
    $('#drugUseCase').hidden=true;
    const button=$('#seeUseCase');
    button.setAttribute('aria-expanded','false');
    button.textContent='See use case';
    button.focus({preventScroll:true});
    button.scrollIntoView({block:'center',behavior:'instant'});
  });
}

function setupExplorer() {
  $('.explore-state-tabs').addEventListener('click',async e=>{
    const tab=e.target.closest('[data-explore-state]');if(!tab)return;
    e.preventDefault();
    const next=tab.dataset.exploreState;if(next===STATE)return;
    const token=++stateSwitchToken;
    const tabsTop=$('.explore-state-tabs').getBoundingClientRect().top;
    $('.pf-explore').setAttribute('aria-busy','true');
    try{
      const index=await Store.index(next);if(token!==stateSwitchToken)return;
      STATE=next;IX=index;levelLabels.lf=next==='tn'?'Sub-detailed head':'Object head';
      models.clear();open.clear();selectedHeads.clear();selectedYears.clear();
      selectedAllYears=false;filterQuery='';renderToken++;
      $('.pf-explore').innerHTML=exploreTemplate;
      const url=new URL(location.href);url.searchParams.set('exploreState',next);
      history.replaceState(null,'',url);
      setupExplorer();
      $('#pfMeta').textContent=`${IX.name}: ${Engine.nfIN(IX.n_leaf_rows)} detail rows across ${IX.doc_years.length} document years, with ${Engine.nfIN(IX.majors.length)} major heads in the explorer.`;
      const restorePosition=()=>{
        if(token!==stateSwitchToken)return;
        const delta=$('.explore-state-tabs').getBoundingClientRect().top-tabsTop;
        window.scrollTo({top:window.scrollY+delta,behavior:'instant'});
      };
      restorePosition();
      requestAnimationFrame(()=>requestAnimationFrame(restorePosition));
    }catch(err){$('#pfNote').textContent='Could not switch state: '+err.message;}
    finally{if(token===stateSwitchToken)$('.pf-explore').removeAttribute('aria-busy');}
  });
  document.querySelectorAll('[data-explore-state]').forEach(tab=>{
    if(tab.dataset.exploreState===STATE)tab.setAttribute('aria-current','page');
    else tab.removeAttribute('aria-current');
  });
  $('#accountUnitHint').textContent=`Source amounts for ${IX.name} are in ${STATE==='tn'?'INR thousand':'INR lakh'}; displayed amounts are converted to ₹ crore. Open a row to see the account levels beneath it. A dash means unavailable data.`;
  setupSelectedHeads();
  DY = IX.doc_years[IX.doc_years.length - 1];

  $("#pfRows").addEventListener("click", (ev) => {
    const tr = ev.target.closest("tr.pf-can");
    if (tr) toggleRow(tr);
  });

  setHeaders(cols());
  renderTree();
  const exportButton = $("#exportAccounts");
  if (exportButton) {
    exportButton.disabled = false;
    exportButton.addEventListener("click", exportVisibleAccounts);
  }

  const index = Search.makeIndex(STATE);
  const baseQuery=index.query.bind(index);
  index.query=(q,limit=12)=>{
    const seen=new Set();
    return baseQuery(q,10000).flatMap(e=>(e[3]||[]).map(mj=>[e[0],e[1],e[2],[mj],e[4]]))
      .filter(e=>{const k=JSON.stringify([e[3][0],e[2],e[0],normalizeHead(e[1])]);if(seen.has(k))return false;seen.add(k);return true;}).slice(0,limit);
  };
  Search.attach($("#pfSearch"), index, {
    global: () => true,
    onPick: pickSearchEntry
  });

  const input = $("#pfSearch").querySelector("input");
  input.addEventListener("input", () => {
    filterQuery = input.value;
    open.clear();
    renderTree();
  });

  document.querySelectorAll("[data-explore-head]").forEach((button) => {
    button.disabled = false;
    button.addEventListener("click", async () => {
      const code = button.dataset.exploreHead;
      filterQuery = code;
      input.value = code;
      open.clear();
      open.add(key(code, []));
      try {
        await renderTree();
        $("#pfSearchInput").focus({ preventScroll: true });
        $("#explore").scrollIntoView({ block: "start", behavior: "smooth" });
      } catch {
        $("#pfNote").textContent = "This account could not be loaded. Select another account or reload the page.";
      }
    });
  });
}

async function setupHealthExample() {
  const host = $("#healthChart");
  const select = $("#healthYear");
  if (!host || !select) return;
  try {
    const exampleIndex=await Store.index('ka');
    const heads=exampleIndex.majors.filter(m=>['2210','2211'].includes(m.c));
    const data={rows:exampleIndex.fys.map((fiscal_year,f)=>{
      const value=m=>{const span=exampleIndex.spans[m];if(!span||f<span[0]||f>span[1])return null;return heads.reduce((sum,h)=>sum+(h.d[m]?.[f]||0),0)/exampleIndex.crore_div;};
      return {fiscal_year,be:value('be'),re:value('re'),actuals:value('ac')};
    })};
    const rows = (data.rows || []).filter((r) =>
      typeof r.fiscal_year === "string" && [r.be, r.re, r.actuals].every(Number.isFinite) && r.be > 0);
    if (!rows.length) throw new Error("No example years");
    select.innerHTML = rows.map((r) => `<option value="${esc(r.fiscal_year)}">${esc(r.fiscal_year)}</option>`).join("");
    select.value = rows[rows.length - 1].fiscal_year;
    select.disabled = false;
    const render = () => {
      const row = rows.find((r) => r.fiscal_year === select.value);
      if (!row) return;
      const max = Math.max(row.be, row.re, row.actuals);
      const bars = [["Budget estimate", "budget", row.be], ["Revised estimate", "revised", row.re], ["Actual expenditure", "actuals", row.actuals]];
      host.innerHTML = bars.map(([label, type, value]) => `<div class="health-bar ${type}"><span>${label}</span><div class="health-track" aria-hidden="true"><div class="health-fill" style="--bar-width:${100 * value / max}%"></div></div><strong>${value.toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></div>`).join("") + '<p class="chart-unit">₹ crore at current prices</p>';
      $("#healthInsight").textContent = `Actual expenditure was ${(row.actuals / row.be * 100).toFixed(1)}% of the budget estimate in ${row.fiscal_year}.`;
    };
    select.addEventListener("change", render);
    render();
  } catch {
    select.disabled = true;
    select.innerHTML = '<option>Unavailable</option>';
    host.innerHTML = '<p>The example could not be loaded. The analysis is available through the Python link below.</p>';
  }
}

/* ---------------------------------------------------------------- boot */
setupHealthExample();
setupUseCase();
// The landing-page examples and coverage describe Karnataka. State tabs
// select only the Explore workspace and its repository-backed data.
Promise.all([Store.index('ka'),Store.states().catch(()=>null),Store.quality('ka').catch(()=>null)])
  .then(async ([index,stateList,quality]) => {
    IX = index;QUALITY=quality;
    STATE_META=stateList?.states?.find(s=>s.st==='ka')||null;
    if($('#metrics')){
    renderMetrics();
    renderHeatmap();
    renderTables();
    renderCoverageList();
    renderChecks();
    setupSql();
    }
    IX=STATE==='ka'?index:await Store.index(STATE);
    if($('.pf-explore')){
    setupExplorer();
    $("#pfMeta").textContent = `${IX.name}: ${Engine.nfIN(IX.n_leaf_rows)} detail rows across ${IX.doc_years.length} document years, with ${Engine.nfIN(IX.majors.length)} major heads in the explorer.`;
    }

  })
  .catch((err) => {
    const note = $("#pfNote");
    if (note) note.textContent = "Could not load the explorer index: " + err.message;
  });
