'use strict';

function hasText(value) {
  return String(value || '').trim().length > 0;
}

function normalizeIdentity(identity) {
  return {
    identificationType: String(identity.identificationType || identity.documentType || '').trim(),
    identificationNumber: String(identity.identificationNumber || identity.legalId || '').trim(),
    legalName: String(identity.legalName || identity.name || '').trim(),
    email: String(identity.email || identity.emailBilling || '').trim(),
  };
}

function isCompleteFiscalIdentity(identity) {
  const normalized = normalizeIdentity(identity || {});
  return hasText(normalized.legalName)
    && hasText(normalized.identificationType)
    && hasText(normalized.identificationNumber)
    && hasText(normalized.email);
}

function identitiesDiffer(first, second) {
  const a = normalizeIdentity(first);
  const b = normalizeIdentity(second);
  return a.identificationType !== b.identificationType
    || a.identificationNumber !== b.identificationNumber
    || a.legalName !== b.legalName;
}

function buildReceiver(sourceType, sourceId, source) {
  return {
    sourceType,
    sourceId,
    legalName: source.legalName || source.name,
    commercialName: source.commercialName || null,
    identificationType: source.identificationType || source.documentType,
    identificationNumber: source.identificationNumber || source.legalId,
    email: source.email || source.emailBilling,
    phone: source.phone || null,
    province: source.province || null,
    canton: source.canton || null,
    district: source.district || null,
    neighborhood: source.neighborhood || null,
    address: source.address || null,
    economicActivityCode: source.economicActivityCode || null,
    economicActivityName: source.economicActivityName || null,
  };
}

function resolveFiscalReceiver(order) {
  const store = order?.clientStore || null;
  const client = order?.client || null;

  if (store?.legalEntity) {
    if (!isCompleteFiscalIdentity(store.legalEntity)) {
      return { ok: false, code: 'FISCAL_RECEIVER_MISSING', reason: 'store_legal_entity_incomplete' };
    }
    return { ok: true, receiver: buildReceiver('CLIENT_STORE_LEGAL_ENTITY', store.legalEntity.id, store.legalEntity) };
  }

  if (client?.legalEntity) {
    if (!isCompleteFiscalIdentity(client.legalEntity)) {
      return { ok: false, code: 'FISCAL_RECEIVER_MISSING', reason: 'client_legal_entity_incomplete' };
    }
    return { ok: true, receiver: buildReceiver('CLIENT_LEGAL_ENTITY', client.legalEntity.id, client.legalEntity) };
  }

  const hasStoreIdentity = isCompleteFiscalIdentity(store);
  const hasClientIdentity = isCompleteFiscalIdentity(client);

  if (hasStoreIdentity && hasClientIdentity && identitiesDiffer(store, client)) {
    return { ok: false, code: 'FISCAL_RECEIVER_IDENTITY_CONFLICT', reason: 'store_client_identity_conflict' };
  }

  if (hasStoreIdentity) {
    return { ok: true, receiver: buildReceiver('CLIENT_STORE', store.id, store) };
  }

  if (hasClientIdentity) {
    return { ok: true, receiver: buildReceiver('CLIENT', client.id, client) };
  }

  return { ok: false, code: 'FISCAL_RECEIVER_MISSING', reason: 'no_complete_receiver_identity' };
}

module.exports = {
  identitiesDiffer,
  isCompleteFiscalIdentity,
  resolveFiscalReceiver,
};
