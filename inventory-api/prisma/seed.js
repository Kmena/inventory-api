const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const permissionDefinitions = [
  ['companies.manage', 'companies', 'manage', 'Crear y administrar empresas'],
  ['users.manage', 'users', 'manage', 'Crear usuarios y asignar roles'],
  ['settings.manage', 'settings', 'manage', 'Configurar empresa y parametros fiscales'],
  ['clients.manage', 'clients', 'manage', 'Crear, editar y actualizar clientes'],
  ['clients.view', 'clients', 'view', 'Ver informacion de clientes asignados sin editar'],
  ['clients.view.all', 'clients', 'view_all', 'Ver informacion de todos los clientes comerciales sin editar'],
  ['products.manage', 'products', 'manage', 'Crear y actualizar articulos'],
  ['products.view', 'products', 'view', 'Ver articulos'],
  ['products.import', 'products', 'import', 'Importar articulos desde Excel'],
  ['inventory.manage', 'inventory', 'manage', 'Gestionar bodegas, lotes y movimientos'],
  ['inventory.view', 'inventory', 'view', 'Ver inventario y movimientos'],
  ['inventory.qa.manage', 'inventory', 'qa_manage', 'Aprobar, rechazar y reactivar lotes con control QA'],
  ['inventory.approve', 'inventory', 'approve', 'Aprobar movimientos excepcionales de inventario'],
  ['warehouse.access', 'warehouse', 'access', 'Entrar al dashboard de bodega'],
  ['procurement.manage', 'procurement', 'manage', 'Gestionar proveedores, compras y recepciones'],
  ['sales.manage', 'sales', 'manage', 'Gestionar pedidos, facturas y pagos'],
  ['sales.orders.create', 'sales', 'create_order', 'Crear pedidos comerciales'],
  ['sales.routes.view.own', 'sales_routes', 'view_own', 'Ver rutas asignadas al agente'],
  ['sales.routes.view.all', 'sales_routes', 'view_all', 'Ver todas las rutas comerciales'],
  ['sales.routes.assign', 'sales_routes', 'assign', 'Asignar rutas a agentes'],
  ['sales.goals.view.own', 'sales_goals', 'view_own', 'Ver metas propias del agente'],
  ['sales.goals.view.all', 'sales_goals', 'view_all', 'Ver metas de todos los agentes'],
  ['sales.goals.assign', 'sales_goals', 'assign', 'Asignar metas comerciales'],
  ['customer.activities.manage', 'customer_activities', 'manage', 'Registrar visitas, gestiones y seguimiento comercial'],
  ['customer.activities.view.all', 'customer_activities', 'view_all', 'Ver actividades comerciales de todo el equipo'],
  ['collections.manage.own', 'collections', 'manage_own', 'Registrar cobros propios del agente'],
  ['collections.view.all', 'collections', 'view_all', 'Ver cobros del equipo comercial'],
  ['collections.assign', 'collections', 'assign', 'Asignar tareas de cobro'],
  ['collections.payments.approve', 'collections', 'payments_approve', 'Aprobar, rechazar y revisar pagos registrados'],
  ['collections.payments.reverse', 'collections', 'payments_reverse', 'Reversar pagos aprobados'],
];

const rolePermissionMap = {
  root: permissionDefinitions.map(([code]) => code),
  admin: permissionDefinitions.map(([code]) => code),
  sales: ['clients.view', 'clients.manage', 'sales.manage'],
  sales_agent: [
    'clients.view',
    'sales.orders.create',
    'sales.routes.view.own',
    'sales.goals.view.own',
    'customer.activities.manage',
    'collections.manage.own',
  ],
  sales_supervisor: [
    'clients.view',
    'clients.view.all',
    'clients.manage',
    'sales.manage',
    'sales.orders.create',
    'sales.routes.view.own',
    'sales.routes.view.all',
    'sales.routes.assign',
    'sales.goals.view.own',
    'sales.goals.view.all',
    'sales.goals.assign',
    'customer.activities.manage',
    'customer.activities.view.all',
    'collections.view.all',
    'collections.assign',
  ],
  warehouse: [
    'warehouse.access',
    'products.view',
    'products.import',
    'products.manage',
    'inventory.view',
    'inventory.manage',
    'procurement.manage',
  ],
};

function getBcryptRounds() {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  return Number.isFinite(rounds) && rounds > 0 ? rounds : 12;
}

