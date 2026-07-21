const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repositoryRoot = path.join(__dirname, '..');
const composeProdPath = path.join(repositoryRoot, 'docker-compose.prod.yml');
const readmePath = path.join(repositoryRoot, 'README.md');
const productionDocPath = path.join(repositoryRoot, 'docs', 'production-baseline.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('production compose baseline includes db, migrate and app services with persistent volumes', () => {
  const composeSource = read(composeProdPath);

  assert.match(composeSource, /^services:/m);
  assert.match(composeSource, /^(?: {2})db:/m);
  assert.match(composeSource, /^(?: {2})migrate:/m);
  assert.match(composeSource, /^(?: {2})app:/m);
  assert.match(composeSource, /command: \["npm", "run", "prisma:deploy"\]/);
  assert.match(composeSource, /postgres_data:/);
  assert.match(composeSource, /app_storage:/);
  assert.match(composeSource, /condition: service_healthy/);
});

test('production baseline documentation covers validation, migrations and health checks', () => {
  const docSource = read(productionDocPath);
  const readmeSource = read(readmePath);

  assert.match(docSource, /npm run validate:production-baseline/);
  assert.match(docSource, /docker compose -f docker-compose.prod.yml run --rm migrate/);
  assert.match(docSource, /\/health\/ready/);
  assert.match(readmeSource, /production-baseline\.md/);
});

test('validate-production-baseline passes with explicit production environment values', () => {
  const result = spawnSync('node', ['scripts/validate-production-baseline.js'], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      ENV_FILE: 'missing.env.production',
      NODE_ENV: 'production',
      PORT: '2500',
      DATABASE_URL: 'postgresql://tracksys:secure_password@db:5432/tracksys?schema=public',
      POSTGRES_DB: 'tracksys',
      POSTGRES_USER: 'tracksys',
      POSTGRES_PASSWORD: 'secure_password',
      CORS_ORIGIN: 'https://inventory.example.com',
      APP_BASE_URL: 'https://inventory.example.com',
      JWT_SECRET: '0123456789abcdef0123456789abcdef',
    },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Production baseline validation passed/);
});
