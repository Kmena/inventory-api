// Wave 5 — Fiscal Approval Modal
// RFR-TASK-501: FiscalApprovalModal component
// Shows receiver fiscal data and activity selection before Order approval.
// Browser → ONLY calls Inventori. Zero Hacienda calls. Zero Billing calls.
(function attachFiscalApprovalModal(globalScope) {
  'use strict';

  const rootShell = /** @type {any} */ (globalScope).RootShell;

  // ─── Pure helpers ──────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatDate(iso) {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (_e) {
      return null;
    }
  }

  // ─── Canonical receiver-state → user message map ───────────────────────────
  // Matches receiverState values from GET /api/orders/:id/fiscal-readiness-preview
  // api-contract.md §A — do NOT invent states here.

  const BLOCKED_MESSAGES = {
    IDENTITY_INCOMPLETE:     'El cliente no tiene datos fiscales completos.',
    IDENTITY_INVALID:        'Los datos de identificación del cliente son inválidos.',
    UNVERIFIED:              'Identidad no verificada con Hacienda.',
    NOT_FOUND:               'Esta identificación no existe en Hacienda.',
    VERIFICATION_UNAVAILABLE:'No fue posible verificar con Hacienda. Sin actividades económicas disponibles.',
    ACTIVITIES_MISSING:      'No hay actividades económicas registradas para este cliente.',
  };

  const IDENT_TYPE_LABELS = {
    FISICA:   '01 — Cédula Física',
    JURIDICA: '02 — Cédula Jurídica',
    DIMEX:    '03 — DIMEX',
    NITE:     '04 — NITE',
  };

  const STATUS_BADGE = {
    A: '<span style="background:#D1FAE5;color:#065F46;font-size:.72rem;padding:1px 8px;border-radius:999px;font-weight:700;">Activa</span>',
    I: '<span style="background:#FEE2E2;color:#991B1B;font-size:.72rem;padding:1px 8px;border-radius:999px;font-weight:700;">Inactiva</span>',
  };

  const TYPE_LABELS = { P: 'Principal', S: 'Secundaria' };

  // ─── Pure renderers (exported for testing) ─────────────────────────────────

  /**
   * Render the verified-receiver information card.
   * Returns empty string when receiver is null (non-READY states handle this separately).
   * @param {object|null} receiver
   * @returns {string}
   */
  function _renderReceiverInfo(receiver) {
    if (!receiver) return '';
    const idLabel = IDENT_TYPE_LABELS[receiver.identificationType]
      || escapeHtml(receiver.identificationType || '—');
    const verifiedAt = formatDate(receiver.lastVerifiedAt);
    return `
      <div class="rfr-receiver-info" style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:12px 16px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span aria-hidden="true">✅</span>
          <strong style="color:#065F46;font-size:.9rem;">Datos fiscales verificados</strong>
          ${verifiedAt ? `<span style="font-size:.78rem;color:#6B7280;margin-left:auto;">Verificado: ${escapeHtml(verifiedAt)}</span>` : ''}
        </div>
        <dl style="margin:0;display:grid;gap:4px;font-size:.85rem;">
          <div style="display:flex;gap:6px;"><dt style="color:#6B7280;min-width:96px;">Razón social</dt><dd style="margin:0;font-weight:700;">${escapeHtml(receiver.legalName || '—')}</dd></div>
          <div style="display:flex;gap:6px;"><dt style="color:#6B7280;min-width:96px;">Tipo ID</dt><dd style="margin:0;">${escapeHtml(idLabel)}</dd></div>
          <div style="display:flex;gap:6px;"><dt style="color:#6B7280;min-width:96px;">Identificación</dt><dd style="margin:0;">${escapeHtml(receiver.identificationNumber || '—')}</dd></div>
        </dl>
      </div>`;
  }

  /**
   * Render a single activity radio item.
   * @param {object} activity
   * @param {string|null} autoSelectedCode — pre-select this code when not null
   * @returns {string}
   */
  function _renderActivityItem(activity, autoSelectedCode) {
    const isChecked = activity.code === autoSelectedCode;
    const badge = STATUS_BADGE[activity.haciendaStatus] || '';
    const typeLabel = TYPE_LABELS[activity.haciendaType] || '';
    return `
      <label class="rfr-activity-item" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid #E2E8F0;border-radius:8px;cursor:pointer;margin-bottom:8px;">
        <input type="radio" name="rfr-activity" value="${escapeHtml(activity.code)}" ${isChecked ? 'checked' : ''}
          style="margin-top:3px;flex-shrink:0;accent-color:#2563EB;"
          aria-label="Actividad ${escapeHtml(activity.code)} — ${escapeHtml(activity.description || '')}">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <strong style="font-size:.88rem;font-family:monospace;">${escapeHtml(activity.code)}</strong>
            ${badge}
          </div>
          <div style="font-size:.82rem;color:#374151;margin-top:2px;word-break:break-word;">${escapeHtml(activity.description || '—')}</div>
          ${typeLabel ? `<div style="font-size:.75rem;color:#9CA3AF;margin-top:2px;">${escapeHtml(typeLabel)}</div>` : ''}
        </div>
      </label>`;
  }

  /**
   * Render the activity selection section (fieldset with radio list).
   * Returns empty string when activities array is empty.
   * @param {Array<object>} eligibleActivities
   * @param {string|null} autoSelectedCode
   * @returns {string}
   */
  function _renderActivitiesSection(eligibleActivities, autoSelectedCode) {
    if (!eligibleActivities || eligibleActivities.length === 0) return '';
    const heading = eligibleActivities.length === 1
      ? 'Actividad económica del receptor'
      : 'Seleccione la actividad económica del receptor';
    return `
      <div class="rfr-activities" style="margin-bottom:16px;">
        <p style="font-weight:700;font-size:.88rem;margin:0 0 10px;" id="rfr-act-legend">${escapeHtml(heading)}</p>
        <fieldset style="border:none;padding:0;margin:0;" aria-labelledby="rfr-act-legend">
          <legend class="sr-only">Actividad económica del receptor</legend>
          <div class="rfr-activity-list">
            ${eligibleActivities.map((a) => _renderActivityItem(a, autoSelectedCode)).join('')}
          </div>
        </fieldset>
      </div>`;
  }

  function _renderBlockingReasons(reasons) {
    if (!Array.isArray(reasons) || reasons.length === 0) return '';
    return `
      <div style="text-align:left;margin:14px auto 0;max-width:420px;background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 12px;">
        <strong style="display:block;color:#991B1B;font-size:.84rem;margin-bottom:6px;">Qué falta corregir:</strong>
        <ul style="margin:0;padding-left:18px;color:#7F1D1D;font-size:.82rem;line-height:1.45;">
          ${reasons.map((reason) => `<li>${escapeHtml(reason.message || reason.label || reason.code || 'Dato fiscal requerido')}</li>`).join('')}
        </ul>
      </div>`;
  }

  /**
   * Render a blocking (non-READY) modal body.
   * @param {string} receiverState
   * @param {object|null} receiver
   * @param {Array<object>} blockingReasons
   * @returns {string}
   */
  function _renderBlockedContent(receiverState, receiver, blockingReasons) {
    const msg = BLOCKED_MESSAGES[receiverState]
      || `Estado fiscal no reconocido: ${escapeHtml(receiverState || '')}`;
    const icon = receiverState === 'UNVERIFIED' ? '⚠️'
      : receiverState === 'NOT_FOUND' ? '🔍'
      : '❌';
    const clientRow = receiver
      ? `<p style="font-size:.82rem;color:#6B7280;margin:8px 0 0;">Cliente: <strong>${escapeHtml(receiver.legalName || '—')}</strong></p>`
      : '';
    return `
      <div class="rfr-blocked" style="text-align:center;padding:20px 0 8px;" aria-live="polite">
        <div style="font-size:2.4rem;margin-bottom:10px;" aria-hidden="true">${icon}</div>
        <p style="font-weight:700;margin:0;font-size:.95rem;">${escapeHtml(msg)}</p>
        ${clientRow}
        ${_renderBlockingReasons(blockingReasons)}
      </div>`;
  }

  /**
   * Build the modal content from a fiscal-readiness-preview DTO.
   * Pure function — no DOM, no side effects.
   * @param {object} preview — GET /api/orders/:id/fiscal-readiness-preview response
   * @returns {{ body: string, confirmDisabled: boolean }}
   */
  function _buildModalContent(preview) {
    const isReady = preview.receiverState === 'READY';

    if (!isReady) {
      return {
        body: _renderBlockedContent(preview.receiverState, preview.receiver, preview.blockingReasons || []),
        confirmDisabled: true,
      };
    }

    const activities = preview.eligibleActivities || [];
    // Confirm is enabled only when there is a pre-selection OR exactly one activity.
    const initiallySelected = Boolean(preview.autoSelectedCode) || activities.length === 1;

    return {
      body: _renderReceiverInfo(preview.receiver)
        + _renderActivitiesSection(activities, preview.autoSelectedCode),
      confirmDisabled: !initiallySelected,
    };
  }

  // ─── Modal orchestrator ────────────────────────────────────────────────────

  /**
   * Open the Confirmar datos de facturación modal.
   *
   * Resolves with the selected activity code string when the user confirms.
   * Resolves with null when the user cancels or closes.
   * Never rejects (errors are displayed inside the modal).
   *
   * @param {object} preview — GET /api/orders/:id/fiscal-readiness-preview DTO
   * @returns {Promise<string|null>}
   */
  function openFiscalApprovalModal(preview) {
    return new Promise((resolve) => {
      const { body, confirmDisabled } = _buildModalContent(preview);
      const orderId = escapeHtml(String(preview.orderId || ''));
      const isReady = preview.receiverState === 'READY';
      const confirmLabel = isReady ? 'Confirmar aprobación' : 'Aprobación bloqueada';

      // ── Build overlay (billing-admin.js modal pattern) ───────────────────
      const overlay = globalScope.document.createElement('div');
      overlay.id = 'rfr-approval-modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'rfr-modal-title');
      overlay.style.cssText = [
        'position:fixed', 'inset:0',
        'background:rgba(0,0,0,.45)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'z-index:9999', 'padding:16px', 'box-sizing:border-box',
      ].join(';');

      const inner = globalScope.document.createElement('div');
      inner.className = 'rfr-modal';
      inner.style.cssText = [
        'background:#fff', 'border-radius:14px', 'padding:24px',
        'max-width:560px', 'width:100%',
        'max-height:90vh', 'overflow-y:auto',
        'box-shadow:0 8px 40px rgba(0,0,0,.18)',
        'box-sizing:border-box',
      ].join(';');

      inner.innerHTML = `
        <h3 id="rfr-modal-title" style="margin:0 0 4px;font-size:1.05rem;">Confirmar datos de facturación</h3>
        <p style="margin:0 0 16px;font-size:.8rem;color:#6B7280;">Pedido #${orderId}</p>
        <div id="rfr-modal-body">${body}</div>
        <p id="rfr-modal-error" style="color:#DC2626;font-size:.83rem;margin:10px 0 0;" hidden></p>
        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;">
          <button type="button" id="rfr-cancel-btn" class="secondary-button"
            style="flex:1;min-height:44px;min-width:100px;">Cancelar</button>
          <button type="button" id="rfr-confirm-btn" class="btn"
            ${confirmDisabled ? 'disabled' : ''}
            aria-disabled="${confirmDisabled}"
            style="flex:2;min-height:44px;min-width:140px;background:#16A34A;${confirmDisabled ? 'opacity:.55;cursor:not-allowed;' : ''}">
            ${escapeHtml(confirmLabel)}</button>
        </div>`;

      overlay.appendChild(inner);
      globalScope.document.body.appendChild(overlay);

      const confirmBtn = inner.querySelector('#rfr-confirm-btn');
      const cancelBtn  = inner.querySelector('#rfr-cancel-btn');
      const errorEl    = inner.querySelector('#rfr-modal-error');

      // Double-submit guard: true while the confirmation POST is in flight.
      // Set by the caller (approvals-admin) after this Promise resolves.
      // Here we just gate confirm against rapid double-click.
      let confirming = false;

      function cleanup(result) {
        globalScope.document.removeEventListener('keydown', onKeyDown);
        overlay.remove();
        resolve(result);
      }

      // ── Cancel / close ───────────────────────────────────────────────────
      cancelBtn.addEventListener('click', () => { if (!confirming) cleanup(null); });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay && !confirming) cleanup(null);
      });

      function onKeyDown(e) {
        if (e.key === 'Escape' && !confirming) cleanup(null);
      }
      globalScope.document.addEventListener('keydown', onKeyDown);

      // ── Non-READY (blocked): no interaction beyond cancel ────────────────
      if (!isReady) {
        confirmBtn.disabled = true;
        (cancelBtn || confirmBtn).focus();
        return;
      }

      // ── Activity radio change → enable/disable confirm ───────────────────
      const activityList = inner.querySelector('.rfr-activity-list');
      if (activityList) {
        activityList.addEventListener('change', () => {
          const checked = inner.querySelector('input[name="rfr-activity"]:checked');
          const has = Boolean(checked);
          confirmBtn.disabled = !has;
          confirmBtn.style.opacity = has ? '1' : '.55';
          confirmBtn.style.cursor  = has ? 'pointer' : 'not-allowed';
          confirmBtn.setAttribute('aria-disabled', String(!has));
        });
      }

      // ── Confirm click ─────────────────────────────────────────────────────
      confirmBtn.addEventListener('click', () => {
        if (confirming || confirmBtn.disabled) return;

        const checked = inner.querySelector('input[name="rfr-activity"]:checked');
        if (!checked) {
          errorEl.textContent = 'Seleccione una actividad económica para continuar.';
          errorEl.hidden = false;
          return;
        }

        confirming = true;
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Confirmando…';
        errorEl.hidden = true;

        cleanup(checked.value);
      });

      // Initial focus: confirm if enabled, otherwise cancel
      (confirmDisabled ? cancelBtn : confirmBtn).focus();
    });
  }

  // ─── Registration ──────────────────────────────────────────────────────────
  // Pure renderers are exposed for unit testing (prefixed _).
  rootShell.register('views.fiscalApprovalModal', {
    openFiscalApprovalModal,
    _buildModalContent,
    _renderBlockedContent,
    _renderBlockingReasons,
    _renderReceiverInfo,
    _renderActivitiesSection,
  });

})(window);