async function upsertRole(code, name) {
  return prisma.role.upsert({
    where: { code },
    update: { name, companyId: null, isActive: true },
    create: { code, name, companyId: null, isActive: true },
  });
}

async function upsertPermission(code, module, action, description) {
  return prisma.permission.upsert({
    where: { code },
    update: { module, action, description, isActive: true },
    create: { code, module, action, description, isActive: true },
  });
}

async function syncRolePermissions(rolesByCode, permissionsByCode) {
  for (const [roleCode, permissionCodes] of Object.entries(rolePermissionMap)) {
    const role = rolesByCode[roleCode];
    for (const permissionCode of permissionCodes) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permissionsByCode[permissionCode].id,
          },
        },
        update: { isEnabled: true },
        create: {
          roleId: role.id,
          permissionId: permissionsByCode[permissionCode].id,
          isEnabled: true,
        },
      });
    }
  }
}

async function upsertUser({ username, fullName, email, phone, passwordHash, roleId, companyId }) {
  return prisma.user.upsert({
    where: { username },
    update: {
      fullName,
      email,
      phone,
      passwordHash,
      roleId,
      companyId,
      status: 'ACTIVE',
    },
    create: {
      username,
      fullName,
      email,
      phone,
      passwordHash,
      roleId,
      companyId,
      status: 'ACTIVE',
    },
  });
}

async function ensureFiscalSequences(companyId) {
  for (const documentType of ['FACTURA_ELECTRONICA', 'TIQUETE_ELECTRONICO', 'NOTA_CREDITO_ELECTRONICA']) {
    await prisma.fiscalSequence.upsert({
      where: {
        companyId_documentType_branchCode_terminalCode: {
          companyId,
          documentType,
          branchCode: '001',
          terminalCode: '00001',
        },
      },
      update: { isActive: true },
      create: {
        companyId,
        documentType,
        branchCode: '001',
        terminalCode: '00001',
        currentNumber: 0,
        nextNumber: 1,
        isActive: true,
      },
    });
  }
}

async function ensureInventory(companyId) {
  const inventory = await prisma.inventory.upsert({
    where: { companyId },
    update: {},
    create: { companyId },
  });

  const categories = [
    { name: 'Producto terminado', categoryType: 'PT', sortOrder: 1 },
    { name: 'Materia prima', categoryType: 'MP', sortOrder: 2 },
    { name: 'Empaque', categoryType: 'EM', sortOrder: 3 },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: {
        inventoryId_name: {
          inventoryId: inventory.id,
          name: category.name,
        },
      },
      update: {
        categoryType: category.categoryType,
        isActive: true,
        sortOrder: category.sortOrder,
      },
      create: {
        inventoryId: inventory.id,
        name: category.name,
        categoryType: category.categoryType,
        isActive: true,
        sortOrder: category.sortOrder,
      },
    });
  }

  return inventory;
}

async function ensureWarehouses(companyId) {
  const warehouses = [
    { code: 'BOD-PT', name: 'Bodega producto terminado', warehouseType: 'FINISHED_GOODS', isVirtual: false, isSellableSource: true },
    { code: 'BOD-MP', name: 'Bodega materia prima', warehouseType: 'RAW_MATERIAL', isVirtual: false, isSellableSource: false },
    { code: 'BOD-QA', name: 'Bodega cuarentena', warehouseType: 'QUARANTINE', isVirtual: false, isSellableSource: false },
    { code: 'V-ADMIN', name: 'Bodega administrativa virtual', warehouseType: 'ADMIN_VIRTUAL', isVirtual: true, isSellableSource: false },
  ];

  for (const warehouse of warehouses) {
    await prisma.warehouse.upsert({
      where: {
        companyId_code: {
          companyId,
          code: warehouse.code,
        },
      },
      update: {
        name: warehouse.name,
        warehouseType: warehouse.warehouseType,
        isVirtual: warehouse.isVirtual,
        isSellableSource: warehouse.isSellableSource,
        isActive: true,
      },
      create: {
        companyId,
        code: warehouse.code,
        name: warehouse.name,
        warehouseType: warehouse.warehouseType,
        isVirtual: warehouse.isVirtual,
        isSellableSource: warehouse.isSellableSource,
        isActive: true,
      },
    });
  }
}

