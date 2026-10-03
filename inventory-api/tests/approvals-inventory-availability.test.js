'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const approvalsView = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'public', 'root', 'views', 'approvals-admin.js'),
  'utf8',
);
const orderService = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'order.service.js'),
  'utf8',
);
const orderRepository = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'repositories', 'order.repository.js'),
  'utf8',
);

test('approvals item summary shows sellable inventory quantity instead of generic inventory requirement copy', () => {
  assert.match(approvalsView, /Inventario vendible:/);
  assert.match(approvalsView, /sellableInventoryQuantity/);
  assert.doesNotMatch(approvalsView, /Requiere inventario/);
});

test('order list enriches products with sellable stock from sellable warehouses only', () => {
  assert.match(orderService, /attachSellableInventoryToOrders/);
  assert.match(orderService, /sellableInventoryQuantity/);
  assert.match(orderService, /deriveLotUsability/);
  assert.match(orderRepository, /isSellableSource:\s*true/);
  assert.match(orderRepository, /findSellableLotStocksByProductIds/);
});
