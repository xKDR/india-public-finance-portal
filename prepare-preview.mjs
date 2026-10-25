import fs from 'node:fs/promises';
import path from 'node:path';
import {createReadStream} from 'node:fs';
import {createGunzip} from 'node:zlib';
import readline from 'node:readline';
const root='local-site/public-finance';
async function files(dir){const all=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())all.push(...await files(p));else all.push(p);}return all;}
for(const p of await files('local-site'))if(p.endsWith('.html')){
 let html=await fs.readFile(p,'utf8');
 html=html.replace(/(<nav\b[^>]*aria-label="Site"[^>]*>)([\s\S]*?)(<\/nav>)/g,(_,a,b,c)=>a+b.replace(/\s*<a\b[^>]*>\s*(Karnataka|Tamil Nadu)\s*<\/a>/g,'')+c);
 await fs.writeFile(p,html);
}
await fs.mkdir(`${root}/assets`,{recursive:true});
try { await fs.rename(`${root}/assets-map.json`,`${root}/assets/india_states.json`); } catch (e) { if (e.code !== 'ENOENT') throw e; }
// Quality metrics come from the repository's published validation summaries.
function csv(s){const out=[];let v='',q=false;for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(q&&s[i+1]==='"'){v+='"';i++;}else q=!q;}else if(c===','&&!q){out.push(v);v='';}else v+=c;}out.push(v);return out;}
for(const [st,pre,slug] of [['ka','KA','karnataka'],['tn','TN','tamil-nadu']]){
 const source=`state-finances/${slug}/${pre}_validation_summary.csv${st==='tn'?'.gz':''}`;
 let stream=createReadStream(source);if(st==='tn')stream=stream.pipe(createGunzip());
 let header;const years={},majorFlags=new Map();
 for await(const line of readline.createInterface({input:stream,crlfDelay:Infinity})){
  if(!header){header=csv(line);continue;}const v=csv(line),r=Object.fromEntries(header.map((k,i)=>[k,v[i]]));
  if(!['Year','Major-Head'].includes(r.level))continue;
  const key=r.document_year+'|'+(r.major_head_code||'');const target=r.level==='Year'?years:majorFlags;
  let a=r.level==='Year'?years[r.document_year]:majorFlags.get(key);
  if(!a){a={dy:r.document_year,codes:[r.major_head_code],n:0,passed:0,accuracy:0};if(r.level==='Year')years[r.document_year]=a;else majorFlags.set(key,a);}
  a.n+=+r.n_checks;a.passed+=+r.n_passed;a.accuracy+=(+r.mu_accuracy_pct||0)*(+r.n_checks);
 }
 const finish=a=>({...a,pp:a.n?100*a.passed/a.n:0,mu:a.n?a.accuracy/a.n:null});
 const quality={years:Object.fromEntries(Object.entries(years).map(([k,a])=>[k,finish(a)])),worst:[...majorFlags.values()].map(finish).sort((a,b)=>a.pp-b.pp)};
 await fs.writeFile(`${root}/data/${st}/quality.json`,JSON.stringify(quality));
 const ix=JSON.parse(await fs.readFile(`${root}/data/${st}/index.json`,'utf8'));
 for(const m of ix.majors)for(const a of quality.worst.filter(a=>a.codes[0]===m.c))m.flagged[ix.doc_years.indexOf(a.dy)]=[a.n-a.passed,a.n];
 await fs.writeFile(`${root}/data/${st}/index.json`,JSON.stringify(ix));
}
const sj=JSON.parse(await fs.readFile(`${root}/data/states.json`,'utf8'));
for(const s of sj.states){const q=JSON.parse(await fs.readFile(`${root}/data/${s.st}/quality.json`,'utf8'));if(q.years[s.last])s.pass={dy:s.last,pct:q.years[s.last].pp};}
await fs.writeFile(`${root}/data/states.json`,JSON.stringify(sj));
// Reconstruct the shared major-head comparison index from local indexes.
const entries=new Map(),states=[];
for(const st of ['ka','tn']){const ix=JSON.parse(await fs.readFile(`${root}/data/${st}/index.json`,'utf8'));states.push({k:st,name:ix.name,fys:ix.fys});for(const m of ix.majors){if(!entries.has(m.c))entries.set(m.c,[m.c,'mj',{}]);entries.get(m.c)[2][st]=[m.n,(m.d.be?.[ix.fys.length-1]||0)/ix.crore_div];}}
await fs.mkdir(`${root}/data/compare`,{recursive:true});await fs.writeFile(`${root}/data/compare/index.json`,JSON.stringify({v:1,states,entries:[...entries.values()]}));
// Make recovery limitations explicit, particularly when inspecting a leaf.
for(const p of await files('local-site'))if(p.endsWith('.html')){let h=await fs.readFile(p,'utf8');h=h.replace(/<aside style="padding:8px 16px;background:#fff4cf[\s\S]*?<\/aside>/g,'');h=h.replace('<body>','<body><aside style="padding:8px 16px;background:#fff4cf;color:#493a14;font:13px system-ui">Local recovered preview · Budget data rebuilt from GitHub. Raw extraction values may differ from live processed data. Detailed quality badges and deeper comparison search are pending; see local README.</aside>');await fs.writeFile(p,h);}
