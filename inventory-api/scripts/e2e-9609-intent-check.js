'use strict';
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: [] });
const j = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x), 2);

async function main() {
  // Get full intent via raw SQL to bypass Prisma client schema drift
  const rows = await p.$queryRaw`
    SELECT id, status, billing_status, billing_fiscal_document_id, clave, consecutive,
           attempt_count, failure_code, failure_message, last_attempt_at, next_attempt_at,
           last_sync_at, metadata
    FROM invoice_fiscal_intents
    WHERE id = 1454
  `;
  console.log('Intent 1454 (raw SQL):');
  rows.forEach(r => console.log(j(r)));

  // Check all recent intents
  const recent = await p.$queryRaw`
    SELECT id, status, billing_fiscal_document_id, clave, attempt_count, failure_message,
           created_at, updated_at
    FROM invoice_fiscal_intents
    ORDER BY id DESC
    LIMIT 5
  `;
  console.log('\nRecent intents:');
  recent.forEach(r => console.log(j(r)));

  // Check if Billing document ID is set
  const intent = rows[0];
  if (intent) {
    console.log('\nKey fields:');
    console.log('  status:', intent.status);
    console.log('  billing_status:', intent.billing_status);
    console.log('  billing_fiscal_document_id:', intent.billing_fiscal_document_id);
    console.log('  clave:', intent.clave);
    console.log('  attempt_count:', intent.attempt_count);
    console.log('  failure_message:', intent.failure_message);
    console.log('  last_attempt_at:', intent.last_attempt_at);
    console.log('  updated_at:', intent.updated_at);
  }

  await p.$disconnect();
}

main().catch(e => { process.stderr.write(e.stack + '\n'); process.exit(1); });
