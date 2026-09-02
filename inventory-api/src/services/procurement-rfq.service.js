'use strict';

const { createHttpError } = require('../lib/errors');
const audit = require('../lib/audit');
const { generateTokenPair, hashToken } = require('../lib/secure-token');
const rfqRepository = require('../repositories/procurement-rfq.repository');

const DEFAULT_TOKEN_TTL_DAYS = 7;
const PUBLIC_APP_BASE_URL = process.env.PUBLIC_APP_BASE_URL || '';

function assertCompanyScope(auth) {
  if (!auth?.companyId) {
    throw createHttpError(403, 'El usuario debe pertenecer a una empresa', 'forbidden');
  }
  return {
    companyId: BigInt(auth.companyId),
    actorUserId: auth.sub ? BigInt(auth.sub) : null,
  };
}

function getTokenTtlDays() {
  const envVal = process.env.RFQ_TOKEN_TTL_DAYS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_TOKEN_TTL_DAYS;
}

function buildSecureLink(rawToken) {
  const base = PUBLIC_APP_BASE_URL || `${process.env.APP_BASE_URL || 'http://localhost:2500'}`;
  return `${base}/supplier-quote/?token=${encodeURIComponent(rawToken)}`;
}

function buildEmailMachote(invitation, rawToken, request) {
  const supplierName = invitation.supplier?.name || 'Proveedor';
  const companyName = invitation.purchaseRequest?.company?.name || '';
  const requestTitle = request?.title || invitation.purchaseRequest?.title || 'Solicitud de cotización';
  const expiresAt = invitation.expiresAt instanceof Date
    ? invitation.expiresAt.toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' })
    : String(invitation.expiresAt);
  const secureLink = buildSecureLink(rawToken);

  const productLines = (request?.items || invitation.purchaseRequest?.items || [])
    .map((item) => `- ${item.product?.name || `Producto #${item.productId}`}: ${item.quantity} unidades`)
    .join('\n');

  const emailSubject = `Solicitud de cotización: ${requestTitle}`;
  const emailBody = [
    `Estimado(a) ${supplierName},`,
    '',
    `Le solicitamos cotización para los siguientes productos:`,
    '',
    productLines,
    '',
    `Por favor ingrese sus precios y plazos de entrega en el siguiente enlace:`,
    secureLink,
    '',
    `Este enlace vence el ${expiresAt}.`,
    '',
    companyName ? `Atentamente,\n${companyName}` : 'Atentamente,',
  ].join('\n');

  return { emailSubject, emailBody, secureLink, expiresAt: invitation.expiresAt };
}

function serializeInvitation(inv) {
  return {
    id: inv.id,
    companyId: inv.companyId,
    purchaseRequestId: inv.purchaseRequestId,
    supplierId: inv.supplierId,
    quotationId: inv.quotationId,
    status: inv.status,
    emailTo: inv.emailTo,
    emailSubject: inv.emailSubject,
    emailBody: inv.emailBody,
    responseSource: inv.responseSource,
    expiresAt: inv.expiresAt,
    preparedAt: inv.preparedAt,
    respondedAt: inv.respondedAt,
    cancelledAt: inv.cancelledAt,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
    supplier: inv.supplier ? { id: inv.supplier.id, name: inv.supplier.name, email: inv.supplier.email } : null,
    quotation: inv.quotation ? { id: inv.quotation.id, status: inv.quotation.status } : null,
  };
}

function serializeQuotationResponseItem(item) {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.product?.name || `Producto #${item.productId}`,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    leadTimeDays: item.leadTimeDays ?? null,
    availabilityNotes: item.availabilityNotes ?? null,
    notes: item.notes ?? null,
    lineTotal: Number(item.quantity) * Number(item.unitPrice),
  };
}

