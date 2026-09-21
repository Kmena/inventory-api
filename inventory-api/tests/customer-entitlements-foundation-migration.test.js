const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// MASTER-007 / NPP-TASK-004 (foundation) + NPP-TASK-014 (permission
// registration) — CustomerEntitlement commercial lifecycle skeleton.
//
// Wave 1 scope (per specs/inventori-product-inventory-master-plan/tasks.md
// §MASTER-007 and execution-waves.md Wave 1):
//   * Prisma model + migration are additive and idempotent.
//   * No historical order/invoice is retroactively promoted to an
//     entitlement (no backfill INSERT into customer_entitlements).
//   * Manual activation permission stays SEPARATE from entitlements.manage
//     (DEC-004).
//   * Access policies map to permission codes as defined in
//     specs/non-physical-products-mvp/security.md §1.
//
// This suite characterizes the migration SQL, Prisma schema and
// access-policy / governance registrations without requiring a live DB.

const MIGRATION_FILE = path.join(
  __dirname,
  '../prisma/migrations/20261026000000_add_customer_entitlements/migration.sql',
);
const PERMS_MIGRATION_FILE = path.join(
  __dirname,
  '../prisma/migrations/20261027000000_add_entitlement_permissions/migration.sql',
);
const SCHEMA_FILE = path.join(__dirname, '../prisma/schema.prisma');
const ACCESS_POLICY_REGISTRY = path.join(
  __dirname,
  '../src/security/access-policy-registry.js',
);
const GOVERNANCE_CONFIG = path.join(
  __dirname,
  '../src/security/permission-governance.config.js',
);

const read = (file) => fs.readFileSync(file, 'utf8');

// ---------------------------------------------------------------------------
// CustomerEntitlementStatus enum
// ---------------------------------------------------------------------------

test('CustomerEntitlementStatus enum has the approved ACTIVE / CANCELLED values', () => {
  const sql = read(MIGRATION_FILE);
  assert.match(
    sql,
    /CREATE TYPE "CustomerEntitlementStatus" AS ENUM \('ACTIVE',\s*'CANCELLED'\)/,
  );
  const schema = read(SCHEMA_FILE);
  const enumBlock = schema.match(
    /enum\s+CustomerEntitlementStatus\s*{([^}]*)}/,
  );
  assert.ok(enumBlock, 'Prisma enum must exist');
  const values = enumBlock[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'));
  assert.deepEqual(values, ['ACTIVE', 'CANCELLED']);
});

// ---------------------------------------------------------------------------
// customer_entitlements table + FKs + unique + indexes
// ---------------------------------------------------------------------------

test('customer_entitlements table exposes every approved column with the correct types', () => {
  const sql = read(MIGRATION_FILE);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "customer_entitlements"/);
  const required = [
    /"id"\s+BIGSERIAL\s+PRIMARY KEY/,
    /"company_id"\s+BIGINT\s+NOT NULL/,
    /"client_id"\s+BIGINT\s+NOT NULL/,
    /"product_id"\s+BIGINT\s+NOT NULL/,
    /"source_order_id"\s+BIGINT\s+NULL/,
    /"source_order_item_id"\s+BIGINT\s+NULL/,
    /"source_invoice_id"\s+BIGINT\s+NULL/,
    /"source_invoice_item_id"\s+BIGINT\s+NULL/,
    /"previous_entitlement_id"\s+BIGINT\s+NULL/,
    /"status"\s+"CustomerEntitlementStatus"\s+NOT NULL DEFAULT 'ACTIVE'/,
    /"entitlement_kind"\s+"ProductEntitlementKind"\s+NOT NULL/,
    /"start_date"\s+TIMESTAMP\(3\)\s+NOT NULL/,
    /"end_date"\s+TIMESTAMP\(3\)\s+NULL/,
    /"activated_at"\s+TIMESTAMP\(3\)\s+NULL/,
    /"activated_by_user_id"\s+BIGINT\s+NULL/,
    /"activation_source"\s+TEXT\s+NOT NULL/,
    /"manual_activation_reason"\s+TEXT\s+NULL/,
    /"cancelled_at"\s+TIMESTAMP\(3\)\s+NULL/,
    /"cancelled_by_user_id"\s+BIGINT\s+NULL/,
    /"cancellation_reason"\s+TEXT\s+NULL/,
    /"price_snapshot"\s+DECIMAL\(14, 2\)\s+NOT NULL/,
    /"currency_snapshot"\s+TEXT\s+NOT NULL DEFAULT 'CRC'/,
    /"validity_count_snapshot"\s+INTEGER\s+NULL/,
    /"validity_unit_snapshot"\s+"ProductValidityUnit"\s+NULL/,
    /"billing_interval_snapshot"\s+"ProductBillingInterval"\s+NULL/,
    /"metadata"\s+JSONB\s+NULL/,
    /"created_at"\s+TIMESTAMP\(3\)/,
    /"updated_at"\s+TIMESTAMP\(3\)/,
  ];
  for (const shape of required) assert.match(sql, shape);
});

