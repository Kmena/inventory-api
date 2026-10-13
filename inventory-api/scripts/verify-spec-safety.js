'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const rawKey = process.env.BILLING_SANDBOX_M2M_API_KEY || '';
if (!rawKey) {
  process.stdout.write('[WARN] Key not set\n');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..', '..', '..');
const checkDirs = [
  path.join(ROOT, 'inventory-api', 'specs'),
  path.join(ROOT, 'inventory-api', 'inventory-api', 'scripts'),
  path.join(ROOT, 'specs', 'inventori-billing-integration'),
];

let found = false;
let checked = 0;

for (const dir of checkDirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fp = path.join(dir, file);
    try {
      const stat = fs.statSync(fp);
      if (stat.isFile() && (file.endsWith('.md') || file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.ts') || file.endsWith('.json'))) {
        const content = fs.readFileSync(fp, 'utf8');
        checked++;
        if (content.includes(rawKey)) {
          process.stdout.write('[FAIL] Raw key found in: ' + fp + '\n');
          found = true;
        }
      }
    } catch (_) { /* skip */ }
  }
}

process.stdout.write('[INFO] Files checked: ' + checked + '\n');
process.stdout.write('[INFO] Raw key NOT printed\n');
process.stdout.write('raw secret in spec/script files: ' + found + '\n');
if (!found) {
  process.stdout.write('[OK] No secret exposure in spec/script files\n');
} else {
  process.stdout.write('[FAIL] Secret exposure detected!\n');
  process.exit(1);
}
