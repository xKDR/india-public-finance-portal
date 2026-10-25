// Rebuild preview data exclusively from the cloned GitHub repository.
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import {createReadStream} from 'node:fs';
const root='local-site/public-finance/data';
const fy=y=>`${y}-${String((y+1)%100).padStart(2,'0')}`;
const write=async(p,x)=>{await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,JSON.stringify(x));};
const states=[];
const excluded=[];
for(const [st,prefix,slug,schema] of [['ka','KA','karnataka','schema-index.json'],['tn','TN','tamil-nadu','schema-tn-index.json']]){
 const template=JSON.parse(await fs.readFile(schema,'utf8'));
 // Only presentation labels are reused from the recovered format.
 const pkg=`state-finances/${slug}`, base=pkg;
 const years=(await fs.readdir(`${base}/${prefix}_years`)).map(s=>s.slice(3)).sort();
 const fys=Array.from({length:parseInt(years.at(-1))-parseInt(years[0])+3},(_,i)=>fy(parseInt(years[0])-2+i));
 const names=JSON.parse(await fs.readFile(`${base}/${prefix}_demand_names.json`,'utf8'));
 const demands=names.demands?Object.fromEntries(Object.entries(names.demands).map(([k,v])=>[k,v.name])):names;
 const ix={state:prefix,name:st==='ka'?'Karnataka':'Tamil Nadu',package_dir:pkg,unit:st==='ka'?'INR_lakh':'INR_thousand',crore_div:st==='ka'?100:10000,doc_years:years,fys,spans:{be:[2,fys.length-1],bp:[1,fys.length-2],re:[1,fys.length-2],ac:[0,fys.length-3]},levels:template.levels,sector_groups:template.sector_groups,demands,demands_data:[],pdfs:{},pdf_key:st==='ka'?'volume':'demand',majors:[],totals:{},n_leaf_rows:0};
 const shards=new Map(), dmMap=new Map();
 const add=(d,m,f,v)=>{d[m]??={};d[m][f]=(d[m][f]||0)+v;};
 const field=['sub_major_head','minor_head','sub_head','detailed_head',st==='ka'?'object_head':'sub_detailed_head'];
 for(const [yi,year] of years.entries()){
  const input=`${base}/${prefix}_years/${prefix}_${year}/${prefix}_json/${prefix}_budget_leaves_${year}.ndjson`;
  ix.pdfs[year]={};
  for await(const line of readline.createInterface({input:createReadStream(input),crlfDelay:Infinity})){
   if(!line.trim())continue;const r=JSON.parse(line);
   if(st==='ka' && r.amounts.some(a=>Math.abs(Number(a.value))>1e15) && ['major_head','sub_major_head','minor_head','sub_head','detailed_head','object_head'].some(k=>r.hierarchy[k]?.code && !/^\d+$/.test(r.hierarchy[k].code))){excluded.push({id:r._id,source:r.source,reason:'Non-numeric Karnataka account-head code and implausible amount indicate a shifted extraction row; excluded for this preview only',row:r});continue;}
   ix.n_leaf_rows++;
   const h=r.hierarchy, code=h.major_head.code;
   let s=shards.get(code);if(!s){s={state:prefix,major:code,name:h.major_head.name||code,levels:ix.levels,nodes:[],paths:[],flags:[],nodeMap:new Map()};shards.set(code,s);}
   const n=field.map((f,i)=>{const a=h[f];if(!a||a.code==null||a.code==='')return -1;const key=JSON.stringify([i,...field.slice(0,i+1).map(k=>h[k]?.code),a.name]);if(!s.nodeMap.has(key)){s.nodeMap.set(key,s.nodes.length);s.nodes.push({i:s.nodes.length,lv:ix.levels[i].k,code:a.code,name:a.name||a.code});}return s.nodeMap.get(key);});
   const p={n,dm:r.demand,d:{},pg:{[yi]:st==='ka'?[r.source.volume,r.source.page]:r.source.page}};
   // Keep each printed leaf separate; never sum repeated BE publications.
   for(const a of r.amounts){const f=fys.indexOf(a.fiscal_year);if(f<0||a.value==null)continue;const m=a.measure==='accounts'?'ac':a.measure==='revised_estimate'?'re':a.fiscal_year===year?'be':'bp';add(p.d,m,f,Number(a.value));}
   s.paths.push(p);
   ix.pdfs[year][st==='ka'?String(r.source.volume):r.demand]=r.source.file;
  }
  console.log(st,year);
 }
 for(const [code,s] of [...shards].sort()){
  const d={};for(const p of s.paths){let dm=dmMap.get(p.dm);if(!dm){dm={dm:p.dm,n:demands[p.dm]||p.dm,mjs:new Set(),d:{}};dmMap.set(p.dm,dm);}dm.mjs.add(code);for(const [m,vs] of Object.entries(p.d))for(const [f,v] of Object.entries(vs)){add(d,m,f,v);add(ix.totals,m,f,v);add(dm.d,m,f,v);}}
  const g=ix.sector_groups.find(g=>+code>=g.lo&&+code<=g.hi);
  const record={c:code,n:s.name,sector:+code<4000?'revenue':+code<6000?'capital':+code<=6010?'debt':'loans',g:g?.k||'other',d,np:s.paths.length,flagged:{}};
  delete s.nodeMap;await write(`${root}/${st}/major/${code}.json`,s);record.kb=Math.ceil(JSON.stringify(s).length/1024);ix.majors.push(record);
 }
 ix.demands_data=[...dmMap.values()].map(d=>({...d,mjs:[...d.mjs].sort()}));
 await write(`${root}/${st}/index.json`,ix);
 await write(`${root}/${st}/quality.json`,{years:{},worst:[],unavailable:'Validation badge rebuild is pending in this recovered preview.'});
 const entries=ix.majors.map(m=>[m.c,m.n,'mj',[m.c],(m.d.be?.[fys.length-1]||0)/ix.crore_div]);
 for(const s of shards.values())for(const n of s.nodes)entries.push([n.code,n.name,n.lv,[s.major],0]);
 for(const [part,lvs] of Object.entries({core:['mj','sm','mn'],subheads:['sh'],detailed:['dh'],leaves:['lf']}))await write(`${root}/${st}/search/${part}.json`,{entries:entries.filter(e=>lvs.includes(e[2]))});
 const latest=fys.length-1, ac=latest-2;
 states.push({st,code:prefix,name:ix.name,n_years:years.length,first:years[0],last:years.at(-1),majors:ix.majors.length,leaf_rows:ix.n_leaf_rows,be:{fy:fys[latest],cr:ix.totals.be[latest]/ix.crore_div},exec:{fy:fys[ac],pct:100*ix.totals.ac[ac]/ix.totals.be[ac]}});
}
await write(`${root}/states.json`,{states});
await write(`${root}/excluded-rows.json`,excluded);
await write(`${root}/provenance.json`,{repository:'https://github.com/xKDR/india-public-finance-portal',commit:'371c1e5d79a7f2dfcb8d55f21867330384093910',inputs:'state-finances/*/*_years/*/*_json/*_budget_leaves_*.ndjson',note:'Every amount rebuilt from repository additive leaves. Hosted budget JSON is not used. Validation badges are pending.'});