function serializeQuotationResponseSummary(quotation, fallbackResponseSource = null) {
  if (!quotation) {
    return null;
  }

  const items = (quotation.items || []).map(serializeQuotationResponseItem);
  return {
    id: quotation.id,
    supplierId: quotation.supplierId,
    supplierName: quotation.supplier?.name || 'Proveedor',
    supplierEmail: quotation.supplier?.email || null,
    status: quotation.status,
    currency: quotation.currency || 'CRC',
    notes: quotation.notes || null,
    submittedAt: quotation.submittedAt || null,
    createdAt: quotation.createdAt || null,
    updatedAt: quotation.updatedAt || null,
    responseSource: fallbackResponseSource,
    itemCount: items.length,
    totalAmount: items.reduce((sum, item) => sum + item.lineTotal, 0),
    items,
  };
}

function isInvitationExpired(invitation, now = new Date()) {
  if (!invitation?.expiresAt) {
    return false;
  }

  const expiresAt = invitation.expiresAt instanceof Date ? invitation.expiresAt : new Date(invitation.expiresAt);
  return !Number.isNaN(expiresAt.getTime()) && now.getTime() > expiresAt.getTime();
}

async function persistExpiredInvitationIfNeeded(invitation, db = null) {
  if (!invitation || invitation.status === 'EXPIRED') {
    return invitation;
  }

  if (invitation.status === 'RESPONDED' || invitation.status === 'CANCELLED') {
    return invitation;
  }

  if (!isInvitationExpired(invitation)) {
    return invitation;
  }

  return rfqRepository.updateInvitation(invitation.id, {
    status: 'EXPIRED',
  }, db || undefined);
}

async function persistExpiredInvitationsIfNeeded(invitations, db = null) {
  return Promise.all((invitations || []).map((invitation) => persistExpiredInvitationIfNeeded(invitation, db)));
}

function assertInvitationAvailableForInternalMutation(invitation) {
  if (invitation.status === 'RESPONDED') {
    throw createHttpError(409, 'La invitación ya fue respondida', 'already_responded');
  }
  if (invitation.status === 'CANCELLED') {
    throw createHttpError(409, 'La invitación está cancelada', 'cancelled');
  }
  if (invitation.status === 'EXPIRED') {
    throw createHttpError(409, 'La invitación ha expirado', 'expired');
  }
}

async function recordRfqAuditEvent(req, action, resourceId, outcome, options = {}) {
  await audit.recordAuditEventSafelyIfAvailable({
    req,
    action,
    resourceType: 'supplier_quotation_invitation',
    resourceId,
    outcome,
    reasonCode: options.reasonCode || null,
    metadata: options.metadata || null,
    afterState: options.afterState || null,
  });
}

async function recordRfqResponseAuditEvent(req, action, resourceId, outcome, options = {}) {
  await audit.recordAuditEventSafelyIfAvailable({
    req,
    action,
    resourceType: 'supplier_quotation_response',
    resourceId,
    outcome,
    reasonCode: options.reasonCode || null,
    metadata: options.metadata || null,
    afterState: options.afterState || null,
  });
}

async function rejectPublicInvitationAccess(req, invitation, statusCode, message, code) {
  await recordRfqResponseAuditEvent(req, 'procurement.rfq_response.reject_token', invitation?.id || null, 'REJECTED', {
    reasonCode: code,
    metadata: {
      invitationId: invitation?.id || null,
      purchaseRequestId: invitation?.purchaseRequestId || null,
      supplierId: invitation?.supplierId || null,
      invitationStatus: invitation?.status || null,
      rejectionCode: code,
    },
  });
  throw createHttpError(statusCode, message, code);
}

/**
 * Create RFQ invitations for selected suppliers in a purchase request.
 */
