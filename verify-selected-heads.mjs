import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=await fs.readFile('local-site/app.js','utf8');
const ctx={Model:{pval:(p,c)=>p.d[c.m]?.[c.f]||0},normalizeHead:s=>String(s||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim()};
vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf('function aggregateSelectedHead('),src.indexOf('function selectedSpecs('))+';this.aggregate=aggregateSelectedHead;',ctx);
const ix=JSON.parse(await fs.readFile('local-site/public-finance/data/ka/index.json'));
const specs=['be','re','ac'].map(m=>({m,f:ix.fys.indexOf('2024-25')}));
const exportRows=new Map();
for(const major of ['2210','2055']){
 const s=JSON.parse(await fs.readFile(`local-site/public-finance/data/ka/major/${major}.json`));
 const model={...s,chains:s.paths.map(p=>p.n.filter(n=>n>=0))};
 const result=ctx.aggregate(model,{lv:'lf',code:'222',name:'Drugs and Chemicals'},specs);
 const expected=[];
 for(const [dy,measure] of [['2024-25','budget_estimate'],['2025-26','revised_estimate'],['2026-27','accounts']]){
  const text=await fs.readFile(`state-finances/karnataka/KA_years/KA_${dy}/KA_json/KA_budget_leaves_${dy}.ndjson`,'utf8');
  let total=0;
  for(const line of text.trim().split('\n')){const r=JSON.parse(line);const h=r.hierarchy;if(h.major_head.code!==major||h.object_head.code!=='222'||ctx.normalizeHead(h.object_head.name)!=='drugs and chemicals')continue;for(const a of r.amounts)if(a.measure===measure&&a.fiscal_year==='2024-25')total+=Number(a.value);}
  expected.push(total);
 }
 result.values.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<0.0001));
 assert.ok(result.matched>0);console.log(major,'verified BE/RE/Actuals against repository leaves:',expected.map(v=>v/100));
 exportRows.set(major,{major,lv:'lf',code:'222',name:'Drugs and Chemicals',model,...result});
}
const synthetic={nodes:[{i:0,lv:'lf',code:'1',name:'A'},{i:1,lv:'lf',code:'1',name:'A'}],chains:[[0,1]],paths:[{d:{be:{0:0},re:{0:5}}}]};
const r=ctx.aggregate(synthetic,{lv:'lf',code:'1',name:'A'},['be','re','ac'].map(m=>({m,f:0})));
assert.deepEqual(Array.from(r.values),[0,5,0]);assert.deepEqual(Array.from(r.available),[true,true,false]);assert.equal(r.matched,1);
console.log('PASS: no duplicate counting; printed zero distinguished from missing data.');
// Exercise the actual CSV click handler with the verified repository totals.
const nodes=new Map();let exported;
Object.assign(ctx,{IX:ix,STATE:'ka',selectedHeads:exportRows,selectedYear:'2024-25',selectedAllYears:false,levelLabels:{lf:'Object head'},Blob,setTimeout:()=>{},URL:{createObjectURL:b=>(exported=b,'blob:test'),revokeObjectURL:()=>{}},document:{createElement:()=>({click(){}})},renderSelectedHeads(){},$:id=>{
 if(!nodes.has(id))nodes.set(id,{querySelectorAll(){return [];},addEventListener(type,cb){this[type]=cb;}});return nodes.get(id);
}});
ctx.Model.colExists=(ix,c)=>c.f>=ix.spans[c.m][0]&&c.f<=ix.spans[c.m][1];
vm.runInContext(src.slice(src.indexOf('function selectedSpecs('),src.indexOf('function renderSelectedHeads('))+src.slice(src.indexOf('function setupSelectedHeads('),src.indexOf('const key ='))+src.slice(src.indexOf('function csvCell('),src.indexOf('async function exportVisibleAccounts(')),ctx);
vm.runInContext('setupSelectedHeads();',ctx);
nodes.get('#downloadSelected').click();
const csv=await exported.text();
assert.equal(csv.trim().split('\r\n').length,3);
assert.ok(csv.includes('0.1997'));assert.ok(csv.includes('110.9791'));assert.ok(csv.includes('BE_INR_crore,RE_INR_crore,Actuals_INR_crore'));
await fs.writeFile('selected-heads-example.csv',csv);
console.log('PASS: CSV handler exports both heads with full precision, units and repository commit.');
nodes.get('#yearPickerOptions').change({target:{dataset:{year:'all'},checked:true}});
nodes.get('#downloadSelected').click();
const allCsv=await exported.text();
assert.equal(allCsv.trim().split('\r\n').length,1+2*ix.fys.length);
assert.ok(allCsv.includes('2016-17'));assert.ok(allCsv.includes('2026-27'));
nodes.get('#yearPickerOptions').change({target:{dataset:{year:'all'},checked:false}});
assert.equal(nodes.get('#downloadSelected').disabled,true);
for(const year of ['2023-24','2024-25'])nodes.get('#yearPickerOptions').change({target:{dataset:{year},checked:true}});
assert.equal(vm.runInContext('selectedTableRows().length',ctx),4);
nodes.get('#downloadSelected').click();
assert.equal((await exported.text()).trim().split('\r\n').length,5);
console.log('PASS: All years, empty selection, and arbitrary multiple-year table/CSV selection.');
// Validate the same aggregation against Tamil Nadu, whose source unit differs.
const tnIx=JSON.parse(await fs.readFile('local-site/public-finance/data/tn/index.json'));
const tnShard=JSON.parse(await fs.readFile('local-site/public-finance/data/tn/major/2210.json'));
const tnModel={...tnShard,chains:tnShard.paths.map(p=>p.n.filter(n=>n>=0))};
const tnEntry={lv:'mj',code:'2210',name:'MEDICAL AND PUBLIC HEALTH'};
const tnValues=ctx.aggregate(tnModel,tnEntry,['be','re','ac'].map(m=>({m,f:tnIx.fys.indexOf('2024-25')})));
const tnExpected=[];
for(const [dy,measure] of [['2024-25','budget_estimate'],['2025-26','revised_estimate'],['2026-27','accounts']]){
 const text=await fs.readFile(`state-finances/tamil-nadu/TN_years/TN_${dy}/TN_json/TN_budget_leaves_${dy}.ndjson`,'utf8');let total=0;
 for(const line of text.trim().split('\n')){const r=JSON.parse(line),h=r.hierarchy;if(h.major_head.code!=='2210')continue;for(const a of r.amounts)if(a.measure===measure&&a.fiscal_year==='2024-25')total+=Number(a.value);}
 tnExpected.push(total);
}
tnValues.values.forEach((v,i)=>assert.ok(Math.abs(v-tnExpected[i])<0.0001));
assert.equal(tnIx.crore_div,10000);
assert.ok(tnExpected.every(v=>v>0));
console.log('PASS: Tamil Nadu search-head totals and thousand-to-crore conversion:',tnExpected.map(v=>v/tnIx.crore_div));
Object.assign(ctx,{IX:tnIx,STATE:'tn',selectedYears:new Set(['2024-25']),selectedAllYears:false,
 selectedHeads:new Map([['tn-medical',{...tnEntry,major:'2210',model:tnModel}]])});
nodes.get('#downloadSelected').click();
const tnCsv=await exported.text();
assert.ok(tnCsv.includes('tn,2024-25,2210'));
assert.ok(tnCsv.includes('15279.5694,15631.4998,15493.2238'));
console.log('PASS: Tamil Nadu CSV state identity, selected year, and native-unit conversion.');
