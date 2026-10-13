/**
 * Wave 6 — Client Fiscal Verification UX component.
 * Spec: specs/inventori-receiver-fiscal-readiness/ § RFR-TASK-601
 *
 * Provides:
 *   - _isStale(lastVerifiedAt)               — pure: stale-check (>90 days)
 *   - _renderVerificationBadge(status)        — pure: status badge HTML
 *   - _renderActivityItem(activity)           — pure: single activity item HTML
 *   - _renderActivitiesList(activities, stat) — pure: activities panel HTML
 *   - _renderFiscalSection(entity, acts, …)   — pure: full section HTML
 *   - renderFiscalSection(entity, acts, can)  — public render entry
 *   - mountFiscalSection(container, session, entity, acts, canVerify, onRefreshed)
 *
 * Security invariants (tested):
 *   - ZERO direct Hacienda calls from this module
 *   - ZERO direct Billing calls from this module
 *   - ZERO localStorage / sessionStorage writes
 *   - Raw verificationStatus enum NOT used as primary UX text
 *   - Activity codes rendered as-is strings ("9609.0" ≠ 9609)
 */
(function attachRootShellClientFiscalVerification(globalScope) {
  'use strict';

  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');

  /** Days threshold after which verification is considered stale (OQ-009, non-blocking) */
  const STALE_THRESHOLD_DAYS = 90;

  /** Maps persisted verificationStatus → Spanish UX labels. Raw enum is never the primary display. */
  const VERIFICATION_STATUS_LABELS = Object.freeze({
    UNVERIFIED: 'Sin verificar',
    VERIFIED: 'Verificado con Hacienda',
    NOT_FOUND: 'No encontrado en Hacienda',
    INVALID: 'Identificación inválida',
    VERIFICATION_UNAVAILABLE: 'Verificación no disponible temporalmente',
  });

  /** Badge colour/fill per verificationStatus */
  const VERIFICATION_STATUS_STYLES = Object.freeze({
    VERIFIED: 'background:#d1fae5;color:#065f46;border-color:#6ee7b7;',
    UNVERIFIED: 'background:#fef3c7;color:#92400e;border-color:#fcd34d;',
    NOT_FOUND: 'background:#fee2e2;color:#991b1b;border-color:#fca5a5;',
    INVALID: 'background:#fee2e2;color:#991b1b;border-color:#fca5a5;',
    VERIFICATION_UNAVAILABLE: 'background:#f3f4f6;color:#374151;border-color:#d1d5db;',
  });

  /** Maps Hacienda haciendaType code → Spanish label */
  const HACIENDA_TYPE_LABELS = Object.freeze({ P: 'Principal', S: 'Secundaria' });

  /** Maps Hacienda haciendaStatus code → Spanish label */
  const HACIENDA_STATUS_LABELS = Object.freeze({ A: 'Activa', I: 'Inactiva' });

  /**
   * Maps identificationType codes (both FISICA/JURIDICA-style and 01/02-style) → Spanish label.
   * Mirrors the select options in clients-admin.renderers.js (create + edit forms).
   */
  const IDENT_TYPE_LABELS = Object.freeze({
    FISICA: 'Cédula Física',
    JURIDICA: 'Cédula Jurídica',
    DIMEX: 'DIMEX',
    NITE: 'NITE',
    '01': 'Cédula Física',
    '02': 'Cédula Jurídica',
    '03': 'DIMEX',
    '04': 'NITE',
  });

  // ─── Pure functions ─────────────────────────────────────────────────────────

  /**
   * Returns true when lastVerifiedAt is more than STALE_THRESHOLD_DAYS days ago.
   * @param {string|Date|null|undefined} lastVerifiedAt
   * @returns {boolean}
   */
  function _isStale(lastVerifiedAt) {
    if (!lastVerifiedAt) return false;
    const ts = new Date(lastVerifiedAt);
    if (isNaN(ts.getTime())) return false;
    return (Date.now() - ts.getTime()) > STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  }

  /**
   * Pure renderer — verification status badge.
   * The badge uses the Spanish label; the raw enum is in aria-label only (never primary text).
   * @param {string} status
   * @returns {string} HTML
   */
  function _renderVerificationBadge(status) {
    const label = VERIFICATION_STATUS_LABELS[status] || VERIFICATION_STATUS_LABELS.UNVERIFIED;
    const style = VERIFICATION_STATUS_STYLES[status] || VERIFICATION_STATUS_STYLES.UNVERIFIED;
    const icon = status === 'VERIFIED' ? '✓'
      : (status === 'NOT_FOUND' || status === 'INVALID') ? '✗' : '○';
    return `<span
      class="badge rfr-verification-badge"
      role="status"
      aria-label="Estado de verificación: ${rootShellUi.escapeHtml(label)}"
      style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;font-size:0.78rem;border:1px solid;${style}"
    >${rootShellUi.escapeHtml(icon)} ${rootShellUi.escapeHtml(label)}</span>`;
  }

  /**
   * Pure renderer — single activity row.
   * IMPORTANT: activity.code is rendered as a STRING. "9609.0" must not be converted to 9609.
   * @param {{ code: string, description: string|null, haciendaStatus: string|null, haciendaType: string|null, isCurrentlyReturned?: boolean }} activity
   * @returns {string} HTML
   */
  function _renderActivityItem(activity) {
    const code = String(activity.code ?? '');
    const description = String(activity.description ?? '');
    const typeLabel = HACIENDA_TYPE_LABELS[activity.haciendaType ?? '']
      || rootShellUi.escapeHtml(String(activity.haciendaType ?? ''));
    const statusLabel = HACIENDA_STATUS_LABELS[activity.haciendaStatus ?? '']
      || rootShellUi.escapeHtml(String(activity.haciendaStatus ?? ''));
    const isActive = activity.haciendaStatus === 'A';
    const isCurrent = activity.isCurrentlyReturned !== false;
    const bulletColor = (isActive && isCurrent) ? '#065f46' : '#9ca3af';
    const statusExtraStyle = !isActive ? 'background:#fee2e2;color:#991b1b;' : '';
    const notReturnedWarning = !isCurrent
      ? `<span class="muted" style="font-size:0.74rem;display:block;margin-top:2px;margin-left:20px;">⚠ No retornada en última verificación</span>`
      : '';

    return `<li class="rfr-activity-item" style="padding:6px 0;border-bottom:1px solid #f3f4f6;word-break:break-word;">
      <div class="rfr-activity-item-head" style="display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;">
        <span aria-hidden="true" style="color:${bulletColor};flex-shrink:0;">${(isCurrent && isActive) ? '●' : '✗'}</span>
        <span>
          <strong style="font-size:0.88rem;">${rootShellUi.escapeHtml(code)}</strong>
          <span style="color:#6b7280;font-size:0.82rem;margin-left:4px;">${rootShellUi.escapeHtml(description)}</span>
        </span>
      </div>
      <div style="margin-left:20px;margin-top:2px;display:flex;gap:6px;flex-wrap:wrap;">
        ${typeLabel ? `<span class="badge" style="font-size:0.74rem;">${typeLabel}</span>` : ''}
        ${statusLabel ? `<span class="badge" style="font-size:0.74rem;${statusExtraStyle}">${statusLabel}</span>` : ''}
      </div>
      ${notReturnedWarning}
    </li>`;
  }

  /**
   * Pure renderer — activities panel.
   * Separates currently-returned from historical activities.
   * @param {any[]} activities
   * @param {string} verificationStatus
   * @returns {string} HTML
   */
  function _renderActivitiesList(activities, verificationStatus) {
    const all = Array.isArray(activities) ? activities : [];
    const current = all.filter((a) => a.isCurrentlyReturned !== false);
    const historical = all.filter((a) => a.isCurrentlyReturned === false);

    if (verificationStatus !== 'VERIFIED' && all.length === 0) {
      return `<p class="muted" style="margin:6px 0;font-size:0.85rem;">Sin verificar. Use "Verificar con Hacienda" para cargar las actividades registradas.</p>`;
    }
    if (verificationStatus === 'VERIFIED' && all.length === 0) {
      return `<p class="muted" style="margin:6px 0;font-size:0.85rem;">Verificado, sin actividades económicas activas registradas.</p>`;
    }
    if (all.length === 0) {
      return `<p class="muted" style="margin:6px 0;font-size:0.85rem;">Sin actividades registradas.</p>`;
    }
    return `<ul class="rfr-activities-list" style="list-style:none;padding:0;margin:0;" aria-label="Actividades económicas verificadas">
      ${current.map(_renderActivityItem).join('')}
      ${historical.map(_renderActivityItem).join('')}
    </ul>`;
  }

  /**
   * Pure renderer — full fiscal section HTML.
   * Renders entity identity fields, verification badge, activities, and optional verify button.
   *
   * @param {{ id: string|number, verificationStatus: string, lastVerifiedAt?: string|null,
   *           taxpayerName?: string|null, identificationType?: string|null,
   *           identificationNumber?: string|null, legalId?: string|null,
   *           legalName?: string|null } | null} legalEntity
   * @param {any[]} activities
   * @param {boolean} canVerify — when false, verify button is not rendered
   * @param {{ loading?: boolean, errorMsg?: string|null }} [uiState]
   * @returns {string} HTML
   */
  function _renderFiscalSection(legalEntity, activities, canVerify, uiState) {
    const state = uiState || {};
    if (!legalEntity || !legalEntity.id) {
      return `<p class="muted" style="font-size:0.85rem;">No hay identidad fiscal registrada para este cliente.</p>`;
    }

    const entityId = String(legalEntity.id);
    const status = String(legalEntity.verificationStatus || 'UNVERIFIED');
    const loading = Boolean(state.loading);
    const errorMsg = state.errorMsg || null;
    const identTypeRaw = String(legalEntity.identificationType || '');
    const identTypeLabel = IDENT_TYPE_LABELS[identTypeRaw] || (identTypeRaw || '—');
    const identNumber = String(legalEntity.identificationNumber || legalEntity.legalId || '—');
    const legalName = String(legalEntity.legalName || '').trim();
    const taxpayerName = String(legalEntity.taxpayerName || '').trim();
    const lastVerifiedAt = legalEntity.lastVerifiedAt || null;
    const stale = _isStale(lastVerifiedAt);
    const verifyBtnText = loading ? 'Verificando…'
      : (status === 'VERIFIED' ? 'Volver a verificar' : 'Verificar con Hacienda');

    return `<div class="rfr-fiscal-section" data-rfr-entity-id="${rootShellUi.escapeHtml(entityId)}">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
        ${_renderVerificationBadge(status)}
        ${lastVerifiedAt ? `<span class="muted" style="font-size:0.78rem;">Verificado: ${rootShellUi.escapeHtml(rootShellUi.formatDate(lastVerifiedAt))}</span>` : ''}
        ${stale ? `<span class="badge rfr-stale-badge" role="alert" style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;font-size:0.74rem;">⚠ Hace más de 90 días</span>` : ''}
      </div>
      <dl style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-bottom:12px;">
        <div>
          <dt class="muted" style="font-size:0.78rem;">Tipo de identificación</dt>
          <dd style="font-weight:600;font-size:0.88rem;margin:2px 0 0;">${rootShellUi.escapeHtml(identTypeLabel)}</dd>
        </div>
        <div>
          <dt class="muted" style="font-size:0.78rem;">Número de identificación</dt>
          <dd style="font-weight:600;font-size:0.88rem;margin:2px 0 0;word-break:break-all;">${rootShellUi.escapeHtml(identNumber)}</dd>
        </div>
        ${legalName ? `<div>
          <dt class="muted" style="font-size:0.78rem;">Razón social (registrada)</dt>
          <dd style="font-weight:600;font-size:0.88rem;margin:2px 0 0;word-break:break-word;">${rootShellUi.escapeHtml(legalName)}</dd>
        </div>` : ''}
        ${taxpayerName ? `<div>
          <dt class="muted" style="font-size:0.78rem;">Nombre según Hacienda</dt>
          <dd style="font-weight:600;font-size:0.88rem;margin:2px 0 0;word-break:break-word;">${rootShellUi.escapeHtml(taxpayerName)}</dd>
        </div>` : ''}
      </dl>
      <div class="rfr-activities-panel" style="margin-bottom:12px;">
        <p style="font-weight:600;font-size:0.88rem;margin:0 0 6px;">Actividades económicas</p>
        <div class="rfr-activities-region" aria-live="polite">
          ${_renderActivitiesList(activities, status)}
        </div>
      </div>
      ${errorMsg ? `<div class="rfr-fiscal-error" role="alert" style="margin-bottom:8px;">${rootShellUi.renderInlineMessage(String(errorMsg), 'error')}</div>` : ''}
      ${canVerify ? `<div class="action-row compact-action-row rfr-verify-row" style="flex-wrap:wrap;">
        <button
          class="secondary-button rfr-verify-button"
          type="button"
          data-rfr-verify="${rootShellUi.escapeHtml(entityId)}"
          aria-label="${rootShellUi.escapeHtml(verifyBtnText)}"
          style="min-height:44px;"
          ${loading ? 'disabled aria-disabled="true"' : ''}
        >${rootShellUi.escapeHtml(verifyBtnText)}</button>
      </div>` : ''}
    </div>`;
  }

  // ─── Mounting ───────────────────────────────────────────────────────────────

  /**
   * Mount the fiscal section into a container element.
   * Renders initial content and wires the "Verificar con Hacienda" button.
   *
   * Security: all Hacienda contact goes through clientsApi.verifyClientLegalEntity,
   * which calls /api/client-legal-entities/:id/verify (Inventori → Hacienda).
   * This module NEVER calls Hacienda directly.
   *
   * @param {HTMLElement} container
   * @param {any} session
   * @param {{ id: string|number, verificationStatus: string, [k: string]: any } | null} legalEntity
   * @param {any[]} activities
   * @param {boolean} canVerify
   * @param {((entity: any, activities: any[]) => void) | null} [onRefreshed]
   */
  function mountFiscalSection(container, session, legalEntity, activities, canVerify, onRefreshed) {
    if (!container) return;

    let currentEntity = legalEntity;
    let currentActivities = Array.isArray(activities) ? activities : [];
    let verifying = false;

    function rerender(uiState) {
      container.innerHTML = _renderFiscalSection(currentEntity, currentActivities, canVerify, uiState);
    }

    rerender();

    container.addEventListener('click', async function onVerifyClick(event) {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      const btn = target.closest('[data-rfr-verify]');
      if (!btn || typeof btn.getAttribute !== 'function') return;
      if (verifying) return; // double-submit guard

      const entityId = btn.getAttribute('data-rfr-verify');
      if (!entityId) return;

      verifying = true;
      rerender({ loading: true });

      const clientsApi = rootShell.require('clientsApi');
      try {
        const result = await clientsApi.verifyClientLegalEntity(session, entityId);
        currentEntity = { ...currentEntity, ...result };
        currentActivities = Array.isArray(result.activities) ? result.activities : currentActivities;
        rerender();
        if (typeof onRefreshed === 'function') {
          onRefreshed(currentEntity, currentActivities);
        }
      } catch (err) {
        const statusCode = err?.statusCode;
        if (statusCode === 502 && err.responseBody) {
          // Hacienda temporarily unavailable — backend preserved existing data
          currentEntity = { ...currentEntity, ...err.responseBody };
          currentActivities = Array.isArray(err.responseBody.activities) ? err.responseBody.activities : currentActivities;
        } else if (statusCode === 404) {
          // hacienda_not_found — identification not found in Hacienda
          currentEntity = { ...currentEntity, verificationStatus: 'NOT_FOUND' };
        }
        const msg = err?.message || 'No se pudo verificar con Hacienda. Intente de nuevo.';
        rerender({ errorMsg: msg });
        if (typeof onRefreshed === 'function') {
          onRefreshed(currentEntity, currentActivities);
        }
      } finally {
        verifying = false;
      }
    });
  }

  /**
   * Public render-only entry point — returns HTML without mounting event handlers.
   * @param {{ id: string|number, verificationStatus: string, [k: string]: any } | null} legalEntity
   * @param {any[]} activities
   * @param {boolean} canVerify
   * @returns {string} HTML
   */
  function renderFiscalSection(legalEntity, activities, canVerify) {
    return _renderFiscalSection(legalEntity, activities, canVerify);
  }

  rootShell.register('views.clientFiscalVerification', {
    renderFiscalSection,
    mountFiscalSection,
    // Exposed for characterization / unit testing:
    _renderVerificationBadge,
    _renderActivitiesList,
    _renderFiscalSection,
    _renderActivityItem,
    _isStale,
  });
}(window));
