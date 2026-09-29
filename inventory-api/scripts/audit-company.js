'use strict';
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error'],
});

const bigIntSerializer = (k, v) => (typeof v === 'bigint' ? v.toString() : v);

async function main() {
  console.log('DATABASE_URL prefix:', (process.env.DATABASE_URL || '').slice(0, 30) + '...');

  const companies = await prisma.company.findMany({
    orderBy: { id: 'asc' },
    include: {
      fiscalConfig: true,
      billingIntegrationConfig: true,
    },
  });

  console.log('=== COMPANIES ===');
  console.log(JSON.stringify(companies, bigIntSerializer, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('ERROR:', String(e));
    prisma.$disconnect();
    process.exit(1);
  });
