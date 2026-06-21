import fs from 'node:fs';
const config = JSON.parse(fs.readFileSync('data/config.json','utf8'));
const sections = JSON.parse(fs.readFileSync('data/sections.json','utf8'));
const carechan = JSON.parse(fs.readFileSync('data/carechan.json','utf8'));
const estimateConfig = JSON.parse(fs.readFileSync('data/estimate-config.json','utf8'));

function validateCarechanNodes(nodes, label){
  if(!Array.isArray(nodes)) throw new Error('carechan questions must be array: ' + label);
  for (const q of nodes) {
    if (!q.id || !q.title) throw new Error('invalid carechan node: ' + JSON.stringify(q));
    if (!Array.isArray(q.ctas)) throw new Error('carechan ctas must be array: ' + q.id);
    if (q.children != null && !Array.isArray(q.children)) throw new Error('carechan children must be array: ' + q.id);
    if (Array.isArray(q.children) && q.children.length) validateCarechanNodes(q.children, q.id);
  }
}

function validateEstimateConfig(data){
  if(typeof data !== 'object' || !data) throw new Error('estimate-config must be object');
  if(typeof data.enabled !== 'boolean') throw new Error('estimate-config.enabled invalid');
  if(typeof data.version !== 'number') throw new Error('estimate-config.version invalid');
  if(!data.page || typeof data.page.title !== 'string') throw new Error('estimate-config.page invalid');
  if(!data.basicFees || typeof data.basicFees !== 'object') throw new Error('estimate-config.basicFees invalid');
  if(!data.distancePricing || !data.distancePricing.mode) throw new Error('estimate-config.distancePricing invalid');
  const categories = data.categories;
  if(!categories || typeof categories !== 'object') throw new Error('estimate-config.categories invalid');
  for (const key of ['mobility', 'assistance', 'stairAssist', 'tripType']) {
    if(!Array.isArray(categories[key]?.items)) throw new Error('estimate-config.categories.' + key + '.items invalid');
  }
}

if (typeof config !== 'object') throw new Error('config must be object');
if (!Array.isArray(config.buttons) || config.buttons.length < 3) throw new Error('config.buttons invalid');
if (!Array.isArray(config.footer) || config.footer.length < 3) throw new Error('config.footer invalid');
if (!Array.isArray(sections)) throw new Error('sections must be array');
for (const s of sections) {
  if (!s.id || !s.type || typeof s.enabled !== 'boolean') throw new Error('invalid section: '+JSON.stringify(s));
}
if (typeof carechan !== 'object') throw new Error('carechan must be object');
if (typeof carechan.enabled !== 'boolean') throw new Error('carechan.enabled invalid');
validateCarechanNodes(carechan.questions, 'root');
validateEstimateConfig(estimateConfig);
console.log('JSON validation passed');
