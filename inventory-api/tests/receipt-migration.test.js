const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MIGRATION_FILE = path.join(__dirname, '../prisma/migrations/20260818020000_add_purchase_receipt_foundation/migration.sql');
const SCHEMA_FILE = path.join(__dirname, '../prisma/schema.prisma');

test('receipt foundation migration creates receipt document, items and inspection structures', () => {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  assert.ok(sql.includes('CREATE TYPE "PurchaseReceiptStatus"'));
  assert.ok(sql.includes('CREATE TYPE "ReceiptInspectionResult"'));
  assert.ok(sql.includes('CREATE TABLE "purchase_receipts"'));
  assert.ok(sql.includes('CREATE TABLE "purchase_receipt_items"'));
  assert.ok(sql.includes('CREATE TABLE "receipt_inspections"'));
});

test('receipt foundation schema exposes actual-arrival and inspection models', () => {
  const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
  assert.ok(schema.includes('model PurchaseReceipt'));
  assert.ok(schema.includes('model PurchaseReceiptItem'));
  assert.ok(schema.includes('model ReceiptInspection'));
  assert.ok(schema.includes('enum PurchaseReceiptStatus'));
});
