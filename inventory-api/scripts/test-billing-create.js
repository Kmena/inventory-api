'use strict';
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { buildBillingFiscalDocumentPayload } = require('../src/services/fiscal-billing-worker.service');
const { createBillingCredentialResolver } = require('../src/services/billing-credential-resolver.service');
const http = require('http');

const p = new PrismaClient();

async function main() {
  const snap = await p.invoiceFiscalSnapshot.findFirst({ where: { invoiceId: 1623n } });
  if (!snap) { console.error('Snapshot not found'); process.exit(1); }

  const payload = buildBillingFiscalDocumentPayload(snap);
  console.log('Payload built OK');
  console.log(JSON.stringify(payload, null, 2));

  const resolver = createBillingCredentialResolver();
  const key = resolver.resolveApiKey('env:BILLING_SANDBOX_M2M_API_KEY');
  const bodyStr = JSON.stringify(payload);

  await new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3000,
      path: '/api/v1/companies/dde91f44-6ceb-4eb7-b322-0139919cc34d/fiscal-documents/SANDBOX/invoices',
      method: 'POST',
      headers: {
        'X-API-Key': key,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'inventori:1698:invoice:1623',
        'X-Correlation-Id': 'test-direct-probe-001',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };
    const req = http.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        console.log('\nHTTP', res.statusCode);
        console.log(d.slice(0, 3000));
        resolve();
      });
    });
    req.on('error', (e) => { console.error('HTTP error:', e.message); reject(e); });
    req.write(bodyStr);
    req.end();
  });

  await p.$disconnect();
}

main().catch((e) => { console.error(e.message); p.$disconnect(); process.exit(1); });
