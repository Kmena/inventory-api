const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function expect(value) {
  return {
    toContain(expected) { assert.ok(value.includes(expected)); },
  };
}

const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', '20261030000000_inventori_billing_foundation', 'migration.sql');
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

describe('Inventori Billing foundation migration', () => {
  test('stops before adding invoice.order_id uniqueness when duplicates exist', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('GROUP BY order_id');
    expect(migration).toContain('HAVING COUNT(*) > 1');
    expect(migration).toContain('RAISE EXCEPTION');
    expect(migration).toContain('CREATE UNIQUE INDEX "invoices_order_id_unique" ON "invoices"("order_id")');
  });

  test('adds durable fiscal snapshot and intent models separate from commercial Invoice.status', () => {
    const schema = fs.readFileSync(schemaPath, 'utf8');

    expect(schema).toContain('model InvoiceFiscalSnapshot');
    expect(schema).toContain('model InvoiceFiscalIntent');
    expect(schema).toContain('enum FiscalIssuanceStatus');
    expect(schema).toContain('idempotencyKey             String               @unique @map("idempotency_key")');
    expect(schema).toContain('billingCredentialSecretRef String             @map("billing_credential_secret_ref")');
    expect(schema).toContain('status    InvoiceStatus @default(PENDING)');
  });
});