async function createRfqInvitations(purchaseRequestId, { supplierIds }, auth, req = null) {
  const { companyId, actorUserId } = assertCompanyScope(auth);
  const request = await rfqRepository.findPurchaseRequestForCompany(purchaseRequestId, companyId);
  if (!request) {
    throw createHttpError(404, 'Solicitud de compra no encontrada', 'not_found');
  }

  const ttlDays = getTokenTtlDays();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  // Validate all suppliers before transaction to fail fast
  const supplierEntries = [];
  for (const supplierId of supplierIds) {
    const sid = BigInt(supplierId);
    const supplier = await rfqRepository.findSupplierForCompany(sid, companyId);
    if (!supplier) {
      throw createHttpError(400, `Proveedor ${sid} no pertenece a la empresa`, 'invalid_supplier');
    }

    const existing = await rfqRepository.findActiveInvitationForSupplier(purchaseRequestId, sid, companyId);
    if (existing) {
      throw createHttpError(409, `Ya existe una invitación activa para el proveedor ${supplier.name}`, 'duplicate_invitation');
    }
    supplierEntries.push({ sid, supplier });
  }

  // Create all invitations atomically
  const results = await rfqRepository.transaction(async (tx) => {
    const transactionResults = [];
    for (const { sid, supplier } of supplierEntries) {
      const { rawToken, tokenHash } = generateTokenPair();
      const machote = buildEmailMachote({ supplier, purchaseRequest: request, expiresAt }, rawToken, request);

      const invitation = await rfqRepository.createInvitation({
        companyId,
        purchaseRequestId,
        supplierId: sid,
        createdByUserId: actorUserId,
        emailTo: supplier.email || null,
        tokenHash,
        status: 'PREPARED',
        expiresAt,
        preparedAt: new Date(),
        emailSubject: machote.emailSubject,
        emailBody: machote.emailBody,
      }, tx);

      transactionResults.push({
        invitation: serializeInvitation(invitation),
        secureLink: machote.secureLink,
        emailSubject: machote.emailSubject,
        emailBody: machote.emailBody,
      });
    }
    return transactionResults;
  });

  for (const result of results) {
    await recordRfqAuditEvent(req, 'procurement.rfq_invitation.create', result.invitation.id, 'SUCCESS', {
      afterState: {
        id: result.invitation.id,
        purchaseRequestId: result.invitation.purchaseRequestId,
        supplierId: result.invitation.supplierId,
        status: result.invitation.status,
        expiresAt: result.invitation.expiresAt,
      },
    });
    await recordRfqAuditEvent(req, 'procurement.rfq_invitation.template_generate', result.invitation.id, 'SUCCESS', {
      afterState: {
        id: result.invitation.id,
        status: result.invitation.status,
        emailTo: result.invitation.emailTo,
      },
      metadata: {
        hasSubject: Boolean(result.emailSubject),
        hasBody: Boolean(result.emailBody),
        hasSecureLink: Boolean(result.secureLink),
      },
    });
  }

  return results;
}

/**
 * List RFQ invitations for a purchase request.
 */
async function listRfqInvitations(purchaseRequestId, auth) {
  const { companyId } = assertCompanyScope(auth);
  const request = await rfqRepository.findPurchaseRequestForCompany(purchaseRequestId, companyId);
  if (!request) {
    throw createHttpError(404, 'Solicitud de compra no encontrada', 'not_found');
  }

  const invitations = await rfqRepository.listInvitationsForRequest(purchaseRequestId, companyId);
  const normalizedInvitations = await persistExpiredInvitationsIfNeeded(invitations);
  return normalizedInvitations.map(serializeInvitation);
}

/**
 * Refresh/regenerate the email machote and secure link for an invitation.
 */
async function refreshInvitationTemplate(invitationId, auth, req = null) {
  const { companyId } = assertCompanyScope(auth);
  let invitation = await rfqRepository.findInvitationById(invitationId, companyId);
  if (!invitation) {
    throw createHttpError(404, 'Invitación no encontrada', 'not_found');
  }
  invitation = await persistExpiredInvitationIfNeeded(invitation);
  assertInvitationAvailableForInternalMutation(invitation);

  const { rawToken, tokenHash } = generateTokenPair();
  const ttlDays = getTokenTtlDays();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  const machote = buildEmailMachote(invitation, rawToken, invitation.purchaseRequest);

  const updated = await rfqRepository.updateInvitation(invitationId, {
    tokenHash,
    status: 'PREPARED',
    expiresAt,
    preparedAt: new Date(),
    emailSubject: machote.emailSubject,
    emailBody: machote.emailBody,
  });

  const result = {
    invitation: serializeInvitation(updated),
    secureLink: machote.secureLink,
    emailSubject: machote.emailSubject,
    emailBody: machote.emailBody,
  };

  await recordRfqAuditEvent(req, 'procurement.rfq_invitation.template_refresh', result.invitation.id, 'SUCCESS', {
    afterState: {
      id: result.invitation.id,
      status: result.invitation.status,
      expiresAt: result.invitation.expiresAt,
      preparedAt: result.invitation.preparedAt,
    },
    metadata: {
      hasSubject: Boolean(result.emailSubject),
      hasBody: Boolean(result.emailBody),
      hasSecureLink: Boolean(result.secureLink),
    },
  });

  return result;
}

