(function attachFiscalSettingsAdminView(globalScope) {
  'use strict';

  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const fiscalSettingsApi = rootShell.require('fiscalSettingsApi');
  const ui = rootShell.require('ui');

  const emptyLabel = 'Sin dato';
  const manageActivitiesPermission = 'fiscal.activities.manage';
  const updateDefaultPermission = 'fiscal.activities.default.update';
  const refreshActivitiesPermission = 'fiscal.activities.refresh';
  const readinessViewPermission = 'fiscal.readiness.view';
  const credentialsManagePermission = 'fiscal.credentials.manage';

  const BLOCKER_MESSAGES = Object.freeze({
    FISCAL_PROFILE_MISSING: 'Falta configurar el perfil fiscal de la empresa.',
    HACIENDA_CONNECTION_MISSING: 'Falta configurar la conexión con Hacienda.',
    HACIENDA_CREDENTIALS_MISSING: 'Faltan las credenciales necesarias para la conexión con Hacienda.',
    ACTIVE_CERTIFICATE_MISSING: 'Falta configurar un certificado de firma activo.',
    CERTIFICATE_EXPIRED: 'El certificado de firma está vencido.',
    CERTIFICATE_NOT_YET_VALID: 'El certificado de firma todavía no es válido.',
    CERTIFICATE_IDENTITY_UNVERIFIED: 'No fue posible verificar la identidad del certificado de firma.',
    CERTIFICATE_IDENTITY_MISMATCH: 'La identidad del certificado no coincide con la empresa.',
    FISCAL_SIGNING_CERTIFICATE_SECRET_UNAVAILABLE: 'El certificado de firma no está disponible actualmente.',
    ISSUANCE_POINT_MISSING: 'Falta configurar el punto de emisión.',
    TAXPAYER_VALIDATION_MISSING: 'Falta verificar la información del contribuyente con Hacienda.',
    TAXPAYER_NOT_ACTIVE: 'El contribuyente no aparece activo para facturación electrónica.',
    ECONOMIC_ACTIVITY_MISSING: 'No hay actividades económicas verificadas disponibles.',
    DEFAULT_ECONOMIC_ACTIVITY_MISSING: 'Seleccione una actividad económica predeterminada.',
    DEFAULT_ECONOMIC_ACTIVITY_INVALID: 'La actividad económica predeterminada ya no es válida para facturación.',
  });

  const WARNING_MESSAGES = Object.freeze({
    TAXPAYER_MOROSO: 'Hacienda reporta al contribuyente como moroso.',
    TAXPAYER_OMISO: 'Hacienda reporta al contribuyente como omiso.',
    ECONOMIC_ACTIVITY_VERIFICATION_STALE: 'La información fiscal fue verificada hace más de 30 días. Se recomienda actualizarla desde Hacienda.',
  });

  function getConnectionStatus(readiness, connection) {
    if (connection?.status) return String(connection.status).toUpperCase();
    const reasons = readiness?.reasonCodes || [];
    if (reasons.includes('HACIENDA_CREDENTIALS_MISSING') || reasons.includes('HACIENDA_CONNECTION_MISSING')) return 'NOT_CONFIGURED';
    if (reasons.includes('HACIENDA_INVALID_CREDENTIALS')) return 'INVALID_CREDENTIALS';
    return readiness?.readyToIssue ? 'CONNECTED' : 'UNKNOWN';
  }

  function connectionLabel(status) {
    const map = {
      CONNECTED: ['✓ Credenciales válidas', 'badge-success'],
      VALID: ['✓ Credenciales válidas', 'badge-success'],
      INVALID_CREDENTIALS: ['⚠ Credenciales inválidas', 'badge-warning'],
      UNAVAILABLE: ['⚠ No fue posible validar con Hacienda', 'badge-warning'],
      NOT_CONFIGURED: ['— Sin configurar', ''],
      DISABLED: ['— Deshabilitada', ''],
    };
    return map[status] || ['Estado pendiente de validar', ''];
  }

  function renderHaciendaConnectionCard(readiness, connection, options) {
    const environment = connection?.environment || readiness?.environment || 'SANDBOX';
    const status = getConnectionStatus(readiness, connection);
    const [label, tone] = connectionLabel(status);
    const configured = status !== 'NOT_CONFIGURED';
    const disabled = options.credentialsPending || !options.canManageCredentials;
    return `
      <section class="card root-card fiscal-hacienda-connection-card" aria-labelledby="fiscal-hacienda-title">
        <h3 id="fiscal-hacienda-title">Conexión con Hacienda</h3>
        <dl class="detail-grid">
          ${renderDetail('Ambiente', environment === 'SANDBOX' ? 'Pruebas (Sandbox)' : asText(environment))}
          <div class="detail-item"><dt>Estado</dt><dd><span class="${tone ? `badge ${tone}` : 'badge'}" role="status">${ui.escapeHtml(label)}</span></dd></div>
          ${configured ? renderDetail('Credenciales', 'Credenciales configuradas') : renderDetail('Credenciales', 'Sin configurar')}
          ${connection?.lastValidatedAt ? renderDetail('Última validación', formatDate(connection.lastValidatedAt)) : ''}
        </dl>
        <form data-hacienda-credentials-form class="fiscal-credentials-form" autocomplete="off">
          <label>Usuario de Hacienda<input name="username" type="text" maxlength="100" autocomplete="username" required ${disabled ? 'disabled' : ''}></label>
          <label>Contraseña<input name="password" type="password" maxlength="200" autocomplete="new-password" required ${disabled ? 'disabled' : ''}></label>
          <p class="muted">Para reemplazar credenciales ingresa usuario y contraseña. Inventori no guarda ni muestra el secreto actual.</p>
          <button type="submit" ${disabled ? 'disabled' : ''} aria-busy="${options.credentialsPending ? 'true' : 'false'}">${options.credentialsPending ? 'Guardando y validando credenciales…' : 'Guardar y validar'}</button>
          ${!options.canManageCredentials ? '<p class="muted">Tu usuario puede ver esta sección, pero no modificar credenciales.</p>' : ''}
        </form>
      </section>
    `;
  }

  function renderReadinessPanel(readiness) {
    if (!readiness) {
      return `
        <section class="card root-card fiscal-readiness-card" aria-labelledby="fiscal-readiness-title">
          <h3 id="fiscal-readiness-title">Estado para facturación electrónica</h3>
          <p>No fue posible comprobar el estado de preparación fiscal.</p>
          <button type="button" data-fiscal-readiness-retry-btn
            aria-label="Volver a comprobar preparación fiscal">Volver a comprobar</button>
        </section>
      `;
    }
    const verdictText = readiness.readyToIssue
      ? '✓ Listo para facturar electrónicamente'
      : 'Configuración fiscal incompleta';
    const tone = readiness.readyToIssue ? 'badge-success' : 'badge-warning';
    const borderClass = readiness.readyToIssue ? 'fiscal-readiness-card--ready' : 'fiscal-readiness-card--not-ready';
    const blockers = (readiness.reasonCodes || []).map((code) => `<li>${ui.escapeHtml(BLOCKER_MESSAGES[code] || 'Existe una configuración fiscal pendiente de resolver.')}</li>`).join('');
    const warnings = (readiness.warnings || []).map((code) => `<li>⚠ ${ui.escapeHtml(WARNING_MESSAGES[code] || 'Advertencia de configuración fiscal pendiente de resolver.')}</li>`).join('');
    return `
      <section class="card root-card fiscal-readiness-card ${borderClass}" aria-labelledby="fiscal-readiness-title">
        <h3 id="fiscal-readiness-title">Estado para facturación electrónica</h3>
        <p><span class="badge ${tone}" role="status">${ui.escapeHtml(verdictText)}</span></p>
        ${readiness.checkedAt ? `<p class="muted">Última comprobación: ${ui.escapeHtml(formatDate(readiness.checkedAt))}</p>` : ''}
        ${blockers ? `<ul aria-label="Problemas de configuración">${blockers}</ul>` : ''}
        ${warnings ? `<ul aria-label="Advertencias">${warnings}</ul>` : ''}
      </section>
    `;
  }

  function asText(value, fallback = emptyLabel) {
    if (typeof value !== 'string') return fallback;
    const normalizedValue = value.trim();
    return normalizedValue.length > 0 ? normalizedValue : fallback;
  }

  function formatBoolean(value) {
    if (value === true) return 'Sí';
    if (value === false) return 'No';
    return emptyLabel;
  }

  function formatDate(value) {
    if (!value) return 'Sin fecha';
    return ui.formatDate(value) || 'Sin fecha';
  }

  function hasPermission(session, permissionCode) {
    return Boolean((session?.user?.permissions || []).includes(permissionCode));
  }

  function getActivities(data) {
    return Array.isArray(data?.activities) ? data.activities : [];
  }

  function isHaciendaActive(activity) {
    return asText(activity?.haciendaStatus, '').toUpperCase() === 'A';
  }

  function isEligibleDefaultActivity(activity) {
    return isHaciendaActive(activity) && activity?.billingEnabled === true;
  }

  function renderDetail(label, value) {
    return `
      <div class="detail-item">
        <dt>${ui.escapeHtml(label)}</dt>
        <dd>${ui.escapeHtml(value)}</dd>
      </div>
    `;
  }

  function renderBadge(text, tone = '') {
    const className = tone ? `badge ${tone}` : 'badge';
    return `<span class="${className}">${ui.escapeHtml(text)}</span>`;
  }

  function resolveDefaultActivity(data) {
    return getActivities(data).find((activity) => activity?.isDefault === true) || null;
  }

  function renderTaxpayerCard(data) {
    const taxpayer = data?.taxpayer || {};
    return `
      <section class="card root-card" aria-labelledby="fiscal-taxpayer-title">
        <h3 id="fiscal-taxpayer-title">Estado del contribuyente</h3>
        <dl class="detail-grid">
          ${renderDetail('Estado de verificación', asText(taxpayer.verificationStatus))}
          ${renderDetail('Última verificación', formatDate(taxpayer.verifiedAt))}
          ${renderDetail('Situación tributaria', asText(taxpayer.taxSituation))}
          ${renderDetail('Moroso', formatBoolean(taxpayer.moroso))}
          ${renderDetail('Omiso', formatBoolean(taxpayer.omiso))}
        </dl>
      </section>
    `;
  }

  function renderActivitiesSummaryCard(data) {
    const activities = getActivities(data);
    const defaultActivity = resolveDefaultActivity(data);
    const integrationLabel = data?.configuration?.hasBillingIntegration === true
      ? 'Integración configurada'
      : 'Integración no disponible';
    const defaultActivityLabel = defaultActivity
      ? `${asText(defaultActivity.code)} — ${asText(defaultActivity.description)}`
      : 'Sin actividad predeterminada';

    return `
      <section class="card root-card" aria-labelledby="fiscal-activities-summary-title">
        <h3 id="fiscal-activities-summary-title">Actividades fiscales</h3>
        <dl class="detail-grid">
          ${renderDetail('Actividades registradas', String(activities.length))}
          ${renderDetail('Actividad predeterminada', defaultActivityLabel)}
          ${renderDetail('Integración de facturación', integrationLabel)}
        </dl>
        <p class="muted">Configurar una actividad predeterminada no confirma preparación para emitir comprobantes.</p>
      </section>
    `;
  }

  function updateRefreshButtonState(button, pending) {
    if (!button) return;
    button.disabled = pending;
    button.setAttribute('aria-busy', pending ? 'true' : 'false');
    button.textContent = pending ? 'Actualizando...' : 'Actualizar desde Hacienda';
  }

  function resolveChecklistDisabledReason({ canManage, activity, pending, refreshPending }) {
    if (refreshPending) return 'Actualización desde Hacienda en proceso.';
    if (pending) return 'Actualización en proceso.';
    if (!canManage) return 'Tu usuario puede ver esta actividad, pero no modificarla.';
    if (!isHaciendaActive(activity)) return 'Actividad no activa ante Hacienda; no puede habilitarse desde esta vista.';
    return '';
  }

  function resolveDefaultDisabledReason({ canUpdateDefault, activity, defaultPending, refreshPending }) {
    if (refreshPending) return 'Actualización desde Hacienda en proceso.';
    if (defaultPending) return 'Actualización de predeterminada en proceso.';
    if (!canUpdateDefault) return 'Tu usuario puede ver la predeterminada, pero no cambiarla.';
    if (activity?.billingEnabled !== true) return 'Debe estar habilitada para facturación antes de seleccionarla.';
    if (!isHaciendaActive(activity)) return 'Actividad no activa ante Hacienda; no puede ser predeterminada.';
    return '';
  }

  function renderActivityChecklistItem(activity, index, options) {
    const code = asText(activity?.code);
    const description = asText(activity?.description, 'Actividad sin descripción');
    const isDefault = activity?.isDefault === true;
    const billingEnabled = activity?.billingEnabled === true;
    const active = isHaciendaActive(activity);
    const pending = options.pendingCodes.has(code);

    const checkboxDisabledReason = resolveChecklistDisabledReason({
      canManage: options.canManage,
      activity,
      pending,
      refreshPending: options.refreshPending,
    });
    const radioDisabledReason = resolveDefaultDisabledReason({
      canUpdateDefault: options.canUpdateDefault,
      activity,
      defaultPending: options.defaultPending,
      refreshPending: options.refreshPending,
    });

    const checkboxId = `fiscal-activity-${index}`;
    const radioId = `fiscal-default-${index}`;
    const checkboxHintId = `${checkboxId}-hint`;
    const radioHintId = `${radioId}-hint`;
    const checkboxLabel = `Actividad ${code}: ${description}`;
    const radioLabel = `Predeterminada ${code}: ${description}`;
    const checkboxHint = checkboxDisabledReason || (billingEnabled ? 'Habilitada en Billing.' : 'Deshabilitada en Billing.');
    const radioHint = radioDisabledReason || (isDefault ? 'Marcada como predeterminada en Billing.' : 'Elegible para predeterminada.');
    const haciendaBadge = active ? renderBadge('Hacienda activa', 'badge-success') : renderBadge('Hacienda inactiva', 'badge-warning');
    const kindPart = asText(activity?.haciendaKind, '');
    const datePart = formatDate(activity?.verifiedAt);
    const meta = [kindPart, datePart ? `Verificado: ${datePart}` : ''].filter(Boolean).join(' · ');

    return `
      <article class="card root-card fiscal-activity-item" data-fiscal-activity-code="${ui.escapeHtml(code)}">
        <div class="fiscal-activity-head">
          <div class="fiscal-activity-info">
            <p class="muted">Código ${ui.escapeHtml(code)}</p>
            <h4>${ui.escapeHtml(description)}</h4>
            ${meta ? `<p class="fiscal-activity-meta">${ui.escapeHtml(meta)}</p>` : ''}
          </div>
          <div class="fiscal-activity-badges">
            ${haciendaBadge}
            ${isDefault ? renderBadge('Predeterminada', 'badge-success') : ''}
          </div>
        </div>
        <div class="fiscal-activity-controls" role="group"
          aria-label="Controles de actividad ${ui.escapeHtml(code)}">
          <div class="fiscal-activity-control-item">
            <input
              id="${checkboxId}"
              type="checkbox"
              data-fiscal-activity-toggle
              data-activity-code="${ui.escapeHtml(code)}"
              ${billingEnabled ? 'checked' : ''}
              ${checkboxDisabledReason ? 'disabled' : ''}
              aria-label="${ui.escapeHtml(checkboxLabel)}"
              aria-describedby="${checkboxHintId}"
            >
            <label for="${checkboxId}">Habilitada para facturación</label>
          </div>
          <div class="fiscal-activity-control-item">
            <input
              id="${radioId}"
              type="radio"
              name="fiscal-default-activity"
              data-fiscal-default-toggle
              data-activity-code="${ui.escapeHtml(code)}"
              ${isDefault ? 'checked' : ''}
              ${radioDisabledReason ? 'disabled' : ''}
              aria-label="${ui.escapeHtml(radioLabel)}"
              aria-describedby="${radioHintId}"
            >
            <label for="${radioId}">Predeterminada</label>
          </div>
        </div>
        <div class="fiscal-activity-hints">
          <span id="${checkboxHintId}">${ui.escapeHtml(checkboxHint)}</span>
          <span id="${radioHintId}">${ui.escapeHtml(radioHint)}</span>
        </div>
        ${isDefault && !billingEnabled ? '<p class="muted">Esta actividad está marcada como predeterminada aunque la facturación esté deshabilitada. Selecciona otra actividad habilitada.</p>' : ''}
      </article>
    `;
  }

  function renderDefaultEmptyState(data) {
    const eligibleCount = getActivities(data).filter(isEligibleDefaultActivity).length;
    if (eligibleCount > 0) return '';
    return `
      <section class="card root-card empty-state" aria-labelledby="fiscal-default-empty-title">
        <h4 id="fiscal-default-empty-title">Actividad predeterminada</h4>
        <p>No hay actividades habilitadas disponibles para seleccionar como predeterminada.</p>
      </section>
    `;
  }

  function renderActivitiesChecklist(data, options) {
    const activities = getActivities(data);
    if (activities.length === 0) {
      return `
        <section class="card root-card empty-state" aria-labelledby="fiscal-activities-title">
          <h3 id="fiscal-activities-title">Actividades económicas</h3>
          <p>No hay actividades económicas verificadas disponibles.</p>
        </section>
      `;
    }

    return `
      <section aria-labelledby="fiscal-activities-title">
        <div class="page-header compact">
          <div>
            <h3 id="fiscal-activities-title">Actividades económicas</h3>
            <p class="muted">Selecciona cuáles actividades registradas ante Hacienda estarán habilitadas y cuál será la predeterminada para facturación.</p>
          </div>
        </div>
        ${renderDefaultEmptyState(data)}
        <div class="fiscal-activities-stack">
          ${activities.map((activity, index) => renderActivityChecklistItem(activity, index, options)).join('')}
        </div>
      </section>
    `;
  }

  function renderFiscalSettingsContent(data, options) {
    return `
      <div class="fiscal-settings-page">
        <div class="fiscal-summary-grid">
          ${renderTaxpayerCard(data)}
          ${renderActivitiesSummaryCard(data)}
        </div>
        ${renderHaciendaConnectionCard(options.readiness, options.connection, options)}
        ${renderActivitiesChecklist(data, options)}
      </div>
    `;
  }

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <div class="page-header compact">
          <div>
            <p class="eyebrow">Administración</p>
            <h2 id="root-view-title">Configuración fiscal</h2>
            <p class="muted">Consulta y habilita actividades económicas verificadas para esta empresa.</p>
          </div>
          <div>
            <button
              type="button"
              data-fiscal-refresh-btn
              hidden
              aria-label="Actualizar información fiscal desde Hacienda"
            >Actualizar desde Hacienda</button>
          </div>
        </div>
      </section>
      <div data-fiscal-settings-status aria-live="polite" aria-atomic="true"></div>
      <div data-fiscal-readiness-content>
        <section class="card root-card fiscal-readiness-card" aria-labelledby="fiscal-readiness-title-load">
          <h3 id="fiscal-readiness-title-load">Estado para facturación electrónica</h3>
          <p aria-busy="true">Comprobando preparación fiscal...</p>
        </section>
      </div>
      <div data-fiscal-settings-content>
        <section class="card root-card empty-state">
          <p>Cargando configuración fiscal...</p>
        </section>
      </div>
    `;
  }

  async function mount(container, session, context = {}) {
    const statusElement = container.querySelector('[data-fiscal-settings-status]');
    const contentElement = container.querySelector('[data-fiscal-settings-content]');
    const refreshButton = container.querySelector('[data-fiscal-refresh-btn]');
    const readinessElement = container.querySelector('[data-fiscal-readiness-content]');
    const pendingCodes = new Set();
    let currentData = null;
    let currentReadiness = null;
    let defaultPending = false;
    let refreshPending = false;
    let credentialsPending = false;
    let currentConnection = null;

    if (!contentElement) return;

    function setStatus(message, tone = 'default') {
      if (statusElement) {
        statusElement.innerHTML = message ? ui.renderInlineMessage(message, tone) : '';
      }
    }

    function renderLoadedContent() {
      contentElement.innerHTML = renderFiscalSettingsContent(currentData || {}, {
        canManage: hasPermission(session, manageActivitiesPermission),
        canUpdateDefault: hasPermission(session, updateDefaultPermission),
        defaultPending,
        pendingCodes,
        refreshPending,
        credentialsPending,
        canManageCredentials: hasPermission(session, credentialsManagePermission),
        readiness: currentReadiness,
        connection: currentConnection,
      });
      bindActivityToggles();
      bindDefaultToggles();
      bindCredentialsForm();
    }

    async function loadReadiness() {
      if (!readinessElement) return;
      readinessElement.innerHTML = '<section class="card root-card fiscal-readiness-card" aria-labelledby="fiscal-readiness-title"><h3 id="fiscal-readiness-title">Estado para facturación electrónica</h3><p aria-busy="true">Comprobando preparación fiscal...</p></section>';
      try {
        currentReadiness = await fiscalSettingsApi.getFiscalReadiness(session);
        readinessElement.innerHTML = renderReadinessPanel(currentReadiness);
      } catch (_error) {
        currentReadiness = null;
        readinessElement.innerHTML = renderReadinessPanel(null);
        const retryBtn = readinessElement.querySelector
          ? readinessElement.querySelector('[data-fiscal-readiness-retry-btn]')
          : null;
        if (retryBtn) retryBtn.addEventListener('click', loadReadiness);
      }
    }

    async function handleRefresh() {
      if (refreshPending) return;
      refreshPending = true;
      updateRefreshButtonState(refreshButton, true);
      setStatus('Actualizando información fiscal desde Hacienda...');
      renderLoadedContent();

      try {
        await fiscalSettingsApi.refreshActivities(session);
        currentData = await fiscalSettingsApi.getFiscalSettings(session);
        setStatus('Información fiscal actualizada desde Hacienda.', 'success');
        if (hasPermission(session, readinessViewPermission) && readinessElement) {
          await loadReadiness();
        }
        if (typeof context.setShellStatus === 'function') {
          context.setShellStatus('Información fiscal actualizada desde Hacienda.');
        }
      } catch (error) {
        const message = typeof error?.message === 'string' && error.message.trim().length > 0
          ? error.message
          : 'No se pudo actualizar la información fiscal desde Hacienda. Intenta nuevamente.';
        setStatus(message, 'error');
        if (typeof context.setShellStatus === 'function') {
          context.setShellStatus('No se pudo actualizar la información fiscal.', 'error');
        }
      } finally {
        refreshPending = false;
        updateRefreshButtonState(refreshButton, false);
        renderLoadedContent();
      }
    }

    async function handleToggleChange(event) {
      const control = event?.target;
      const activityCode = control?.getAttribute?.('data-activity-code') || '';
      if (!activityCode || pendingCodes.has(activityCode)) return;

      const desiredBillingEnabled = control.checked === true;
      pendingCodes.add(activityCode);
      setStatus('Actualizando actividad fiscal...');
      renderLoadedContent();

      try {
        currentData = await fiscalSettingsApi.updateActivityBillingEnabled(
          session,
          activityCode,
          desiredBillingEnabled,
        );
        setStatus('Actividad fiscal actualizada.', 'success');
        if (hasPermission(session, readinessViewPermission) && readinessElement) {
          await loadReadiness();
        }
        if (typeof context.setShellStatus === 'function') {
          context.setShellStatus('Actividad fiscal actualizada.');
        }
      } catch (error) {
        const message = typeof error?.message === 'string' && error.message.trim().length > 0
          ? error.message
          : 'No se pudo actualizar la actividad fiscal. Intenta nuevamente.';
        setStatus(message, 'error');
        if (typeof context.setShellStatus === 'function') {
          context.setShellStatus('No se pudo actualizar la actividad fiscal.', 'error');
        }
      } finally {
        pendingCodes.delete(activityCode);
        renderLoadedContent();
      }
    }

    async function handleDefaultChange(event) {
      const control = event?.target;
      const activityCode = control?.getAttribute?.('data-activity-code') || '';
      if (!activityCode || defaultPending) return;

      defaultPending = true;
      setStatus('Actualizando actividad predeterminada...');
      renderLoadedContent();

      try {
        currentData = await fiscalSettingsApi.setDefaultActivity(session, activityCode);
        setStatus('Actividad predeterminada actualizada.', 'success');
        if (hasPermission(session, readinessViewPermission) && readinessElement) {
          await loadReadiness();
        }
        if (typeof context.setShellStatus === 'function') {
          context.setShellStatus('Actividad predeterminada actualizada.');
        }
      } catch (error) {
        const message = typeof error?.message === 'string' && error.message.trim().length > 0
          ? error.message
          : 'No se pudo actualizar la actividad predeterminada. Intenta nuevamente.';
        setStatus(message, 'error');
        if (typeof context.setShellStatus === 'function') {
          context.setShellStatus('No se pudo actualizar la actividad predeterminada.', 'error');
        }
      } finally {
        defaultPending = false;
        renderLoadedContent();
      }
    }

    function bindActivityToggles() {
      const controls = contentElement.querySelectorAll
        ? contentElement.querySelectorAll('[data-fiscal-activity-toggle]')
        : [];
      for (const control of controls) {
        control.addEventListener('change', handleToggleChange);
      }
    }

    function bindCredentialsForm() {
      const form = contentElement.querySelector ? contentElement.querySelector('[data-hacienda-credentials-form]') : null;
      if (!form) return;
      form.addEventListener('submit', handleCredentialsSubmit);
    }

    async function handleCredentialsSubmit(event) {
      event.preventDefault();
      if (credentialsPending) return;
      const form = event.target;
      const usernameInput = form.elements.username;
      const passwordInput = form.elements.password;
      const username = String(usernameInput?.value || '').trim();
      const password = String(passwordInput?.value || '');
      if (!username || !password) {
        setStatus('Ingresa usuario y contraseña de Hacienda.', 'error');
        return;
      }
      credentialsPending = true;
      setStatus('Guardando y validando credenciales…');
      renderLoadedContent();
      try {
        const result = await fiscalSettingsApi.configureHaciendaCredentials(session, { username, password });
        currentConnection = result?.connection || null;
        const status = getConnectionStatus(currentReadiness, currentConnection);
        setStatus(status === 'INVALID_CREDENTIALS'
          ? 'Credenciales actualizadas, pero Hacienda indica que no son válidas.'
          : 'Credenciales guardadas y validadas.', status === 'INVALID_CREDENTIALS' ? 'error' : 'success');
        if (hasPermission(session, readinessViewPermission) && readinessElement) await loadReadiness();
      } catch (error) {
        const message = typeof error?.message === 'string' && error.message.trim()
          ? error.message
          : 'No se pudo guardar y validar la conexión con Hacienda.';
        setStatus(message, 'error');
      } finally {
        if (passwordInput) passwordInput.value = '';
        credentialsPending = false;
        renderLoadedContent();
      }
    }

    function bindDefaultToggles() {
      const controls = contentElement.querySelectorAll
        ? contentElement.querySelectorAll('[data-fiscal-default-toggle]')
        : [];
      for (const control of controls) {
        control.addEventListener('change', handleDefaultChange);
      }
    }

    try {
      currentData = await fiscalSettingsApi.getFiscalSettings(session);
      setStatus('');
      renderLoadedContent();
      if (hasPermission(session, refreshActivitiesPermission) && refreshButton) {
        refreshButton.hidden = false;
        refreshButton.addEventListener('click', handleRefresh);
      }
      if (hasPermission(session, readinessViewPermission) && readinessElement) {
        await loadReadiness();
      }
      if (typeof context.setShellStatus === 'function') {
        context.setShellStatus('Configuración fiscal cargada.');
      }
    } catch (error) {
      const message = typeof error?.message === 'string' && error.message.trim().length > 0
        ? error.message
        : 'No se pudo cargar la configuración fiscal. Intenta nuevamente más tarde o contacta al administrador.';
      setStatus(message, 'error');
      contentElement.innerHTML = `
        <section class="card root-card empty-state">
          <h3>No se pudo cargar la configuración fiscal</h3>
          <p class="muted">Esta vista solo muestra el estado disponible cuando la integración responde.</p>
        </section>
      `;
      if (typeof context.setShellStatus === 'function') {
        context.setShellStatus('No se pudo cargar la configuración fiscal.', 'error');
      }
    }
  }

  rootShell.register('views.fiscalSettingsAdmin', {
    render,
    mount,
  });
}(window));
