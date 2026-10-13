(function attachRootShellFiscalSettingsApi(globalScope) {
  'use strict';

  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  const FISCAL_SETTINGS_ENDPOINT = '/api/company/fiscal-settings';

  async function getFiscalSettings(session) {
    return inventoryAuth.fetchJson(session, FISCAL_SETTINGS_ENDPOINT, {
      fallbackMessage: 'No se pudo cargar la configuración fiscal.',
    });
  }

  async function updateActivityBillingEnabled(session, activityCode, billingEnabled) {
    return inventoryAuth.fetchJson(
      session,
      `${FISCAL_SETTINGS_ENDPOINT}/activities/${encodeURIComponent(activityCode)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ billingEnabled: billingEnabled === true }),
        fallbackMessage: 'No se pudo actualizar la actividad fiscal.',
      },
    );
  }

  async function setDefaultActivity(session, activityCode) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/activities/default`, {
      method: 'PUT',
      body: JSON.stringify({ code: activityCode }),
      fallbackMessage: 'No se pudo actualizar la actividad predeterminada.',
    });
  }

  async function refreshActivities(session) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/activities/refresh`, {
      method: 'POST',
      fallbackMessage: 'No se pudo actualizar la información fiscal desde Hacienda.',
    });
  }

  async function configureHaciendaCredentials(session, payload) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/hacienda-credentials`, {
      method: 'PUT',
      body: JSON.stringify({ username: payload.username, password: payload.password }),
      fallbackMessage: 'No se pudo guardar y validar la conexión con Hacienda.',
    });
  }

  async function validateHaciendaCredentials(session) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/hacienda-credentials/validate`, {
      method: 'POST',
      fallbackMessage: 'No se pudo validar la conexión con Hacienda.',
    });
  }

  async function disableHaciendaConnection(session) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/hacienda-credentials/disable`, {
      method: 'POST',
      body: JSON.stringify({}),
      fallbackMessage: 'No se pudo deshabilitar la conexión con Hacienda.',
    });
  }

  async function getFiscalReadiness(session) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/readiness`, {
      fallbackMessage: 'No se pudo comprobar la preparación fiscal.',
    });
  }

  async function initiateFiscalTestInvoice(session, payload) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/test-invoices`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo iniciar la factura fiscal de prueba.',
    });
  }

  async function getFiscalTestInvoiceStatus(session, executionId) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/test-invoices/${encodeURIComponent(executionId)}`, {
      fallbackMessage: 'No se pudo actualizar el estado de la factura fiscal de prueba.',
    });
  }

  async function getIssuerAdministration(session) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/issuer`, {
      fallbackMessage: 'No se pudo cargar el emisor fiscal.',
    });
  }

  async function getFiscalSecurityConfiguration(session) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/security`, {
      fallbackMessage: 'No se pudo cargar la conexión fiscal segura.',
    });
  }

  async function uploadSigningCertificate(session, { certificate, pin, replace }) {
    const formData = new FormData();
    formData.append('certificate', certificate);
    formData.append('pin', pin);
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/certificate`, {
      method: replace ? 'PUT' : 'POST',
      body: formData,
      fallbackMessage: replace
        ? 'No se pudo reemplazar el certificado. El certificado anterior permanece activo.'
        : 'No se pudo cargar el certificado fiscal.',
    });
  }

  async function provisionIssuer(session) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/issuer/provision`, {
      method: 'POST',
      body: JSON.stringify({}),
      fallbackMessage: 'No se pudo asociar la empresa con Billing.',
    });
  }

  async function updateIssuerAdministration(session, payload) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/issuer`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo guardar la configuración del emisor.',
    });
  }

  async function getIssuanceAdministration(session) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/issuance-points`, {
      fallbackMessage: 'No se pudieron cargar las sucursales y terminales fiscales.',
    });
  }

  async function upsertFiscalBranch(session, payload) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/branches`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo guardar la sucursal fiscal.',
    });
  }

  async function setFiscalBranchActive(session, branchId, active) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/branches/${encodeURIComponent(branchId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active: active === true }),
      fallbackMessage: 'No se pudo cambiar el estado de la sucursal fiscal.',
    });
  }

  async function upsertFiscalTerminal(session, branchId, payload) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/branches/${encodeURIComponent(branchId)}/terminals`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo guardar la terminal fiscal.',
    });
  }

  async function setFiscalTerminalActive(session, terminalId, active) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/terminals/${encodeURIComponent(terminalId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active: active === true }),
      fallbackMessage: 'No se pudo cambiar el estado de la terminal fiscal.',
    });
  }

  async function selectDefaultIssuancePoint(session, terminalId) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/issuance-points/default`, {
      method: 'PUT',
      body: JSON.stringify({ terminalId }),
      fallbackMessage: 'No se pudo cambiar el punto de emisión predeterminado.',
    });
  }

  async function readFiscalSequence(session, terminalId, documentType) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/sequences/read`, {
      method: 'POST',
      body: JSON.stringify({ terminalId, documentType }),
      fallbackMessage: 'No se pudo consultar la secuencia fiscal.',
    });
  }

  async function configureInitialFiscalSequence(session, payload) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/sequences/initial`, {
      method: 'PUT',
      body: JSON.stringify({ ...payload, confirmed: true }),
      fallbackMessage: 'No se pudo configurar la secuencia fiscal inicial.',
    });
  }

  rootShell.register('fiscalSettingsApi', {
    getFiscalSettings,
    refreshActivities,
    setDefaultActivity,
    updateActivityBillingEnabled,
    configureHaciendaCredentials,
    validateHaciendaCredentials,
    disableHaciendaConnection,
    getFiscalReadiness,
    initiateFiscalTestInvoice,
    getFiscalTestInvoiceStatus,
    getIssuerAdministration,
    getFiscalSecurityConfiguration,
    uploadSigningCertificate,
    provisionIssuer,
    updateIssuerAdministration,
    getIssuanceAdministration,
    upsertFiscalBranch,
    setFiscalBranchActive,
    upsertFiscalTerminal,
    setFiscalTerminalActive,
    selectDefaultIssuancePoint,
    readFiscalSequence,
    configureInitialFiscalSequence,
  });
}(window));
