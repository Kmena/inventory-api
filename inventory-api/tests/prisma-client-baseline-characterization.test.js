const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repositoryRoot = path.join(__dirname, '..');

function runNode(expression) {
  return spawnSync(process.execPath, ['-e', expression], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
}

test('payment receipt evidence service import chain does not fail with missing generated Prisma client baseline', () => {
  const result = runNode("require('./src/services/payment-receipt-evidence.service');");

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(result.stderr || '', /\.prisma\/client\/default/);
  assert.doesNotMatch(result.stdout || '', /\.prisma\/client\/default/);
});

test('payment receipt evidence repository import chain resolves the shared Prisma bootstrap successfully', () => {
  const result = runNode("const prisma = require('./src/lib/prisma'); const repository = require('./src/repositories/payment.repository'); if (!prisma || !repository) process.exit(1);");

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(result.stderr || '', /\.prisma\/client\/default/);
});
