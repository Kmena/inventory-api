const fs = require('node:fs/promises');

const paymentRepository = require('../repositories/payment.repository');
const invoiceRepository = require('../repositories/invoice.repository');
const { createHttpError } = require('../lib/errors');
const { buildPaginatedResponse } = require('../lib/pagination');
const audit = require('../lib/audit');
const {
  buildPrivatePaymentReceiptPath,
} = require('../lib/payment-receipt-storage');
const {
  getActorUserId,
  hasAnyPermission,
  assertHasAnyPermission,
} = require('./approval-baseline.service');
const {
  assertInvoiceAllowsNewPayments,
  assertPaymentEditable,
  assertPaymentCanMoveToReview,
  assertPaymentCanBeRejected,
  assertPaymentCanBeApproved,
  assertPaymentCanBeReversed,
  assertNoApprovalOverpayment,
  synchronizeInvoiceFinancialState,
  executePaymentFinancialSyncTransaction,
} = require('./payment-lifecycle-support.service');
const {
  serializePayment,
  serializePaymentList,
  validatePaymentReceiptPayload,
  createPaymentReceiptEvidence,
  replacePaymentReceiptEvidence,
} = require('./payment-receipt-evidence.service');

const PAYMENT_VIEW_ALL_PERMISSIONS = [
  'sales.manage',
  'collections.view.all',
  'collections.payments.approve',
  'collections.payments.reverse',
];
const PAYMENT_MANAGE_OWN_PERMISSIONS = ['sales.manage', 'collections.manage.own'];
const PAYMENT_APPROVAL_PERMISSIONS = ['collections.payments.approve'];
const PAYMENT_REVERSE_PERMISSIONS = ['collections.payments.reverse'];

function assertCompanyScope(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'Se requiere una empresa activa para revisar pagos', 'forbidden');
  }
  return BigInt(auth.companyId);
}

function resolvePaymentReadScope(auth) {
  if (hasAnyPermission(auth, PAYMENT_VIEW_ALL_PERMISSIONS)) {
    return {};
  }

  if (hasAnyPermission(auth, PAYMENT_MANAGE_OWN_PERMISSIONS)) {
    const submittedByUserId = getActorUserId(auth);
    if (!submittedByUserId) {
      throw createHttpError(403, 'No se pudo determinar el usuario autenticado para revisar sus pagos', 'forbidden');
    }
    return { submittedByUserId };
  }

  throw createHttpError(403, 'No tiene permisos para revisar pagos', 'forbidden');
}


async function listPayments(auth, pagination = null) {
  const companyId = assertCompanyScope(auth);
  const payments = await paymentRepository.findCompanyPayments(companyId, pagination, resolvePaymentReadScope(auth));
  if (!pagination) {
    return serializePaymentList(payments);
  }
  const paginatedPayments = /** @type {{ items: Array<any>, totalItems: number }} */ (payments);
  return buildPaginatedResponse(serializePaymentList(paginatedPayments.items), pagination, paginatedPayments.totalItems);
}

async function getPayment(id, auth, options = {}) {
  const companyId = assertCompanyScope(auth);
  const payment = await paymentRepository.findCompanyPaymentById(
    id,
    companyId,
    options.ignoreOwnershipScope ? {} : resolvePaymentReadScope(auth),
  );
  if (!payment) throw createHttpError(404, 'Pago no encontrado', 'not_found');
  return serializePayment(payment);
}

async function getRawPaymentForCompany(id, companyId, db = null) {
  const payment = await paymentRepository.findCompanyPaymentById(id, companyId, {}, db || undefined);
  if (!payment) {
    throw createHttpError(404, 'Pago no encontrado', 'not_found');
  }
  return payment;
}

async function validatePaymentInvoice(invoiceId, companyId, db = null) {
  const invoice = await invoiceRepository.findCompanyInvoiceForFinancialSync(invoiceId, companyId, db || undefined);
  if (!invoice) {
    throw createHttpError(400, 'La factura no pertenece a la empresa autenticada', 'validation_error');
  }
  return invoice;
}

