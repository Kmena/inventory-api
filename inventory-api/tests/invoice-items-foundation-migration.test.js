const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// MASTER-003 / NPP-TASK-003 — InvoiceItem schema and historical backfill.
// The migration is additive and idempotent. This suite characterizes the SQL
// and Prisma model without requiring a live database.
//
// Acceptance criteria enforced here (see
// specs/non-physical-products-mvp/tasks.md §TASK-003,
// specs/non-physical-products-mvp/migration.md §2 Migration C,
// specs/inventori-product-inventory-master-plan/migration-order.md Migration 3):
//   * InvoiceItemKind enum PHYSICAL_GOOD/SERVICE/ENTITLEMENT.
//   * invoice_items table with the approved columns and snapshot fields.
//   * Unique [invoice_id, order_item_id] constraint for idempotency.
//   * Company scope with FK to companies(id).
//   * Backfill for order-derived invoices produces one line per OrderItem.
//   * Backfill for manual invoices produces one fallback SERVICE line
//     "Factura histórica <number>", quantity 1, unit_price = amount.
//   * Backfill re-run does not duplicate rows.
//   * Formula matches billing-trigger.service.calculateInvoiceAmount at the
//     line level (quantity*unit_price - total_discount, clamped at 0).

const MIGRATION_FILE = path.join(
  __dirname,
  '../prisma/migrations/20261022000000_add_invoice_items_foundation/migration.sql',
);
const SCHEMA_FILE = path.join(__dirname, '../prisma/schema.prisma');

function readSql() {
  return fs.readFileSync(MIGRATION_FILE, 'utf8');
}
function readSchema() {
  return fs.readFileSync(SCHEMA_FILE, 'utf8');
}

test('InvoiceItemKind enum contains the three approved values', () => {
  const sql = readSql();
  assert.match(sql, /CREATE TYPE "InvoiceItemKind" AS ENUM/);
  for (const value of ['PHYSICAL_GOOD', 'SERVICE', 'ENTITLEMENT']) {
    assert.ok(sql.includes(`'${value}'`), `enum must include ${value}`);
  }

  const schema = readSchema();
  const enumBlock = schema.match(/enum\s+InvoiceItemKind\s*{([^}]*)}/);
  assert.ok(enumBlock, 'Prisma enum InvoiceItemKind must exist');
  const values = enumBlock[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'));
  assert.deepEqual(values, ['PHYSICAL_GOOD', 'SERVICE', 'ENTITLEMENT']);
});

test('invoice_items table has every approved column with the correct types', () => {
  const sql = readSql();
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "invoice_items"/);

  const requiredColumns = [
    { name: '"id"', shape: /"id"\s+BIGSERIAL\s+PRIMARY KEY/ },
    { name: '"invoice_id"', shape: /"invoice_id"\s+BIGINT\s+NOT NULL/ },
    { name: '"order_item_id"', shape: /"order_item_id"\s+BIGINT\s+NULL/ },
    { name: '"product_id"', shape: /"product_id"\s+BIGINT\s+NULL/ },
    { name: '"company_id"', shape: /"company_id"\s+BIGINT\s+NOT NULL/ },
    { name: '"line_kind"', shape: /"line_kind"\s+"InvoiceItemKind"\s+NOT NULL/ },
    { name: '"description_snapshot"', shape: /"description_snapshot"\s+TEXT\s+NOT NULL/ },
    { name: '"product_code_snapshot"', shape: /"product_code_snapshot"\s+TEXT\s+NULL/ },
    { name: '"quantity"', shape: /"quantity"\s+DECIMAL\(14, 3\)\s+NOT NULL/ },
    { name: '"unit_price"', shape: /"unit_price"\s+DECIMAL\(14, 2\)\s+NOT NULL/ },
    { name: '"discount_percent"', shape: /"discount_percent"\s+DECIMAL\(8, 2\)/ },
    { name: '"discount_amount"', shape: /"discount_amount"\s+DECIMAL\(14, 2\)/ },
    { name: '"tax_category_snapshot"', shape: /"tax_category_snapshot"\s+TEXT\s+NULL/ },
    { name: '"tax_rate_snapshot"', shape: /"tax_rate_snapshot"\s+DECIMAL\(5, 2\)\s+NULL/ },
    { name: '"subtotal"', shape: /"subtotal"\s+DECIMAL\(14, 2\)\s+NOT NULL/ },
    { name: '"tax"', shape: /"tax"\s+DECIMAL\(14, 2\)/ },
    { name: '"total"', shape: /"total"\s+DECIMAL\(14, 2\)\s+NOT NULL/ },
    { name: '"created_at"', shape: /"created_at"\s+TIMESTAMP\(3\)/ },
  ];
  for (const col of requiredColumns) {
    assert.match(sql, col.shape, `column ${col.name} must be declared`);
  }
});