async function ensureRegions(companyId) {
  const centralRegion = await prisma.region.upsert({
    where: {
      companyId_name: {
        companyId,
        name: 'Central',
      },
    },
    update: { routeCode: 'CTR' },
    create: {
      companyId,
      name: 'Central',
      routeCode: 'CTR',
    },
  });

  const westRegion = await prisma.region.upsert({
    where: {
      companyId_name: {
        companyId,
        name: 'Occidente',
      },
    },
    update: { routeCode: 'OCC' },
    create: {
      companyId,
      name: 'Occidente',
      routeCode: 'OCC',
    },
  });

  const escazuSubregion = await prisma.subregion.upsert({
    where: {
      regionId_name: {
        regionId: centralRegion.id,
        name: 'Escazu',
      },
    },
    update: { routeCode: 'CTR-01' },
    create: {
      regionId: centralRegion.id,
      name: 'Escazu',
      routeCode: 'CTR-01',
    },
  });

  const santaAnaSubregion = await prisma.subregion.upsert({
    where: {
      regionId_name: {
        regionId: centralRegion.id,
        name: 'Santa Ana',
      },
    },
    update: { routeCode: 'CTR-02' },
    create: {
      regionId: centralRegion.id,
      name: 'Santa Ana',
      routeCode: 'CTR-02',
    },
  });

  const alajuelaCenterSubregion = await prisma.subregion.upsert({
    where: {
      regionId_name: {
        regionId: westRegion.id,
        name: 'Alajuela Centro',
      },
    },
    update: { routeCode: 'OCC-01' },
    create: {
      regionId: westRegion.id,
      name: 'Alajuela Centro',
      routeCode: 'OCC-01',
    },
  });

  return {
    escazuSubregion,
    santaAnaSubregion,
    alajuelaCenterSubregion,
  };
}

async function ensureClientLandscape(companyId, subregionId) {
  const classification = await prisma.clientClassification.upsert({
    where: {
      companyId_code: {
        companyId,
        code: 'GENERAL',
      },
    },
    update: {
      name: 'General',
      isActive: true,
    },
    create: {
      companyId,
      code: 'GENERAL',
      name: 'General',
      isActive: true,
    },
  });

  const legalEntity = await prisma.clientLegalEntity.upsert({
    where: {
      companyId_identificationNumber: {
        companyId,
        identificationNumber: '3101000000',
      },
    },
    update: {
      legalName: 'Cliente Demo Sociedad Anonima',
      commercialName: 'Cliente Demo',
      identificationType: '02',
      economicActivityCode: '620100',
      economicActivityName: 'Comercio',
      address: 'Escazu Centro',
      email: 'cliente@demo.local',
      phone: '7000-0000',
      isActive: true,
    },
    create: {
      companyId,
      legalName: 'Cliente Demo Sociedad Anonima',
      commercialName: 'Cliente Demo',
      identificationType: '02',
      identificationNumber: '3101000000',
      economicActivityCode: '620100',
      economicActivityName: 'Comercio',
      address: 'Escazu Centro',
      email: 'cliente@demo.local',
      phone: '7000-0000',
      isActive: true,
    },
  });

  const client = await prisma.client.upsert({
    where: {
      companyId_code: {
        companyId,
        code: 'CLI-001',
      },
    },
    update: {
      name: 'Cliente Demo',
      legalId: '1-111-111111',
      documentType: '01',
      clientClassificationId: classification.id,
      legalEntityId: legalEntity.id,
      paymentType: 'CREDIT',
      paymentDays: 30,
      emailBilling: 'cliente@demo.local',
      phone: '7000-0000',
      address: 'Escazu Centro',
    },
    create: {
      companyId,
      code: 'CLI-001',
      name: 'Cliente Demo',
      legalId: '1-111-111111',
      documentType: '01',
      clientClassificationId: classification.id,
      legalEntityId: legalEntity.id,
      paymentType: 'CREDIT',
      paymentDays: 30,
      emailBilling: 'cliente@demo.local',
      phone: '7000-0000',
      address: 'Escazu Centro',
    },
  });

  await prisma.clientStore.upsert({
    where: {
      clientId_code: {
        clientId: client.id,
        code: 'TND-001',
      },
    },
    update: {
      legalEntityId: legalEntity.id,
      subregionId,
      name: 'Tienda Demo',
      storeType: 'Retail',
      locationReference: 'Frente al parque central',
      attentionSchedule: 'Lunes a sabado 8:00-18:00',
      isPrimary: true,
      isActive: true,
      phone: '7000-0002',
      address: 'Escazu Centro',
    },
    create: {
      clientId: client.id,
      legalEntityId: legalEntity.id,
      subregionId,
      code: 'TND-001',
      name: 'Tienda Demo',
      storeType: 'Retail',
      locationReference: 'Frente al parque central',
      attentionSchedule: 'Lunes a sabado 8:00-18:00',
      isPrimary: true,
      isActive: true,
      phone: '7000-0002',
      address: 'Escazu Centro',
    },
  });
}

