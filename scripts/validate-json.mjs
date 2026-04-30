import fs from 'node:fs';
const config = JSON.parse(fs.readFileSync('data/config.json','utf8'));
const sections = JSON.parse(fs.readFileSync('data/sections.json','utf8'));
if (typeof config !== 'object') throw new Error('config must be object');
if (!Array.isArray(config.buttons) || config.buttons.length < 3) throw new Error('config.buttons invalid');
if (!Array.isArray(config.footer) || config.footer.length < 3) throw new Error('config.footer invalid');
if (!Array.isArray(sections)) throw new Error('sections must be array');
for (const s of sections) {
  if (!s.id || !s.type || typeof s.enabled !== 'boolean') throw new Error('invalid section: '+JSON.stringify(s));
}
console.log('JSON validation passed');
