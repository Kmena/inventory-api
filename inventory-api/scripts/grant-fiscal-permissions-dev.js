/**
 * DEV-ONLY utility: upserts fiscal permissions into the permissions table
 * and grants them to the admin and root roles.
 *
 * Safe to re-run (all upserts). Does NOT touch user passwords,
 * company data, or any other role.
 *
 * Usage (from inventory-api/):
 *   node scripts/grant-fiscal-permissions-dev.js
 */
'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const FISCAL_PERMISSIONS = [
  ['fiscal.settings.view',           'fiscal_settings', 'view',                    'Ver configuracion fiscal y actividades economicas registradas'],
  ['fiscal.activities.refresh',      'fiscal_settings', 'refresh_activities',      'Actualizar actividades fiscales desde Billing'],
  ['fiscal.activities.manage',       'fiscal_settings', 'manage_activities',       'Habilitar o deshabilitar actividades fiscales'],
  ['fiscal.activities.default.update','fiscal_settings','update_default_activity', 'Cambiar actividad fiscal predeterminada'],
  ['fiscal.readiness.view',          'fiscal_settings', 'view_readiness',          'Ver preparacion fiscal cuando exista contrato M2M confirmado'],
];

// Roles that should receive all fiscal permissions in dev
const TARGET_ROLE_CODES = ['admin', 'root'];

async function main() {
  console.log('→ Upserting fiscal permissions…');

  const permissionRecords = [];
  for (const [code, module, action, description] of FISCAL_PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where:  { code },
      update: { module, action, description, isActive: true },
      create: { code, module, action, description, isActive: true },
    });
    permissionRecords.push(record);
    console.log(`  ✔ permission: ${code} (id=${record.id})`);
  }

  console.log('\n→ Assigning permissions to target roles…');
  for (const roleCode of TARGET_ROLE_CODES) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) {
      console.log(`  ⚠ role "${roleCode}" not found — skipping`);
      continue;
    }

    for (const perm of permissionRecords) {
      await prisma.rolePermission.upsert({
        where:  { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
    console.log(`  ✔ role "${roleCode}" (id=${role.id}) — ${permissionRecords.length} fiscal permissions assigned`);
  }

  console.log('\n✅ Done. Fiscal permissions are available for admin and root roles.');
}

main()
  .catch((err) => { console.error('Error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