test('customer_entitlements FKs enforce ownership and safe deletion semantics', () => {
  const sql = read(MIGRATION_FILE);
  // Owners cascade on delete.
  assert.match(sql, /customer_entitlements_company_id_fkey[\s\S]*ON DELETE CASCADE/);
  assert.match(sql, /customer_entitlements_client_id_fkey[\s\S]*ON DELETE CASCADE/);
  // Product deletion must be blocked while an entitlement exists.
  assert.match(sql, /customer_entitlements_product_id_fkey[\s\S]*ON DELETE RESTRICT/);
  // Optional source references decouple on delete.
  assert.match(sql, /customer_entitlements_source_order_id_fkey[\s\S]*ON DELETE SET NULL/);
  assert.match(sql, /customer_entitlements_source_order_item_id_fkey[\s\S]*ON DELETE SET NULL/);
  assert.match(sql, /customer_entitlements_source_invoice_id_fkey[\s\S]*ON DELETE SET NULL/);
  assert.match(sql, /customer_entitlements_source_invoice_item_id_fkey[\s\S]*ON DELETE SET NULL/);
  // Renewal chain uses SET NULL.
  assert.match(sql, /customer_entitlements_previous_entitlement_id_fkey[\s\S]*ON DELETE SET NULL/);
});

test('customer_entitlements enforces idempotency uniques on order-item and invoice-item sources', () => {
  const sql = read(MIGRATION_FILE);
  assert.match(
    sql,
    /customer_entitlements_source_order_item_unique[\s\S]*UNIQUE\s*\("company_id",\s*"source_order_item_id"\)/,
  );
  assert.match(
    sql,
    /customer_entitlements_source_invoice_item_unique[\s\S]*UNIQUE\s*\("company_id",\s*"source_invoice_item_id"\)/,
  );
});

test('customer_entitlements indexes cover list-by-client, list-by-product, expiration and renewal queries', () => {
  const sql = read(MIGRATION_FILE);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS "customer_entitlements_company_client_status_idx"/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS "customer_entitlements_company_product_idx"/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS "customer_entitlements_company_end_date_idx"/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS "customer_entitlements_previous_entitlement_id_idx"/);
});

test('customer_entitlements migration does NOT backfill historical rows', () => {
  const sql = read(MIGRATION_FILE);
  assert.doesNotMatch(sql, /INSERT INTO "customer_entitlements"/i);
});

test('customer_entitlements migration does NOT modify orders, invoices or invoice_items', () => {
  const sql = read(MIGRATION_FILE);
  assert.doesNotMatch(sql, /UPDATE\s+"?orders"?/i);
  assert.doesNotMatch(sql, /UPDATE\s+"?invoices"?/i);
  assert.doesNotMatch(sql, /UPDATE\s+"?invoice_items"?/i);
  assert.doesNotMatch(sql, /UPDATE\s+"?clients"?/i);
  assert.doesNotMatch(sql, /UPDATE\s+"?products"?/i);
});

// ---------------------------------------------------------------------------
// Prisma model
// ---------------------------------------------------------------------------