test('invoice_items enforces tenant scope via company_id FK to companies', () => {
  const sql = readSql();
  assert.match(
    sql,
    /invoice_items_company_id_fkey[\s\S]*REFERENCES "companies"\s*\("id"\)/,
    'company FK must exist',
  );
  assert.match(
    sql,
    /invoice_items_invoice_id_fkey[\s\S]*REFERENCES "invoices"\s*\("id"\)[\s\S]*ON DELETE CASCADE/,
    'invoice FK must cascade on delete',
  );
});

test('invoice_items unique [invoice_id, order_item_id] constraint is present', () => {
  const sql = readSql();
  assert.match(
    sql,
    /invoice_items_invoice_order_item_unique[\s\S]*UNIQUE\s*\("invoice_id",\s*"order_item_id"\)/,
    'unique constraint powering idempotent backfill must exist',
  );
});

test('invoice_items has the approved indexes', () => {
  const sql = readSql();
  assert.match(
    sql,
    /CREATE INDEX IF NOT EXISTS "invoice_items_company_id_invoice_id_idx"/,
  );
  assert.match(sql, /CREATE INDEX IF NOT EXISTS "invoice_items_product_id_idx"/);
});

test('order-derived invoices are backfilled with one InvoiceItem per OrderItem', () => {
  const sql = readSql();
  // The order-derived INSERT joins invoices → clients → order_items → products
  // and filters on invoices.order_id IS NOT NULL.
  assert.match(sql, /FROM "invoices" inv[\s\S]*JOIN "order_items"\s+oi/);
  assert.match(sql, /WHERE inv\."order_id" IS NOT NULL/);
  assert.match(
    sql,
    /ON CONFLICT ON CONSTRAINT "invoice_items_invoice_order_item_unique" DO NOTHING/,
    'backfill must be idempotent via the invoice_items unique constraint',
  );
});

test('order-derived backfill uses the calculateInvoiceAmount line-level formula (quantity * unit_price - total_discount, clamped)', () => {
  const sql = readSql();
  assert.match(
    sql,
    /GREATEST\(\s*0\s*,\s*\(oi\."quantity"\s*\*\s*oi\."unit_price"\)\s*-\s*COALESCE\(oi\."total_discount",\s*0\)\s*\)/,
    'subtotal formula must mirror calculateInvoiceAmount at the line level',
  );
});

test('order-derived backfill snapshots product code/name and tax config at insert time', () => {
  const sql = readSql();
  assert.match(sql, /COALESCE\(p\."name", 'Producto'\)/);
  assert.match(sql, /p\."code"/);
  assert.match(sql, /p\."tax_category"/);
  assert.match(sql, /p\."tax_rate"/);
});

test('manual/legacy invoices without orders receive a single fallback SERVICE line', () => {
  const sql = readSql();
  // A block that inserts one SERVICE line with description "Factura histórica <number>"
  assert.match(
    sql,
    /'SERVICE'::"InvoiceItemKind"[\s\S]*'Factura histórica '\s*\|\|\s*inv\."number"/,
  );
  assert.match(sql, /WHERE inv\."order_id" IS NULL/);
  assert.match(
    sql,
    /NOT EXISTS \(\s*SELECT 1 FROM "invoice_items" ii WHERE ii\."invoice_id" = inv\."id"\s*\)/,
    'fallback insert must guard against duplicates (NULL order_item_id defeats unique constraint)',
  );
});

