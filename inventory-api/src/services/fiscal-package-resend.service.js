const prisma = require('../lib/prisma');
const { BillingApiClient, BillingClientError } = require('./billing-api-client.service');
const { createBillingCredentialResolver } = require('./billing-credential-resolver.service');
const { createHttpError } = require('../lib/errors');

function mapResendBillingError(error) {
  if (!(error instanceof BillingClientError)) return createHttpError(502, 'No se pudo solicitar el reenvío de documentos', 'BILLING_RESEND_UNAVAILABLE');
  if (error.code === 'BILLING_TIMEOUT') return createHttpError(504, 'Tiempo de espera agotado al solicitar el reenvío', 'BILLING_TIMEOUT');
  if (error.code === 'BILLING_UNAVAILABLE' || error.statusCode === 429 || error.statusCode === 503) return createHttpError(503, 'Servicio de facturación no disponible temporalmente', 'BILLING_UNAVAILABLE');
  if (error.statusCode === 409) return createHttpError(409, 'El reenvío ya está en proceso', 'FISCAL_RESEND_CONFLICT');
  return createHttpError(422, 'El sistema de facturación rechazó la solicitud de reenvío', 'FISCAL_RESEND_REJECTED');
}

async function requestAcceptedPackageResend(invoiceId, companyId, options = {}) {
  const db = options.db || prisma;
  const invoice = await db.invoice.findFirst({ where: { id: invoiceId, client: { companyId } }, select: { id: true } });
  if (!invoice) throw createHttpError(404, 'Factura no encontrada', 'not_found');
  const intent = await db.invoiceFiscalIntent.findUnique({ where: { invoiceId }, include: { integrationConfig: true } });
  if (!intent) throw createHttpError(422, 'Esta factura no tiene emisión fiscal', 'FISCAL_INTENT_NOT_FOUND');
  if (intent.companyId.toString() !== companyId.toString()) throw createHttpError(403, 'Acceso denegado', 'forbidden');
  if (intent.status !== 'ACCEPTED') throw createHttpError(422, 'El comprobante fiscal no está aceptado', 'FISCAL_DOCUMENT_NOT_ACCEPTED');
  if (!intent.billingFiscalDocumentId || !intent.integrationConfig) throw createHttpError(422, 'El documento fiscal no está disponible para reenvío', 'FISCAL_DOCUMENT_NOT_READY');
  const config = intent.integrationConfig;
  const client = options.billingClient || new BillingApiClient({ baseUrl: config.baseUrl || process.env.BILLING_BASE_URL, credentialResolver: createBillingCredentialResolver(), timeoutMs: Number(process.env.BILLING_TIMEOUT_MS) || 10000 });
  try {
    return await client.requestAcceptedPackageResend({ billingCompanyId: config.billingCompanyId, environment: String(config.billingEnvironment).toUpperCase(), billingFiscalDocumentId: intent.billingFiscalDocumentId, secretReference: config.billingCredentialSecretRef, correlationId: options.correlationId || `inventori-resend-${invoiceId}-${Date.now()}` });
  } catch (error) {
    throw mapResendBillingError(error);
  }
}
module.exports = { requestAcceptedPackageResend, mapResendBillingError };