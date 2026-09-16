/**
 * account-api.js — API de cuenta del usuario autenticado.
 *
 * Expone window.InventoryAccountApi con las operaciones de autogestión
 * de cuenta disponibles para todos los shells (root, warehouse, agent).
 *
 * El endpoint PATCH /api/me/password deriva el userId de la sesión
 * autenticada en el servidor; nunca se envía desde el cliente.
 */
(function attachInventoryAccountApi(globalScope) {
  'use strict';

  const inventoryAuth = /** @type {any} */ (globalScope).InventoryAuth;

  /**
   * Intenta parsear el cuerpo de la respuesta como JSON.
   * Retorna null si la respuesta no contiene JSON válido.
   * @param {Response} response
   * @returns {Promise<any>}
   */
  async function parseJsonSafely(response) {
    try {
      return await response.json();
    } catch (_e) {
      return null;
    }
  }

  /**
   * Cambia la contraseña del usuario autenticado.
   *
   * Lanza un Error con las siguientes propiedades adicionales si falla:
   *   error.statusCode  — código HTTP
   *   error.code        — código de dominio (CURRENT_PASSWORD_INVALID, etc.)
   *   error.fieldErrors — errores de campo de Zod (o null)
   *
   * @param {any} session   Sesión activa del usuario
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns {Promise<void>}
   */
  async function changePassword(session, currentPassword, newPassword) {
    const response = await globalScope.fetch('/api/me/password', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: inventoryAuth.buildHeaders(session, {
        includeJsonContentType: true,
      }),
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (response.status === 204) {
      return;
    }

    const data = await parseJsonSafely(response);

    if (response.status === 401) {
      inventoryAuth.handleUnauthorized();
    }

    const error = /** @type {Error & { statusCode?: number, code?: string | null, fieldErrors?: Record<string, string[]> | null }} */ (
      new Error(data?.message || 'No pudimos actualizar la contraseña. Intenta nuevamente.')
    );
    error.statusCode = response.status;
    error.code = data?.error || null;
    error.fieldErrors = data?.details?.fieldErrors || null;
    throw error;
  }

  /** @type {any} */ (globalScope).InventoryAccountApi = {
    changePassword,
  };
}(window));
