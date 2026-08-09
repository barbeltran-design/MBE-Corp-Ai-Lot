const swc = require('@swc/core');
const fs = require('fs');
const path = '/sessions/great-nifty-hypatia/mnt/MBE Corpilot AI/PlanAccionBuilder.tsx';
const code = fs.readFileSync(path, 'utf8');
swc.transform(code, { filename: 'PlanAccionBuilder.tsx', jsc: { parser: { syntax: 'typescript', tsx: true }, target: 'es2020' } })
  .then((out) => console.log('OK, output length', out.code.length))
  .catch((e) => console.log('ERROR:', e.message));