async function createPayment(payload, auth, req = null) {
  const companyId = assertCompanyScope(auth);
  assertHasAnyPermission(auth, PAYMENT_MANAGE_OWN_PERMISSIONS, 'No tiene permisos para registrar pagos');
  const invoice = await validatePaymentInvoice(payload.invoiceId, companyId);
  assertInvoiceAllowsNewPayments(invoice);

  const normalizedReceiptFile = payload.receiptFile
    ? {
        ...payload.receiptFile,
        _validatedReceiptPayload: validatePaymentReceiptPayload(payload.receiptFile),
      }
    : null;

  const paymentId = normalizedReceiptFile ? await paymentRepository.reservePaymentId() : null;
  let payment;

  try {
    payment = normalizedReceiptFile
      ? await paymentRepository.transaction(async (tx) => {
          const createdPayment = await paymentRepository.createPayment({
            id: paymentId,
            invoiceId: payload.invoiceId,
            amount: payload.amount,
            paymentMethod: payload.paymentMethod,
            reference: payload.reference,
            status: 'PENDING_APPROVAL',
            submittedByUserId: getActorUserId(auth),
            submittedAt: new Date(),
          }, tx);
          await createPaymentReceiptEvidence(createdPayment, normalizedReceiptFile, auth, tx);
          return createdPayment;
        })
      : await paymentRepository.createPayment({
          invoiceId: payload.invoiceId,
          amount: payload.amount,
          paymentMethod: payload.paymentMethod,
          reference: payload.reference,
          status: 'PENDING_APPROVAL',
          submittedByUserId: getActorUserId(auth),
          submittedAt: new Date(),
        });
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }
    throw createHttpError(500, 'No se pudo guardar la evidencia del pago', 'internal_server_error');
  }

  const createdPayment = await paymentRepository.findCompanyPaymentById(payment.id, companyId);
  await audit.recordAuditEventIfAvailable({
    req,
    action: 'payments.create',
    resourceType: 'payment',
    resourceId: payment.id,
    outcome: 'SUCCESS',
    afterState: {
      id: payment.id,
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      status: 'PENDING_APPROVAL',
      submittedByUserId: getActorUserId(auth),
      hasReceiptEvidence: Boolean((createdPayment?.receipts || []).length),
    },
  });

  return serializePayment(createdPayment);
}

async function updatePayment(id, payload, auth, req = null) {
  const companyId = assertCompanyScope(auth);
  assertHasAnyPermission(auth, PAYMENT_MANAGE_OWN_PERMISSIONS, 'No tiene permisos para editar pagos');
  const ownershipScope = resolvePaymentReadScope(auth);
  const existingPayment = await paymentRepository.findCompanyPaymentById(id, companyId, ownershipScope);

  if (!existingPayment) {
    throw createHttpError(404, 'Pago no encontrado', 'not_found');
  }

  assertPaymentEditable(existingPayment);

  const invoiceId = payload.invoiceId ?? existingPayment.invoiceId;
  const invoice = await validatePaymentInvoice(invoiceId, companyId);
  assertInvoiceAllowsNewPayments(invoice);

  const updatedPayment = await paymentRepository.updateCompanyPayment(id, companyId, {
    ...(payload.invoiceId !== undefined ? { invoiceId: payload.invoiceId } : {}),
    ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
    ...(payload.paymentMethod !== undefined ? { paymentMethod: payload.paymentMethod } : {}),
    ...(payload.reference !== undefined ? { reference: payload.reference } : {}),
  });

  if (!updatedPayment) {
    throw createHttpError(404, 'Pago no encontrado', 'not_found');
  }

  const normalizedReceiptFile = payload.receiptFile
    ? {
        ...payload.receiptFile,
        _validatedReceiptPayload: validatePaymentReceiptPayload(payload.receiptFile),
      }
    : null;

  const paymentWithReceipt = normalizedReceiptFile
    ? await replacePaymentReceiptEvidence(updatedPayment, normalizedReceiptFile, auth)
    : updatedPayment;

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'payments.update',
    resourceType: 'payment',
    resourceId: id,
    outcome: 'SUCCESS',
    beforeState: {
      id: existingPayment.id,
      invoiceId: existingPayment.invoiceId,
      amount: existingPayment.amount,
      status: existingPayment.status,
      reference: existingPayment.reference,
    },
    afterState: {
      id: paymentWithReceipt.id,
      invoiceId: paymentWithReceipt.invoiceId,
      amount: paymentWithReceipt.amount,
      status: paymentWithReceipt.status,
      reference: paymentWithReceipt.reference,
      hasReceiptEvidence: Boolean((paymentWithReceipt.receipts || []).length),
    },
  });

  return serializePayment(paymentWithReceipt);
}

