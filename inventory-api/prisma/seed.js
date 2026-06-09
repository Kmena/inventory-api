const { PrismaClient, PaymentType, UserStatus } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const rounds = Number(process.env.BCRYPT_ROUNDS || 12);

  const rootRole = await prisma.role.upsert({
    where: { code: 'root' },
    update: { name: 'Root', isActive: true },
    create: { code: 'root', name: 'Root', isActive: true },
  });

  const adminRole = await prisma.role.upsert({
    where: { code: 'admin' },
    update: { name: 'Administrador', isActive: true },
    create: { code: 'admin', name: 'Administrador', isActive: true },
  });

  const salesRole = await prisma.role.upsert({
    where: { code: 'sales' },
    update: { name: 'Ventas', isActive: true },
    create: { code: 'sales', name: 'Ventas', isActive: true },
  });

  const warehouseRole = await prisma.role.upsert({
    where: { code: 'warehouse' },
    update: { name: 'Bodega', isActive: true },
    create: { code: 'warehouse', name: 'Bodega', isActive: true },
  });

  const permissionDefinitions = [
    ['companies.manage', 'companies', 'manage', 'Crear y administrar empresas'],
    ['users.manage', 'users', 'manage', 'Crear usuarios y asignar roles'],
    ['settings.manage', 'settings', 'manage', 'Configurar empresa y parametros fiscales'],
    ['clients.manage', 'clients', 'manage', 'Crear y actualizar clientes'],
    ['products.manage', 'products', 'manage', 'Crear y actualizar articulos'],
    ['inventory.manage', 'inventory', 'manage', 'Gestionar bodegas, lotes y movimientos'],
    ['procurement.manage', 'procurement', 'manage', 'Gestionar proveedores, compras y recepciones'],
    ['sales.manage', 'sales', 'manage', 'Gestionar pedidos, facturas y pagos'],
  ];

  const permissions = {};
  for (const [code, module, action, description] of permissionDefinitions) {
    permissions[code] = await prisma.permission.upsert({
      where: { code },
      update: { module, action, description, isActive: true },
      create: { code, module, action, description, isActive: true },
    });
  }

  const rolePermissionMap = {
    root: Object.keys(permissions),
    admin: Object.keys(permissions),
    sales: ['clients.manage', 'sales.manage'],
    warehouse: ['products.manage', 'inventory.manage', 'procurement.manage'],
  };

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissionMap)) {
    const role = { root: rootRole, admin: adminRole, sales: salesRole, warehouse: warehouseRole }[roleCode];
    for (const permissionCode of permissionCodes) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permissions[permissionCode].id,
          },
        },
        update: { isEnabled: true },
        create: {
          roleId: role.id,
          permissionId: permissions[permissionCode].id,
          isEnabled: true,
        },
      });
    }
  }

  const company = await prisma.company.upsert({
    where: { id: 1n },
    update: {
      name: 'inventori',
      legalId: '3-101-000000',
      isActive: true,
      phone: '2222-2222',
      email: 'demo@tracksys.local',
      address: 'San José, Costa Rica',
    },
    create: {
      id: 1n,
      name: 'inventori',
      legalId: '3-101-000000',
      isActive: true,
      phone: '2222-2222',
      email: 'demo@tracksys.local',
      address: 'San José, Costa Rica',
      companyConfig: {
        create: {
          taxPercentage: 13,
          currency: 'CRC',
          pricingMode: 'standard',
          allowBackorder: false,
          settingsJson: {
            inventoryAlerts: true,
            invoicePrefix: 'FAC',
          },
        },
      },
      inventory: {
        create: {
          categories: {
            create: [
              { name: 'Producto terminado', categoryType: 'PT', sortOrder: 1 },
              { name: 'Materia prima', categoryType: 'MP', sortOrder: 2 },
              { name: 'Empaque', categoryType: 'EM', sortOrder: 3 },
            ],
          },
        },
      },
      regions: {
        create: [
          { name: 'Central', routeCode: 'CTR' },
          { name: 'Occidente', routeCode: 'OCC' },
        ],
      },
    },
    include: {
      inventory: { include: { categories: true } },
      regions: true,
    },
  });

  await prisma.companyFiscalConfig.upsert({
    where: {
      companyId_haciendaEnvironment: {
        companyId: company.id,
        haciendaEnvironment: 'STAGING',
      },
    },
    update: {
      legalName: company.name,
      identificationType: '02',
      identificationNumber: company.legalId || '3101000000',
      email: company.email,
      phone: company.phone,
      address: company.address,
      defaultBranchCode: '001',
      defaultTerminalCode: '00001',
      isActive: true,
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
      isActive: true,
    },
  });

  for (const documentType of ['FACTURA_ELECTRONICA', 'TIQUETE_ELECTRONICO', 'NOTA_CREDITO_ELECTRONICA']) {
    await prisma.fiscalSequence.upsert({
      where: {
        companyId_documentType_branchCode_terminalCode: {
          companyId: company.id,
          documentType,
          branchCode: '001',
          terminalCode: '00001',
        },
      },
      update: { isActive: true },
      create: {
        companyId: company.id,
        documentType,
        branchCode: '001',
        terminalCode: '00001',
        currentNumber: 0,
        nextNumber: 1,
        isActive: true,
      },
    });
  }

  const rootPasswordHash = await bcrypt.hash('root1234', rounds);
  const passwordHash = await bcrypt.hash('admin123', rounds);
  const salesPasswordHash = await bcrypt.hash('ventas123', rounds);
  const warehousePasswordHash = await bcrypt.hash('bodega123', rounds);

  await prisma.user.upsert({
    where: { username: 'root' },
    update: {
      fullName: 'Root Inventori',
      passwordHash: rootPasswordHash,
      companyId: company.id,
      roleId: rootRole.id,
      status: UserStatus.ACTIVE,
    },
    create: {
      fullName: 'Root Inventori',
      email: 'root@inventori.local',
      username: 'root',
      passwordHash: rootPasswordHash,
      phone: '8000-0000',
      companyId: company.id,
      roleId: rootRole.id,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      fullName: 'Administrador Demo',
      passwordHash,
      companyId: company.id,
      roleId: adminRole.id,
      status: UserStatus.ACTIVE,
    },
    create: {
      fullName: 'Administrador Demo',
      email: 'admin@tracksys.local',
      username: 'admin',
      passwordHash,
      phone: '8888-8888',
      companyId: company.id,
      roleId: adminRole.id,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { username: 'ventas' },
    update: {
      fullName: 'Usuario Ventas Demo',
      passwordHash: salesPasswordHash,
      companyId: company.id,
      roleId: salesRole.id,
      status: UserStatus.ACTIVE,
    },
    create: {
      fullName: 'Usuario Ventas Demo',
      email: 'ventas@tracksys.local',
      username: 'ventas',
      passwordHash: salesPasswordHash,
      phone: '8777-7777',
      companyId: company.id,
      roleId: salesRole.id,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.user.upsert({
    where: { username: 'bodega' },
    update: {
      fullName: 'Usuario Bodega Demo',
      passwordHash: warehousePasswordHash,
      companyId: company.id,
      roleId: warehouseRole.id,
      status: UserStatus.ACTIVE,
    },
    create: {
      fullName: 'Usuario Bodega Demo',
      email: 'bodega@tracksys.local',
      username: 'bodega',
      passwordHash: warehousePasswordHash,
      phone: '8666-6666',
      companyId: company.id,
      roleId: warehouseRole.id,
      status: UserStatus.ACTIVE,
    },
  });

  const region = await prisma.region.findFirst({ where: { companyId: company.id, name: 'Central' } });

  const client = await prisma.client.upsert({
    where: { id: 1n },
    update: {
      name: 'Cliente Demo',
      paymentType: PaymentType.CREDIT,
      paymentDays: 30,
    },
    create: {
      id: 1n,
      companyId: company.id,
      regionId: region?.id,
      code: 'CLI-001',
      name: 'Cliente Demo',
      legalId: '1-111-111111',
      emailBilling: 'cliente@demo.local',
      phone: '7000-0000',
      address: 'Heredia',
      paymentType: PaymentType.CREDIT,
      paymentDays: 30,
      contacts: {
        create: [{ name: 'Encargado Compras', email: 'compras@demo.local', phone: '7000-0001' }],
      },
    },
  });

  const finishedCategory = company.inventory?.categories.find((item) => item.categoryType === 'PT');
  const rawCategory = company.inventory?.categories.find((item) => item.categoryType === 'MP');

  const rawMaterial = await prisma.product.upsert({
    where: { id: 1n },
    update: {
      name: 'Base concentrada',
      quantity: 100,
    },
    create: {
      id: 1n,
      companyId: company.id,
      categoryId: rawCategory?.id,
      code: 'MP-001',
      name: 'Base concentrada',
      unit: 'KG',
      quantity: 100,
      minStock: 10,
      maxStock: 500,
      price: 2500,
    },
  });

  const recipe = await prisma.recipe.upsert({
    where: { id: 1n },
    update: { name: 'Receta demo 1' },
    create: {
      id: 1n,
      companyId: company.id,
      code: 'RCT-001',
      name: 'Receta demo 1',
      ingredients: {
        create: [{ productId: rawMaterial.id, quantity: 2.5, sortOrder: 1 }],
      },
    },
  });

  const finalProduct = await prisma.product.upsert({
    where: { id: 2n },
    update: { name: 'Producto demo final' },
    create: {
      id: 2n,
      companyId: company.id,
      categoryId: finishedCategory?.id,
      recipeId: recipe.id,
      code: 'PT-001',
      name: 'Producto demo final',
      unit: 'UN',
      price: 4500,
      quantity: 20,
      inCatalog: true,
      netContent: 1,
    },
  });

  const salesUser = await prisma.user.findUnique({ where: { username: 'ventas' } });

  const order = await prisma.order.upsert({
    where: { id: 1n },
    update: { total: 4500 },
    create: {
      id: 1n,
      companyId: company.id,
      clientId: client.id,
      userId: salesUser?.id,
      receiptNumber: 'REC-001',
      total: 4500,
      status: 'APPROVED',
      approved: true,
      isCash: false,
      items: {
        create: [{ productId: finalProduct.id, quantity: 1, unitPrice: 4500, approved: true }],
      },
    },
  });

  const invoice = await prisma.invoice.upsert({
    where: { number: 'FAC-001' },
    update: { amount: 4500 },
    create: {
      clientId: client.id,
      orderId: order.id,
      number: 'FAC-001',
      amount: 4500,
      status: 'PENDING',
    },
  });

  await prisma.payment.upsert({
    where: { id: 1n },
    update: { amount: 1000 },
    create: {
      id: 1n,
      invoiceId: invoice.id,
      amount: 1000,
      paymentMethod: 'TRANSFER',
      reference: 'TRX-DEMO-001',
    },
  });

  console.log('Seed completado con estructura base');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