test('Prisma CustomerEntitlement model matches the approved data-model.md §3 shape', () => {
  const schema = read(SCHEMA_FILE);
  const modelMatch = schema.match(/model\s+CustomerEntitlement\s*{([\s\S]*?)\n}/);
  assert.ok(modelMatch, 'CustomerEntitlement model must exist');
  const body = modelMatch[1];

  assert.match(body, /companyId\s+BigInt/);
  assert.match(body, /clientId\s+BigInt/);
  assert.match(body, /productId\s+BigInt/);
  assert.match(body, /sourceOrderId\s+BigInt\?/);
  assert.match(body, /sourceOrderItemId\s+BigInt\?/);
  assert.match(body, /sourceInvoiceId\s+BigInt\?/);
  assert.match(body, /sourceInvoiceItemId\s+BigInt\?/);
  assert.match(body, /previousEntitlementId\s+BigInt\?/);
  assert.match(body, /status\s+CustomerEntitlementStatus\s+@default\(ACTIVE\)/);
  assert.match(body, /entitlementKind\s+ProductEntitlementKind/);
  assert.match(body, /activationSource\s+String/);
  assert.match(body, /priceSnapshot\s+Decimal/);
  assert.match(body, /currencySnapshot\s+String\s+@default\("CRC"\)/);

  // Renewal self-relation.
  assert.match(
    body,
    /previousEntitlement\s+CustomerEntitlement\?\s+@relation\("entitlement_renewal"/,
  );
  assert.match(body, /renewals\s+CustomerEntitlement\[\]\s+@relation\("entitlement_renewal"\)/);

  // Idempotency uniques + indexes.
  assert.match(body, /@@unique\(\[companyId, sourceOrderItemId\]/);
  assert.match(body, /@@unique\(\[companyId, sourceInvoiceItemId\]/);
  assert.match(body, /@@index\(\[companyId, clientId, status\]\)/);
  assert.match(body, /@@index\(\[companyId, productId\]\)/);
  assert.match(body, /@@index\(\[companyId, endDate\]\)/);
  assert.match(body, /@@index\(\[previousEntitlementId\]\)/);
  assert.match(body, /@@map\("customer_entitlements"\)/);
});

test('Company / Client / Product / Order / OrderItem / Invoice / InvoiceItem gained entitlement back-relations', () => {
  const schema = read(SCHEMA_FILE);

  const grab = (name) => schema.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`))[1];

  assert.match(grab('Company'), /customerEntitlements\s+CustomerEntitlement\[\]/);
  assert.match(grab('Client'), /entitlements\s+CustomerEntitlement\[\]/);
  assert.match(grab('Product'), /entitlements\s+CustomerEntitlement\[\]/);
  assert.match(grab('Order'), /entitlements\s+CustomerEntitlement\[\]/);
  assert.match(grab('OrderItem'), /entitlements\s+CustomerEntitlement\[\]/);
  assert.match(grab('Invoice'), /entitlements\s+CustomerEntitlement\[\]/);
  assert.match(grab('InvoiceItem'), /entitlements\s+CustomerEntitlement\[\]/);
});

// ---------------------------------------------------------------------------
// Permission migration
// ---------------------------------------------------------------------------

test('Entitlement permissions migration registers the three approved codes', () => {
  const sql = read(PERMS_MIGRATION_FILE);
  for (const code of ['entitlements.view', 'entitlements.manage', 'entitlements.activate.manual']) {
    assert.match(
      sql,
      new RegExp(
        `INSERT INTO "permissions"[\\s\\S]*'${code.replace('.', '\\.')}'[\\s\\S]*NOT EXISTS[\\s\\S]*WHERE "code" = '${code.replace('.', '\\.')}'`,
      ),
      `permission migration must insert ${code} idempotently`,
    );
  }
});

test('Entitlement permissions migration does NOT grant permissions to any role', () => {
  const sql = read(PERMS_MIGRATION_FILE);
  // Role grants (role_permissions inserts) belong to Wave 2 rollout, not the
  // Wave 1 foundation.
  assert.doesNotMatch(sql, /INSERT INTO "role_permissions"/i);
});

// ---------------------------------------------------------------------------
// Access policy registry + governance config
// ---------------------------------------------------------------------------

test("Access policy 'entitlements.view' accepts both view and manage permissions", () => {
  const src = read(ACCESS_POLICY_REGISTRY);
  const block = src.match(
    /'entitlements\.view':\s*{[\s\S]*?permissions:\s*\[([^\]]+)\]/,
  );
  assert.ok(block, "'entitlements.view' policy must be registered");
  assert.match(block[1], /entitlements\.view/);
  assert.match(block[1], /entitlements\.manage/);
});

test("Access policy 'entitlements.manage' requires the manage permission only", () => {
  const src = read(ACCESS_POLICY_REGISTRY);
  const block = src.match(
    /'entitlements\.manage':\s*{[\s\S]*?permissions:\s*\[([^\]]+)\]/,
  );
  assert.ok(block, "'entitlements.manage' policy must be registered");
  const perms = block[1];
  assert.match(perms, /entitlements\.manage/);
  // DEC-004: 'entitlements.manage' policy must NOT accept the manual
  // activation permission as a substitute.
  assert.doesNotMatch(perms, /entitlements\.activate\.manual/);
});

test("DEC-004: 'entitlements.activate.manual' policy is separate and requires its own permission", () => {
  const src = read(ACCESS_POLICY_REGISTRY);
  const block = src.match(
    /'entitlements\.activate\.manual':\s*{[\s\S]*?permissions:\s*\[([^\]]+)\]/,
  );
  assert.ok(block, "'entitlements.activate.manual' policy must be registered");
  const perms = block[1];
  assert.match(perms, /entitlements\.activate\.manual/);
  // Manual activation MUST NOT be satisfied by holding entitlements.manage
  // alone. This is the load-bearing separation from DEC-004.
  assert.doesNotMatch(perms, /'entitlements\.manage'/);
});

test('Governance config registers the three entitlement permissions with correct sensitivity + justification flags', () => {
  const src = read(GOVERNANCE_CONFIG);

  const viewEntry = src.match(
    /code:\s*'entitlements\.view'[\s\S]*?}\)/,
  );
  assert.ok(viewEntry, 'entitlements.view must be registered in governance config');
  assert.match(viewEntry[0], /category:\s*'entitlements'/);
  assert.match(viewEntry[0], /sensitivity:\s*'operational'/);

  const manageEntry = src.match(
    /code:\s*'entitlements\.manage'[\s\S]*?}\)/,
  );
  assert.ok(manageEntry, 'entitlements.manage must be registered in governance config');
  assert.match(manageEntry[0], /sensitivity:\s*'sensitive'/);

  const manualEntry = src.match(
    /code:\s*'entitlements\.activate\.manual'[\s\S]*?}\)/,
  );
  assert.ok(manualEntry, 'entitlements.activate.manual must be registered in governance config');
  assert.match(manualEntry[0], /sensitivity:\s*'sensitive'/);
  assert.match(
    manualEntry[0],
    /requiresJustification:\s*true/,
    'manual activation must require justification (sensitive commercial state change)',
  );
});
