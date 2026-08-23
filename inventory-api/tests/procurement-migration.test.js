const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATION_FILE = path.join(__dirname, '../prisma/migrations/20260818010000_add_procurement_foundation/migration.sql');
const SCHEMA_FILE = path.join(__dirname, '../prisma/schema.prisma');

test('procurement foundation migration creates request, quotation, selection and PO structures', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  assert.ok(sql.includes('CREATE TYPE "PurchaseRequestStatus"'));
  assert.ok(sql.includes('CREATE TYPE "SupplierQuotationStatus"'));
  assert.ok(sql.includes('CREATE TYPE "ProcurementApprovalStatus"'));
  assert.ok(sql.includes('CREATE TYPE "PurchaseOrderStatus"'));
  assert.ok(sql.includes('CREATE TABLE "purchase_requests"'));
  assert.ok(sql.includes('CREATE TABLE "purchase_request_items"'));
  assert.ok(sql.includes('CREATE TABLE "supplier_quotations"'));
  assert.ok(sql.includes('CREATE TABLE "supplier_quotation_items"'));
  assert.ok(sql.includes('CREATE TABLE "supplier_selections"'));
  assert.ok(sql.includes('CREATE TABLE "purchase_orders"'));
  assert.ok(sql.includes('CREATE TABLE "purchase_order_items"'));
});

test('procurement foundation migration includes expected foreign keys and indexes', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  assert.ok(sql.includes('REFERENCES "companies"("id")'));
  assert.ok(sql.includes('REFERENCES "users"("id")'));
  assert.ok(sql.includes('REFERENCES "suppliers"("id")'));
  assert.ok(sql.includes('REFERENCES "products"("id")'));
  assert.ok(sql.includes('CREATE INDEX "purchase_requests_company_id_status_created_at_idx"'));
  assert.ok(sql.includes('CREATE INDEX "supplier_quotations_company_id_purchase_request_id_created_at_idx"'));
  assert.ok(sql.includes('CREATE INDEX "purchase_orders_company_id_supplier_id_created_at_idx"'));
});

test('prisma schema exposes procurement foundation models', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');

  assert.ok(schema.includes('model PurchaseRequest'));
  assert.ok(schema.includes('model SupplierQuotation'));
  assert.ok(schema.includes('model SupplierSelection'));
  assert.ok(schema.includes('model PurchaseOrder'));
  assert.ok(schema.includes('enum PurchaseRequestStatus'));
  assert.ok(schema.includes('enum ProcurementApprovalStatus'));
});
