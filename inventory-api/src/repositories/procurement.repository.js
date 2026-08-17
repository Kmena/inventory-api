const prisma = require('../lib/prisma');

const purchaseRequestInclude = {
  items: {
    include: { product: true },
  },
  quotations: {
    include: {
      supplier: true,
      items: {
        include: { product: true },
      },
    },
  },
  selections: {
    include: {
      quotation: {
        include: {
          supplier: true,
          items: {
            include: { product: true },
          },
        },
      },
    },
  },
  purchaseOrders: {
    include: {
      supplier: true,
      items: {
        include: { product: true },
      },
    },
  },
};

function transaction(work) {
  return prisma.$transaction(work);
}

function createAssistedPurchaseRequest(data, db = prisma) {
  return db.purchaseRequest.create({
    data,
    include: purchaseRequestInclude,
  });
}

function findCompanyConfigByCompanyId(companyId, db = prisma) {
  return db.companyConfig.findUnique({
    where: { companyId },
  });
}

function findSupplierByIdForCompany(supplierId, companyId, db = prisma) {
  return db.supplier.findFirst({
    where: { id: supplierId, companyId },
  });
}

function findProductByIdForCompany(productId, companyId, db = prisma) {
  return db.product.findFirst({
    where: { id: productId, companyId, isActive: true },
    include: {
      supplierLinks: true,
    },
  });
}

function listQuotableProductsForCompany(companyId, db = prisma) {
  return db.product.findMany({
    where: {
      companyId,
      isActive: true,
      supplierLinks: {
        some: {},
      },
    },
    select: {
      id: true,
      companyId: true,
      sku: true,
      name: true,
      inventoryType: true,
      sourcingMethod: true,
      quantity: true,
      minStock: true,
      supplierLinks: {
        select: {
          supplierId: true,
        },
        orderBy: [{ supplierId: 'asc' }],
      },
    },
  });
}

function findProductSupplierPricingByProductIdForCompany(productId, companyId, db = prisma) {
  return db.product.findFirst({
    where: {
      id: productId,
      companyId,
      isActive: true,
      supplierLinks: {
        some: {},
      },
    },
    select: {
      id: true,
      companyId: true,
      sku: true,
      name: true,
      quantity: true,
      minStock: true,
      supplierLinks: {
        include: {
          supplier: true,
        },
        orderBy: [{ isPreferred: 'desc' }, { supplierId: 'asc' }],
      },
    },
  });
}

function createPurchaseRequest(data, db = prisma) {
  return db.purchaseRequest.create({
    data,
    include: purchaseRequestInclude,
  });
}

function listPurchaseRequests(companyId, db = prisma) {
  return db.purchaseRequest.findMany({
    where: { companyId },
    include: purchaseRequestInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

function findPurchaseRequestByIdForCompany(id, companyId, db = prisma) {
  return db.purchaseRequest.findFirst({
    where: { id, companyId },
    include: purchaseRequestInclude,
  });
}

function updatePurchaseRequest(id, _companyId, data, db = prisma) {
  return db.purchaseRequest.update({
    where: { id },
    data,
    include: purchaseRequestInclude,
  });
}

function createSupplierQuotation(data, db = prisma) {
  return db.supplierQuotation.create({
    data,
    include: {
      supplier: true,
      items: {
        include: { product: true },
      },
    },
  });
}

function findSupplierQuotationByIdForCompany(id, companyId, db = prisma) {
  return db.supplierQuotation.findFirst({
    where: { id, companyId },
    include: {
      supplier: true,
      purchaseRequest: true,
      items: {
        include: { product: true },
      },
    },
  });
}

function updateSupplierQuotation(id, _companyId, data, db = prisma) {
  return db.supplierQuotation.update({
    where: { id },
    data,
    include: {
      supplier: true,
      items: {
        include: { product: true },
      },
    },
  });
}

function createSupplierSelection(data, db = prisma) {
  return db.supplierSelection.create({
    data,
    include: {
      quotation: {
        include: {
          supplier: true,
          items: {
            include: { product: true },
          },
        },
      },
    },
  });
}

function findSupplierSelectionByIdForCompany(id, companyId, db = prisma) {
  return db.supplierSelection.findFirst({
    where: { id, companyId },
    include: {
      quotation: {
        include: {
          supplier: true,
          items: {
            include: { product: true },
          },
        },
      },
      purchaseRequest: true,
    },
  });
}

function updateSupplierSelection(id, _companyId, data, db = prisma) {
  return db.supplierSelection.update({
    where: { id },
    data,
    include: {
      quotation: {
        include: {
          supplier: true,
          items: {
            include: { product: true },
            orderBy: [{ id: 'asc' }],
          },
        },
      },
    },
  });
}

function createPurchaseOrder(data, db = prisma) {
  return db.purchaseOrder.create({
    data,
    include: {
      supplier: true,
      items: {
        include: { product: true },
      },
    },
  });
}

function findPurchaseOrderByIdForCompany(id, companyId, db = prisma) {
  return db.purchaseOrder.findFirst({
    where: { id, companyId },
    include: {
      supplier: true,
      items: {
        include: { product: true },
        orderBy: [{ id: 'asc' }],
      },
      quotation: true,
      selection: true,
      purchaseRequest: true,
    },
  });
}

function listPurchaseOrders(companyId, db = prisma) {
  return db.purchaseOrder.findMany({
    where: { companyId },
    include: {
      supplier: true,
      items: { include: { product: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = {
  transaction,
  createAssistedPurchaseRequest,
  findCompanyConfigByCompanyId,
  findSupplierByIdForCompany,
  findProductByIdForCompany,
  listQuotableProductsForCompany,
  findProductSupplierPricingByProductIdForCompany,
  createPurchaseRequest,
  listPurchaseRequests,
  findPurchaseRequestByIdForCompany,
  updatePurchaseRequest,
  createSupplierQuotation,
  findSupplierQuotationByIdForCompany,
  updateSupplierQuotation,
  createSupplierSelection,
  findSupplierSelectionByIdForCompany,
  updateSupplierSelection,
  createPurchaseOrder,
  findPurchaseOrderByIdForCompany,
  listPurchaseOrders,
};
