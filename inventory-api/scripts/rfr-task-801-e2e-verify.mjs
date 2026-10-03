/* eslint-disable */
/**
 * RFR-TASK-801 E2E Verification Script
 * =====================================================================
 * Validates the full Inventori → Billing → XML pipeline for:
 *   CodigoActividadReceptor (Wave 8, RFR-TASK-801)
 *
 * Boundary: Inventori fiscal-billing-worker payload format →
 *           Billing API (POST /fiscal-documents/invoices) →
 *           Billing XML serializer → CodigoActividadReceptor in XML →
 *           XSD validation
 *
 * Safety contract:
 *   - USE_REAL_HACIENDA=false  (Billing started without real Hacienda)
 *   - No real Hacienda submission
 *   - Stops at XML generation / XSD validation only
 *
 * Taxpayer verification mode:
 *   LIVE PUBLIC HACIENDA LOOKUP (pre-existing verified entity from DB)
 *   Entity ID=5, identificationNumber=116560486, VERIFIED 2026-10-01
 *   Activities: 4100.0 (Construcción de edificios), 9311.0 (Gestión instalaciones deportivas)
 *   BOTH are 6-char codes passing the XSD length constraint.
 *
 * Usage:
 *   node scripts/rfr-task-801-e2e-verify.mjs
 */

import fetch from 'node:http';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Configuration ──────────────────────────────────────────────────────────
const BILLING_BASE_URL = 'http://localhost:3000/api/v1';
const M2M_API_KEY = 'bk_test_8c3323eb_3611035e343b7e8607981c431b6233f7';
const BILLING_COMPANY_ID = 'dde91f44-6ceb-4eb7-b322-0139919cc34d';
const BILLING_TENANT_ID = '25ae538c-b272-407b-83d0-ccc78be3c658';
const BILLING_ENVIRONMENT = 'SANDBOX';
// Local storage path (Billing .env.local: STORAGE_TYPE=local, LOCAL_STORAGE_PATH=./storage)
const BILLING_STORAGE_ROOT = path.join(
  'C:\\Users\\kmena\\Documents\\proyectos\\Billing',
  'storage',
  'fiscal',
  BILLING_TENANT_ID,
  BILLING_COMPANY_ID,
  BILLING_ENVIRONMENT,
);

// The Inventori fiscal-billing-worker.service.js builds this exact receiver shape
// from buildBillingFiscalDocumentPayload() using entity ID=5 data.
// Wave 4: selectedEconomicActivityCode → receiver.economicActivity
const RECEIVER_PAYLOAD = {
  sourceType: 'CLIENT_LEGAL_ENTITY',
  sourceId: '5',
  name: 'JULIAN RODRIGUEZ CYRMAN',
  commercialName: null,
  identificationType: '01',          // Cédula Física
  identificationNumber: '116560486', // Entity ID=5, VERIFIED 2026-10-01
  email: 'julian@test.local',
  phone: null,
  province: null,
  canton: null,
  district: null,
  address: 'San Jose, Costa Rica',
  // Wave 4 selectedEconomicActivityCode → this field
  // Activity 4100.0 = "Construcción de edificios" (6 chars, haciendaStatus=A, isCurrentlyReturned=true)
  economicActivity: '4100.0',
};

// Minimal fiscal document payload (mirrors buildBillingFiscalDocumentPayload output)
const FISCAL_DOCUMENT_PAYLOAD = {
  receiver: RECEIVER_PAYLOAD,
  currency: 'CRC',
  exchangeRate: '1.00000',
  saleCondition: '01',
  paymentMethod: '01',
  lines: [
    {
      lineNumber: 1,
      cabysCode: '8313100000100', // 13-digit CAByS: Servicios de consultoría en software
      description: 'Servicio de consultoría RFR-TASK-801 E2E',
      unitMeasure: 'Sp',
      quantity: '1.00000',
      unitPrice: '1000.00000',
      taxCode: '01',
      taxRateCode: '08',
      taxRate: '13.00000',
      taxAmount: '130.00000',
    },
  ],
};

// ── HTTP helpers ───────────────────────────────────────────────────────────
function httpRequest(method, urlStr, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': M2M_API_KEY,
        ...headers,
      },
    };
    const bodyStr = body ? JSON.stringify(body) : undefined;
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = fetch.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── XML helpers ────────────────────────────────────────────────────────────
function extractXmlElement(xml, tag) {
  const openTag = `<${tag}>`;
  const closeTag = `</${tag}>`;
  const start = xml.indexOf(openTag);
  if (start === -1) return null;
  const end = xml.indexOf(closeTag, start);
  if (end === -1) return null;
  return xml.slice(start + openTag.length, end);
}