async function markPaymentUnderReview(id, payload, auth, req = null) {
  const companyId = assertCompanyScope(auth);
  assertHasAnyPermission(auth, PAYMENT_APPROVAL_PERMISSIONS, 'No tiene permisos para revisar pagos');
  const existingPayment = await getRawPaymentForCompany(id, companyId);
  assertPaymentCanMoveToReview(existingPayment);

  const updatedPayment = await paymentRepository.markPaymentUnderReview(id, companyId, {
    underReviewAt: new Date(),
    underReviewByUserId: getActorUserId(auth),
    reviewReason: payload.reason,
  });

  if (!updatedPayment) {
    throw createHttpError(409, 'El pago no pudo pasar a revision', 'conflict');
  }

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'payments.review',
    resourceType: 'payment',
    resourceId: id,
    outcome: 'SUCCESS',
    beforeState: {
      id: existingPayment.id,
      status: existingPayment.status,
    },
    afterState: {
      id: updatedPayment.id,
      status: updatedPayment.status,
      reviewReason: updatedPayment.reviewReason,
    },
  });

  return serializePayment(updatedPayment);
}

async function approvePayment(id, payload, auth, req = null) {
  const companyId = assertCompanyScope(auth);
  assertHasAnyPermission(auth, PAYMENT_APPROVAL_PERMISSIONS, 'No tiene permisos para aprobar pagos');
  const existingPayment = await getRawPaymentForCompany(id, companyId);
  assertPaymentCanBeApproved(existingPayment);

  const invoice = await validatePaymentInvoice(existingPayment.invoiceId, companyId);
  assertNoApprovalOverpayment(invoice, existingPayment);

  const approvedAt = new Date();
  const approvedByUserId = getActorUserId(auth);

  /** @type {{ approvedPayment: any, synchronizedInvoice: any }} */
  const { approvedPayment, synchronizedInvoice } = await executePaymentFinancialSyncTransaction(async (tx) => {
    const transactionalPayment = await getRawPaymentForCompany(id, companyId, tx);
    assertPaymentCanBeApproved(transactionalPayment);

    const transactionalInvoice = await validatePaymentInvoice(transactionalPayment.invoiceId, companyId, tx);
    assertNoApprovalOverpayment(transactionalInvoice, transactionalPayment);

    const approvedPaymentResult = await paymentRepository.approveCompanyPayment(id, companyId, {
      approvedAt,
      approvedByUserId,
      reviewReason: payload.note || transactionalPayment.reviewReason || null,
    }, tx);

    if (!approvedPaymentResult) {
      throw createHttpError(409, 'El pago no pudo aprobarse', 'conflict');
    }

    const synchronizedInvoiceResult = await synchronizeInvoiceFinancialState(transactionalPayment.invoiceId, companyId, tx);

    return {
      approvedPayment: approvedPaymentResult,
      synchronizedInvoice: synchronizedInvoiceResult,
    };
  });

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'payments.approve',
    resourceType: 'payment',
    resourceId: id,
    outcome: 'SUCCESS',
    beforeState: {
      id: existingPayment.id,
      status: existingPayment.status,
      invoiceId: existingPayment.invoiceId,
      amount: existingPayment.amount,
    },
    afterState: {
      id: approvedPayment.id,
      status: approvedPayment.status,
      invoiceId: approvedPayment.invoiceId,
      approvedAt: approvedPayment.approvedAt,
      invoiceStatus: synchronizedInvoice?.status,
      invoicePaidAt: synchronizedInvoice?.paidAt || null,
    },
  });

  return serializePayment(approvedPayment);
}