/**
 * Cancel an RFQ invitation.
 */
async function cancelInvitation(invitationId, auth, req = null) {
  const { companyId } = assertCompanyScope(auth);
  let invitation = await rfqRepository.findInvitationById(invitationId, companyId);
  if (!invitation) {
    throw createHttpError(404, 'Invitación no encontrada', 'not_found');
  }
  invitation = await persistExpiredInvitationIfNeeded(invitation);
  if (invitation.status === 'RESPONDED') {
    throw createHttpError(409, 'La invitación ya fue respondida', 'invalid_status');
  }
  if (invitation.status === 'CANCELLED') {
    throw createHttpError(409, 'La invitación ya está cancelada', 'already_cancelled');
  }
  if (invitation.status === 'EXPIRED') {
    throw createHttpError(409, 'La invitación ha expirado', 'expired');
  }

  const updated = await rfqRepository.updateInvitation(invitationId, {
    status: 'CANCELLED',
    cancelledAt: new Date(),
  });

  const serialized = serializeInvitation(updated);
  await recordRfqAuditEvent(req, 'procurement.rfq_invitation.cancel', serialized.id, 'SUCCESS', {
    afterState: {
      id: serialized.id,
      status: serialized.status,
      cancelledAt: serialized.cancelledAt,
    },
  });

  return serialized;
}

/**
 * Get public invitation data by raw token (for supplier page).
 */
async function getPublicInvitation(rawToken, req = null) {
  const tokenHash = hashToken(rawToken);
  let invitation = await rfqRepository.findInvitationByTokenHash(tokenHash);
  if (!invitation) {
    await rejectPublicInvitationAccess(req, null, 404, 'Enlace no válido', 'not_found');
  }

  invitation = await persistExpiredInvitationIfNeeded(invitation);

  if (invitation.status === 'CANCELLED') {
    await rejectPublicInvitationAccess(req, invitation, 410, 'Esta solicitud fue cancelada', 'cancelled');
  }
  if (invitation.status === 'RESPONDED') {
    await rejectPublicInvitationAccess(req, invitation, 409, 'Esta solicitud ya fue respondida', 'already_responded');
  }
  if (invitation.status === 'EXPIRED') {
    await rejectPublicInvitationAccess(req, invitation, 410, 'Este enlace ha expirado', 'expired');
  }

  const request = invitation.purchaseRequest;
  return {
    supplierName: invitation.supplier?.name || 'Proveedor',
    requestTitle: request?.title || 'Solicitud de cotización',
    expiresAt: invitation.expiresAt,
    items: (request?.items || []).map((item) => ({
      productId: item.productId,
      productName: item.product?.name || `Producto #${item.productId}`,
      quantity: item.quantity,
      notes: item.notes,
      unit: item.product?.unit || null,
    })),
  };
}

/**
 * Submit a public supplier response by raw token.
 */
