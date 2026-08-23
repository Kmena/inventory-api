(function supplierQuoteApp() {
  'use strict';

  const messageEl = document.getElementById('supplier-quote-message');
  const contentEl = document.getElementById('supplier-quote-content');

  function getTokenFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str ?? '')));
    return div.innerHTML;
  }

  function showError(message) {
    contentEl.innerHTML = `
      <div class="supplier-quote-error">
        <h2>⚠️</h2>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
  }

  function showSuccess(message) {
    contentEl.innerHTML = `
      <div class="supplier-quote-success">
        <h2>✓ Respuesta enviada</h2>
        <p>${escapeHtml(message)}</p>
        <p class="muted">Puede cerrar esta ventana.</p>
      </div>
    `;
  }

  function showMessage(text, tone) {
    const cls = tone === 'error' ? 'inline-message inline-message--error'
      : tone === 'warning' ? 'inline-message inline-message--warning'
      : 'inline-message inline-message--success';
    messageEl.innerHTML = `<div class="${cls}" role="alert"><p>${escapeHtml(text)}</p></div>`;
  }

  function renderForm(data) {
    const items = data.items || [];
    const expiresAt = data.expiresAt ? new Date(data.expiresAt).toLocaleDateString('es-CR', {
      year: 'numeric', month: 'long', day: 'numeric',
    }) : '';

    contentEl.innerHTML = `
      <article class="card root-card">
        <div class="page-header">
          <div>
            <h3>${escapeHtml(data.requestTitle || 'Solicitud de cotización')}</h3>
            <p class="muted">Proveedor: <strong>${escapeHtml(data.supplierName || '')}</strong></p>
            ${expiresAt ? `<p class="muted">Vence: ${escapeHtml(expiresAt)}</p>` : ''}
          </div>
        </div>

        <form id="supplier-quote-form" class="root-form">
          <fieldset class="root-form__section">
            <legend>Datos generales</legend>
            <div class="root-form-grid">
              <label>
                <span>Moneda *</span>
                <select id="sq-currency" name="currency" required>
                  <option value="CRC">CRC — Colón</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </label>
              <label>
                <span>Notas (opcional)</span>
                <textarea id="sq-notes" name="notes" maxlength="2000" rows="2" placeholder="Observaciones, condiciones de pago, etc."></textarea>
              </label>
            </div>
          </fieldset>

          <fieldset class="root-form__section">
            <legend>Productos solicitados</legend>
            <div class="table-wrapper supplier-quote-items-table">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad *</th>
                    <th>Precio unitario *</th>
                    <th>Plazo entrega (días)</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody id="sq-items-body">
                  ${items.map((item) => `
                    <tr data-product-id="${escapeHtml(String(item.productId))}">
                      <td data-label="Producto">
                        <strong>${escapeHtml(item.productName || '')}</strong>
                        ${item.unit ? `<br><span class="muted">${escapeHtml(item.unit)}</span>` : ''}
                        ${item.notes ? `<br><span class="muted">${escapeHtml(item.notes)}</span>` : ''}
                      </td>
                      <td data-label="Cantidad">
                        <input type="number" name="quantity" min="0.01" step="0.01"
                               value="${escapeHtml(String(item.quantity || 0))}" required
                               aria-label="Cantidad para ${escapeHtml(item.productName || '')}" />
                      </td>
                      <td data-label="Precio unitario">
                        <input type="number" name="unitPrice" min="0.01" step="0.01"
                               required placeholder="0.00"
                               aria-label="Precio unitario para ${escapeHtml(item.productName || '')}" />
                      </td>
                      <td data-label="Plazo entrega">
                        <input type="number" name="leadTimeDays" min="0" step="1"
                               placeholder="Días"
                               aria-label="Plazo de entrega para ${escapeHtml(item.productName || '')}" />
                      </td>
                      <td data-label="Notas">
                        <input type="text" name="itemNotes" maxlength="500" placeholder="Opcional"
                               aria-label="Notas para ${escapeHtml(item.productName || '')}" />
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <p class="muted">Complete el precio unitario para cada producto que desee cotizar.</p>
          </fieldset>
        </form>

        <div class="action-row">
          <button id="sq-submit-button" type="button">Enviar cotización</button>
        </div>
      </article>
    `;

    document.getElementById('sq-submit-button').addEventListener('click', handleSubmit);
  }

  async function loadInvitation(token) {
    try {
      const response = await fetch(`/api/public/supplier-quotations/${encodeURIComponent(token)}`);
      const data = await response.json();
      if (!response.ok) {
        showError(data.message || 'No se pudo cargar la solicitud.');
        return;
      }
      renderForm(data);
    } catch (_error) {
      showError('No se pudo conectar al servidor. Intente de nuevo.');
    }
  }

  async function handleSubmit() {
    const token = getTokenFromUrl();
    if (!token) {
      showMessage('Token no válido.', 'error');
      return;
    }

    messageEl.innerHTML = '';
    const rows = document.querySelectorAll('#sq-items-body tr');
    const currency = document.getElementById('sq-currency')?.value || 'CRC';
    const notes = document.getElementById('sq-notes')?.value || null;

    const items = Array.from(rows).map((row) => ({
      productId: row.getAttribute('data-product-id'),
      quantity: Number(row.querySelector('[name="quantity"]')?.value || 0),
      unitPrice: Number(row.querySelector('[name="unitPrice"]')?.value || 0),
      leadTimeDays: row.querySelector('[name="leadTimeDays"]')?.value
        ? Number(row.querySelector('[name="leadTimeDays"]').value)
        : null,
      notes: row.querySelector('[name="itemNotes"]')?.value || null,
    })).filter((item) => item.unitPrice > 0 && item.quantity > 0);

    if (!items.length) {
      showMessage('Debes ingresar precio y cantidad para al menos un producto.', 'warning');
      return;
    }

    const submitButton = document.getElementById('sq-submit-button');
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    try {
      const response = await fetch(`/api/public/supplier-quotations/${encodeURIComponent(token)}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency, notes, items }),
      });
      const data = await response.json();
      if (!response.ok) {
        showMessage(data.message || 'No se pudo enviar la cotización.', 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar cotización';
        return;
      }
      showSuccess(data.message || 'Cotización enviada correctamente.');
    } catch (_error) {
      showMessage('Error de conexión. Intente de nuevo.', 'error');
      submitButton.disabled = false;
      submitButton.textContent = 'Enviar cotización';
    }
  }

  // Init
  const token = getTokenFromUrl();
  if (!token) {
    showError('Enlace no válido. Verifique que la URL esté completa.');
  } else {
    loadInvitation(token);
  }
}());
