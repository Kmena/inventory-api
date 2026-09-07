const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

/*
 * TASK-005 (purchase-production-order-ux): Verify that production creation
 * does NOT reject missing expirationDate for products requiring expiration,
 * and that completion STILL enforces it (FR-011, FR-012, BR-008, AC-010, AC-011).
 */

const serviceSource = readFileSync(
  resolve(__dirname, '../src/services/production.service.js'),
  'utf8',
);

const executionServiceSource = readFileSync(
  resolve(__dirname, '../src/services/production-execution.service.js'),
  'utf8',
);

const schemaSource = readFileSync(
  resolve(__dirname, '../src/schemas/production.schema.js'),
  'utf8',
);

describe('Production expiration validation alignment (FR-011 / BR-008)', () => {

  it('service creation path does NOT reject missing expirationDate for requiresExpiration product', () => {
    // The old rejection pattern was:
    //   if (product.requiresExpiration && !payload.expirationDate) { throw ... }
    // It must NOT be present in getValidatedProductionContext.
    const contextFnMatch = serviceSource.match(
      /async function getValidatedProductionContext\b[\s\S]*?^}/m,
    );
    assert.ok(contextFnMatch, 'getValidatedProductionContext should exist in service');

    const fnBody = contextFnMatch[0];

    // Must NOT contain an active (non-comment) line that throws for missing expirationDate
    const activeLines = fnBody.split('\n').filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
    });
    const activeCode = activeLines.join('\n');

    const hasExpirationRejection =
      activeCode.includes('requiresExpiration') &&
      activeCode.includes('expirationDate') &&
      activeCode.includes('throw');

    assert.ok(
      !hasExpirationRejection,
      'getValidatedProductionContext must not reject creation solely for missing expirationDate when product.requiresExpiration',
    );
  });

  it('service creation path has an explicit comment documenting the FR-011 / BR-008 decision', () => {
    assert.ok(
      serviceSource.includes('FR-011') || serviceSource.includes('BR-008'),
      'Service source should reference FR-011 or BR-008 decision about expiration timing',
    );
  });

  it('schema allows expirationDate to be omitted at creation time', () => {
    // The schema's expirationDate field must be optional or nullable
    assert.ok(
      schemaSource.includes('expirationDate: optionalDateSchema') ||
      schemaSource.includes('expirationDate') && schemaSource.includes('.optional()'),
      'createProductionOrderSchema must allow omitting expirationDate',
    );
  });

  it('completion/execution service still enforces expirationDate for requiresExpiration products', () => {
    // The completion path must contain a check that rejects missing expiration
    const hasCompletionExpirationCheck =
      executionServiceSource.includes('requiresExpiration') &&
      executionServiceSource.includes('expirationDate') &&
      executionServiceSource.includes('throw');

    assert.ok(
      hasCompletionExpirationCheck,
      'Completion/execution service must still enforce expirationDate for products requiring expiration (AC-011)',
    );
  });

  it('date relationship validation remains when expirationDate is voluntarily provided', () => {
    // Schema must still validate expirationDate < productionDate and expirationDate < plannedDate
    assert.ok(
      schemaSource.includes('expirationDate < payload.productionDate') ||
      schemaSource.includes('expirationDate') && schemaSource.includes('anterior'),
      'Schema must validate date relationships when expirationDate is provided',
    );
  });
});
