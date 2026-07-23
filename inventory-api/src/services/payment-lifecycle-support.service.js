const paymentRepository = require('../repositories/payment.repository');
const invoiceRepository = require('../repositories/invoice.repository');
const { createHttpError } = require('../lib/errors');
const {
  getAppliedAmountDecimal,
  calculateDerivedInvoiceFinancialState,
} = require('./invoice-financial-state');
const {
  addMoney,
  compareMoney,
} = require('../lib/money');
const { assertLifecycleStatusAllowed } = require('./approval-baseline.service');

const EDITABLE_PAYMENT_STATUSES = ['PENDING_APPROVAL', 'UNDER_REVIEW'];

function assertInvoiceAllowsNewPayments(invoice) {
  if (invoice.status === 'CANCELLED') {
    throw createHttpError(
      409,
      'La factura esta cancelada y no admite pagos nuevos; use solo reversos o correcciones documentadas',
      'conflict',
    );
  }
}

function assertPaymentEditable(payment) {
  if (!EDITABLE_PAYMENT_STATUSES.includes(payment.status)) {
    throw createHttpError(
      409,
      'El pago ya no admite edicion directa; use la revision administrativa o notas de credito/debito segun corresponda',
      'conflict',
    );
  }
}

function assertPaymentCanMoveToReview(payment) {
  assertLifecycleStatusAllowed(payment.status, ['PENDING_APPROVAL'], 'Solo pagos pendientes de aprobacion pueden pasar a revision');
}

function assertPaymentCanBeRejected(payment) {
  assertLifecycleStatusAllowed(payment.status, ['PENDING_APPROVAL', 'UNDER_REVIEW'], 'Solo pagos pendientes o en revision pueden rechazarse');
}

function assertPaymentCanBeApproved(payment) {
  assertLifecycleStatusAllowed(payment.status, ['PENDING_APPROVAL', 'UNDER_REVIEW'], 'Solo pagos pendientes o en revision pueden aprobarse');
}

function assertPaymentCanBeReversed(payment) {
  if (payment.status === 'REVERSED') {
    throw createHttpError(409, 'El pago ya fue reversado', 'conflict');
  }

  if (payment.status !== 'APPROVED') {
    throw createHttpError(409, 'Solo pagos aprobados pueden reversarse', 'conflict');
  }
}

function assertNoApprovalOverpayment(invoice, paymentToApprove) {
  const appliedAmount = getAppliedAmountDecimal(invoice);
  const nextAppliedAmount = addMoney(appliedAmount, paymentToApprove.amount || 0);
  const invoiceAmount = invoice.amount || 0;

  if (compareMoney(nextAppliedAmount, invoiceAmount) > 0) {
    throw createHttpError(
      409,
      'La aprobacion excede el saldo de la factura y deja dinero a devolver al cliente; revise el cobro antes de aprobar',
      'conflict',
    );
  }
}

async function synchronizeInvoiceFinancialState(invoiceId, companyId, db = null) {
  const databaseClient = db || undefined;
  const invoice = await invoiceRepository.findCompanyInvoiceForFinancialSync(invoiceId, companyId, databaseClient);
  if (!invoice) {
    throw createHttpError(404, 'Factura no encontrada para sincronizacion financiera', 'not_found');
  }

  const derivedState = calculateDerivedInvoiceFinancialState(invoice);
  return invoiceRepository.updateCompanyInvoiceFinancialState(invoiceId, companyId, derivedState, databaseClient);
}

/**
 * @param {(tx: any) => Promise<any>} work
 * @returns {Promise<any>}
 */
function executePaymentFinancialSyncTransaction(work) {
  return /** @type {Promise<any>} */ (paymentRepository.transaction(async (tx) => work(tx)));
}

module.exports = {
  assertInvoiceAllowsNewPayments,
  assertPaymentEditable,
  assertPaymentCanMoveToReview,
  assertPaymentCanBeRejected,
  assertPaymentCanBeApproved,
  assertPaymentCanBeReversed,
  assertNoApprovalOverpayment,
  synchronizeInvoiceFinancialState,
  executePaymentFinancialSyncTransaction,
};
