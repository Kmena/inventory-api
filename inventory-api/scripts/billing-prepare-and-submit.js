'use strict';
require('dotenv').config();
const http = require('http');
const { createBillingCredentialResolver } = require('../src/services/billing-credential-resolver.service');

const resolver = createBillingCredentialResolver();
const key = resolver.resolveApiKey('env:BILLING_SANDBOX_M2M_API_KEY');
const DOC_ID = '353a13aa-dd13-4382-8af3-9bb15280fff6';
const COMPANY_ID = 'dde91f44-6ceb-4eb7-b322-0139919cc34d';
const ENV = 'SANDBOX';

function httpReq(method, path, extraHeaders, body) {
  return new Promise((resolve, reject) => {
    const headers = { 'X-API-Key': key, 'Content-Type': 'application/json', ...extraHeaders };
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request({ hostname: 'localhost', port: 3000, path, method, headers }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ s: res.statusCode, b: d }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  process.stdout.write(`\n=== Billing Document ${DOC_ID} ===\n\n`);

  // Step 1: prepare-xml
  process.stdout.write('Step 1: POST /api/v1/fiscal-documents/{id}/prepare-xml\n');
  const pr = await httpReq('POST', `/api/v1/fiscal-documents/${DOC_ID}/prepare-xml`, {}, '{}');
  process.stdout.write(`  HTTP: ${pr.s}\n  Body: ${pr.b.slice(0, 800)}\n`);

  if (pr.s !== 200 && pr.s !== 201) {
    process.stdout.write('prepare-xml failed\n');
    return;
  }

  const prepResult = JSON.parse(pr.b);
  process.stdout.write(`  Status after prepare-xml: ${prepResult.status}\n`);

  if (prepResult.status !== 'READY_TO_SUBMIT') {
    process.stdout.write(`  Document not READY_TO_SUBMIT after prepare-xml: ${prepResult.status}\n`);
    return;
  }

  // Step 2: submit
  process.stdout.write('\nStep 2: POST /api/v1/companies/{id}/fiscal-documents/{env}/invoices/{id}/submit\n');
  const sr = await httpReq('POST',
    `/api/v1/companies/${COMPANY_ID}/fiscal-documents/${ENV}/invoices/${DOC_ID}/submit`,
    {},
    '{}');
  process.stdout.write(`  HTTP: ${sr.s}\n  Body: ${sr.b.slice(0, 1000)}\n`);

  // Step 3: check submission status
  await new Promise((r) => setTimeout(r, 2000));
  process.stdout.write('\nStep 3: GET submission status\n');
  const st = await httpReq('GET',
    `/api/v1/companies/${COMPANY_ID}/fiscal-documents/${ENV}/invoices/${DOC_ID}/submission`,
    {}, null);
  process.stdout.write(`  HTTP: ${st.s}\n  Body: ${st.b.slice(0, 1200)}\n`);
}

main().catch((e) => { process.stderr.write(`ERROR: ${e.message}\n`); process.exit(1); });