async function submitPublicResponse(rawToken, responseBody, req = null) {
  const tokenHash = hashToken(rawToken);

  /** @type {any} */
  const result = await rfqRepository.transaction(async (tx) => {
    let invitation = await rfqRepository.findInvitationByTokenHash(tokenHash, tx);
    if (!invitation) {
      await rejectPublicInvitationAccess(req, null, 404, 'Enlace no válido', 'not_found');
    }

    invitation = await persistExpiredInvitationIfNeeded(invitation, tx);

    if (invitation.status === 'CANCELLED') {
      await rejectPublicInvitationAccess(req, invitation, 410, 'Esta solicitud fue cancelada', 'cancelled');
    }
    if (invitation.status === 'RESPONDED') {
      await rejectPublicInvitationAccess(req, invitation, 409, 'Esta solicitud ya fue respondida', 'already_responded');
    }
    if (invitation.status === 'EXPIRED') {
      await rejectPublicInvitationAccess(req, invitation, 410, 'Este enlace ha expirado', 'expired');
    }

    const requestItemIds = new Set(
      (invitation.purchaseRequest?.items || []).map((i) => i.productId.toString())
    );
    for (const item of responseBody.items) {
      if (!requestItemIds.has(BigInt(item.productId).toString())) {
        throw createHttpError(400, `Producto ${item.productId} no pertenece a esta solicitud`, 'invalid_product');
      }
    }

    const quotation = await rfqRepository.createSupplierQuotation({
      companyId: invitation.companyId,
      purchaseRequestId: invitation.purchaseRequestId,
      supplierId: invitation.supplierId,
      currency: responseBody.currency || 'CRC',
      notes: responseBody.notes || null,
      status: 'SUBMITTED',
      items: {
        create: responseBody.items.map((item) => ({
          productId: BigInt(item.productId),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          leadTimeDays: item.leadTimeDays ?? null,
          notes: item.notes || null,
        })),
      },
    }, tx);

    const updatedInvitation = await rfqRepository.updateInvitation(invitation.id, {
      status: 'RESPONDED',
      respondedAt: new Date(),
      quotationId: quotation.id,
      responseSource: 'PUBLIC_TOKEN',
    }, tx);

    return {
      quotationId: quotation.id,
      invitationId: updatedInvitation.id,
      purchaseRequestId: updatedInvitation.purchaseRequestId,
      supplierId: updatedInvitation.supplierId,
      responseSource: updatedInvitation.responseSource,
      message: 'Respuesta registrada exitosamente',
    };
  });

  await recordRfqResponseAuditEvent(req, 'procurement.rfq_response.submit', result.invitationId, 'SUCCESS', {
    afterState: {
      invitationId: result.invitationId,
      quotationId: result.quotationId,
      purchaseRequestId: result.purchaseRequestId,
      supplierId: result.supplierId,
      responseSource: result.responseSource,
    },
  });

  return { quotationId: result.quotationId, message: result.message };
}

/**
 * Submit a manual response captured by an internal user (office email).
 */
async function submitManualResponse(invitationId, responseBody, auth, req = null) {
  const { companyId, actorUserId } = assertCompanyScope(auth);

  /** @type {any} */
  const result = await rfqRepository.transaction(async (tx) => {
    let invitation = await rfqRepository.findInvitationById(invitationId, companyId, tx);
    if (!invitation) {
      throw createHttpError(404, 'Invitación no encontrada', 'not_found');
    }
    invitation = await persistExpiredInvitationIfNeeded(invitation, tx);
    assertInvitationAvailableForInternalMutation(invitation);

    const requestItemIds = new Set(
      (invitation.purchaseRequest?.items || []).map((i) => i.productId.toString())
    );
    for (const item of responseBody.items) {
      if (!requestItemIds.has(BigInt(item.productId).toString())) {
        throw createHttpError(400, `Producto ${item.productId} no pertenece a esta solicitud`, 'invalid_product');
      }
    }

    const quotation = await rfqRepository.createSupplierQuotation({
      companyId,
      purchaseRequestId: invitation.purchaseRequestId,
      supplierId: invitation.supplierId,
      currency: responseBody.currency || 'CRC',
      notes: responseBody.notes || null,
      status: 'SUBMITTED',
      items: {
        create: responseBody.items.map((item) => ({
          productId: BigInt(item.productId),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          leadTimeDays: item.leadTimeDays ?? null,
          notes: item.notes || null,
        })),
      },
    }, tx);

    const updatedInvitation = await rfqRepository.updateInvitation(invitation.id, {
      status: 'RESPONDED',
      respondedAt: new Date(),
      quotationId: quotation.id,
      responseSource: 'MANUAL_OFFICE_EMAIL',
      manualResponseByUserId: actorUserId,
      manualResponseNotes: responseBody.notes || null,
    }, tx);

    return {
      quotationId: quotation.id,
      invitationId: updatedInvitation.id,
      purchaseRequestId: updatedInvitation.purchaseRequestId,
      supplierId: updatedInvitation.supplierId,
      responseSource: updatedInvitation.responseSource,
      message: 'Respuesta manual registrada exitosamente',
    };
  });

  await recordRfqResponseAuditEvent(req, 'procurement.rfq_response.manual_capture', result.invitationId, 'SUCCESS', {
    afterState: {
      invitationId: result.invitationId,
      quotationId: result.quotationId,
      purchaseRequestId: result.purchaseRequestId,
      supplierId: result.supplierId,
      responseSource: result.responseSource,
      actorUserId,
    },
  });

  return { quotationId: result.quotationId, message: result.message };
}

