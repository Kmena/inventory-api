const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const projectRoot = path.resolve(__dirname, '..');
const prismaSchemaPath = path.join(projectRoot, 'prisma', 'schema.prisma');
const migrationsDirectory = path.join(projectRoot, 'prisma', 'migrations');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function assertDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL es obligatorio para aplicar las migraciones comprometidas.');
  }
}

function listMigrationFiles() {
  return fs.readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(migrationsDirectory, entry.name, 'migration.sql'))
    .filter((filePath) => fs.existsSync(filePath))
    .sort();
}

function executeMigrationFile(filePath) {
  const result = spawnSync(
    npxCommand,
    ['prisma', 'db', 'execute', '--file', filePath, '--schema', prismaSchemaPath],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit',
    },
  );

  if (result.status !== 0) {
    throw new Error(`No se pudo aplicar la migracion comprometida: ${path.relative(projectRoot, filePath)}`);
  }
}

async function verifyPhysicalSchema() {
  const prisma = new PrismaClient();

  try {
    const tableRows = await prisma.$queryRawUnsafe(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    if (!Array.isArray(tableRows) || tableRows.length === 0) {
      throw new Error('La aplicacion secuencial de migraciones no dejo tablas fisicas en schema public.');
    }

    const availableTables = new Set(tableRows.map((row) => row.table_name || row.TABLE_NAME));
    const requiredTables = ['Role', 'companies', 'users', 'permissions', 'orders'];
    const missingTables = requiredTables.filter((tableName) => !availableTables.has(tableName));

    if (missingTables.length > 0) {
      throw new Error(`Faltan tablas esperadas tras aplicar migraciones: ${missingTables.join(', ')}`);
    }

    console.log(`Migraciones SQL aplicadas y verificadas. Tablas detectadas en public: ${tableRows.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  assertDatabaseUrl();

  const migrationFiles = listMigrationFiles();
  if (migrationFiles.length === 0) {
    throw new Error('No se encontraron archivos migration.sql comprometidos.');
  }

  for (const filePath of migrationFiles) {
    console.log(`Aplicando ${path.relative(projectRoot, filePath)}...`);
    executeMigrationFile(filePath);
  }

  await verifyPhysicalSchema();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