async function ensureSalesRoutes(companyId, usersByCode, subregionsByCode) {
  const routeDefinitions = [
    { code: 'CTR-01', name: 'Ruta Central 01', subregion: subregionsByCode.escazuSubregion },
    { code: 'CTR-02', name: 'Ruta Central 02', subregion: subregionsByCode.santaAnaSubregion },
    { code: 'OCC-01', name: 'Ruta Occidente 01', subregion: subregionsByCode.alajuelaCenterSubregion },
  ];

  const routesByCode = {};
  for (const definition of routeDefinitions) {
    const route = await prisma.salesRoute.upsert({
      where: {
        companyId_code: {
          companyId,
          code: definition.code,
        },
      },
      update: {
        name: definition.name,
        visitFrequencyDays: 15,
        nearLimitDays: 3,
        isActive: true,
      },
      create: {
        companyId,
        code: definition.code,
        name: definition.name,
        visitFrequencyDays: 15,
        nearLimitDays: 3,
        isActive: true,
      },
    });

    routesByCode[definition.code] = route;

    await prisma.salesRouteSubzone.upsert({
      where: {
        salesRouteId_subregionId: {
          salesRouteId: route.id,
          subregionId: definition.subregion.id,
        },
      },
      update: {
        companyId,
      },
      create: {
        companyId,
        salesRouteId: route.id,
        subregionId: definition.subregion.id,
      },
    });
  }

  await prisma.salesRouteAssignment.upsert({
    where: {
      userId_salesRouteId: {
        userId: usersByCode.salesAgent.id,
        salesRouteId: routesByCode['CTR-01'].id,
      },
    },
    update: { companyId, isActive: true },
    create: {
      companyId,
      userId: usersByCode.salesAgent.id,
      salesRouteId: routesByCode['CTR-01'].id,
      isActive: true,
    },
  });

  await prisma.salesRouteAssignment.upsert({
    where: {
      userId_salesRouteId: {
        userId: usersByCode.salesAgent.id,
        salesRouteId: routesByCode['CTR-02'].id,
      },
    },
    update: { companyId, isActive: true },
    create: {
      companyId,
      userId: usersByCode.salesAgent.id,
      salesRouteId: routesByCode['CTR-02'].id,
      isActive: true,
    },
  });

  await prisma.salesRouteAssignment.upsert({
    where: {
      userId_salesRouteId: {
        userId: usersByCode.salesSupervisor.id,
        salesRouteId: routesByCode['OCC-01'].id,
      },
    },
    update: { companyId, isActive: true },
    create: {
      companyId,
      userId: usersByCode.salesSupervisor.id,
      salesRouteId: routesByCode['OCC-01'].id,
      isActive: true,
    },
  });
}