async function rejectPayment(id, payload, auth, req = null) {
  const companyId = assertCompanyScope(auth);
  assertHasAnyPermission(auth, PAYMENT_APPROVAL_PERMISSIONS, 'No tiene permisos para rechazar pagos');
  const existingPayment = await getRawPaymentForCompany(id, companyId);
  assertPaymentCanBeRejected(existingPayment);

  const rejectedAt = new Date();
  const rejectedByUserId = getActorUserId(auth);

  /** @type {any} */
  const rejectedPayment = await executePaymentFinancialSyncTransaction(async (tx) => {
    const transactionalPayment = await getRawPaymentForCompany(id, companyId, tx);
    assertPaymentCanBeRejected(transactionalPayment);

    const rejectedPaymentResult = await paymentRepository.rejectCompanyPayment(id, companyId, {
      rejectedAt,
      rejectedByUserId,
      rejectionReason: payload.reason,
    }, tx);

    if (!rejectedPaymentResult) {
      throw createHttpError(409, 'El pago no pudo rechazarse', 'conflict');
    }

    await synchronizeInvoiceFinancialState(transactionalPayment.invoiceId, companyId, tx);
    return rejectedPaymentResult;
  });

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'payments.reject',
    resourceType: 'payment',
    resourceId: id,
    outcome: 'SUCCESS',
    beforeState: {
      id: existingPayment.id,
      status: existingPayment.status,
    },
    afterState: {
      id: rejectedPayment.id,
      status: rejectedPayment.status,
      rejectionReason: rejectedPayment.rejectionReason,
    },
  });

  return serializePayment(rejectedPayment);
}

async function reversePayment(id, auth, reason, req = null) {
  const companyId = assertCompanyScope(auth);
  assertHasAnyPermission(auth, PAYMENT_REVERSE_PERMISSIONS, 'No tiene permisos para reversar pagos');
  const existingPayment = await getRawPaymentForCompany(id, companyId);
  assertPaymentCanBeReversed(existingPayment);

  const reversedAt = new Date();
  const reversedByUserId = getActorUserId(auth);
  /** @type {{ reversedPayment: any, synchronizedInvoice: any }} */
  const { reversedPayment, synchronizedInvoice } = await executePaymentFinancialSyncTransaction(async (tx) => {
    const transactionalPayment = await getRawPaymentForCompany(id, companyId, tx);
    assertPaymentCanBeReversed(transactionalPayment);

    const result = await paymentRepository.reverseCompanyPayment(id, companyId, {
      reversedAt,
      reversedByUserId,
      reversalReason: reason,
    }, tx);

    if (!result || result.count === 0) {
      throw createHttpError(404, 'Pago no encontrado', 'not_found');
    }

    const reversedPaymentResult = await paymentRepository.findCompanyPaymentById(id, companyId, {}, tx);
    const synchronizedInvoiceResult = await synchronizeInvoiceFinancialState(transactionalPayment.invoiceId, companyId, tx);

    return {
      reversedPayment: reversedPaymentResult,
      synchronizedInvoice: synchronizedInvoiceResult,
    };
  });

  await audit.recordAuditEventIfAvailable({
    req,
    action: 'payments.reverse',
    resourceType: 'payment',
    resourceId: id,
    outcome: 'SUCCESS',
    beforeState: {
      id: existingPayment.id,
      invoiceId: existingPayment.invoiceId,
      amount: existingPayment.amount,
      status: existingPayment.status,
    },
    afterState: {
      id,
      status: 'REVERSED',
      reversedAt,
      reversedByUserId,
      reversalReason: reason,
      invoiceStatus: synchronizedInvoice?.status,
      invoicePaidAt: synchronizedInvoice?.paidAt || null,
    },
  });

  return serializePayment(reversedPayment);
}

async function removePayment(id, auth, req = null) {
  await reversePayment(id, auth, 'DELETE_COMPATIBILITY_FLOW', req);
  return { count: 1 };
}

async function getPaymentReceiptDownload(paymentId, receiptId, auth) {
  const companyId = assertCompanyScope(auth);
  const scope = resolvePaymentReadScope(auth);
  if (scope.submittedByUserId) {
    await getPayment(paymentId, auth);
  }

  const receipt = await paymentRepository.findCompanyPaymentReceiptById(paymentId, receiptId, companyId);
  if (!receipt) {
    throw createHttpError(404, 'Comprobante no encontrado', 'not_found');
  }

  const absolutePath = buildPrivatePaymentReceiptPath({
    companyId,
    paymentId,
    storageRef: receipt.storageRef,
  });

  try {
    await fs.access(absolutePath);
  } catch {
    throw createHttpError(404, 'Comprobante no disponible para descarga', 'not_found');
  }

  return {
    absolutePath,
    fileName: receipt.originalFileName,
    mimeType: receipt.mimeType || 'application/octet-stream',
  };
}

module.exports = {
  listPayments,
  getPayment,
  getPaymentReceiptDownload,
  createPayment,
  updatePayment,
  markPaymentUnderReview,
  approvePayment,
  rejectPayment,
  reversePayment,
  removePayment,
};
