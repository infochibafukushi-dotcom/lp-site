import fs from 'node:fs';
const config = JSON.parse(fs.readFileSync('data/config.json','utf8'));
const sections = JSON.parse(fs.readFileSync('data/sections.json','utf8'));
const carechan = JSON.parse(fs.readFileSync('data/carechan.json','utf8'));
if (typeof config !== 'object') throw new Error('config must be object');
if (!Array.isArray(config.buttons) || config.buttons.length < 3) throw new Error('config.buttons invalid');
if (!Array.isArray(config.footer) || config.footer.length < 3) throw new Error('config.footer invalid');
if (!Array.isArray(sections)) throw new Error('sections must be array');
for (const s of sections) {
  if (!s.id || !s.type || typeof s.enabled !== 'boolean') throw new Error('invalid section: '+JSON.stringify(s));
}
if (typeof carechan !== 'object') throw new Error('carechan must be object');
if (typeof carechan.enabled !== 'boolean') throw new Error('carechan.enabled invalid');
if (!Array.isArray(carechan.questions)) throw new Error('carechan.questions must be array');
for (const q of carechan.questions) {
  if (!q.id || !q.title) throw new Error('invalid carechan question: '+JSON.stringify(q));
  if (!Array.isArray(q.ctas)) throw new Error('carechan ctas must be array: '+q.id);
}
console.log('JSON validation passed');