async function main() {
  const rounds = getBcryptRounds();

  const rolesByCode = {
    root: await upsertRole('root', 'Root'),
    admin: await upsertRole('admin', 'Administrador'),
    sales: await upsertRole('sales', 'Ventas legado'),
    sales_agent: await upsertRole('sales_agent', 'Agente comercial'),
    sales_supervisor: await upsertRole('sales_supervisor', 'Supervisor comercial'),
    warehouse: await upsertRole('warehouse', 'Bodega'),
  };

  const permissionsByCode = {};
  for (const permissionDefinition of permissionDefinitions) {
    const [code, module, action, description] = permissionDefinition;
    permissionsByCode[code] = await upsertPermission(code, module, action, description);
  }
  await syncRolePermissions(rolesByCode, permissionsByCode);

  const company = await prisma.company.upsert({
    where: { id: 1n },
    update: {
      name: 'Inventori Demo',
      legalId: '3-101-000000',
      phone: '2222-2222',
      email: 'demo@tracksys.local',
      address: 'San Jose, Costa Rica',
      isActive: true,
    },
    create: {
      id: 1n,
      name: 'Inventori Demo',
      legalId: '3-101-000000',
      phone: '2222-2222',
      email: 'demo@tracksys.local',
      address: 'San Jose, Costa Rica',
      isActive: true,
    },
  });

  await prisma.companyConfig.upsert({
    where: { companyId: company.id },
    update: {
      taxPercentage: 13,
      currency: 'CRC',
      pricingMode: 'standard',
      allowBackorder: false,
      settingsJson: {
        inventoryAlerts: true,
        invoicePrefix: 'FAC',
      },
    },
    create: {
      companyId: company.id,
      taxPercentage: 13,
      currency: 'CRC',
      pricingMode: 'standard',
      allowBackorder: false,
      settingsJson: {
        inventoryAlerts: true,
        invoicePrefix: 'FAC',
      },
    },
  });

  await prisma.companyFiscalConfig.upsert({
    where: { companyId: company.id },
    update: {
      legalName: company.name,
      commercialName: company.name,
      identificationType: '02',
      identificationNumber: company.legalId || '3101000000',
      email: company.email,
      phone: company.phone,
      address: company.address,
      haciendaEnvironment: 'STAGING',
      defaultBranchCode: '001',
      defaultTerminalCode: '00001',
    },
    create: {
      companyId: company.id,
      legalName: company.name,
      commercialName: company.name,
      identificationType: '02',
      identificationNumber: company.legalId || '3101000000',
      email: company.email,
      phone: company.phone,
      address: company.address,
      haciendaEnvironment: 'STAGING',
      defaultBranchCode: '001',
      defaultTerminalCode: '00001',
    },
  });

  await ensureFiscalSequences(company.id);
  await ensureInventory(company.id);
  await ensureWarehouses(company.id);
  const subregions = await ensureRegions(company.id);

  const rootPasswordHash = await bcrypt.hash('root1234', rounds);
  const adminPasswordHash = await bcrypt.hash('admin123', rounds);
  const salesPasswordHash = await bcrypt.hash('ventas123', rounds);
  const agentPasswordHash = await bcrypt.hash('agente123', rounds);
  const supervisorPasswordHash = await bcrypt.hash('supervisor123', rounds);
  const warehousePasswordHash = await bcrypt.hash('bodega123', rounds);

  const usersByCode = {
    root: await upsertUser({
      username: 'root',
      fullName: 'Root Inventori',
      email: 'root@inventori.local',
      phone: '8000-0000',
      passwordHash: rootPasswordHash,
      roleId: rolesByCode.root.id,
      companyId: null,
    }),
    rootCompanies: await upsertUser({
      username: 'empresas',
      fullName: 'Root Empresas',
      email: 'empresas@inventori.local',
      phone: '8000-0001',
      passwordHash: rootPasswordHash,
      roleId: rolesByCode.root.id,
      companyId: null,
    }),
    admin: await upsertUser({
      username: 'admin',
      fullName: 'Administrador Demo',
      email: 'admin@tracksys.local',
      phone: '8888-8888',
      passwordHash: adminPasswordHash,
      roleId: rolesByCode.admin.id,
      companyId: company.id,
    }),
    sales: await upsertUser({
      username: 'ventas',
      fullName: 'Usuario Ventas Demo',
      email: 'ventas@tracksys.local',
      phone: '8777-7777',
      passwordHash: salesPasswordHash,
      roleId: rolesByCode.sales.id,
      companyId: company.id,
    }),
    salesAgent: await upsertUser({
      username: 'agente',
      fullName: 'Agente Comercial Demo',
      email: 'agente@tracksys.local',
      phone: '8555-5555',
      passwordHash: agentPasswordHash,
      roleId: rolesByCode.sales_agent.id,
      companyId: company.id,
    }),
    salesSupervisor: await upsertUser({
      username: 'supervisor',
      fullName: 'Supervisor Comercial Demo',
      email: 'supervisor@tracksys.local',
      phone: '8444-4444',
      passwordHash: supervisorPasswordHash,
      roleId: rolesByCode.sales_supervisor.id,
      companyId: company.id,
    }),
    warehouse: await upsertUser({
      username: 'bodega',
      fullName: 'Usuario Bodega Demo',
      email: 'bodega@tracksys.local',
      phone: '8666-6666',
      passwordHash: warehousePasswordHash,
      roleId: rolesByCode.warehouse.id,
      companyId: company.id,
    }),
  };

  await ensureClientLandscape(company.id, subregions.escazuSubregion.id);
  await ensureSalesRoutes(company.id, usersByCode, subregions);

  console.log('Seed completed successfully.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