/**
 * Get RFQ tracking summary for the company.
 */
async function getRfqTrackingSummary(auth) {
  const { companyId } = assertCompanyScope(auth);
  const requests = await rfqRepository.listRfqTrackingSummary(companyId);
  const normalizedRequests = await Promise.all((requests || []).map(async (request) => ({
    request,
    invitations: await persistExpiredInvitationsIfNeeded(request.rfqInvitations || []),
  })));

  return normalizedRequests.map(({ request: req, invitations }) => {
    const serializedInvitations = invitations.map((inv) => ({
      id: inv.id,
      purchaseRequestId: inv.purchaseRequestId,
      supplierId: inv.supplierId,
      supplierName: inv.supplier?.name || 'Proveedor',
      supplierEmail: inv.supplier?.email || null,
      status: inv.status,
      responseSource: inv.responseSource,
      expiresAt: inv.expiresAt,
      respondedAt: inv.respondedAt,
      createdAt: inv.createdAt,
      quotationId: inv.quotationId,
      quotation: serializeQuotationResponseSummary(inv.quotation, inv.responseSource || null),
    }));

    const serializedQuotations = (req.quotations || []).map((quotation) => {
      const relatedInvitation = invitations.find((invitation) => String(invitation.quotationId) === String(quotation.id));
      // Distinguish direct-entry quotations (tagged with evidence._source) from
      // catalog-assisted ones (evidence: null). Only the former count as responses.
      const isDirectEntry = quotation.evidence?._source === 'DIRECT_ENTRY';
      const responseSource = relatedInvitation?.responseSource || (isDirectEntry ? 'DIRECT_ENTRY' : null);
      return {
        ...serializeQuotationResponseSummary(quotation, responseSource),
        invitationId: relatedInvitation?.id || null,
        invitationStatus: relatedInvitation?.status || null,
      };
    });

    const respondedInvitations = serializedInvitations.filter((invitation) => invitation.status === 'RESPONDED');
    const directEntryCount = serializedQuotations.filter((q) => q.responseSource === 'DIRECT_ENTRY').length;

    return {
      purchaseRequestId: req.id,
      title: req.title,
      status: req.status,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
      itemCount: req.items?.length || 0,
      hasInvitations: serializedInvitations.length > 0,
      quotationCount: serializedQuotations.length,
      respondedInvitationCount: respondedInvitations.length,
      manualResponseCount: respondedInvitations.filter((invitation) => invitation.responseSource === 'MANUAL_OFFICE_EMAIL').length,
      publicResponseCount: respondedInvitations.filter((invitation) => invitation.responseSource === 'PUBLIC_TOKEN').length,
      directEntryCount,
      items: (req.items || []).map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes,
        productName: item.product?.name || `Producto #${item.productId}`,
        unit: item.product?.unit || null,
      })),
      invitations: serializedInvitations,
      quotations: serializedQuotations,
    };
  });
}

module.exports = {
  createRfqInvitations,
  listRfqInvitations,
  refreshInvitationTemplate,
  cancelInvitation,
  getPublicInvitation,
  submitPublicResponse,
  submitManualResponse,
  getRfqTrackingSummary,
  serializeInvitation,
  buildEmailMachote,
  buildSecureLink,
};
