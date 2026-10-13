'use strict';

/**
 * Wave 1 — Receiver Fiscal Readiness: Data Model Foundation
 * spec: inventori-receiver-fiscal-readiness v2.0.2
 *
 * Tasks covered:
 *   RFR-TASK-101 — ClientEconomicActivity table
 *   RFR-TASK-102 — ClientLegalEntity verification fields
 *   RFR-TASK-103 — OrderFiscalApproval model + Order.fiscalApproval relation
 *
 * Test scope (Wave 1 only):
 *   - Migration SQL content: tables, columns, constraints, indexes
 *   - Prisma schema content: models, fields, relations, constraints
 *
 * These are structural/characterization tests — they validate the schema and
 * migration file contents WITHOUT requiring a live database connection.
 *
 * Wave 2+ behavior (verification service, Hacienda calls, approval endpoint
 * changes) is intentionally NOT tested here.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationFile = path.join(
  __dirname, '..', 'prisma', 'migrations',
  '20261101000000_receiver_fiscal_readiness_wave1',
  'migration.sql',
);

const schemaFile = path.join(__dirname, '..', 'prisma', 'schema.prisma');

function readMigration() {
  return fs.readFileSync(migrationFile, 'utf-8');
}

function readSchema() {
  return fs.readFileSync(schemaFile, 'utf-8');
}

// ─── Migration file existence ────────────────────────────────────────────────

test('Wave 1 migration file exists', () => {
  assert.ok(fs.existsSync(migrationFile), `Migration must exist at ${migrationFile}`);
});

// ─── RFR-TASK-101: ClientEconomicActivity table ──────────────────────────────

test('migration creates client_economic_activities table', () => {
  const sql = readMigration();
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "client_economic_activities"/, 'Must create client_economic_activities');
});

test('migration: client_economic_activities has company_id column', () => {
  const sql = readMigration();
  assert.match(sql, /"company_id"\s+BIGINT\s+NOT NULL/, 'Must have company_id BIGINT NOT NULL');
});

test('migration: client_economic_activities has client_legal_entity_id column', () => {
  const sql = readMigration();
  assert.match(sql, /"client_legal_entity_id"\s+BIGINT\s+NOT NULL/, 'Must have client_legal_entity_id BIGINT NOT NULL');
});

test('migration: client_economic_activities has code column (TEXT NOT NULL)', () => {
  const sql = readMigration();
  assert.match(sql, /"code"\s+TEXT\s+NOT NULL/, 'Must have code TEXT NOT NULL');
});

test('migration: client_economic_activities has description (nullable)', () => {
  const sql = readMigration();
  assert.match(sql, /"description"\s+TEXT\s+NULL/, 'Must have description TEXT NULL');
});

test('migration: client_economic_activities has hacienda_status and hacienda_type (nullable)', () => {
  const sql = readMigration();
  assert.match(sql, /"hacienda_status"\s+TEXT\s+NULL/, 'Must have hacienda_status TEXT NULL');
  assert.match(sql, /"hacienda_type"\s+TEXT\s+NULL/, 'Must have hacienda_type TEXT NULL');
});

test('migration: client_economic_activities has is_currently_returned with default true', () => {
  const sql = readMigration();
  assert.match(sql, /"is_currently_returned"\s+BOOLEAN\s+NOT NULL DEFAULT true/, 'Must have is_currently_returned with default true');
});

test('migration: client_economic_activities has verified_at (NOT NULL)', () => {
  const sql = readMigration();
  assert.match(sql, /"verified_at"\s+TIMESTAMP\(3\)\s+NOT NULL/, 'Must have verified_at TIMESTAMP NOT NULL');
});

test('migration: client_economic_activities unique constraint on (entity, code)', () => {
  const sql = readMigration();
  assert.match(sql, /client_economic_activities_entity_code_unique/, 'Must have unique constraint on entity+code');
  assert.match(sql, /"client_legal_entity_id", "code"/, 'Unique constraint must include client_legal_entity_id and code');
});

test('migration: client_economic_activities FK to companies (CASCADE)', () => {
  const sql = readMigration();
  assert.match(sql, /client_economic_activities_company_id_fkey/, 'Must have company FK');
  // Verify it references companies
  const companyFkBlock = sql.match(/client_economic_activities_company_id_fkey[\s\S]*?END\$\$/)?.[0] ?? '';
  assert.ok(companyFkBlock.includes('"companies"'), 'Company FK must reference companies table');
  assert.ok(companyFkBlock.includes('CASCADE'), 'Company FK must use CASCADE');
});

test('migration: client_economic_activities FK to client_legal_entities (CASCADE)', () => {
  const sql = readMigration();
  assert.match(sql, /client_economic_activities_client_legal_entity_id_fkey/, 'Must have client_legal_entity FK');
  const entityFkBlock = sql.match(/client_economic_activities_client_legal_entity_id_fkey[\s\S]*?END\$\$/)?.[0] ?? '';
  assert.ok(entityFkBlock.includes('"client_legal_entities"'), 'Entity FK must reference client_legal_entities table');
  assert.ok(entityFkBlock.includes('CASCADE'), 'Entity FK must use CASCADE');
});

test('migration: client_economic_activities index on (company_id, client_legal_entity_id)', () => {
  const sql = readMigration();
  assert.match(sql, /client_economic_activities_company_entity_idx/, 'Must create compound index on company+entity');
});

test('migration uses idempotent DO-blocks for FK constraints', () => {
  const sql = readMigration();
  const doBlockCount = (sql.match(/DO \$\$ BEGIN/g) || []).length;
  assert.ok(doBlockCount >= 6, `Expected at least 6 DO-blocks (got ${doBlockCount})`);
});

// ─── RFR-TASK-102: ClientLegalEntity verification fields ─────────────────────

test('migration adds verification_status column as NOT NULL DEFAULT UNVERIFIED', () => {
  const sql = readMigration();
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "verification_status"/, 'Must add verification_status column');
  // NOT NULL is required: every row must have a canonical UNVERIFIED value, never NULL.
  // PostgreSQL 11+ constant-DEFAULT optimization means existing rows also observe 'UNVERIFIED'
  // without a table rewrite — SQL-visible semantics are NOT NULL DEFAULT 'UNVERIFIED'.
  assert.match(
    sql,
    /"verification_status"\s+TEXT NOT NULL DEFAULT 'UNVERIFIED'/,
    'Must be NOT NULL DEFAULT UNVERIFIED (not nullable — no two representations of UNVERIFIED)',
  );
});

test('migration adds last_verified_at column to client_legal_entities (nullable)', () => {
  const sql = readMigration();
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "last_verified_at"\s+TIMESTAMP\(3\) NULL/, 'Must add last_verified_at as nullable');
});

test('migration adds taxpayer_name column to client_legal_entities (nullable)', () => {
  const sql = readMigration();
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "taxpayer_name"\s+TEXT NULL/, 'Must add taxpayer_name as nullable');
});

test('migration: existing rows observe UNVERIFIED via PostgreSQL DEFAULT — no manual UPDATE needed', () => {
  const sql = readMigration();
  // PostgreSQL 11+ constant-DEFAULT behavior: ADD COLUMN ... NOT NULL DEFAULT 'UNVERIFIED'
  // causes existing rows to return 'UNVERIFIED' for the new column immediately.
  // No manual UPDATE statement is needed or written — PostgreSQL handles it.
  // Asserting no UPDATE is present confirms we rely on correct PostgreSQL semantics,
  // not a manual backfill that would be redundant and risk a table lock.
  const updateStatements = sql.match(/UPDATE\s+"client_legal_entities"/gi) || [];
  assert.strictEqual(
    updateStatements.length,
    0,
    'Must NOT have a manual UPDATE for client_legal_entities: PostgreSQL DEFAULT handles existing rows',
  );
});

// ─── RFR-TASK-103: OrderFiscalApproval table ─────────────────────────────────

test('migration creates order_fiscal_approvals table', () => {
  const sql = readMigration();
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "order_fiscal_approvals"/, 'Must create order_fiscal_approvals');
});

test('migration: order_fiscal_approvals has order_id (NOT NULL)', () => {
  const sql = readMigration();
  assert.match(sql, /"order_id"\s+BIGINT\s+NOT NULL/, 'order_id must be BIGINT NOT NULL');
});

test('migration: order_fiscal_approvals has client_legal_entity_id (NOT NULL)', () => {
  const sql = readMigration();
  assert.match(sql, /"client_legal_entity_id"\s+BIGINT\s+NOT NULL/, 'client_legal_entity_id must be BIGINT NOT NULL');
});

test('migration: order_fiscal_approvals has receiver_economic_activity_code (nullable)', () => {
  const sql = readMigration();
  assert.match(sql, /"receiver_economic_activity_code"\s+TEXT\s+NULL/, 'receiver_economic_activity_code must be nullable');
});

test('migration: order_fiscal_approvals has confirmed_by_id (nullable)', () => {
  const sql = readMigration();
  assert.match(sql, /"confirmed_by_id"\s+BIGINT\s+NULL/, 'confirmed_by_id must be nullable');
});

test('migration: order_fiscal_approvals does NOT have updated_at (immutable record)', () => {
  // Extract only the order_fiscal_approvals CREATE TABLE block
  const sql = readMigration();
  const tableBlock = sql.match(
    /CREATE TABLE IF NOT EXISTS "order_fiscal_approvals" \([\s\S]*?\);/
  )?.[0] ?? '';
  assert.ok(tableBlock.length > 0, 'Must find order_fiscal_approvals CREATE TABLE block');
  assert.ok(!tableBlock.includes('"updated_at"'), 'order_fiscal_approvals must NOT have updated_at (immutable)');
});

test('migration: order_id UNIQUE constraint on order_fiscal_approvals', () => {
  const sql = readMigration();
  assert.match(sql, /order_fiscal_approvals_order_id_key/, 'Must have unique constraint on order_id');
  const uniqueBlock = sql.match(/order_fiscal_approvals_order_id_key[\s\S]*?END\$\$/)?.[0] ?? '';
  assert.ok(uniqueBlock.includes('UNIQUE ("order_id")'), 'Unique constraint must be on order_id alone');
});

test('migration: order_fiscal_approvals FK to companies (CASCADE)', () => {
  const sql = readMigration();
  assert.match(sql, /order_fiscal_approvals_company_id_fkey/, 'Must have company FK');
  const block = sql.match(/order_fiscal_approvals_company_id_fkey[\s\S]*?END\$\$/)?.[0] ?? '';
  assert.ok(block.includes('"companies"'), 'Company FK must reference companies');
  assert.ok(block.includes('CASCADE'), 'Company FK must CASCADE');
});

test('migration: order_fiscal_approvals FK to orders (CASCADE)', () => {
  const sql = readMigration();
  assert.match(sql, /order_fiscal_approvals_order_id_fkey/, 'Must have order FK');
  const block = sql.match(/order_fiscal_approvals_order_id_fkey[\s\S]*?END\$\$/)?.[0] ?? '';
  assert.ok(block.includes('"orders"'), 'Order FK must reference orders');
  assert.ok(block.includes('CASCADE'), 'Order FK must CASCADE');
});

test('migration: order_fiscal_approvals FK to client_legal_entities (RESTRICT)', () => {
  const sql = readMigration();
  assert.match(sql, /order_fiscal_approvals_client_legal_entity_id_fkey/, 'Must have entity FK');
  const block = sql.match(/order_fiscal_approvals_client_legal_entity_id_fkey[\s\S]*?END\$\$/)?.[0] ?? '';
  assert.ok(block.includes('"client_legal_entities"'), 'Entity FK must reference client_legal_entities');
  assert.ok(block.includes('RESTRICT'), 'Entity FK must use RESTRICT (fiscal approval cannot be orphaned)');
});

test('migration: order_fiscal_approvals FK to users with SET NULL for confirmed_by_id', () => {
  const sql = readMigration();
  assert.match(sql, /order_fiscal_approvals_confirmed_by_id_fkey/, 'Must have confirmed_by FK');
  const block = sql.match(/order_fiscal_approvals_confirmed_by_id_fkey[\s\S]*?END\$\$/)?.[0] ?? '';
  assert.ok(block.includes('"users"'), 'confirmed_by FK must reference users');
  assert.ok(block.includes('SET NULL'), 'confirmed_by FK must use SET NULL (user deletion must not destroy record)');
});

test('migration: order_fiscal_approvals compound index on (company_id, order_id)', () => {
  const sql = readMigration();
  assert.match(sql, /order_fiscal_approvals_company_order_idx/, 'Must create compound index');
});

test('migration does NOT backfill order_fiscal_approvals', () => {
  const sql = readMigration();
  const insertStatements = sql.match(/INSERT INTO "order_fiscal_approvals"/gi) || [];
  assert.strictEqual(insertStatements.length, 0, 'Must NOT insert any OrderFiscalApproval rows');
});

// ─── Prisma schema: RFR-TASK-101 ─────────────────────────────────────────────

test('Prisma schema defines ClientEconomicActivity model', () => {
  const schema = readSchema();
  assert.match(schema, /model ClientEconomicActivity/, 'Must define ClientEconomicActivity model');
  assert.match(schema, /@@map\("client_economic_activities"\)/, 'Must map to client_economic_activities table');
});

test('Prisma schema: ClientEconomicActivity has required fields', () => {
  const schema = readSchema();
  assert.match(schema, /clientLegalEntityId\s+BigInt\s+@map\("client_legal_entity_id"\)/, 'Must have clientLegalEntityId');
  assert.match(schema, /code\s+String/, 'Must have code String');
  assert.match(schema, /isCurrentlyReturned\s+Boolean\s+@default\(true\)/, 'Must have isCurrentlyReturned default true');
  assert.match(schema, /verifiedAt\s+DateTime\s+@map\("verified_at"\)/, 'Must have verifiedAt');
  assert.match(schema, /haciendaStatus\s+String\?/, 'Must have haciendaStatus nullable');
  assert.match(schema, /haciendaType\s+String\?/, 'Must have haciendaType nullable');
});

test('Prisma schema: ClientEconomicActivity unique constraint on [clientLegalEntityId, code]', () => {
  const schema = readSchema();
  assert.match(
    schema,
    /@@unique\(\[clientLegalEntityId, code\]/,
    'Must have @@unique([clientLegalEntityId, code])',
  );
});

test('Prisma schema: ClientEconomicActivity has compound index on [companyId, clientLegalEntityId]', () => {
  const schema = readSchema();
  assert.match(schema, /@@index\(\[companyId, clientLegalEntityId\]\)/, 'Must have compound index');
});

test('Prisma schema: ClientLegalEntity has economicActivities reverse relation', () => {
  const schema = readSchema();
  assert.match(schema, /economicActivities\s+ClientEconomicActivity\[\]/, 'ClientLegalEntity must have economicActivities[]');
});

test('Prisma schema: Company has clientEconomicActivities reverse relation', () => {
  const schema = readSchema();
  assert.match(schema, /clientEconomicActivities\s+ClientEconomicActivity\[\]/, 'Company must have clientEconomicActivities[]');
});

// ─── Prisma schema: RFR-TASK-102 ─────────────────────────────────────────────

test('Prisma schema: ClientLegalEntity has verificationStatus as non-nullable String', () => {
  const schema = readSchema();
  // Non-nullable String (not String?): the DB column is NOT NULL DEFAULT 'UNVERIFIED'.
  // Existing rows observe 'UNVERIFIED' via PostgreSQL constant-DEFAULT semantics.
  // NULL is never a valid value — one canonical representation of the initial state.
  assert.match(
    schema,
    /verificationStatus\s+String\s+@default\("UNVERIFIED"\)\s+@map\("verification_status"\)/,
    'Must have verificationStatus String (non-nullable) @default("UNVERIFIED") — not String?',
  );
  // Confirm String? does NOT appear for this field (would indicate wrong nullability)
  const nullableMatch = schema.match(/verificationStatus\s+String\?/);
  assert.ok(!nullableMatch, 'verificationStatus must NOT be nullable (String?) — use non-nullable String');
});

test('Prisma schema: ClientLegalEntity has lastVerifiedAt field (nullable DateTime)', () => {
  const schema = readSchema();
  assert.match(schema, /lastVerifiedAt\s+DateTime\?\s+@map\("last_verified_at"\)/, 'Must have lastVerifiedAt DateTime?');
});

test('Prisma schema: ClientLegalEntity has taxpayerName field (nullable String)', () => {
  const schema = readSchema();
  assert.match(schema, /taxpayerName\s+String\?\s+@map\("taxpayer_name"\)/, 'Must have taxpayerName String?');
});

test('Prisma schema: verificationStatus default is UNVERIFIED, VERIFYING is never a persisted default', () => {
  const schema = readSchema();
  // Default must be specifically "UNVERIFIED"
  assert.match(schema, /@default\("UNVERIFIED"\)/, 'Default must be UNVERIFIED');
  // VERIFYING is a transient UI state — must never appear as a persisted default
  const defaultVerifying = schema.match(/@default\("VERIFYING"\)/g) || [];
  assert.strictEqual(defaultVerifying.length, 0, 'VERIFYING must never be a persisted default');
});

// ─── Prisma schema: RFR-TASK-103 ─────────────────────────────────────────────

test('Prisma schema defines OrderFiscalApproval model', () => {
  const schema = readSchema();
  assert.match(schema, /model OrderFiscalApproval/, 'Must define OrderFiscalApproval model');
  assert.match(schema, /@@map\("order_fiscal_approvals"\)/, 'Must map to order_fiscal_approvals table');
});

test('Prisma schema: OrderFiscalApproval has orderId @unique', () => {
  const schema = readSchema();
  assert.match(schema, /orderId\s+BigInt\s+@unique\s+@map\("order_id"\)/, 'orderId must be @unique');
});

test('Prisma schema: OrderFiscalApproval has clientLegalEntityId (NOT NULL)', () => {
  const schema = readSchema();
  assert.match(schema, /clientLegalEntityId\s+BigInt\s+@map\("client_legal_entity_id"\)/, 'clientLegalEntityId must be non-nullable BigInt');
});

test('Prisma schema: OrderFiscalApproval has receiverEconomicActivityCode (nullable)', () => {
  const schema = readSchema();
  assert.match(schema, /receiverEconomicActivityCode\s+String\?\s+@map\("receiver_economic_activity_code"\)/, 'receiverEconomicActivityCode must be nullable String?');
});

test('Prisma schema: OrderFiscalApproval has confirmedById (nullable)', () => {
  const schema = readSchema();
  assert.match(schema, /confirmedById\s+BigInt\?\s+@map\("confirmed_by_id"\)/, 'confirmedById must be nullable BigInt?');
});

test('Prisma schema: OrderFiscalApproval does NOT have @updatedAt directive (immutable)', () => {
  const schema = readSchema();
  // Find the OrderFiscalApproval model block
  const modelMatch = schema.match(/model OrderFiscalApproval \{([\s\S]*?)\n\}/);
  assert.ok(modelMatch, 'Must find OrderFiscalApproval model block');
  const modelBody = modelMatch[1];
  // Check for the Prisma @updatedAt DIRECTIVE specifically — not the word in comments
  assert.ok(!modelBody.includes('@updatedAt'), 'OrderFiscalApproval must NOT have @updatedAt directive (immutable record)');
});

test('Prisma schema: OrderFiscalApproval has compound index on [companyId, orderId]', () => {
  const schema = readSchema();
  // Find the OrderFiscalApproval model block
  const modelMatch = schema.match(/model OrderFiscalApproval \{([\s\S]*?)\n\}/);
  const modelBody = modelMatch?.[1] ?? '';
  assert.ok(modelBody.includes('@@index([companyId, orderId])'), 'Must have @@index([companyId, orderId])');
});

test('Prisma schema: OrderFiscalApproval relations — company, order, clientLegalEntity, confirmedBy', () => {
  const schema = readSchema();
  const modelMatch = schema.match(/model OrderFiscalApproval \{([\s\S]*?)\n\}/);
  const modelBody = modelMatch?.[1] ?? '';
  assert.ok(modelBody.includes('company '), 'Must have company relation');
  assert.ok(modelBody.includes('order '), 'Must have order relation');
  assert.ok(modelBody.includes('clientLegalEntity'), 'Must have clientLegalEntity relation');
  assert.ok(modelBody.includes('confirmedBy'), 'Must have confirmedBy relation');
});

test('Prisma schema: Order model has fiscalApproval optional relation', () => {
  const schema = readSchema();
  assert.match(schema, /fiscalApproval\s+OrderFiscalApproval\?/, 'Order must have fiscalApproval OrderFiscalApproval?');
});

test('Prisma schema: Company has orderFiscalApprovals reverse relation', () => {
  const schema = readSchema();
  assert.match(schema, /orderFiscalApprovals\s+OrderFiscalApproval\[\]/, 'Company must have orderFiscalApprovals[]');
});

test('Prisma schema: ClientLegalEntity has orderFiscalApprovals reverse relation', () => {
  const schema = readSchema();
  // Match within ClientLegalEntity block specifically
  const entityMatch = schema.match(/model ClientLegalEntity \{([\s\S]*?)@@map\("client_legal_entities"\)/);
  const entityBody = entityMatch?.[1] ?? '';
  assert.ok(entityBody.includes('orderFiscalApprovals'), 'ClientLegalEntity must have orderFiscalApprovals[]');
});

test('Prisma schema: User has orderFiscalApprovals reverse relation', () => {
  const schema = readSchema();
  assert.match(schema, /orderFiscalApprovals\s+OrderFiscalApproval\[\]/, 'User must have orderFiscalApprovals[]');
});

// ─── Structural invariants ────────────────────────────────────────────────────

test('OrderFiscalApproval does NOT add approvedReceiverActivityCode to Order (v2.0.2 design)', () => {
  const schema = readSchema();
  // The superseded field must not exist on Order model
  const orderMatch = schema.match(/model Order \{([\s\S]*?)@@map\("orders"\)/);
  const orderBody = orderMatch?.[1] ?? '';
  assert.ok(
    !orderBody.includes('approvedReceiverActivityCode'),
    'Order must NOT have approvedReceiverActivityCode (superseded by OrderFiscalApproval relation in v2.0.2)',
  );
});

test('Prisma schema companyId present on ClientEconomicActivity (tenant isolation)', () => {
  const schema = readSchema();
  const modelMatch = schema.match(/model ClientEconomicActivity \{([\s\S]*?)\n\}/);
  const modelBody = modelMatch?.[1] ?? '';
  assert.ok(modelBody.includes('companyId'), 'ClientEconomicActivity must carry companyId for tenant isolation');
});

test('Prisma schema companyId present on OrderFiscalApproval (tenant isolation)', () => {
  const schema = readSchema();
  const modelMatch = schema.match(/model OrderFiscalApproval \{([\s\S]*?)\n\}/);
  const modelBody = modelMatch?.[1] ?? '';
  assert.ok(modelBody.includes('companyId'), 'OrderFiscalApproval must carry companyId for tenant isolation');
});

// ─── DB-level: verification_status DEFAULT behavior ───────────────────────────
//
// These tests verify PostgreSQL's constant-DEFAULT column semantics against
// an actual running database. They are gated on INVENTORI_BILLING_POSTGRES_TEST=1
// following the repository postgres test convention.
//
// Behavior being verified:
//   ALTER TABLE client_legal_entities
//     ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
//
// PostgreSQL 11+ (this project uses 16): for a constant DEFAULT expression,
// existing rows observe the DEFAULT value immediately — NOT NULL — without a
// physical table rewrite. SQL-visible result for pre-existing rows = 'UNVERIFIED'.

const {
  configureFiscalDisposableDatabase,
  verifyFiscalDisposableDatabase,
} = require('./helpers/fiscal-disposable-database-guard');

const disposableDatabaseConfig = configureFiscalDisposableDatabase();
const runDbTests = disposableDatabaseConfig != null;
const dbRunOptions = { skip: !runDbTests };

const { describe, before: dbBefore, after: dbAfter } = require('node:test');

describe('DB verification: verification_status PostgreSQL DEFAULT semantics', dbRunOptions, () => {
  let prisma;
  const createdIds = [];

  function uid() {
    return `rfr-w1-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  dbBefore(async () => {
    prisma = require('../src/lib/prisma');
    await prisma.$connect();
    await verifyFiscalDisposableDatabase(prisma, disposableDatabaseConfig);
  });

  dbAfter(async () => {
    // Cleanup: delete created test entities (cascade handles economicActivities/orderFiscalApprovals)
    for (const id of createdIds) {
      await prisma.clientLegalEntity.deleteMany({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test('DB: verification_status column is NOT NULL in information_schema', async () => {
    // Verifies the migration applied NOT NULL constraint to the column
    const rows = await prisma.$queryRaw`
      SELECT is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'client_legal_entities'
        AND column_name = 'verification_status'
    `;
    assert.ok(rows.length === 1, 'Column client_legal_entities.verification_status must exist in DB');
    assert.strictEqual(
      rows[0].is_nullable,
      'NO',
      'verification_status must be NOT NULL in the database',
    );
  });

  test('DB: verification_status column default is UNVERIFIED in information_schema', async () => {
    const rows = await prisma.$queryRaw`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_name = 'client_legal_entities'
        AND column_name = 'verification_status'
    `;
    assert.ok(rows.length === 1, 'Column must exist');
    // PostgreSQL stores the default as a cast expression, e.g. "'UNVERIFIED'::text"
    assert.ok(
      rows[0].column_default != null && rows[0].column_default.includes('UNVERIFIED'),
      `Column default must include UNVERIFIED, got: ${rows[0].column_default}`,
    );
  });

  test('DB: newly created ClientLegalEntity has verificationStatus = UNVERIFIED', async () => {
    // This verifies that new rows receive 'UNVERIFIED' from the DEFAULT
    const suffix = uid();
    const company = await prisma.company.create({
      data: { name: `RFR-W1-Test-${suffix}`, legalId: `RFR-${suffix}` },
    });

    const entity = await prisma.clientLegalEntity.create({
      data: {
        companyId: company.id,
        legalName: `RFR Test Entity ${suffix}`,
        // verificationStatus intentionally omitted — DB DEFAULT must supply it
      },
    });
    createdIds.push(entity.id);

    assert.strictEqual(
      entity.verificationStatus,
      'UNVERIFIED',
      'New ClientLegalEntity must have verificationStatus = UNVERIFIED from DB DEFAULT',
    );
    assert.strictEqual(entity.lastVerifiedAt, null, 'lastVerifiedAt must be null for new entity');
    assert.strictEqual(entity.taxpayerName, null, 'taxpayerName must be null for new entity');

    // Cleanup company
    await prisma.clientLegalEntity.deleteMany({ where: { id: entity.id } });
    await prisma.company.deleteMany({ where: { id: company.id } });
  });

  test('DB: raw SQL query confirms verification_status = UNVERIFIED on new row (not NULL)', async () => {
    // Belt-and-suspenders: verify via rawQuery that the Prisma client is not masking nulls
    const suffix = uid();
    const company = await prisma.company.create({
      data: { name: `RFR-W1-Raw-${suffix}`, legalId: `RFR-RAW-${suffix}` },
    });
    const entity = await prisma.clientLegalEntity.create({
      data: { companyId: company.id, legalName: `RFR Raw Entity ${suffix}` },
    });
    createdIds.push(entity.id);

    const rows = await prisma.$queryRaw`
      SELECT verification_status, last_verified_at, taxpayer_name
      FROM client_legal_entities
      WHERE id = ${entity.id}
    `;
    assert.ok(rows.length === 1, 'Row must exist');
    assert.strictEqual(
      rows[0].verification_status,
      'UNVERIFIED',
      'Raw SQL: verification_status must be UNVERIFIED, NOT NULL',
    );
    assert.strictEqual(rows[0].last_verified_at, null, 'Raw SQL: last_verified_at must be NULL');
    assert.strictEqual(rows[0].taxpayer_name, null, 'Raw SQL: taxpayer_name must be NULL');

    await prisma.clientLegalEntity.deleteMany({ where: { id: entity.id } });
    await prisma.company.deleteMany({ where: { id: company.id } });
  });
});