function findStorageFile(docId, kind) {
  const dir = path.join(BILLING_STORAGE_ROOT, docId, 'v4.4');
  const filePath = path.join(dir, `${kind}.xml`);
  if (existsSync(filePath)) return filePath;
  return null;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const report = {
    timestamp: new Date().toISOString(),
    spec: 'RFR-TASK-801',
    wave: 'Wave 8 — CodigoActividadReceptor E2E',
    agent: 'code-puppy-ce507b',
    boundary: 'Inventori fiscal-billing-worker → Billing API → XML → XSD validation',
    taxpayerVerificationMode: 'LIVE PUBLIC HACIENDA LOOKUP (pre-existing verified entity)',
    entityId: 5,
    entityIdentificationNumber: '116560486',
    entityVerificationStatus: 'VERIFIED',
    entityLastVerifiedAt: '2026-10-01T14:32:33.361Z',
    selectedActivity: { code: '4100.0', description: 'Construcción de edificios', haciendaStatus: 'A', chars: 6 },
    billingCompanyId: BILLING_COMPANY_ID,
    billingEnvironment: BILLING_ENVIRONMENT,
    useRealHacienda: false,
    steps: [],
    result: null,
  };

  console.log('🐶 RFR-TASK-801 E2E Verification (rummy / code-puppy-ce507b)');
  console.log('═'.repeat(60));

  // ── Step 1: Create fiscal document ────────────────────────────────────────
  console.log('\n[1/3] Creating fiscal document via Billing API...');
  const idempotencyKey = `rfr-task-801-e2e-${Date.now()}`;
  const createResp = await httpRequest(
    'POST',
    `${BILLING_BASE_URL}/companies/${BILLING_COMPANY_ID}/fiscal-documents/${BILLING_ENVIRONMENT}/invoices`,
    FISCAL_DOCUMENT_PAYLOAD,
    { 'idempotency-key': idempotencyKey },
  );

  report.steps.push({
    step: 1,
    action: 'POST /fiscal-documents/invoices',
    httpStatus: createResp.status,
    idempotencyKey,
    responseBody: createResp.body,
  });

  if (createResp.status !== 201 && createResp.status !== 200) {
    console.error(`  ❌ FAIL: HTTP ${createResp.status}`, JSON.stringify(createResp.body));
    report.result = { ok: false, error: `Create document failed: HTTP ${createResp.status}`, details: createResp.body };
    printReport(report);
    process.exit(1);
  }

  const docId = createResp.body?.id || createResp.body?.fiscalDocumentId;
  if (!docId) {
    console.error('  ❌ No document ID in response');
    report.result = { ok: false, error: 'No document ID in response', details: createResp.body };
    printReport(report);
    process.exit(1);
  }

  console.log(`  ✅ Document created: ${docId}`);
  console.log(`  ✅ Status: ${createResp.body?.status}`);

  // ── Step 2: Prepare XML (generate + sign + XSD validate) ─────────────────
  console.log('\n[2/3] Preparing fiscal XML (generate → sign → XSD validate)...');
  const prepareResp = await httpRequest(
    'POST',
    `${BILLING_BASE_URL}/fiscal-documents/${docId}/prepare-xml`,
    null,
  );

  report.steps.push({
    step: 2,
    action: `POST /fiscal-documents/${docId}/prepare-xml`,
    httpStatus: prepareResp.status,
    responseBody: prepareResp.body,
  });

  if (prepareResp.status !== 200 && prepareResp.status !== 201) {
    console.error(`  ❌ FAIL: HTTP ${prepareResp.status}`, JSON.stringify(prepareResp.body));
    report.result = { ok: false, error: `Prepare XML failed: HTTP ${prepareResp.status}`, details: prepareResp.body };
    printReport(report);
    process.exit(1);
  }

  const prepareResult = prepareResp.body;
  console.log(`  ✅ XML prepared. Status: ${prepareResult.status}`);
  console.log(`  ✅ Unsigned XML SHA-256: ${prepareResult.unsignedXmlSha256}`);
  console.log(`  ✅ Signed XML SHA-256: ${prepareResult.signedXmlSha256}`);

  // ── Step 3: Retrieve XML and inspect CodigoActividadReceptor ─────────────
  console.log('\n[3/3] Retrieving XML and inspecting CodigoActividadReceptor...');
  const unsignedPath = findStorageFile(docId, 'unsigned');
  const signedPath = findStorageFile(docId, 'signed');

  if (!unsignedPath) {
    console.error(`  ❌ Unsigned XML file not found at ${BILLING_STORAGE_ROOT}/${docId}/v4.4/unsigned.xml`);
    report.result = { ok: false, error: 'XML file not found in local storage' };
    printReport(report);
    process.exit(1);
  }

  const unsignedXml = readFileSync(unsignedPath, 'utf8');
  const signedXml = signedPath ? readFileSync(signedPath, 'utf8') : null;

  // Extract CodigoActividadReceptor
  const codigoActividadReceptorValue = extractXmlElement(unsignedXml, 'CodigoActividadReceptor');
  const codigoActividadEmisorValue = extractXmlElement(unsignedXml, 'CodigoActividadEmisor');
  const numeroConsecutivoValue = extractXmlElement(unsignedXml, 'NumeroConsecutivo');
  const claveValue = extractXmlElement(unsignedXml, 'Clave');

  // Ordering check: CodigoActividadEmisor → CodigoActividadReceptor → NumeroConsecutivo
  const posEmisor = unsignedXml.indexOf('<CodigoActividadEmisor>');
  const posReceptor = unsignedXml.indexOf('<CodigoActividadReceptor>');
  const posConsecutivo = unsignedXml.indexOf('<NumeroConsecutivo>');
  const orderingValid = posEmisor < posReceptor && posReceptor < posConsecutivo;

  // Root-level check: CodigoActividadReceptor must NOT be inside <Receptor>
  const receptorStart = unsignedXml.indexOf('<Receptor>');
  const receptorEnd = unsignedXml.indexOf('</Receptor>');
  const receptorBlock = receptorStart > -1 && receptorEnd > -1
    ? unsignedXml.slice(receptorStart, receptorEnd + '</Receptor>'.length)
    : '';
  const notInsideReceptor = !receptorBlock.includes('<CodigoActividadReceptor>');

  // XSD validation (Billing already ran this during prepare-xml)
  const xsdValid = prepareResult.status === 'READY_TO_SUBMIT'; // only set if XSD passed

  console.log(`  CodigoActividadEmisor  = ${codigoActividadEmisorValue}`);
  console.log(`  CodigoActividadReceptor = ${codigoActividadReceptorValue}`);
  console.log(`  NumeroConsecutivo      = ${numeroConsecutivoValue}`);
  console.log(`  Ordering valid         = ${orderingValid}`);
  console.log(`  Not inside <Receptor>  = ${notInsideReceptor}`);
  console.log(`  XSD valid (READY_TO_SUBMIT) = ${xsdValid}`);

  const allPassed =
    codigoActividadReceptorValue === '4100.0' &&
    orderingValid &&
    notInsideReceptor &&
    xsdValid;

  report.steps.push({
    step: 3,
    action: 'Inspect XML',
    unsignedXmlPath: unsignedPath,
    codigoActividadReceptorValue,
    codigoActividadEmisorValue,
    expectedValue: '4100.0',
    valueMatch: codigoActividadReceptorValue === '4100.0',
    orderingValid,
    notInsideReceptor,
    xsdValidByBilling: xsdValid,
    documentStatus: prepareResult.status,
  });

  // Build a snippet of the XML around CodigoActividadReceptor for evidence
  const snippetStart = Math.max(0, posReceptor - 50);
  const snippetEnd = Math.min(unsignedXml.length, posReceptor + 100);
  const xmlSnippet = unsignedXml.slice(snippetStart, snippetEnd);

  report.result = {
    ok: allPassed,
    fiscalDocumentId: docId,
    codigoActividadReceptorValue,
    expectedValue: '4100.0',
    valueMatch: codigoActividadReceptorValue === '4100.0',
    orderingValid,
    notInsideReceptor,
    xsdValidByBilling: xsdValid,
    documentFinalStatus: prepareResult.status,
    xmlSnippet,
    unsignedXmlSha256: prepareResult.unsignedXmlSha256,
    signedXmlSha256: prepareResult.signedXmlSha256 || null,
  };

  console.log('\n' + '═'.repeat(60));
  if (allPassed) {
    console.log('🐶✅ ALL CHECKS PASSED — Wave 8 CodigoActividadReceptor E2E verified!');
  } else {
    console.log('❌ SOME CHECKS FAILED');
    if (codigoActividadReceptorValue !== '4100.0') {
      console.log(`  ❌ CodigoActividadReceptor: expected "4100.0", got "${codigoActividadReceptorValue}"`);
    }
    if (!orderingValid) console.log('  ❌ Element ordering is wrong');
    if (!notInsideReceptor) console.log('  ❌ CodigoActividadReceptor is INSIDE <Receptor>!');
    if (!xsdValid) console.log('  ❌ XSD validation did not pass');
  }

  printReport(report);
  process.exit(allPassed ? 0 : 1);
}

function printReport(report) {
  const reportPath = path.join(
    'C:\\Users\\kmena\\Documents\\proyectos\\inventory-api\\inventory-api',
    'test-output',
    'rfr-task-801-e2e-report.json',
  );
  import('node:fs').then(({ mkdirSync, writeFileSync }) => {
    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n📄 Report written to: ${reportPath}`);
  });
  console.log('\n📋 REPORT SUMMARY:');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('E2E script failed:', err);
  process.exit(1);
});
