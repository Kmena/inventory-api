/**
 * account-dialog.js — Modal de cuenta del usuario autenticado.
 *
 * Expone window.InventoryAccountDialog con el método open(session, options).
 *
 * Funciona en los tres shells (root, warehouse, agent) sin acoplarse a ninguno.
 * Cada shell inyecta su propio callback onSuccess para mostrar la notificación
 * de éxito mediante el mecanismo propio del shell (toast, status bar, etc.).
 *
 * Accesibilidad:
 *   - Labels asociados a todos los inputs
 *   - aria-label en botones de mostrar/ocultar contraseña
 *   - aria-live en mensajes de error por campo
 *   - Foco inicial en primer campo al abrir
 *   - Devuelve el foco al trigger al cerrar
 *   - Escape cierra el dialog limpiando el formulario
 */
(function attachInventoryAccountDialog(globalScope) {
  'use strict';

  const DIALOG_ID = 'inventory-account-dialog';

  /** @type {HTMLElement | null} Botón que abrió el dialog — para devolver el foco al cerrar */
  let _triggerElement = null;

  /** @type {any | null} Sesión activa en el momento en que se abrió el dialog */
  let _currentSession = null;

  /** @type {(() => void) | null} Callback inyectado por el shell para notificar éxito */
  let _onSuccessCallback = null;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Escapa caracteres HTML para evitar XSS en contenido renderizado dinámicamente.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  /**
   * Genera el HTML del dialog. Se llama una única vez al crear el elemento.
   * @returns {string}
   */
  function renderDialogHtml() {
    return `
      <dialog id="${DIALOG_ID}" class="modal-card" aria-labelledby="account-dialog-title">
        <form id="account-dialog-form" class="root-form" novalidate>
          <div class="page-header">
            <div>
              <h2 id="account-dialog-title" class="account-dialog__title">Mi cuenta</h2>
              <p id="account-dialog-subtitle" class="muted account-dialog__subtitle"></p>
            </div>
            <button
              id="account-dialog-close"
              class="secondary-button"
              type="button"
              aria-label="Cerrar Mi cuenta"
            >Cerrar</button>
          </div>

          <fieldset class="root-form__section">
            <legend>Cambiar contraseña</legend>
            <p class="muted" style="margin-bottom:12px;">
              Por seguridad, ingresa tu contraseña actual antes de establecer una nueva.
            </p>

            <div class="root-form-grid">

              <div class="root-form-grid__full">
                <label for="account-input-current">
                  <span>Contraseña actual *</span>
                </label>
                <div style="display:flex;gap:8px;align-items:center;">
                  <input
                    id="account-input-current"
                    name="currentPassword"
                    type="password"
                    required
                    maxlength="100"
                    autocomplete="current-password"
                    style="flex:1;"
                  />
                  <button
                    type="button"
                    class="secondary-button"
                    data-toggle-for="account-input-current"
                    aria-label="Mostrar contraseña actual"
                    style="white-space:nowrap;flex-shrink:0;"
                  >Mostrar</button>
                </div>
                <p
                  id="account-error-current"
                  class="message error"
                  role="alert"
                  aria-live="polite"
                  style="display:none;margin-top:4px;"
                ></p>
              </div>

              <div class="root-form-grid__full">
                <label for="account-input-new">
                  <span>Nueva contraseña *</span>
                </label>
                <div style="display:flex;gap:8px;align-items:center;">
                  <input
                    id="account-input-new"
                    name="newPassword"
                    type="password"
                    required
                    minlength="8"
                    maxlength="100"
                    autocomplete="new-password"
                    style="flex:1;"
                  />
                  <button
                    type="button"
                    class="secondary-button"
                    data-toggle-for="account-input-new"
                    aria-label="Mostrar nueva contraseña"
                    style="white-space:nowrap;flex-shrink:0;"
                  >Mostrar</button>
                </div>
                <p class="muted" style="margin-top:4px;font-size:0.82rem;">
                  Usa al menos 8 caracteres.
                </p>
                <p
                  id="account-error-new"
                  class="message error"
                  role="alert"
                  aria-live="polite"
                  style="display:none;margin-top:4px;"
                ></p>
              </div>

              <div class="root-form-grid__full">
                <label for="account-input-confirm">
                  <span>Confirmar nueva contraseña *</span>
                </label>
                <div style="display:flex;gap:8px;align-items:center;">
                  <input
                    id="account-input-confirm"
                    name="confirmPassword"
                    type="password"
                    required
                    minlength="8"
                    maxlength="100"
                    autocomplete="new-password"
                    style="flex:1;"
                  />
                  <button
                    type="button"
                    class="secondary-button"
                    data-toggle-for="account-input-confirm"
                    aria-label="Mostrar confirmación de contraseña"
                    style="white-space:nowrap;flex-shrink:0;"
                  >Mostrar</button>
                </div>
                <p
                  id="account-error-confirm"
                  class="message error"
                  role="alert"
                  aria-live="polite"
                  style="display:none;margin-top:4px;"
                ></p>
              </div>

            </div>
          </fieldset>

          <div id="account-dialog-general-message" style="margin-top:8px;"></div>

          <div class="action-row">
            <button id="account-dialog-submit" type="submit">Guardar cambio</button>
            <button
              id="account-dialog-cancel"
              class="secondary-button"
              type="button"
            >Cancelar</button>
          </div>
        </form>
      </dialog>
    `.trim();
  }

  // ─── DOM helpers ──────────────────────────────────────────────────────────

  /**
   * Muestra un mensaje de error bajo un campo específico.
   * @param {HTMLElement} dialog
   * @param {string} errorId   ID del elemento de error (sin #)
   * @param {string} message
   */
  function showFieldError(dialog, errorId, message) {
    const el = dialog.querySelector(`#${errorId}`);
    if (!(el instanceof globalScope.HTMLElement)) return;
    el.textContent = message;
    el.style.display = '';
  }

  /**
   * Muestra un mensaje general de error dentro del dialog.
   * @param {HTMLElement} dialog
   * @param {string} message
   */
  function showGeneralError(dialog, message) {
    const el = dialog.querySelector('#account-dialog-general-message');
    if (!(el instanceof globalScope.HTMLElement)) return;
    el.innerHTML = `<p class="message error" role="alert">${escapeHtml(message)}</p>`;
  }

  /**
   * Limpia todos los mensajes de error del dialog.
   * @param {HTMLElement} dialog
   */
  function clearErrors(dialog) {
    const errorEls = dialog.querySelectorAll('[role="alert"]');
    errorEls.forEach((el) => {
      if (el instanceof globalScope.HTMLElement) {
        el.textContent = '';
        el.style.display = 'none';
      }
    });
    const generalEl = dialog.querySelector('#account-dialog-general-message');
    if (generalEl instanceof globalScope.HTMLElement) {
      generalEl.innerHTML = '';
    }
  }

  /**
   * Resetea el formulario y limpia todos los errores y estados de visibilidad.
   * @param {HTMLElement} dialog
   */
  function resetForm(dialog) {
    const form = /** @type {HTMLFormElement | null} */ (dialog.querySelector('#account-dialog-form'));
    if (form) form.reset();

    clearErrors(dialog);

    // Restablecer visibilidad de contraseñas a "ocultar"
    dialog.querySelectorAll('[data-toggle-for]').forEach((btn) => {
      if (!(btn instanceof globalScope.HTMLElement)) return;
      const targetId = btn.getAttribute('data-toggle-for');
      const input = /** @type {HTMLInputElement | null} */ (targetId ? dialog.querySelector(`#${targetId}`) : null);
      if (input) {
        input.type = 'password';
        btn.textContent = 'Mostrar';
        const fieldLabel = btn.closest('div')?.previousElementSibling?.textContent?.trim() || 'contraseña';
        btn.setAttribute('aria-label', `Mostrar ${fieldLabel}`);
      }
    });
  }

  // ─── Lógica de cierre ─────────────────────────────────────────────────────

  /**
   * Cierra el dialog: resetea formulario, cierra y devuelve el foco al trigger.
   * @param {HTMLDialogElement} dialog
   */
  function closeDialog(dialog) {
    resetForm(dialog);
    dialog.close();

    if (_triggerElement instanceof globalScope.HTMLElement) {
      _triggerElement.focus();
    }
  }

  // ─── Mapeo de errores backend → campos UI ─────────────────────────────────

  /**
   * Mapea el error del backend al campo correspondiente en el formulario.
   * @param {HTMLElement} dialog
   * @param {Error & { code?: string | null, fieldErrors?: Record<string, string[]> | null, message?: string }} error
   */
  function mapBackendError(dialog, error) {
    const code = error?.code;
    const fieldErrors = error?.fieldErrors;

    if (code === 'CURRENT_PASSWORD_INVALID') {
      showFieldError(dialog, 'account-error-current', 'La contraseña actual no es correcta.');
      const input = /** @type {HTMLInputElement | null} */ (dialog.querySelector('#account-input-current'));
      if (input) input.focus();
      return;
    }

    if (code === 'PASSWORD_SAME_AS_CURRENT') {
      showFieldError(dialog, 'account-error-new', 'La nueva contraseña debe ser diferente a la actual.');
      const input = /** @type {HTMLInputElement | null} */ (dialog.querySelector('#account-input-new'));
      if (input) input.focus();
      return;
    }

    // Errores de validación Zod (format: { error: 'validation_error', details: { fieldErrors: {} } })
    if (fieldErrors) {
      const currentErrs = fieldErrors['currentPassword'] || [];
      const newErrs = fieldErrors['newPassword'] || [];
      let focusedField = false;

      if (currentErrs.length > 0) {
        showFieldError(dialog, 'account-error-current', currentErrs[0]);
        const input = /** @type {HTMLInputElement | null} */ (dialog.querySelector('#account-input-current'));
        if (input) { input.focus(); focusedField = true; }
      }
      if (newErrs.length > 0) {
        showFieldError(dialog, 'account-error-new', newErrs[0]);
        if (!focusedField) {
          const input = /** @type {HTMLInputElement | null} */ (dialog.querySelector('#account-input-new'));
          if (input) input.focus();
        }
      }

      if (!currentErrs.length && !newErrs.length) {
        showGeneralError(dialog, error?.message || 'No pudimos actualizar la contraseña. Intenta nuevamente.');
      }
      return;
    }

    showGeneralError(dialog, 'No pudimos actualizar la contraseña. Intenta nuevamente.');
  }

  // ─── Event listeners del dialog ───────────────────────────────────────────

  /**
   * Vincula todos los event listeners del dialog al crearlo.
   * @param {HTMLDialogElement} dialog
   */
  function bindDialogEvents(dialog) {
    const closeBtn = dialog.querySelector('#account-dialog-close');
    const cancelBtn = dialog.querySelector('#account-dialog-cancel');
    const submitBtn = /** @type {HTMLButtonElement | null} */ (dialog.querySelector('#account-dialog-submit'));
    const form = /** @type {HTMLFormElement | null} */ (dialog.querySelector('#account-dialog-form'));

    // Botones de mostrar/ocultar contraseña — delegación desde el dialog
    dialog.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof globalScope.HTMLElement)) return;

      const toggleBtn = target.closest('[data-toggle-for]');
      if (!(toggleBtn instanceof globalScope.HTMLElement)) return;

      const targetId = toggleBtn.getAttribute('data-toggle-for');
      const input = /** @type {HTMLInputElement | null} */ (targetId ? dialog.querySelector(`#${targetId}`) : null);
      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggleBtn.textContent = isPassword ? 'Ocultar' : 'Mostrar';
      toggleBtn.setAttribute('aria-label', `${isPassword ? 'Ocultar' : 'Mostrar'} contraseña`);
    });

    if (closeBtn instanceof globalScope.HTMLElement) {
      closeBtn.addEventListener('click', () => closeDialog(dialog));
    }
    if (cancelBtn instanceof globalScope.HTMLElement) {
      cancelBtn.addEventListener('click', () => closeDialog(dialog));
    }

    // Interceptar Escape nativo del <dialog> para limpiar el formulario
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog(dialog);
    });

    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors(dialog);

      const currentInput = /** @type {HTMLInputElement | null} */ (dialog.querySelector('#account-input-current'));
      const newInput = /** @type {HTMLInputElement | null} */ (dialog.querySelector('#account-input-new'));
      const confirmInput = /** @type {HTMLInputElement | null} */ (dialog.querySelector('#account-input-confirm'));

      const currentPassword = currentInput?.value ?? '';
      const newPassword = newInput?.value ?? '';
      const confirmPassword = confirmInput?.value ?? '';

      // ── Validación client-side ─────────────────────────────────────────────
      let firstErrorField = /** @type {HTMLElement | null} */ (null);

      function markError(inputEl, errorId, message) {
        showFieldError(dialog, errorId, message);
        if (!firstErrorField && inputEl) firstErrorField = inputEl;
      }

      if (!currentPassword) {
        markError(currentInput, 'account-error-current', 'Ingresa tu contraseña actual.');
      }

      if (!newPassword) {
        markError(newInput, 'account-error-new', 'Ingresa una nueva contraseña.');
      } else if (newPassword.length < 8) {
        markError(newInput, 'account-error-new', 'La nueva contraseña debe tener al menos 8 caracteres.');
      } else if (currentPassword && newPassword === currentPassword) {
        markError(newInput, 'account-error-new', 'La nueva contraseña debe ser diferente a la actual.');
      }

      if (!confirmPassword) {
        markError(confirmInput, 'account-error-confirm', 'Confirma la nueva contraseña.');
      } else if (newPassword && confirmPassword !== newPassword) {
        markError(confirmInput, 'account-error-confirm', 'Las contraseñas no coinciden.');
      }

      if (firstErrorField) {
        firstErrorField.focus();
        return;
      }

      // ── Envío al backend ───────────────────────────────────────────────────
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';
      }

      try {
        const accountApi = /** @type {any} */ (globalScope).InventoryAccountApi;
        await accountApi.changePassword(_currentSession, currentPassword, newPassword);

        resetForm(dialog);
        dialog.close();

        if (_triggerElement instanceof globalScope.HTMLElement) {
          _triggerElement.focus();
        }

        if (typeof _onSuccessCallback === 'function') {
          _onSuccessCallback();
        }
      } catch (error) {
        mapBackendError(dialog, /** @type {any} */ (error));
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Guardar cambio';
        }
      }
    });
  }

  // ─── Inicialización del dialog ────────────────────────────────────────────

  /**
   * Obtiene el dialog existente o lo crea y lo agrega al body.
   * El dialog se crea una única vez y se reutiliza entre aperturas.
   * @returns {HTMLDialogElement}
   */
  function getOrCreateDialog() {
    const existing = /** @type {HTMLDialogElement | null} */ (
      globalScope.document.getElementById(DIALOG_ID)
    );
    if (existing) return existing;

    const wrapper = globalScope.document.createElement('div');
    wrapper.innerHTML = renderDialogHtml();
    const dialog = /** @type {HTMLDialogElement} */ (wrapper.firstElementChild);
    globalScope.document.body.appendChild(dialog);
    bindDialogEvents(dialog);
    return dialog;
  }

  // ─── API pública ──────────────────────────────────────────────────────────

  /**
   * Abre el modal "Mi cuenta".
   *
   * @param {any} session   Sesión activa del usuario (se pasa al API call)
   * @param {{ onSuccess?: () => void }} [options]
   *   onSuccess — callback invocado por el shell tras cambio exitoso para
   *               mostrar la notificación mediante su propio mecanismo
   *               (toast, status bar, etc.)
   */
  function open(session, options = {}) {
    _currentSession = session;
    _onSuccessCallback = typeof options.onSuccess === 'function' ? options.onSuccess : null;
    _triggerElement = globalScope.document?.activeElement instanceof globalScope.HTMLElement
      ? globalScope.document.activeElement
      : null;

    const dialog = getOrCreateDialog();

    // Actualizar subtítulo con el nombre/rol del usuario actual
    const subtitle = /** @type {HTMLElement | null} */ (dialog.querySelector('#account-dialog-subtitle'));
    if (subtitle) {
      const fullName = session?.user?.fullName || session?.user?.username || 'Usuario';
      const roleCode = session?.user?.role?.code || '';
      subtitle.textContent = roleCode ? `${fullName} — ${roleCode}` : fullName;
    }

    resetForm(dialog);
    dialog.showModal();

    // Foco inicial en el primer campo
    const firstInput = /** @type {HTMLInputElement | null} */ (dialog.querySelector('#account-input-current'));
    if (firstInput) {
      // Timeout mínimo para que showModal() complete la animación de apertura
      setTimeout(() => firstInput.focus(), 0);
    }
  }

  /** @type {any} */ (globalScope).InventoryAccountDialog = {
    open,
  };
}(window));
