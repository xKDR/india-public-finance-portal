import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=await fs.readFile('local-site/public-finance/js/compare.js','utf8');
const funcs=source.slice(source.indexOf('  function windowRaw('),source.indexOf('  /* Indexed to 100'));
const ctx={Number,YEARS:['a','b','c','d'],S:{from:0,to:3},STATE_YIX:{ka:new Map([['a',0],['b',1],['c',2],['d',3]])},IXS:{ka:{spans:{be:[0,3]},totals:{be:{0:100,1:20,2:0,3:200}}}}};
vm.createContext(ctx);vm.runInContext(funcs+';this.raw=windowRaw;this.pct=pctValues;',ctx);
const raw=ctx.raw('ka',{vals:{be:[10,0,2,40]}},'be');
assert.deepEqual(Array.from(raw),[10,0,2,40]);
assert.deepEqual(Array.from(ctx.pct({st:'ka',mk:'be',raw})),[10,0,null,20]);
ctx.IXS.ka.totals.be[1]=20;
assert.equal(ctx.pct({st:'ka',mk:'be',raw:[10,5,null,40]})[1],25,'Small state totals must not disappear');
ctx.IXS.ka.totals.be[1]=undefined;
assert.equal(ctx.pct({st:'ka',mk:'be',raw:[10,5,null,40]})[1],null);
ctx.IXS.ka.spans.be=[1,2];
assert.deepEqual(Array.from(ctx.raw('ka',{vals:{be:[10,0,2,40]}},'be')),[null,0,2,null]);
// Run the same transforms on all recovered heads, states and measures.
for(const st of ['ka','tn']){
 const ix=JSON.parse(await fs.readFile(`local-site/public-finance/data/${st}/index.json`));
 ctx.IXS[st]=ix;ctx.YEARS=ix.fys;ctx.S.to=ix.fys.length-1;
 ctx.STATE_YIX[st]=new Map(ix.fys.map((f,i)=>[f,i]));
 for(const major of ix.majors)for(const mk of ['be','bp','re','ac']){
  const rec={vals:major.d};const vals=ctx.raw(st,rec,mk);const shares=ctx.pct({st,mk,raw:vals});
  for(let i=0;i<vals.length;i++){
   const t=ix.totals[mk]?.[i];
   if(vals[i]!=null&&Number.isFinite(t)&&t!==0)assert.equal(shares[i],vals[i]/t*100);
   else assert.equal(shares[i],null);
  }
 }
}
console.log('PASS: percentage shares across every major head, state and measure; zero, missing, low-total and coverage cases.');
