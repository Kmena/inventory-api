const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const migrationPath = path.join(
  __dirname,
  '..',
  'prisma',
  'migrations',
  '20260801000000_due_diligence_closeout_indexes',
  'migration.sql',
);
const userRepositoryPath = path.join(__dirname, '..', 'src', 'repositories', 'user.repository.js');
const agentWorkspaceRepositoryPath = path.join(__dirname, '..', 'src', 'repositories', 'agent-workspace.repository.js');
const invoiceRepositoryPath = path.join(__dirname, '..', 'src', 'repositories', 'invoice.repository.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('schema adds only the approved closeout indexes for User, OrderItem, and Invoice', () => {
  const schema = read(schemaPath);
  const userModel = schema.match(/model User \{[\s\S]*?@@map\("users"\)\s*\}/)?.[0] || '';
  const orderItemModel = schema.match(/model OrderItem \{[\s\S]*?@@map\("order_items"\)\s*\}/)?.[0] || '';
  const invoiceModel = schema.match(/model Invoice \{[\s\S]*?@@map\("invoices"\)\s*\}/)?.[0] || '';

  assert.match(userModel, /@@index\(\[companyId, id\]\)/);
  assert.match(orderItemModel, /@@index\(\[orderId\]\)/);
  assert.match(orderItemModel, /@@index\(\[productId\]\)/);
  assert.match(invoiceModel, /@@index\(\[clientId\]\)/);
  assert.match(invoiceModel, /@@index\(\[orderId\]\)/);
  assert.doesNotMatch(invoiceModel, /companyId/);
});

test('closeout migration stays additive and limited to the approved index set', () => {
  const migration = read(migrationPath);

  assert.match(migration, /CREATE INDEX "users_company_id_id_idx" ON "users"\("company_id", "id"\)/);
  assert.match(migration, /CREATE INDEX "order_items_order_id_idx" ON "order_items"\("order_id"\)/);
  assert.match(migration, /CREATE INDEX "order_items_product_id_idx" ON "order_items"\("product_id"\)/);
  assert.match(migration, /CREATE INDEX "invoices_client_id_idx" ON "invoices"\("client_id"\)/);
  assert.match(migration, /CREATE INDEX "invoices_order_id_idx" ON "invoices"\("order_id"\)/);
  assert.doesNotMatch(migration, /ALTER TABLE "invoices" ADD COLUMN "company_id"/);
});

test('repository hotspots still justify the bounded index set', () => {
  const userRepository = read(userRepositoryPath);
  const agentWorkspaceRepository = read(agentWorkspaceRepositoryPath);
  const invoiceRepository = read(invoiceRepositoryPath);

  assert.match(userRepository, /const where = \{ companyId \}/);
  assert.match(agentWorkspaceRepository, /prisma\.orderItem\.findMany\(/);
  assert.match(agentWorkspaceRepository, /order: \{[\s\S]*companyId,[\s\S]*clientId,[\s\S]*clientStoreId: \{ not: storeId \}/);
  assert.match(invoiceRepository, /client: \{ companyId \}/);
  assert.match(invoiceRepository, /orderBy: \[\{ issuedAt: 'desc' \}, \{ id: 'desc' \}\]/);
});
