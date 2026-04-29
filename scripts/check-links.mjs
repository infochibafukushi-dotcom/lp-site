import fs from 'node:fs';
const files = ['data/config.json','data/sections.json'];
const bad = [];
for (const f of files){
  const text=fs.readFileSync(f,'utf8');
  const urls=[...text.matchAll(/https?:\/\/[^\"\s]+|tel:[0-9+]+|#[-a-zA-Z0-9_]+/g)].map(v=>v[0]);
  urls.forEach((u)=>{ if (/^javascript:/i.test(u)) bad.push({f,u}); });
}
if (bad.length){ console.error('bad links', bad); process.exit(1);} 
console.log('Link check passed');
