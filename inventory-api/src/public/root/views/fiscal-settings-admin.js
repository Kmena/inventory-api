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

  const BLOCKER_ACTIONS = Object.freeze({
    FISCAL_PROFILE_MISSING: ['Falta configurar el perfil fiscal de la empresa.', '#fiscal-issuer-section', 'Completar perfil fiscal'],
    HACIENDA_CONNECTION_MISSING: ['Falta configurar la conexión con Hacienda.', '#fiscal-security-section', 'Configurar conexión'],
    HACIENDA_CREDENTIALS_MISSING: ['Faltan las credenciales necesarias de Hacienda para este ambiente.', '#fiscal-security-section', 'Revisar conexión'],
    ACTIVE_CERTIFICATE_MISSING: ['Billing confirma que falta un certificado de firma activo.', '#fiscal-security-section', 'Configurar certificado'],
    CERTIFICATE_EXPIRED: ['El certificado de firma está vencido.', '#fiscal-security-section', 'Reemplazar certificado'],
    CERTIFICATE_NOT_YET_VALID: ['El certificado de firma todavía no es válido.', '#fiscal-security-section', 'Revisar certificado'],
    CERTIFICATE_IDENTITY_UNVERIFIED: ['Billing no pudo verificar la identidad del certificado.', '#fiscal-security-section', 'Revisar certificado'],
    CERTIFICATE_IDENTITY_MISMATCH: ['La identidad del certificado no coincide con la empresa.', '#fiscal-security-section', 'Revisar identidad'],
    FISCAL_SIGNING_CERTIFICATE_SECRET_UNAVAILABLE: ['El material de firma configurado no está disponible actualmente en Billing.', '#fiscal-security-section', 'Revisar certificado'],
    ISSUANCE_POINT_MISSING: ['Falta seleccionar un punto de emisión activo.', '#fiscal-issuance-section', 'Configurar punto de emisión'],
    TAXPAYER_VALIDATION_MISSING: ['Falta verificar la información del contribuyente con Hacienda.', '#fiscal-activities-section', 'Verificar contribuyente'],
    TAXPAYER_IDENTITY_MISMATCH: ['La identidad verificada no coincide con el emisor fiscal.', '#fiscal-issuer-section', 'Revisar identidad'],
    TAXPAYER_NOT_ACTIVE: ['El contribuyente no aparece activo para facturación electrónica.', '#fiscal-activities-section', 'Revisar verificación'],
    ECONOMIC_ACTIVITY_MISSING: ['No hay actividades económicas verificadas disponibles.', '#fiscal-activities-section', 'Actualizar actividades'],
    DEFAULT_ECONOMIC_ACTIVITY_MISSING: ['Seleccione una actividad económica predeterminada.', '#fiscal-activities-section', 'Elegir actividad'],
    DEFAULT_ECONOMIC_ACTIVITY_INVALID: ['La actividad económica predeterminada ya no es válida para facturación.', '#fiscal-activities-section', 'Cambiar actividad'],
  });

  const WARNING_MESSAGES = Object.freeze({
    TAXPAYER_MOROSO: 'Hacienda reporta al contribuyente como moroso.',
    TAXPAYER_OMISO: 'Hacienda reporta al contribuyente como omiso.',
    ECONOMIC_ACTIVITY_VERIFICATION_STALE: 'La información fiscal fue verificada hace más de 30 días. Se recomienda actualizarla desde Hacienda.',
  });

  const DIMENSION_LABELS = Object.freeze({
    issuer: 'Identidad del emisor',
    profile: 'Perfil fiscal',
    activity: 'Actividades económicas',
    hacienda: 'Conexión con Hacienda',
    certificate: 'Certificado de firma',
    issuancePoint: 'Punto de emisión predeterminado',
    sequence: 'Secuencias',
    operational: 'Disponibilidad operativa',
  });

  function readinessDimensionDetail(name, metadata = {}) {
    if (name === 'issuer') return metadata.verificationStatus ? `Verificación: ${metadata.verificationStatus}` : null;
    if (name === 'profile') return metadata.configured === true ? 'Perfil configurado' : null;
    if (name === 'activity' && Number.isInteger(metadata.count)) return `${metadata.count} actividad${metadata.count === 1 ? '' : 'es'}`;
    if (name === 'hacienda') return metadata.lastValidatedAt ? `Validada ${formatDate(metadata.lastValidatedAt)}` : (metadata.status || null);
    if (name === 'certificate') return metadata.validTo ? `Válido hasta ${formatDate(metadata.validTo)}` : (metadata.status || null);
    if (name === 'issuancePoint') return [metadata.branchCode, metadata.terminalCode].filter(Boolean).join('-') || metadata.status || null;
    if (name === 'sequence' && Number.isInteger(metadata.configuredTypes)) return `${metadata.configuredTypes} tipo${metadata.configuredTypes === 1 ? '' : 's'} configurado${metadata.configuredTypes === 1 ? '' : 's'}`;
    if (name === 'operational') return metadata.database === 'AVAILABLE' ? 'Servicio disponible' : null;
    return null;
  }

  function renderReadinessDimensions(readiness) {
    const dimensions = readiness?.dimensions || {};
    const entries = Object.entries(dimensions);
    if (entries.length === 0) return '';
    const stateLabels = {
      READY: ['Lista', 'badge-success'], NOT_READY: ['Pendiente', 'badge-warning'],
      WARNING: ['Advertencia', 'badge-warning'], UNKNOWN: ['Desconocida', ''],
    };
    return `<div class="fiscal-readiness-dimensions" aria-label="Dimensiones de preparación fiscal">
      ${entries.map(([name, dimension]) => {
        const [label, tone] = stateLabels[dimension?.state] || stateLabels.UNKNOWN;
        const detail = readinessDimensionDetail(name, dimension?.metadata);
        return `<div class="fiscal-readiness-dimension">
          <div><strong>${ui.escapeHtml(DIMENSION_LABELS[name] || 'Dimensión informativa')}</strong>${detail ? `<span>${ui.escapeHtml(detail)}</span>` : ''}</div>
          <span class="badge ${tone}" aria-label="${ui.escapeHtml(DIMENSION_LABELS[name] || name)}: ${label}">${label}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  function renderReadinessBlockers(readiness) {
    const blockers = readiness?.blockers || readiness?.reasonCodes || [];
    if (blockers.length === 0) return '';
    return `<div class="fiscal-readiness-blockers" aria-labelledby="fiscal-blockers-title" data-section-label="Problemas de configuración">
      <h4 id="fiscal-blockers-title">Qué falta resolver</h4>
      <ul>${blockers.map((code) => {
        const action = BLOCKER_ACTIONS[code];
        const message = action?.[0] || 'Billing reportó una configuración fiscal pendiente cuyo significado aún no está mapeado en Inventori.';
        return `<li><div><strong>${ui.escapeHtml(message)}</strong>${action ? '' : `<span class="muted">Código: ${ui.escapeHtml(code)}</span>`}</div>${action ? `<a class="secondary-button fiscal-readiness-action" href="${action[1]}">${ui.escapeHtml(action[2])}</a>` : ''}</li>`;
      }).join('')}</ul>
    </div>`;
  }

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

  function renderHaciendaConnectionCard(security, options) {
    const connection = security?.connection || null;
    const environment = security?.environment || connection?.environment || 'SANDBOX';
    const status = connection ? getConnectionStatus(null, connection) : 'NOT_CONFIGURED';
    const [label, tone] = connectionLabel(status);
    const configured = Boolean(connection && status !== 'NOT_CONFIGURED');
    const connectionDisabled = status === 'DISABLED';
    const disabled = options.credentialsPending || options.validationPending || options.disablePending
      || connectionDisabled || !options.canManageCredentials;
    return `
      <section class="card root-card fiscal-hacienda-connection-card" aria-labelledby="fiscal-hacienda-title">
        <div class="fiscal-card-heading">
          <div><h3 id="fiscal-hacienda-title">Conexión con Hacienda</h3><p class="muted">Las credenciales se envían a Billing y permanecen ocultas después de guardar.</p></div>
          <span class="${tone ? `badge ${tone}` : 'badge'}" role="status">${ui.escapeHtml(label)}</span>
        </div>
        <dl class="detail-grid">
          ${renderDetail('Ambiente', environment === 'SANDBOX' ? 'Pruebas (Sandbox)' : asText(environment))}
          ${configured ? renderDetail('Credenciales', 'Configuradas (valor oculto)') : renderDetail('Credenciales', 'Sin configurar')}
          ${connection?.lastValidatedAt ? renderDetail('Última validación', formatDate(connection.lastValidatedAt)) : ''}
          ${connection?.lastSuccessfulAuthAt ? renderDetail('Última autenticación exitosa', formatDate(connection.lastSuccessfulAuthAt)) : ''}
        </dl>
        ${connectionDisabled ? '<p class="fiscal-security-notice" role="status">La conexión está deshabilitada. Billing conserva credenciales, certificado e historial, pero bloquea nuevas emisiones.</p>' : ''}
        <form data-hacienda-credentials-form class="fiscal-credentials-form" autocomplete="off">
          <div class="root-form-grid">
            <label><span>Usuario de Hacienda</span><input name="username" type="text" maxlength="100" autocomplete="off" required ${disabled ? 'disabled' : ''}></label>
            <label><span>Contraseña</span><input name="password" type="password" maxlength="200" autocomplete="new-password" required ${disabled ? 'disabled' : ''}></label>
          </div>
          <p class="muted">Al guardar se reemplazan ambos valores y se validan en el ambiente seleccionado. Inventori no conserva una copia.</p>
          <div class="action-row fiscal-security-actions">
            <button type="submit" ${disabled ? 'disabled' : ''} aria-busy="${options.credentialsPending ? 'true' : 'false'}">${options.credentialsPending ? 'Guardando y validando…' : (configured ? 'Reemplazar y validar' : 'Guardar y validar')}</button>
            <button type="button" class="secondary-button" data-hacienda-validate ${disabled || !configured ? 'disabled' : ''} aria-busy="${options.validationPending ? 'true' : 'false'}">${options.validationPending ? 'Validando…' : 'Validar nuevamente'}</button>
            ${configured && !connectionDisabled && options.canManageCredentials && !options.disableConfirmationPending ? `<button type="button" class="secondary-button danger-button" data-hacienda-disable-request ${disabled ? 'disabled' : ''}>Deshabilitar conexión</button>` : ''}
          </div>
          ${options.disableConfirmationPending ? `
            <div class="fiscal-security-notice" role="group" aria-labelledby="fiscal-disable-confirmation-title">
              <p id="fiscal-disable-confirmation-title"><strong>¿Deshabilitar la conexión?</strong> Billing rechazará preparación y emisión hasta que exista un flujo autorizado de reactivación. No se borrarán credenciales, certificados ni historial.</p>
              <div class="action-row fiscal-security-actions">
                <button type="button" class="secondary-button" data-hacienda-disable-cancel ${options.disablePending ? 'disabled' : ''}>Cancelar</button>
                <button type="button" class="secondary-button danger-button" data-hacienda-disable-confirm ${options.disablePending ? 'disabled' : ''} aria-busy="${options.disablePending ? 'true' : 'false'}">${options.disablePending ? 'Deshabilitando…' : 'Sí, deshabilitar'}</button>
              </div>
            </div>
          ` : ''}
          ${!options.canManageCredentials ? '<p class="muted">Tu usuario puede ver esta sección, pero no modificar credenciales.</p>' : ''}
        </form>
      </section>
    `;
  }

  function certificateStatus(certificate) {
    if (!certificate) return ['Sin certificado', ''];
    if (certificate.status === 'EXPIRED' || certificate.expiryState === 'EXPIRED') return ['Certificado vencido', 'badge-warning'];
    if (certificate.expiryState === 'EXPIRING_SOON') return ['Vence pronto', 'badge-warning'];
    if (certificate.status === 'ACTIVE') return ['Certificado activo', 'badge-success'];
    return [`Certificado ${String(certificate.status || 'pendiente').toLowerCase()}`, ''];
  }

  function renderCertificateCard(security, options) {
    const certificate = security?.certificate || null;
    const [statusLabel, tone] = certificateStatus(certificate);
    const disabled = options.certificatePending || !options.canManageCredentials;
    const replace = Boolean(certificate);
    return `
      <section class="card root-card fiscal-certificate-card" aria-labelledby="fiscal-certificate-title">
        <div class="fiscal-card-heading">
          <div><h3 id="fiscal-certificate-title">Certificado de firma</h3><p class="muted">Archivo PKCS#12 y PIN de uso único para esta carga.</p></div>
          <span class="${tone ? `badge ${tone}` : 'badge'}" role="status">${ui.escapeHtml(statusLabel)}</span>
        </div>
        ${certificate ? `
          <dl class="detail-grid fiscal-certificate-metadata">
            ${renderDetail('Válido desde', formatDate(certificate.validFrom))}
            ${renderDetail('Válido hasta', formatDate(certificate.validTo))}
            ${renderDetail('Titular', asText(certificate.subjectName))}
            ${renderDetail('Emisor', asText(certificate.issuerName))}
            ${renderDetail('Identidad verificada', [certificate.extractedIdentityType, certificate.extractedIdentityNumber].filter(Boolean).join(' · ') || emptyLabel)}
            ${renderDetail('Serie', asText(certificate.serialNumber))}
          </dl>
          ${certificate.expiryState === 'EXPIRING_SOON' ? `<p class="fiscal-security-notice" role="status">Este certificado vence en ${ui.escapeHtml(String(certificate.daysRemaining))} días. Programa su reemplazo.</p>` : ''}
          ${certificate.expiryState === 'EXPIRED' ? '<p class="fiscal-security-notice" role="alert">El certificado está vencido. Reemplázalo para recuperar la preparación fiscal.</p>' : ''}
        ` : '<p class="fiscal-security-empty">Aún no hay un certificado activo en este ambiente.</p>'}
        <form data-fiscal-certificate-form class="fiscal-certificate-form" autocomplete="off">
          <input type="hidden" name="replace" value="${replace ? 'true' : 'false'}">
          <label><span>Archivo PKCS#12</span><input name="certificate" type="file" accept=".p12,.pfx,application/x-pkcs12,application/pkcs12" required ${disabled ? 'disabled' : ''} aria-describedby="fiscal-certificate-file-hint"></label>
          <p id="fiscal-certificate-file-hint" class="muted">Máximo 1 MiB. El archivo se procesa en memoria y no se guarda en Inventori.</p>
          <label><span>PIN del certificado</span><input name="pin" type="password" maxlength="200" autocomplete="new-password" required ${disabled ? 'disabled' : ''}></label>
          <p class="muted">Si el reemplazo falla, Billing conserva el certificado activo anterior.</p>
          <button type="submit" ${disabled ? 'disabled' : ''} aria-busy="${options.certificatePending ? 'true' : 'false'}">${options.certificatePending ? 'Validando certificado…' : (replace ? 'Reemplazar certificado' : 'Cargar certificado')}</button>
          ${!options.canManageCredentials ? '<p class="muted">Tu usuario puede consultar metadatos, pero no cargar certificados.</p>' : ''}
        </form>
      </section>
    `;
  }

  function renderFiscalSecurity(security, options) {
    const environment = security?.environment || 'SANDBOX';
    return `
      <section id="fiscal-security-section" class="fiscal-security-section" aria-labelledby="fiscal-security-title">
        <div class="fiscal-section-heading">
          <div><h3 id="fiscal-security-title">Conexión y firma</h3><p class="muted">Configuración protegida para ${environment === 'SANDBOX' ? 'pruebas (Sandbox)' : 'producción'}.</p></div>
          <span class="badge" aria-label="Ambiente fiscal">${ui.escapeHtml(environment)}</span>
        </div>
        <div class="fiscal-security-grid">
          ${renderHaciendaConnectionCard(security, options)}
          ${renderCertificateCard(security, options)}
        </div>
      </section>
    `;
  }

  function renderReadinessPanel(readiness, view = {}) {
    const state = view.state || readiness?.status || 'UNAVAILABLE';
    const presentation = {
      READY: ['Listo para facturar electrónicamente', 'Billing confirma que la configuración del emisor está lista en este ambiente.', 'badge-success', 'fiscal-readiness-card--ready'],
      NOT_READY: ['Configuración fiscal incompleta', 'Billing confirma requisitos que deben resolverse antes de emitir.', 'badge-warning', 'fiscal-readiness-card--not-ready'],
      UNKNOWN: ['Estado desconocido', 'Billing respondió, pero no pudo establecer un veredicto de preparación.', '', 'fiscal-readiness-card--unknown'],
      UNAVAILABLE: ['Billing no disponible', 'No fue posible comprobar el estado de preparación fiscal autoritativo. No se infiere que falte asociación, certificado ni otra configuración.', '', 'fiscal-readiness-card--unavailable'],
      STALE: ['Información anterior', 'La última consulta falló. Se conserva la respuesta anterior solo como referencia; no confirma preparación actual.', 'badge-warning', 'fiscal-readiness-card--stale'],
      LOADING: ['Comprobando preparación fiscal', 'Consultando la preparación canónica en Billing…', '', 'fiscal-readiness-card--loading'],
      ASSOCIATION_REQUIRED: ['Asociación requerida', 'Inventori confirma que esta empresa aún no tiene una asociación fiscal con Billing. No se evaluaron certificado ni demás requisitos.', 'badge-warning', 'fiscal-readiness-card--not-ready'],
      HISTORICAL_ONLY: ['Asociación solo histórica', 'Esta empresa conserva su vínculo fiscal únicamente como evidencia histórica. No se consulta readiness ni se permite reactivarlo desde esta pantalla.', 'badge-warning', 'fiscal-readiness-card--not-ready'],
      INTEGRATION_DISABLED: ['Integración deshabilitada', 'La integración fiscal está deshabilitada para esta empresa. No se evaluó la preparación canónica.', 'badge-warning', 'fiscal-readiness-card--not-ready'],
      PERMISSION_REQUIRED: ['Permiso de consulta requerido', 'Tu sesión no incluye el permiso para consultar la preparación fiscal. Solicita fiscal.readiness.view mediante la administración normal de roles.', 'badge-warning', 'fiscal-readiness-card--not-ready'],
    }[state] || ['Estado desconocido', 'No fue posible interpretar el estado autoritativo.', '', 'fiscal-readiness-card--unknown'];
    const warnings = (readiness?.warnings || []).map((code) => `<li>⚠ ${ui.escapeHtml(WARNING_MESSAGES[code] || 'Billing reportó una advertencia no mapeada.')} <span class="muted">${ui.escapeHtml(code)}</span></li>`).join('');
    const readyCount = Object.values(readiness?.dimensions || {}).filter((dimension) => dimension?.state === 'READY').length;
    const dimensionCount = Object.keys(readiness?.dimensions || {}).length;
    const canRefresh = !['LOADING', 'ASSOCIATION_REQUIRED', 'HISTORICAL_ONLY', 'INTEGRATION_DISABLED', 'PERMISSION_REQUIRED'].includes(state);
    return `
      <section id="fiscal-readiness-section" class="card root-card fiscal-readiness-card ${presentation[3]}" aria-labelledby="fiscal-readiness-title" aria-busy="${state === 'LOADING' ? 'true' : 'false'}">
        <div class="fiscal-readiness-heading">
          <div><h3 id="fiscal-readiness-title">${ui.escapeHtml(presentation[0])}</h3><p>${ui.escapeHtml(presentation[1])}</p></div>
          <span class="badge ${presentation[2]}" role="status">${ui.escapeHtml(readiness?.environment || view.environment || 'AMBIENTE NO CONFIRMADO')} · ${ui.escapeHtml(state === 'ASSOCIATION_REQUIRED' ? 'NO EVALUADA' : state)}</span>
        </div>
        <div class="fiscal-readiness-meta">
          ${readiness?.checkedAt ? `<span>Última comprobación exitosa: <strong>${ui.escapeHtml(formatDate(readiness.checkedAt))}</strong></span>` : '<span>Sin verificación exitosa disponible</span>'}
          ${view.attemptedAt ? `<span>Último intento: <strong>${ui.escapeHtml(formatDate(view.attemptedAt))}</strong></span>` : ''}
          ${dimensionCount ? `<span>${readyCount} de ${dimensionCount} dimensiones confirmadas; este conteo no es un porcentaje.</span>` : ''}
        </div>
        ${state === 'ASSOCIATION_REQUIRED' ? '<p><a class="secondary-button fiscal-readiness-action" href="#fiscal-issuer-section">Asociar empresa</a></p>' : ''}
        ${readiness ? renderReadinessDimensions(readiness) : ''}
        ${readiness ? renderReadinessBlockers(readiness) : ''}
        ${warnings ? `<ul aria-label="Advertencias">${warnings}</ul>` : ''}
        <div class="fiscal-readiness-footer">
          <p class="muted">Este estado cubre al emisor y la disponibilidad operativa. Receptor, correo, tipo de documento, CAByS, unidad e impuestos se validan para cada transacción antes del envío.</p>
          ${canRefresh ? '<button type="button" class="secondary-button" data-fiscal-readiness-refresh data-fiscal-readiness-retry-btn>Actualizar estado</button>' : ''}
        </div>
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
        <section id="fiscal-activities-section" class="card root-card empty-state" aria-labelledby="fiscal-activities-title">
          <h3 id="fiscal-activities-title">Actividades económicas</h3>
          <p>No hay actividades económicas verificadas disponibles.</p>
        </section>
      `;
    }

    return `
      <section id="fiscal-activities-section" aria-labelledby="fiscal-activities-title">
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
        ${renderActivitiesChecklist(data, options)}
      </div>
    `;
  }

  function fieldValue(value) {
    return ui.escapeHtml(typeof value === 'string' ? value : '');
  }

  function renderIssuerAdministration(data, options) {
    if (!data) {
      return '<section id="fiscal-issuer-section" class="card root-card fiscal-issuer-panel"><h3>Emisor fiscal</h3><p aria-busy="true">Consultando el estado canónico en Billing…</p></section>';
    }
    if (data.association?.status === 'HISTORICAL_ONLY') {
      return `
        <section id="fiscal-issuer-section" class="card root-card fiscal-issuer-panel" aria-labelledby="fiscal-issuer-title">
          <div class="fiscal-issuer-heading">
            <div><h3 id="fiscal-issuer-title">Emisor fiscal</h3><p>La asociación de esta empresa se conserva únicamente para trazabilidad histórica.</p></div>
            <span class="badge badge-warning" role="status">Solo histórica</span>
          </div>
          <p class="muted">No puede reactivarse ni aprovisionarse de nuevo desde esta pantalla. Para operar con otra empresa, cierra sesión e ingresa con una cuenta autorizada para esa empresa.</p>
          ${options.companyId ? `<p class="muted">Empresa de la sesión actual: <strong>${ui.escapeHtml(String(options.companyId))}</strong>.</p>` : ''}
        </section>`;
    }
    if (data.association?.status === 'DISABLED') {
      return `
        <section id="fiscal-issuer-section" class="card root-card fiscal-issuer-panel" aria-labelledby="fiscal-issuer-title">
          <div class="fiscal-issuer-heading">
            <div><h3 id="fiscal-issuer-title">Emisor fiscal</h3><p>La integración fiscal está deshabilitada para esta empresa.</p></div>
            <span class="badge badge-warning" role="status">Deshabilitada</span>
          </div>
          <p class="muted">La reactivación requiere el flujo administrativo autorizado; esta pantalla no modifica la asociación.</p>
        </section>`;
    }
    if (data.association?.status !== 'ASSOCIATED') {
      return `
        <section id="fiscal-issuer-section" class="card root-card fiscal-issuer-panel" aria-labelledby="fiscal-issuer-title">
          <div class="fiscal-issuer-heading">
            <div><h3 id="fiscal-issuer-title">Emisor fiscal</h3><p>Esta empresa todavía no está asociada con un emisor fiscal de Billing.</p></div>
            <span class="badge badge-warning" role="status">Pendiente de asociación</span>
          </div>
          <p class="muted">El alta usa la identidad fiscal registrada en Inventori y entrega la credencial únicamente al servidor. No se mostrará ningún secreto.</p>
          <button type="button" data-fiscal-issuer-provision ${options.pending || !options.canManage ? 'disabled' : ''} aria-busy="${options.pending ? 'true' : 'false'}">${options.pending ? 'Asociando empresa…' : 'Asociar con Billing'}</button>
          ${!options.canManage ? '<p class="muted">Necesitas permiso para administrar credenciales fiscales.</p>' : ''}
        </section>`;
    }
    const issuer = data.issuer || {};
    const profile = data.profile || {};
    return `
      <section id="fiscal-issuer-section" class="card root-card fiscal-issuer-panel" aria-labelledby="fiscal-issuer-title">
        <div class="fiscal-issuer-heading">
          <div><h3 id="fiscal-issuer-title">Emisor fiscal</h3><p class="muted">Datos confirmados por Billing para ${ui.escapeHtml(data.association.environment === 'SANDBOX' ? 'pruebas' : 'producción')}.</p></div>
          <span class="badge badge-success" role="status">Sincronizado</span>
        </div>
        <form data-fiscal-issuer-form class="fiscal-issuer-form" novalidate>
          <fieldset class="root-form__section">
            <legend>Identidad legal</legend>
            <p id="fiscal-identity-lock-hint" class="fiscal-lock-note">Billing bloquea tipo y número de identificación cuando existe certificado activo, reserva o comprobante fiscal. Los documentos históricos nunca cambian.</p>
            <div class="root-form-grid">
              <label><span>Razón social</span><input name="legalName" required minlength="2" maxlength="255" value="${fieldValue(issuer.legalName)}"></label>
              <label><span>Nombre comercial</span><input name="tradeName" maxlength="255" value="${fieldValue(issuer.tradeName)}"></label>
              <label><span>Tipo de identificación</span><select name="identificationType" aria-describedby="fiscal-identity-lock-hint" required>${['FISICA','JURIDICA','DIMEX','NITE'].map((value) => `<option value="${value}" ${issuer.identificationType === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
              <label><span>Número de identificación</span><input name="identificationNumber" aria-describedby="fiscal-identity-lock-hint" required minlength="9" maxlength="20" value="${fieldValue(issuer.identificationNumber)}"></label>
            </div>
          </fieldset>
          <fieldset class="root-form__section">
            <legend>Perfil y ubicación fiscal</legend>
            <div class="root-form-grid">
              <label><span>Actividad económica</span><input name="economicActivityCode" required maxlength="20" value="${fieldValue(profile.economicActivityCode)}"></label>
              <label><span>Correo fiscal</span><input name="email" type="email" required maxlength="160" value="${fieldValue(profile.email)}"></label>
              <label><span>Provincia</span><input name="province" inputmode="numeric" pattern="\\d" required maxlength="1" value="${fieldValue(profile.province)}"></label>
              <label><span>Cantón</span><input name="canton" inputmode="numeric" pattern="\\d{2}" required maxlength="2" value="${fieldValue(profile.canton)}"></label>
              <label><span>Distrito</span><input name="district" inputmode="numeric" pattern="\\d{2}" required maxlength="2" value="${fieldValue(profile.district)}"></label>
              <label><span>Barrio</span><input name="barrio" maxlength="50" value="${fieldValue(profile.barrio)}"></label>
              <label class="root-form-grid__full"><span>Otras señas</span><textarea name="otrasSenas" required minlength="5" maxlength="250" rows="3">${fieldValue(profile.otrasSenas)}</textarea></label>
              <label><span>Código de país</span><input name="phoneCountryCode" inputmode="numeric" pattern="\\d{1,3}" maxlength="3" value="${fieldValue(profile.phoneCountryCode)}"></label>
              <label><span>Teléfono</span><input name="phoneNumber" inputmode="tel" pattern="\\d{4,20}" maxlength="20" value="${fieldValue(profile.phoneNumber)}"></label>
            </div>
          </fieldset>
          <div class="action-row"><button type="submit" ${options.pending || !options.canManage ? 'disabled' : ''} aria-busy="${options.pending ? 'true' : 'false'}">${options.pending ? 'Guardando…' : 'Guardar y confirmar en Billing'}</button></div>
        </form>
      </section>`;
  }

  function renderFiscalTerminalRow(branch, terminal, defaultPoint, options) {
    const isDefault = defaultPoint?.terminalId === terminal.terminalId;
    const eligible = branch.active && terminal.active;
    const disabled = options.pending || !options.canManage;
    return `
      <li class="fiscal-terminal-row" data-terminal-id="${ui.escapeHtml(terminal.terminalId)}">
        <div class="fiscal-terminal-summary">
          <div>
            <strong>${ui.escapeHtml(terminal.code)} · ${ui.escapeHtml(terminal.name)}</strong>
            <div class="fiscal-state-badges">
              ${renderBadge(terminal.active ? 'Activa' : 'Inactiva', terminal.active ? 'badge-success' : '')}
              ${isDefault ? renderBadge('Predeterminada', 'badge-success') : ''}
            </div>
          </div>
          <div class="action-row fiscal-point-actions">
            <button type="button" class="secondary-button" data-terminal-default="${ui.escapeHtml(terminal.terminalId)}" ${disabled || !eligible || isDefault ? 'disabled' : ''}>${isDefault ? 'Predeterminada' : 'Usar como predeterminada'}</button>
            <button type="button" class="secondary-button" data-terminal-active="${ui.escapeHtml(terminal.terminalId)}" data-active="${terminal.active ? 'false' : 'true'}" ${disabled || isDefault ? 'disabled' : ''}>${terminal.active ? 'Desactivar' : 'Activar'}</button>
          </div>
        </div>
        ${isDefault && terminal.active ? '' : (!eligible ? '<p class="muted">Activa la sucursal y la terminal antes de seleccionarla como punto predeterminado.</p>' : '')}
        <details class="fiscal-inline-editor">
          <summary>Editar nombre</summary>
          <form data-terminal-form data-branch-id="${ui.escapeHtml(branch.branchId)}" class="fiscal-compact-form">
            <input type="hidden" name="code" value="${ui.escapeHtml(terminal.code)}">
            <label><span>Nombre de la terminal ${ui.escapeHtml(terminal.code)}</span><input name="name" required maxlength="120" value="${fieldValue(terminal.name)}" ${disabled ? 'disabled' : ''}></label>
            <button type="submit" ${disabled ? 'disabled' : ''}>Guardar nombre</button>
          </form>
        </details>
      </li>`;
  }

  function renderFiscalBranchGroup(branch, defaultPoint, options) {
    const isDefaultBranch = defaultPoint?.branchId === branch.branchId;
    const disabled = options.pending || !options.canManage;
    const terminals = branch.terminals || [];
    return `
      <article class="fiscal-branch-group" data-branch-id="${ui.escapeHtml(branch.branchId)}">
        <header class="fiscal-branch-header">
          <div>
            <h4>${ui.escapeHtml(branch.code)} · ${ui.escapeHtml(branch.name)}</h4>
            <div class="fiscal-state-badges">
              ${renderBadge(branch.active ? 'Sucursal activa' : 'Sucursal inactiva', branch.active ? 'badge-success' : '')}
              ${isDefaultBranch ? renderBadge('Contiene el punto predeterminado', 'badge-success') : ''}
            </div>
          </div>
          <button type="button" class="secondary-button" data-branch-active="${ui.escapeHtml(branch.branchId)}" data-active="${branch.active ? 'false' : 'true'}" ${disabled || isDefaultBranch ? 'disabled' : ''}>${branch.active ? 'Desactivar sucursal' : 'Activar sucursal'}</button>
        </header>
        <details class="fiscal-inline-editor">
          <summary>Editar nombre de sucursal</summary>
          <form data-branch-form class="fiscal-compact-form">
            <input type="hidden" name="code" value="${ui.escapeHtml(branch.code)}">
            <label><span>Nombre de la sucursal ${ui.escapeHtml(branch.code)}</span><input name="name" required maxlength="120" value="${fieldValue(branch.name)}" ${disabled ? 'disabled' : ''}></label>
            <button type="submit" ${disabled ? 'disabled' : ''}>Guardar nombre</button>
          </form>
        </details>
        <div class="fiscal-terminal-heading"><h5>Terminales</h5><span class="muted">${terminals.length} configurada${terminals.length === 1 ? '' : 's'}</span></div>
        ${terminals.length > 0
    ? `<ul class="fiscal-terminal-list">${terminals.map((terminal) => renderFiscalTerminalRow(branch, terminal, defaultPoint, options)).join('')}</ul>`
    : '<p class="fiscal-empty-inline">Esta sucursal todavía no tiene terminales fiscales.</p>'}
        <details class="fiscal-inline-editor" data-terminal-create>
          <summary>Agregar terminal</summary>
          <form data-terminal-form data-branch-id="${ui.escapeHtml(branch.branchId)}" class="fiscal-compact-form fiscal-compact-form--two-fields">
            <label><span>Código de 5 dígitos</span><input name="code" inputmode="numeric" pattern="\\d{5}" maxlength="5" required placeholder="00001" ${disabled ? 'disabled' : ''}></label>
            <label><span>Nombre</span><input name="name" required maxlength="120" placeholder="Caja principal" ${disabled ? 'disabled' : ''}></label>
            <button type="submit" ${disabled ? 'disabled' : ''}>Agregar terminal</button>
          </form>
        </details>
      </article>`;
  }

  function renderFiscalSequencePanel(data, options) {
    const terminals = (data?.branches || []).flatMap((branch) => (branch.terminals || []).map((terminal) => ({ branch, terminal })));
    const sequence = options.sequenceResult?.sequence || null;
    const selectedTerminalId = options.sequenceResult?.terminalId || '';
    const selectedTerminal = terminals.find(({ terminal }) => terminal.terminalId === selectedTerminalId) || null;
    const disabled = options.sequencePending || !options.canManage;
    return `
      <section class="fiscal-sequence-panel" aria-labelledby="fiscal-sequence-title">
        <div class="fiscal-sequence-heading">
          <div><h4 id="fiscal-sequence-title">Secuencias fiscales</h4><p class="muted">Billing asigna los consecutivos. Consultar este estado nunca reserva ni incrementa una secuencia.</p></div>
        </div>
        ${terminals.length === 0 ? '<p class="fiscal-empty-inline">Agrega una terminal para consultar o configurar su secuencia inicial.</p>' : `
          <form data-sequence-read-form class="fiscal-compact-form fiscal-compact-form--two-fields">
            <label><span>Terminal</span><select name="terminalId" required>${terminals.map(({ branch, terminal }) => `<option value="${ui.escapeHtml(terminal.terminalId)}" ${terminal.terminalId === selectedTerminalId ? 'selected' : ''}>${ui.escapeHtml(branch.code)}-${ui.escapeHtml(terminal.code)} · ${ui.escapeHtml(terminal.name)}</option>`).join('')}</select></label>
            <label><span>Tipo de documento</span><select name="documentType"><option value="INVOICE" ${sequence?.documentType === 'INVOICE' ? 'selected' : ''}>Factura</option><option value="TICKET" ${sequence?.documentType === 'TICKET' ? 'selected' : ''}>Tiquete</option></select></label>
            <button type="submit" class="secondary-button" ${options.sequencePending ? 'disabled' : ''} aria-busy="${options.sequencePending ? 'true' : 'false'}">${options.sequencePending ? 'Consultando…' : 'Consultar secuencia'}</button>
          </form>
          ${options.sequenceResult ? (sequence ? `
            <dl class="detail-grid fiscal-sequence-state" aria-live="polite">
              ${renderDetail('Documento', sequence.documentType === 'INVOICE' ? 'Factura' : 'Tiquete')}
              ${renderDetail('Sucursal / terminal', `${sequence.branchCode}-${sequence.terminalCode}`)}
              ${renderDetail('Último asignado', sequence.lastAssigned ?? 'Ninguno')}
              ${renderDetail('Siguiente disponible', sequence.nextValue)}
            </dl>
            <p class="fiscal-security-notice" role="status">${sequence.locked ? 'La secuencia ya tiene asignaciones y está bloqueada para cambios.' : 'La secuencia inicial ya está configurada. No puede reemplazarse ni reducirse desde Inventori.'}</p>
          ` : `
            <div class="fiscal-sequence-empty" aria-live="polite">
              <p><strong>Sin secuencia configurada</strong> para ${ui.escapeHtml(selectedTerminal ? `${selectedTerminal.branch.code}-${selectedTerminal.terminal.code}` : 'esta terminal')}.</p>
              <form data-sequence-initial-form class="fiscal-compact-form">
                <input type="hidden" name="terminalId" value="${ui.escapeHtml(selectedTerminalId)}">
                <input type="hidden" name="documentType" value="${ui.escapeHtml(options.sequenceDocumentType || 'INVOICE')}">
                <label><span>Siguiente valor inicial</span><input name="nextValue" type="number" inputmode="numeric" min="1" max="9999999999" step="1" required value="1" ${disabled ? 'disabled' : ''}></label>
                <label class="fiscal-confirm-check"><input name="confirmed" type="checkbox" required ${disabled ? 'disabled' : ''}><span>Confirmo que este valor solo puede establecerse antes de la primera asignación y no podrá reducirse ni reiniciarse.</span></label>
                <button type="submit" ${disabled ? 'disabled' : ''} aria-busy="${options.sequencePending ? 'true' : 'false'}">${options.sequencePending ? 'Configurando…' : 'Configurar secuencia inicial'}</button>
              </form>
            </div>` ) : ''}
        `}
      </section>`;
  }

  function renderIssuanceAdministration(data, options) {
    if (!data) {
      return '<section class="fiscal-issuance-section"><h3>Sucursales y puntos de emisión</h3><p aria-busy="true">Consultando el estado canónico en Billing…</p></section>';
    }
    const branches = data.branches || [];
    const disabled = options.pending || !options.canManage;
    return `
      <section id="fiscal-issuance-section" class="fiscal-issuance-section" aria-labelledby="fiscal-issuance-title">
        <div class="fiscal-section-heading">
          <div><h3 id="fiscal-issuance-title">Sucursales y puntos de emisión</h3><p class="muted">Las sucursales fiscales son independientes de bodegas y locales comerciales. Billing conserva la autoridad sobre terminales, predeterminado y secuencias.</p></div>
          <span class="badge" aria-label="Ambiente fiscal">${ui.escapeHtml(data.environment)}</span>
        </div>
        <form data-branch-form class="card root-card fiscal-create-branch-form">
          <div><h4>Agregar sucursal fiscal</h4><p class="muted">Guardar nuevamente el mismo código actualiza únicamente el nombre permitido por el contrato.</p></div>
          <div class="fiscal-compact-form fiscal-compact-form--two-fields">
            <label><span>Código de 3 dígitos</span><input name="code" inputmode="numeric" pattern="\\d{3}" maxlength="3" required placeholder="001" ${disabled ? 'disabled' : ''}></label>
            <label><span>Nombre</span><input name="name" required maxlength="120" placeholder="Sucursal central" ${disabled ? 'disabled' : ''}></label>
            <button type="submit" ${disabled ? 'disabled' : ''} aria-busy="${options.pending ? 'true' : 'false'}">${options.pending ? 'Guardando…' : 'Guardar sucursal'}</button>
          </div>
          ${!options.canManage ? '<p class="muted">Tu usuario puede consultar esta configuración, pero necesita permiso de administración fiscal para modificarla.</p>' : ''}
        </form>
        <div class="fiscal-branch-list">
          ${branches.length > 0 ? branches.map((branch) => renderFiscalBranchGroup(branch, data.defaultIssuancePoint, options)).join('') : '<p class="fiscal-empty-inline">No hay sucursales fiscales configuradas. Agrega la primera para continuar.</p>'}
        </div>
        ${renderFiscalSequencePanel(data, options)}
      </section>`;
  }

  function renderFiscalTestWorkspace(readiness, result, options = {}) {
    const isSandbox = readiness?.environment === 'SANDBOX' || options.environment === 'SANDBOX';
    const isReady = readiness?.readyToIssue === true;
    const disabled = options.pending || !options.canManage || !isReady || !isSandbox;
    const submission = result?.submission;
    const artifacts = result?.artifacts || [];
    const deliveries = result?.deliveries || [];
    return `
      <section id="fiscal-test-section" class="card root-card fiscal-test-workspace" aria-labelledby="fiscal-test-title">
        <div class="fiscal-section-heading">
          <div><h3 id="fiscal-test-title">Factura fiscal de prueba</h3><p class="muted">Usa el pipeline fiscal real del ambiente de pruebas. No crea una factura comercial de Inventori.</p></div>
          <span class="badge ${isSandbox ? 'badge-success' : 'badge-warning'}">${isSandbox ? 'SANDBOX' : 'No disponible'}</span>
        </div>
        <div class="fiscal-test-disclosure" role="note">
          <strong>Esta acción consume un consecutivo SANDBOX.</strong>
          <span>Que Billing acepte la solicitud no significa que Hacienda haya aceptado el comprobante.</span>
        </div>
        ${!isSandbox ? '<p class="fiscal-security-notice">La política del servidor bloquea esta acción en producción, aunque la interfaz fuese manipulada.</p>' : ''}
        ${isSandbox && !isReady ? '<p class="fiscal-security-notice">Completa los bloqueos de preparación fiscal antes de ejecutar la prueba.</p>' : ''}
        <form data-fiscal-test-form class="fiscal-test-form" novalidate>
          <fieldset class="root-form__section" ${disabled ? 'disabled' : ''}>
            <legend>Receptor y línea de prueba</legend>
            <div class="root-form-grid">
              <label><span>Nombre del receptor</span><input name="receiverName" required maxlength="160" value="Receptor de prueba"></label>
              <label><span>Tipo de identificación</span><select name="receiverType"><option value="JURIDICA">JURIDICA</option><option value="FISICA">FISICA</option><option value="DIMEX">DIMEX</option><option value="NITE">NITE</option></select></label>
              <label><span>Identificación</span><input name="receiverNumber" required minlength="9" maxlength="20" value="3101000001"></label>
              <label><span>Correo de prueba</span><input name="receiverEmail" type="email" required maxlength="160" value="receptor@example.invalid"></label>
              <label><span>CABYS</span><input name="cabysCode" inputmode="numeric" pattern="\\d{13}" required maxlength="13" value="1234567890123"></label>
              <label><span>Descripción</span><input name="description" required maxlength="200" value="Servicio de prueba fiscal"></label>
              <label><span>Cantidad</span><input name="quantity" inputmode="decimal" required value="1.00000"></label>
              <label><span>Precio unitario CRC</span><input name="unitPrice" inputmode="decimal" required value="1000.00000"></label>
              <label><span>Impuesto CRC</span><input name="taxAmount" inputmode="decimal" required value="130.00000"></label>
            </div>
            <label class="fiscal-confirm-check"><input name="confirmed" type="checkbox" required><span>Confirmo que deseo consumir un consecutivo SANDBOX y enviar este comprobante al flujo de pruebas de Hacienda.</span></label>
            <div class="action-row"><button type="submit" ${disabled ? 'disabled' : ''} aria-busy="${options.pending ? 'true' : 'false'}">${options.pending ? 'Iniciando prueba…' : 'Probar facturación en SANDBOX'}</button></div>
          </fieldset>
        </form>
        ${result ? `
          <div class="fiscal-test-result" aria-live="polite">
            <div class="fiscal-section-heading"><div><h4>Seguimiento</h4><p class="muted">Ejecución ${ui.escapeHtml(result.executionId)}</p></div><button type="button" class="secondary-button" data-fiscal-test-refresh ${options.pending ? 'disabled' : ''}>Actualizar estado</button></div>
            <dl class="detail-grid">
              ${renderDetail('Documento', result.document?.status || 'PENDIENTE')}
              ${renderDetail('Solicitud Billing', submission ? 'ACEPTADA PARA PROCESAR' : 'PENDIENTE')}
              ${renderDetail('Estado Hacienda', submission?.haciendaAccepted ? 'ACEPTADA' : (submission?.status || 'SIN RESPUESTA'))}
              ${renderDetail('Consecutivo SANDBOX', result.document?.consecutive || 'Pendiente')}
              ${renderDetail('Última actualización', result.document?.updatedAt ? formatDate(result.document.updatedAt) : 'Pendiente')}
            </dl>
            ${submission?.errorMessage ? `<p class="inline-message error">${ui.escapeHtml(submission.errorMessage)}</p>` : ''}
            <div class="fiscal-test-evidence-grid">
              <div><h5>Artefactos</h5>${artifacts.length ? `<ul>${artifacts.map((artifact) => `<li><a href="/api/company/fiscal-settings/test-invoices/${encodeURIComponent(result.executionId)}/artifacts/${encodeURIComponent(artifact.type)}">Descargar ${ui.escapeHtml(artifact.type)}</a> <span class="muted">${ui.escapeHtml(String(artifact.sizeBytes))} bytes</span></li>`).join('')}</ul>` : '<p class="muted">Aún no hay artefactos disponibles.</p>'}</div>
              <div><h5>Entregas</h5>${deliveries.length ? `<ul>${deliveries.map((delivery) => `<li><strong>${ui.escapeHtml(delivery.kind)}</strong> · ${ui.escapeHtml(delivery.status)} · ${ui.escapeHtml(delivery.deliveryEvidence || 'Resultado externo no confirmado')} · ${ui.escapeHtml(String(delivery.attemptCount))} intento(s)</li>`).join('')}</ul>` : '<p class="muted">Aún no hay entregas registradas.</p>'}</div>
            </div>
          </div>` : ''}
        ${!options.canManage ? '<p class="muted">Necesitas permiso para administrar credenciales fiscales para ejecutar la prueba.</p>' : ''}
      </section>`;
  }

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <div class="page-header compact">
          <div>
            <h2 id="root-view-title">Configuración fiscal</h2>
            <p class="muted">Administra la identidad fiscal y confirma el estado canónico de esta empresa.</p>
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
      <div data-fiscal-readiness-content>${renderReadinessPanel(null, { state: 'LOADING' })}</div>
      <div data-fiscal-test-content>${renderFiscalTestWorkspace(null, null, {})}</div>
      <div data-fiscal-issuer-content>${renderIssuerAdministration(null, {})}</div>
      <div data-fiscal-security-content>
        <section class="fiscal-security-section" aria-labelledby="fiscal-security-loading-title">
          <div class="fiscal-section-heading"><div><h3 id="fiscal-security-loading-title">Conexión y firma</h3><p class="muted">Consultando estado canónico en Billing…</p></div></div>
          <div class="fiscal-security-grid" aria-busy="true">
            <div class="card root-card fiscal-security-skeleton"></div>
            <div class="card root-card fiscal-security-skeleton"></div>
          </div>
        </section>
      </div>
      <div data-fiscal-issuance-content>${renderIssuanceAdministration(null, {})}</div>
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
    const testInvoiceElement = container.querySelector('[data-fiscal-test-content]');
    const issuerElement = container.querySelector('[data-fiscal-issuer-content]');
    const securityElement = container.querySelector('[data-fiscal-security-content]');
    const issuanceElement = container.querySelector('[data-fiscal-issuance-content]');
    const pendingCodes = new Set();
    let currentData = null;
    let currentReadiness = null;
    let defaultPending = false;
    let refreshPending = false;
    let credentialsPending = false;
    let validationPending = false;
    let disablePending = false;
    let disableConfirmationPending = false;
    let certificatePending = false;
    let currentSecurity = null;
    let currentIssuerAdministration = null;
    let issuerLoadState = 'LOADING';
    let issuerPending = false;
    let currentIssuanceAdministration = null;
    let issuancePending = false;
    let sequencePending = false;
    let sequenceResult = null;
    let sequenceDocumentType = 'INVOICE';
    let readinessPending = false;
    let lastVerifiedReadiness = null;
    let lastReadinessAttemptedAt = null;
    let testInvoicePending = false;
    let testInvoiceResult = null;
    let testInvoiceIdempotencyKey = null;

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
      });
      bindActivityToggles();
      bindDefaultToggles();
    }

    function renderSecurityContent() {
      if (!securityElement || !currentSecurity) return;
      securityElement.innerHTML = renderFiscalSecurity(currentSecurity, {
        credentialsPending,
        validationPending,
        disablePending,
        disableConfirmationPending,
        certificatePending,
        canManageCredentials: hasPermission(session, credentialsManagePermission),
      });
      securityElement.querySelector('[data-hacienda-credentials-form]')?.addEventListener('submit', handleCredentialsSubmit);
      securityElement.querySelector('[data-hacienda-validate]')?.addEventListener('click', handleCredentialsValidation);
      securityElement.querySelector('[data-hacienda-disable-request]')?.addEventListener('click', handleDisableRequest);
      securityElement.querySelector('[data-hacienda-disable-cancel]')?.addEventListener('click', handleDisableCancel);
      securityElement.querySelector('[data-hacienda-disable-confirm]')?.addEventListener('click', handleDisableConfirm);
      securityElement.querySelector('[data-fiscal-certificate-form]')?.addEventListener('submit', handleCertificateSubmit);
    }

    async function loadFiscalSecurityConfiguration() {
      if (!securityElement) return;
      try {
        currentSecurity = await fiscalSettingsApi.getFiscalSecurityConfiguration(session);
        renderSecurityContent();
      } catch (error) {
        securityElement.innerHTML = `<section class="card root-card fiscal-security-error"><h3>Conexión y firma</h3><p>${ui.escapeHtml(error?.message || 'No se pudo consultar la configuración segura.')}</p><button type="button" data-fiscal-security-retry>Volver a intentar</button></section>`;
        securityElement.querySelector('[data-fiscal-security-retry]')?.addEventListener('click', loadFiscalSecurityConfiguration);
      }
    }

    function renderIssuanceContent() {
      if (!issuanceElement || !currentIssuanceAdministration) return;
      issuanceElement.innerHTML = renderIssuanceAdministration(currentIssuanceAdministration, {
        pending: issuancePending,
        sequencePending,
        sequenceResult,
        sequenceDocumentType,
        canManage: hasPermission(session, credentialsManagePermission),
      });
      issuanceElement.querySelectorAll('[data-branch-form]').forEach((form) => form.addEventListener('submit', handleBranchSubmit));
      issuanceElement.querySelectorAll('[data-terminal-form]').forEach((form) => form.addEventListener('submit', handleTerminalSubmit));
      issuanceElement.querySelectorAll('[data-branch-active]').forEach((button) => button.addEventListener('click', handleBranchStatus));
      issuanceElement.querySelectorAll('[data-terminal-active]').forEach((button) => button.addEventListener('click', handleTerminalStatus));
      issuanceElement.querySelectorAll('[data-terminal-default]').forEach((button) => button.addEventListener('click', handleDefaultPoint));
      issuanceElement.querySelector('[data-sequence-read-form]')?.addEventListener('submit', handleSequenceRead);
      issuanceElement.querySelector('[data-sequence-initial-form]')?.addEventListener('submit', handleInitialSequence);
    }

    async function loadIssuanceAdministration() {
      if (!issuanceElement) return;
      try {
        currentIssuanceAdministration = await fiscalSettingsApi.getIssuanceAdministration(session);
        renderIssuanceContent();
      } catch (error) {
        issuanceElement.innerHTML = `<section class="card root-card fiscal-issuance-error"><h3>Sucursales y puntos de emisión</h3><p>${ui.escapeHtml(error?.message || 'No se pudo consultar la configuración de emisión.')}</p><button type="button" data-fiscal-issuance-retry>Volver a intentar</button></section>`;
        issuanceElement.querySelector('[data-fiscal-issuance-retry]')?.addEventListener('click', loadIssuanceAdministration);
      }
    }

    async function runIssuanceMutation(work, pendingMessage, successMessage) {
      if (issuancePending) return;
      issuancePending = true;
      setStatus(pendingMessage);
      renderIssuanceContent();
      try {
        currentIssuanceAdministration = await work();
        sequenceResult = null;
        setStatus(successMessage, 'success');
        if (hasPermission(session, readinessViewPermission) && readinessElement) await loadReadiness();
      } catch (error) {
        if (error?.statusCode === 409 || String(error?.code || '').includes('CONFLICT')) {
          await loadIssuanceAdministration();
          setStatus('Billing detectó un cambio concurrente. Se actualizó el estado canónico; revisa la selección antes de intentar de nuevo.', 'error');
        } else {
          setStatus(error?.message || 'No se pudo guardar la configuración del punto de emisión.', 'error');
        }
      } finally {
        issuancePending = false;
        renderIssuanceContent();
      }
    }

    async function handleBranchSubmit(event) {
      event.preventDefault();
      if (issuancePending || !event.currentTarget.reportValidity()) return;
      const values = new FormData(event.currentTarget);
      await runIssuanceMutation(
        () => fiscalSettingsApi.upsertFiscalBranch(session, { code: String(values.get('code') || ''), name: String(values.get('name') || '').trim() }),
        'Guardando sucursal y verificando el estado canónico…',
        'Sucursal confirmada por Billing.',
      );
    }

    async function handleTerminalSubmit(event) {
      event.preventDefault();
      if (issuancePending || !event.currentTarget.reportValidity()) return;
      const form = event.currentTarget;
      const values = new FormData(form);
      await runIssuanceMutation(
        () => fiscalSettingsApi.upsertFiscalTerminal(session, form.dataset.branchId, { code: String(values.get('code') || ''), name: String(values.get('name') || '').trim() }),
        'Guardando terminal y verificando el estado canónico…',
        'Terminal confirmada por Billing.',
      );
    }

    async function handleBranchStatus(event) {
      const button = event.currentTarget;
      await runIssuanceMutation(
        () => fiscalSettingsApi.setFiscalBranchActive(session, button.dataset.branchActive, button.dataset.active === 'true'),
        'Actualizando la sucursal…',
        'Estado de sucursal confirmado por Billing.',
      );
    }

    async function handleTerminalStatus(event) {
      const button = event.currentTarget;
      await runIssuanceMutation(
        () => fiscalSettingsApi.setFiscalTerminalActive(session, button.dataset.terminalActive, button.dataset.active === 'true'),
        'Actualizando la terminal…',
        'Estado de terminal confirmado por Billing.',
      );
    }

    async function handleDefaultPoint(event) {
      const terminalId = event.currentTarget.dataset.terminalDefault;
      await runIssuanceMutation(
        () => fiscalSettingsApi.selectDefaultIssuancePoint(session, terminalId),
        'Seleccionando el punto predeterminado…',
        'Punto de emisión predeterminado confirmado por Billing.',
      );
    }

    async function handleSequenceRead(event) {
      event.preventDefault();
      if (sequencePending || !event.currentTarget.reportValidity()) return;
      const values = new FormData(event.currentTarget);
      const terminalId = String(values.get('terminalId') || '');
      sequenceDocumentType = String(values.get('documentType') || 'INVOICE');
      sequencePending = true;
      renderIssuanceContent();
      try {
        sequenceResult = await fiscalSettingsApi.readFiscalSequence(session, terminalId, sequenceDocumentType);
        setStatus(sequenceResult.sequence ? 'Secuencia canónica consultada sin reservar consecutivos.' : 'La secuencia aún no está configurada.', 'success');
      } catch (error) {
        setStatus(error?.message || 'No se pudo consultar la secuencia fiscal.', 'error');
      } finally {
        sequencePending = false;
        renderIssuanceContent();
      }
    }

    async function handleInitialSequence(event) {
      event.preventDefault();
      if (sequencePending || !event.currentTarget.reportValidity()) return;
      const values = new FormData(event.currentTarget);
      sequencePending = true;
      renderIssuanceContent();
      try {
        sequenceResult = await fiscalSettingsApi.configureInitialFiscalSequence(session, {
          terminalId: String(values.get('terminalId') || ''),
          documentType: String(values.get('documentType') || 'INVOICE'),
          nextValue: Number(values.get('nextValue')),
        });
        setStatus('Secuencia inicial confirmada por Billing. No podrá reducirse ni reiniciarse.', 'success');
        if (hasPermission(session, readinessViewPermission) && readinessElement) await loadReadiness();
      } catch (error) {
        setStatus(error?.message || 'No se pudo configurar la secuencia inicial. Consulta de nuevo el estado canónico.', 'error');
      } finally {
        sequencePending = false;
        renderIssuanceContent();
      }
    }

    function renderIssuerContent() {
      if (!issuerElement) return;
      issuerElement.innerHTML = renderIssuerAdministration(currentIssuerAdministration, {
        pending: issuerPending,
        canManage: hasPermission(session, credentialsManagePermission),
        companyId: session?.user?.companyId || null,
      });
      issuerElement.querySelector('[data-fiscal-issuer-provision]')?.addEventListener('click', handleIssuerProvision);
      issuerElement.querySelector('[data-fiscal-issuer-form]')?.addEventListener('submit', handleIssuerSave);
    }

    async function loadIssuerAdministration() {
      if (!issuerElement) return;
      try {
        currentIssuerAdministration = await fiscalSettingsApi.getIssuerAdministration(session);
        issuerLoadState = 'LOADED';
        renderIssuerContent();
      } catch (error) {
        issuerLoadState = 'UNAVAILABLE';
        currentIssuerAdministration = null;
        issuerElement.innerHTML = `<section id="fiscal-issuer-section" class="card root-card fiscal-issuer-panel"><h3>Emisor fiscal</h3><p><strong>Estado actual desconocido.</strong> Billing no está disponible; esto no confirma que falte la asociación.</p><button type="button" data-fiscal-issuer-retry>Volver a intentar</button></section>`;
        issuerElement.querySelector('[data-fiscal-issuer-retry]')?.addEventListener('click', loadIssuerAdministration);
        setStatus(error?.message || 'No se pudo consultar el emisor fiscal.', 'error');
      }
    }

    async function handleIssuerProvision() {
      if (issuerPending) return;
      issuerPending = true;
      renderIssuerContent();
      setStatus('Asociando la empresa con Billing…');
      try {
        currentIssuerAdministration = await fiscalSettingsApi.provisionIssuer(session);
        issuerLoadState = 'LOADED';
        setStatus('Empresa asociada y estado canónico confirmado.', 'success');
        await loadFiscalSecurityConfiguration();
        await loadIssuanceAdministration();
        if (hasPermission(session, readinessViewPermission)) await loadReadiness();
      } catch (error) {
        setStatus(error?.message || 'No se pudo asociar la empresa. Puedes volver a intentar sin crear otro emisor.', 'error');
      } finally {
        issuerPending = false;
        renderIssuerContent();
      }
    }

    async function handleIssuerSave(event) {
      event.preventDefault();
      if (issuerPending || !event.currentTarget.reportValidity()) return;
      const form = event.currentTarget;
      const values = new FormData(form);
      const optional = (name) => String(values.get(name) || '').trim() || undefined;
      issuerPending = true;
      renderIssuerContent();
      setStatus('Guardando y verificando el estado canónico…');
      try {
        currentIssuerAdministration = await fiscalSettingsApi.updateIssuerAdministration(session, {
          issuer: {
            legalName: optional('legalName'),
            tradeName: optional('tradeName'),
            identificationType: optional('identificationType'),
            identificationNumber: optional('identificationNumber'),
          },
          profile: {
            economicActivityCode: optional('economicActivityCode'),
            province: optional('province'), canton: optional('canton'), district: optional('district'),
            barrio: optional('barrio'), otrasSenas: optional('otrasSenas'), email: optional('email'),
            phoneCountryCode: optional('phoneCountryCode'), phoneNumber: optional('phoneNumber'),
          },
        });
        setStatus('Configuración confirmada por Billing.', 'success');
        if (hasPermission(session, readinessViewPermission)) await loadReadiness();
      } catch (error) {
        const locked = error?.code === 'ISSUER_IDENTITY_LOCKED';
        setStatus(locked ? 'La identidad legal ya está bloqueada por actividad fiscal. Conserva tipo y número, y guarda únicamente los demás cambios.' : (error?.message || 'No se pudo guardar la configuración fiscal.'), 'error');
      } finally {
        issuerPending = false;
        renderIssuerContent();
      }
    }

    function expectedReadinessEnvironment() {
      return currentSecurity?.environment
        || currentIssuanceAdministration?.environment
        || currentIssuerAdministration?.association?.environment
        || null;
    }

    function renderTestInvoiceWorkspace() {
      if (!testInvoiceElement) return;
      testInvoiceElement.innerHTML = renderFiscalTestWorkspace(currentReadiness, testInvoiceResult, {
        environment: expectedReadinessEnvironment(),
        pending: testInvoicePending,
        canManage: hasPermission(session, credentialsManagePermission),
      });
      testInvoiceElement.querySelector?.('[data-fiscal-test-form]')?.addEventListener('submit', handleFiscalTestSubmit);
      testInvoiceElement.querySelector?.('[data-fiscal-test-refresh]')?.addEventListener('click', refreshFiscalTestStatus);
    }

    async function handleFiscalTestSubmit(event) {
      event.preventDefault();
      if (testInvoicePending || !event.currentTarget.reportValidity()) return;
      const data = new FormData(event.currentTarget);
      testInvoiceIdempotencyKey ||= globalScope.crypto.randomUUID();
      testInvoicePending = true;
      renderTestInvoiceWorkspace();
      setStatus('Iniciando la factura fiscal de prueba en SANDBOX…');
      try {
        testInvoiceResult = await fiscalSettingsApi.initiateFiscalTestInvoice(session, {
          idempotencyKey: testInvoiceIdempotencyKey,
          confirmed: data.get('confirmed') === 'on',
          receiver: {
            name: String(data.get('receiverName') || ''),
            identificationType: String(data.get('receiverType') || ''),
            identificationNumber: String(data.get('receiverNumber') || ''),
            email: String(data.get('receiverEmail') || ''),
          },
          currency: 'CRC',
          saleCondition: '01',
          paymentMethod: '01',
          lines: [{
            lineNumber: 1,
            cabysCode: String(data.get('cabysCode') || ''),
            description: String(data.get('description') || ''),
            unitMeasure: 'Sp',
            quantity: String(data.get('quantity') || ''),
            unitPrice: String(data.get('unitPrice') || ''),
            taxAmount: String(data.get('taxAmount') || ''),
            taxCode: '01',
            taxRateCode: '08',
            taxRate: '13.00000',
          }],
        });
        setStatus('Billing aceptó la ejecución para procesamiento. Esto todavía no confirma aceptación de Hacienda.', 'success');
      } catch (error) {
        setStatus(error?.message || 'No se pudo iniciar la factura fiscal de prueba.', 'error');
      } finally {
        testInvoicePending = false;
        renderTestInvoiceWorkspace();
      }
    }

    async function refreshFiscalTestStatus() {
      if (testInvoicePending || !testInvoiceResult?.executionId) return;
      testInvoicePending = true;
      renderTestInvoiceWorkspace();
      try {
        testInvoiceResult = await fiscalSettingsApi.getFiscalTestInvoiceStatus(session, testInvoiceResult.executionId);
        setStatus('Estado de la prueba actualizado.', 'success');
      } catch (error) {
        setStatus(error?.message || 'No se pudo actualizar el estado de la prueba.', 'error');
      } finally {
        testInvoicePending = false;
        renderTestInvoiceWorkspace();
      }
    }

    function renderReadinessState(state, readiness = currentReadiness) {
      if (!readinessElement) return;
      readinessElement.innerHTML = renderReadinessPanel(readiness, {
        state,
        attemptedAt: lastReadinessAttemptedAt,
        environment: expectedReadinessEnvironment(),
      });
      readinessElement.querySelector?.('[data-fiscal-readiness-refresh]')?.addEventListener('click', loadReadiness);
      renderTestInvoiceWorkspace();
    }

    function normalizeReadinessForPresentation(readiness) {
      if (!readiness || readiness.status || readiness.contractVersion || typeof readiness.readyToIssue !== 'boolean') return readiness;
      return {
        ...readiness,
        status: readiness.readyToIssue ? 'READY' : 'NOT_READY',
        blockers: Array.isArray(readiness.reasonCodes) ? readiness.reasonCodes : [],
      };
    }

    function resolveTerminalReadinessState() {
      if (issuerLoadState === 'LOADED') {
        const associationStatus = currentIssuerAdministration?.association?.status;
        if (associationStatus === 'HISTORICAL_ONLY') return 'HISTORICAL_ONLY';
        if (associationStatus === 'DISABLED') return 'INTEGRATION_DISABLED';
        if (associationStatus !== 'ASSOCIATED') return 'ASSOCIATION_REQUIRED';
      }
      if (!hasPermission(session, readinessViewPermission)) return 'PERMISSION_REQUIRED';
      return null;
    }

    async function loadReadiness() {
      if (!readinessElement || readinessPending) return;
      const terminalState = resolveTerminalReadinessState();
      if (terminalState) {
        currentReadiness = null;
        lastVerifiedReadiness = null;
        renderReadinessState(terminalState, null);
        return;
      }
      const expectedEnvironment = expectedReadinessEnvironment();
      if (lastVerifiedReadiness && expectedEnvironment && lastVerifiedReadiness.environment !== expectedEnvironment) {
        lastVerifiedReadiness = null;
        currentReadiness = null;
      }
      readinessPending = true;
      lastReadinessAttemptedAt = new Date().toISOString();
      renderReadinessState('LOADING', lastVerifiedReadiness);
      try {
        currentReadiness = normalizeReadinessForPresentation(await fiscalSettingsApi.getFiscalReadiness(session));
        lastVerifiedReadiness = currentReadiness;
        renderReadinessState(currentReadiness.status, currentReadiness);
      } catch (_error) {
        const canUseHistorical = lastVerifiedReadiness
          && (!expectedEnvironment || lastVerifiedReadiness.environment === expectedEnvironment);
        currentReadiness = canUseHistorical ? lastVerifiedReadiness : null;
        renderReadinessState(canUseHistorical ? 'STALE' : 'UNAVAILABLE', currentReadiness);
      } finally {
        readinessPending = false;
        const finalState = currentReadiness
          ? (currentReadiness === lastVerifiedReadiness && currentReadiness.status ? currentReadiness.status : 'STALE')
          : 'UNAVAILABLE';
        if (readinessElement.querySelector?.('[aria-busy="true"]')) {
          renderReadinessState(finalState, currentReadiness);
        }
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
      renderSecurityContent();
      try {
        const result = await fiscalSettingsApi.configureHaciendaCredentials(session, { username, password });
        currentSecurity = { ...currentSecurity, connection: result?.connection || null };
        const status = getConnectionStatus(null, currentSecurity.connection);
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
        renderSecurityContent();
      }
    }

    async function handleCredentialsValidation() {
      if (validationPending || credentialsPending) return;
      validationPending = true;
      setStatus('Validando la conexión con Hacienda…');
      renderSecurityContent();
      try {
        const result = await fiscalSettingsApi.validateHaciendaCredentials(session);
        currentSecurity = { ...currentSecurity, connection: result?.connection || null };
        const status = getConnectionStatus(null, currentSecurity.connection);
        setStatus(status === 'CONNECTED'
          ? 'Conexión con Hacienda validada.'
          : 'Hacienda no confirmó las credenciales. Revisa los datos e intenta nuevamente.', status === 'CONNECTED' ? 'success' : 'error');
        if (hasPermission(session, readinessViewPermission) && readinessElement) await loadReadiness();
      } catch (error) {
        setStatus(error?.message || 'No se pudo validar la conexión con Hacienda.', 'error');
      } finally {
        validationPending = false;
        renderSecurityContent();
      }
    }

    function handleDisableRequest() {
      if (disablePending || credentialsPending || validationPending) return;
      disableConfirmationPending = true;
      renderSecurityContent();
      securityElement?.querySelector('[data-hacienda-disable-confirm]')?.focus?.();
    }

    function handleDisableCancel() {
      if (disablePending) return;
      disableConfirmationPending = false;
      renderSecurityContent();
      securityElement?.querySelector('[data-hacienda-disable-request]')?.focus?.();
    }

    async function handleDisableConfirm() {
      if (disablePending || !disableConfirmationPending) return;
      disablePending = true;
      setStatus('Deshabilitando la conexión con Hacienda…');
      renderSecurityContent();
      try {
        const result = await fiscalSettingsApi.disableHaciendaConnection(session);
        currentSecurity = { ...currentSecurity, connection: result?.connection || null };
        disableConfirmationPending = false;
        setStatus('Conexión con Hacienda deshabilitada. La emisión fiscal quedó bloqueada.', 'success');
        if (hasPermission(session, readinessViewPermission) && readinessElement) await loadReadiness();
      } catch (error) {
        setStatus(error?.message || 'No se pudo deshabilitar la conexión con Hacienda.', 'error');
      } finally {
        disablePending = false;
        renderSecurityContent();
      }
    }

    async function handleCertificateSubmit(event) {
      event.preventDefault();
      if (certificatePending || !event.currentTarget.reportValidity()) return;
      const form = event.currentTarget;
      const certificate = form.elements.certificate?.files?.[0] || null;
      const pinInput = form.elements.pin;
      const pin = String(pinInput?.value || '');
      const replace = form.elements.replace?.value === 'true';
      if (!certificate || certificate.size < 1) {
        setStatus('Selecciona un archivo PKCS#12.', 'error');
        return;
      }
      if (certificate.size > 1_048_576) {
        setStatus('El certificado supera el límite de 1 MiB.', 'error');
        return;
      }
      if (!pin || pin.length > 200) {
        setStatus('Ingresa un PIN válido para el certificado.', 'error');
        return;
      }

      certificatePending = true;
      setStatus(replace ? 'Validando el reemplazo del certificado…' : 'Validando el certificado…');
      renderSecurityContent();
      try {
        const result = await fiscalSettingsApi.uploadSigningCertificate(session, { certificate, pin, replace });
        currentSecurity = { ...currentSecurity, certificate: result?.certificate || null };
        setStatus(replace ? 'Certificado reemplazado y confirmado por Billing.' : 'Certificado cargado y confirmado por Billing.', 'success');
        if (hasPermission(session, readinessViewPermission) && readinessElement) await loadReadiness();
      } catch (error) {
        const mismatch = error?.code === 'FISCAL_CERTIFICATE_IDENTITY_MISMATCH'
          || error?.code === 'FISCAL_CERTIFICATE_EMITTER_MISMATCH';
        setStatus(mismatch
          ? 'La identidad del certificado no coincide con el emisor fiscal. Verifica el archivo correcto.'
          : (error?.message || 'No se pudo validar el certificado. El certificado anterior permanece activo.'), 'error');
        await loadFiscalSecurityConfiguration();
      } finally {
        if (pinInput) pinInput.value = '';
        certificatePending = false;
        renderSecurityContent();
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

    await loadIssuerAdministration();
    if (currentIssuerAdministration?.association?.status === 'ASSOCIATED') {
      await loadFiscalSecurityConfiguration();
      await loadIssuanceAdministration();
    } else if (issuerLoadState === 'LOADED' && securityElement) {
      securityElement.innerHTML = '<section class="card root-card fiscal-security-empty"><h3>Conexión y firma</h3><p>Asocia primero la empresa con Billing para configurar credenciales y certificado.</p></section>';
      if (issuanceElement) issuanceElement.innerHTML = '<section class="card root-card fiscal-issuance-error"><h3>Sucursales y puntos de emisión</h3><p>Asocia primero la empresa con Billing para administrar puntos de emisión.</p></section>';
    } else if (securityElement) {
      securityElement.innerHTML = '<section class="card root-card fiscal-security-error"><h3>Conexión y firma</h3><p>Estado actual desconocido. Billing no está disponible; no se infiere que falten credenciales o certificado.</p></section>';
      if (issuanceElement) issuanceElement.innerHTML = '<section class="card root-card fiscal-issuance-error"><h3>Sucursales y puntos de emisión</h3><p>Estado actual desconocido. Billing no está disponible; no se infiere que falten sucursales, terminales o secuencias.</p></section>';
    }
    try {
      currentData = await fiscalSettingsApi.getFiscalSettings(session);
      setStatus('');
      renderLoadedContent();
      if (hasPermission(session, refreshActivitiesPermission) && refreshButton) {
        refreshButton.hidden = false;
        refreshButton.addEventListener('click', handleRefresh);
      }
      if (readinessElement) await loadReadiness();
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
      if (readinessElement) await loadReadiness();
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
