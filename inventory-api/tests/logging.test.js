const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildErrorLogEntry,
  createRequestLogMessage,
  isDevelopmentEnvironment,
  logConfigurationWarning,
} = require('../src/lib/logging');

test('isDevelopmentEnvironment returns true only for development', () => {
  assert.equal(isDevelopmentEnvironment('development'), true);
  assert.equal(isDevelopmentEnvironment('staging'), false);
  assert.equal(isDevelopmentEnvironment('test'), false);
});

test('createRequestLogMessage keeps minimal non-dev request context', () => {
  const message = createRequestLogMessage({
    nodeEnv: 'staging',
    requestId: 'req-123',
    method: 'GET',
    path: '/api/clients',
    statusCode: 403,
    durationMs: 12.5,
    errorCode: 'forbidden',
  });

  assert.deepEqual(JSON.parse(message), {
    level: 'info',
    environment: 'staging',
    requestId: 'req-123',
    method: 'GET',
    path: '/api/clients',
    statusCode: 403,
    durationMs: 12.5,
    errorCode: 'forbidden',
  });
});

test('createRequestLogMessage includes governed heavy-endpoint metrics only when available', () => {
  const message = createRequestLogMessage({
    nodeEnv: 'staging',
    requestId: 'req-456',
    method: 'GET',
    path: '/api/inventory/stocks?warehouseId=1',
    statusCode: 200,
    durationMs: 18.2,
    errorCode: '-',
    heavyEndpointMetrics: {
      endpointKey: 'inventory-stocks-list',
      routePattern: '/api/inventory/stocks',
      payloadClass: 'medium',
      responseShape: 'split-collection',
      responseBytes: 259,
      resultCount: 5,
    },
  });

  assert.deepEqual(JSON.parse(message), {
    level: 'info',
    environment: 'staging',
    requestId: 'req-456',
    method: 'GET',
    path: '/api/inventory/stocks?warehouseId=1',
    statusCode: 200,
    durationMs: 18.2,
    errorCode: '-',
    endpointKey: 'inventory-stocks-list',
    routePattern: '/api/inventory/stocks',
    payloadClass: 'medium',
    responseShape: 'split-collection',
    responseBytes: 259,
    resultCount: 5,
  });
});

test('buildErrorLogEntry returns original error in development', () => {
  const error = new Error('boom');
  error.code = 'internal_server_error';
  error.statusCode = 500;

  const entry = buildErrorLogEntry({
    error,
    req: { method: 'GET', originalUrl: '/health' },
    nodeEnv: 'development',
  });

  assert.equal(entry, error);
});

test('buildErrorLogEntry sanitizes error details outside development', () => {
  const error = new Error('sensitive details');
  error.code = 'validation_error';
  error.statusCode = 400;
  error.stack = 'stack should not be logged';

  const entry = buildErrorLogEntry({
    error,
    req: {
      method: 'POST',
      originalUrl: '/api/payments',
      requestContext: { requestId: 'req-789' },
    },
    nodeEnv: 'production',
  });

  assert.deepEqual(entry, {
    level: 'error',
    environment: 'production',
    requestId: 'req-789',
    method: 'POST',
    path: '/api/payments',
    statusCode: 400,
    errorCode: 'validation_error',
  });

  assert.equal('message' in entry, false);
  assert.equal('stack' in entry, false);
});

test('logConfigurationWarning keeps plain warning in development', () => {
  const warnings = [];

  logConfigurationWarning({
    message: 'temporary warning',
    nodeEnv: 'development',
    warnLogger: (value) => warnings.push(value),
  });

  assert.deepEqual(warnings, ['temporary warning']);
});

test('logConfigurationWarning serializes warning in non-development environments', () => {
  const warnings = [];

  logConfigurationWarning({
    message: 'temporary warning',
    nodeEnv: 'staging',
    warnLogger: (value) => warnings.push(value),
  });

  assert.deepEqual(JSON.parse(warnings[0]), {
    level: 'warn',
    environment: 'staging',
    code: 'configuration_warning',
    message: 'temporary warning',
  });
});