test('manual/legacy backfill uses invoice.amount as unit_price and total', () => {
  const sql = readSql();
  const manualBlock = sql.slice(sql.indexOf("'SERVICE'::\"InvoiceItemKind\""));
  assert.match(manualBlock, /inv\."amount"/);
});

test('backfill never invents cross-company InvoiceItems', () => {
  const sql = readSql();
  // Both backfill INSERTs derive company_id from clients.company_id (the
  // invoice's own client). No literal company_id is injected.
  assert.match(sql, /c\."company_id"/);
  assert.doesNotMatch(sql, /"company_id"\s+INTEGER\s+DEFAULT/i);
});

test('Prisma InvoiceItem model exists with tenant scope and unique constraint', () => {
  const schema = readSchema();
  const modelMatch = schema.match(/model\s+InvoiceItem\s*{([\s\S]*?)\n}/);
  assert.ok(modelMatch, 'Prisma model InvoiceItem must exist');
  const body = modelMatch[1];
  assert.match(body, /companyId\s+BigInt/);
  assert.match(body, /invoiceId\s+BigInt/);
  assert.match(body, /orderItemId\s+BigInt\?/);
  assert.match(body, /productId\s+BigInt\?/);
  assert.match(body, /lineKind\s+InvoiceItemKind/);
  assert.match(body, /descriptionSnapshot\s+String/);
  assert.match(body, /quantity\s+Decimal/);
  assert.match(body, /unitPrice\s+Decimal/);
  assert.match(body, /subtotal\s+Decimal/);
  assert.match(body, /total\s+Decimal/);
  assert.match(
    body,
    /@@unique\(\[invoiceId, orderItemId\]/,
    'unique idempotency constraint must be modeled in Prisma',
  );
  assert.match(body, /@@map\("invoice_items"\)/);
});

test('Company / Invoice / Product / OrderItem gained invoiceItems back-relations', () => {
  const schema = readSchema();
  const companyBlock = schema.match(/model\s+Company\s*{([\s\S]*?)\n}/)[1];
  assert.match(companyBlock, /invoiceItems\s+InvoiceItem\[\]/);

  const invoiceBlock = schema.match(/model\s+Invoice\s*{([\s\S]*?)\n}/)[1];
  assert.match(invoiceBlock, /items\s+InvoiceItem\[\]/);

  const productBlock = schema.match(/model\s+Product\s*{([\s\S]*?)\n}/)[1];
  assert.match(productBlock, /invoiceItems\s+InvoiceItem\[\]/);

  const orderItemBlock = schema.match(/model\s+OrderItem\s*{([\s\S]*?)\n}/)[1];
  assert.match(orderItemBlock, /invoiceItems\s+InvoiceItem\[\]/);
});

test('MASTER-003 migration is fully idempotent (guards on enum, table, indexes, unique, FKs, INSERTs)', () => {
  const sql = readSql();
  assert.match(sql, /IF NOT EXISTS \(SELECT 1 FROM pg_type WHERE typname = 'InvoiceItemKind'\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "invoice_items"/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS "invoice_items_company_id_invoice_id_idx"/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS "invoice_items_product_id_idx"/);
  const fkGuardCount = (sql.match(/IF NOT EXISTS \(\s*SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_/g) || []).length;
  assert.equal(fkGuardCount, 5, 'each FK + the unique constraint must be guarded (invoice, order_item, product, company, unique)');
  assert.match(sql, /ON CONFLICT ON CONSTRAINT "invoice_items_invoice_order_item_unique" DO NOTHING/);
});

test('MASTER-003 migration does not modify historical invoices, payments, orders or products', () => {
  const sql = readSql();
  // Only INSERTs into invoice_items are permitted. No UPDATE / DELETE on
  // existing tables.
  assert.doesNotMatch(sql, /UPDATE\s+"?invoices"?/i);
  assert.doesNotMatch(sql, /UPDATE\s+"?payments"?/i);
  assert.doesNotMatch(sql, /UPDATE\s+"?orders"?/i);
  assert.doesNotMatch(sql, /UPDATE\s+"?order_items"?/i);
  assert.doesNotMatch(sql, /UPDATE\s+"?products"?/i);
  assert.doesNotMatch(sql, /DELETE\s+FROM/i);
});
