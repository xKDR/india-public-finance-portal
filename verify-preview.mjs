import fs from 'node:fs/promises';
import path from 'node:path';
let count=0;
async function scan(d){for(const e of await fs.readdir(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())await scan(f);else if(f.endsWith('.html')){const h=await fs.readFile(f,'utf8');const nav=h.match(/<nav[^>]*aria-label="Site"[^>]*>([\s\S]*?)<\/nav>/);if(nav){if(/>\s*(Karnataka|Tamil Nadu)\s*<\/a>/.test(nav[1]))throw Error(f);count++;}}}}
await scan('local-site');
for(const st of ['ka','tn']){const ix=JSON.parse(await fs.readFile(`local-site/public-finance/data/${st}/index.json`));for(const vs of Object.values(ix.totals))for(const v of Object.values(vs))if(!Number.isFinite(v))throw Error('Invalid total');}
console.log(`${count} Site navigation blocks verified; all state totals finite.`);
