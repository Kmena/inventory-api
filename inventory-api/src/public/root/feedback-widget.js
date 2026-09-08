(function attachRootShellFeedbackWidget(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const feedbackApi = rootShell.require('feedbackApi');

  const TOAST_TIMEOUT_MS = 6000;
  const NUDGE_KEY_PREFIX = 'fbnudge-';

  let storedSession = null;
  let initialized = false;

  // ── Utilities ──────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function removeElement(el) {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  // ── Success toast (2 s) ────────────────────────────────────────────────────

  function showSuccessToast() {
    const toast = globalScope.document.createElement('div');
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = [
      'position:fixed', 'bottom:90px', 'right:24px', 'z-index:9999',
      'background:#16a34a', 'color:#fff', 'padding:12px 16px',
      'border-radius:8px', 'max-width:280px',
      'box-shadow:0 4px 12px rgba(0,0,0,0.3)', 'font-size:14px',
    ].join(';');
    toast.textContent = '¡Gracias por tu feedback!';
    globalScope.document.body.appendChild(toast);
    globalScope.setTimeout(() => removeElement(toast), 2000);
  }

  // ── Modal ──────────────────────────────────────────────────────────────────

  function openModal(context, session) {
    const activeSession = session || storedSession;
    const existingOverlay = globalScope.document.getElementById('feedback-modal-overlay');
    if (existingOverlay) return;

    let selectedRating = null;
    let selectedCategory = null;

    const overlay = globalScope.document.createElement('div');
    overlay.id = 'feedback-modal-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:10000',
      'background:rgba(0,0,0,0.5)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'padding:16px',
    ].join(';');

    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title"
           style="background:#fff;color:#1e293b;border-radius:12px;padding:24px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 id="feedback-modal-title" style="margin:0;font-size:1.1rem;">Enviar feedback</h2>
          <button id="feedback-modal-cancel" type="button" aria-label="Cerrar"
                  style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:4px;">✕</button>
        </div>

        <div id="feedback-modal-message" role="status" aria-live="polite" style="margin-bottom:8px;"></div>

        <fieldset style="border:none;padding:0;margin-bottom:16px;">
          <legend style="font-weight:600;margin-bottom:8px;">Rating *</legend>
          <div id="feedback-rating-group" style="display:flex;gap:8px;" role="group" aria-label="Calificación">
            <button type="button" data-rating="1" aria-label="1 - Muy malo"  style="font-size:1.8rem;background:none;border:2px solid transparent;border-radius:8px;cursor:pointer;padding:4px;">😞</button>
            <button type="button" data-rating="2" aria-label="2 - Malo"      style="font-size:1.8rem;background:none;border:2px solid transparent;border-radius:8px;cursor:pointer;padding:4px;">😐</button>
            <button type="button" data-rating="3" aria-label="3 - Regular"   style="font-size:1.8rem;background:none;border:2px solid transparent;border-radius:8px;cursor:pointer;padding:4px;">😊</button>
            <button type="button" data-rating="4" aria-label="4 - Bueno"     style="font-size:1.8rem;background:none;border:2px solid transparent;border-radius:8px;cursor:pointer;padding:4px;">😄</button>
            <button type="button" data-rating="5" aria-label="5 - Excelente" style="font-size:1.8rem;background:none;border:2px solid transparent;border-radius:8px;cursor:pointer;padding:4px;">🤩</button>
          </div>
        </fieldset>

        <fieldset style="border:none;padding:0;margin-bottom:16px;">
          <legend style="font-weight:600;margin-bottom:8px;">Categoría *</legend>
          <div id="feedback-category-group" style="display:flex;gap:8px;flex-wrap:wrap;" role="group" aria-label="Categoría">
            <button type="button" data-category="bug"       style="padding:6px 12px;border:2px solid #e5e7eb; color:#1e293b;border-radius:20px;background:none;cursor:pointer;">🐛 Bug</button>
            <button type="button" data-category="sugerencia" style="padding:6px 12px;border:2px solid #e5e7eb; color:#1e293b;border-radius:20px;background:none;cursor:pointer;">💡 Sugerencia</button>
            <button type="button" data-category="elogio"    style="padding:6px 12px;border:2px solid #e5e7eb; color:#1e293b;border-radius:20px;background:none;cursor:pointer;">👏 Elogio</button>
          </div>
        </fieldset>

        <div style="margin-bottom:16px;">
          <label style="display:block;font-weight:600;margin-bottom:6px;" for="feedback-comment">¿Qué pasó? *</label>
          <textarea id="feedback-comment" maxlength="2000" rows="4"
                    style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;resize:vertical;box-sizing:border-box;"
                    placeholder="Describe lo que ocurrió..."></textarea>
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block;font-weight:600;margin-bottom:6px;" for="feedback-improvement">¿Cómo lo mejorarías? (opcional)</label>
          <textarea id="feedback-improvement" maxlength="2000" rows="3"
                    style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;resize:vertical;box-sizing:border-box;"
                    placeholder="Tu sugerencia..."></textarea>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="feedback-modal-submit-cancel" type="button"
                  style="padding:8px 16px;border:1px solid #e5e7eb;border-radius:6px;background:none;cursor:pointer; color:#1e293b">
            Cancelar
          </button>
          <button id="feedback-modal-submit" type="button"
                  style="padding:8px 16px;border-radius:6px;background:#2563eb;color:#fff;border:none;cursor:pointer;font-weight:600;">
            Enviar
          </button>
        </div>
      </div>
    `;

    globalScope.document.body.appendChild(overlay);

    const messageEl = overlay.querySelector('#feedback-modal-message');
    const ratingGroup = overlay.querySelector('#feedback-rating-group');
    const categoryGroup = overlay.querySelector('#feedback-category-group');
    const commentEl = /** @type {HTMLTextAreaElement|null} */ (overlay.querySelector('#feedback-comment'));
    const improvementEl = /** @type {HTMLTextAreaElement|null} */ (overlay.querySelector('#feedback-improvement'));
    const submitBtn = overlay.querySelector('#feedback-modal-submit');
    const cancelBtn = overlay.querySelector('#feedback-modal-cancel');
    const cancelBtn2 = overlay.querySelector('#feedback-modal-submit-cancel');

    // Focus management — focus first rating button
    const firstRatingBtn = ratingGroup ? ratingGroup.querySelector('button') : null;
    if (firstRatingBtn) firstRatingBtn.focus();

    function closeModal() {
      removeElement(overlay);
      const floatBtn = globalScope.document.getElementById('feedback-float-btn');
      if (floatBtn) floatBtn.focus();
    }

    function updateRatingSelection(rating) {
      selectedRating = rating;
      if (!ratingGroup) return;
      ratingGroup.querySelectorAll('button[data-rating]').forEach((btn) => {
        const btnEl = /** @type {HTMLElement} */ (btn);
        btnEl.style.borderColor = String(btnEl.getAttribute('data-rating')) === String(rating)
          ? '#2563eb' : 'transparent';
      });
    }

    function updateCategorySelection(category) {
      selectedCategory = category;
      if (!categoryGroup) return;
      categoryGroup.querySelectorAll('button[data-category]').forEach((btn) => {
        const btnEl = /** @type {HTMLElement} */ (btn);
        btnEl.style.borderColor = btnEl.getAttribute('data-category') === category
          ? '#2563eb' : '#e5e7eb';
      });
    }

    if (ratingGroup) {
      ratingGroup.addEventListener('click', (e) => {
        const btn = e.target instanceof HTMLElement ? e.target.closest('[data-rating]') : null;
        if (btn instanceof HTMLElement) {
          updateRatingSelection(parseInt(btn.getAttribute('data-rating') || '0', 10));
        }
      });
    }

    if (categoryGroup) {
      categoryGroup.addEventListener('click', (e) => {
        const btn = e.target instanceof HTMLElement ? e.target.closest('[data-category]') : null;
        if (btn instanceof HTMLElement) {
          updateCategorySelection(btn.getAttribute('data-category') || '');
        }
      });
    }

    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (cancelBtn2) cancelBtn2.addEventListener('click', closeModal);

    // Close on Escape
    function onKeydown(e) {
      if (e.key === 'Escape') {
        closeModal();
        globalScope.document.removeEventListener('keydown', onKeydown);
      }
    }
    globalScope.document.addEventListener('keydown', onKeydown);

    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        if (!messageEl) return;
        messageEl.innerHTML = '';

        if (!selectedRating) {
          messageEl.innerHTML = '<p style="color:#dc2626;margin:0;">Por favor selecciona un rating.</p>';
          return;
        }
        if (!selectedCategory) {
          messageEl.innerHTML = '<p style="color:#dc2626;margin:0;">Por favor selecciona una categoría.</p>';
          return;
        }
        const comment = commentEl ? commentEl.value.trim() : '';
        if (!comment) {
          messageEl.innerHTML = '<p style="color:#dc2626;margin:0;">El comentario es requerido.</p>';
          return;
        }

        const improvement = improvementEl ? improvementEl.value.trim() : '';
        const payload = {
          rating: selectedRating,
          category: selectedCategory,
          comment,
          improvement: improvement || undefined,
          context: String(context),
          route: String(globalScope.location.hash || ''),
        };

        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';

        try {
          await feedbackApi.submitFeedback(activeSession, payload);
          globalScope.document.removeEventListener('keydown', onKeydown);
          removeElement(overlay);
          showSuccessToast();
        } catch (err) {
          const msg = escapeHtml(err?.message || 'No se pudo enviar el feedback. Intenta de nuevo.');
          messageEl.innerHTML = `<p style="color:#dc2626;margin:0;">${msg}</p>`;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Enviar';
        }
      });
    }
  }

  // ── Toast nudge ────────────────────────────────────────────────────────────

  function triggerNudge(context, session) {
    const nudgeKey = NUDGE_KEY_PREFIX + context;
    if (globalScope.sessionStorage.getItem(nudgeKey)) return;
    globalScope.sessionStorage.setItem(nudgeKey, '1');

    const toastId = `feedback-toast-${escapeHtml(context)}`;
    const existing = globalScope.document.getElementById(toastId);
    if (existing) return;

    const toast = globalScope.document.createElement('div');
    toast.id = toastId;
    toast.setAttribute('role', 'status');
    toast.style.cssText = [
      'position:fixed', 'bottom:90px', 'right:24px', 'z-index:9997',
      'background:#1e293b', 'color:#fff', 'padding:12px 16px',
      'border-radius:8px', 'cursor:pointer', 'max-width:280px',
      'box-shadow:0 4px 12px rgba(0,0,0,0.3)', 'font-size:14px',
    ].join(';');
    toast.innerHTML = '¿Cómo fue tu experiencia? <strong>Contarnos &rarr;</strong>';

    toast.addEventListener('click', () => {
      removeElement(toast);
      openModal(context, session);
    });

    globalScope.document.body.appendChild(toast);

    globalScope.setTimeout(() => removeElement(toast), TOAST_TIMEOUT_MS);
  }

  // ── Floating button ────────────────────────────────────────────────────────

  function init(session) {
    if (initialized) return;
    initialized = true;
    storedSession = session;

    const btn = globalScope.document.createElement('button');
    btn.id = 'feedback-float-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Enviar feedback o reporte de problema');
    btn.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px', 'z-index:9998',
      'width:52px', 'height:52px', 'border-radius:50%',
      'background:#2563eb', 'color:#fff', 'border:none',
      'font-size:22px', 'cursor:pointer',
      'box-shadow:0 2px 8px rgba(0,0,0,0.25)',
    ].join(';');
    btn.textContent = '💬';

    btn.addEventListener('click', () => openModal('manual', session));

    globalScope.document.body.appendChild(btn);
  }

  rootShell.register('feedbackWidget', { init, triggerNudge });
}(window));
