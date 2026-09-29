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

  async function getFiscalReadiness(session) {
    return inventoryAuth.fetchJson(session, `${FISCAL_SETTINGS_ENDPOINT}/readiness`, {
      fallbackMessage: 'No se pudo comprobar la preparación fiscal.',
    });
  }

  rootShell.register('fiscalSettingsApi', {
    getFiscalSettings,
    refreshActivities,
    setDefaultActivity,
    updateActivityBillingEnabled,
    getFiscalReadiness,
  });
}(window));
