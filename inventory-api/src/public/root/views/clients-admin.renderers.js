(function attachRootShellClientsAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');

  function renderInlineEntries(items, emptyCopy, renderer) {
    if (!Array.isArray(items) || !items.length) {
      return `<p class="empty-state">${rootShellUi.escapeHtml(emptyCopy)}</p>`;
    }
    return items.map(renderer).join('');
  }

  function renderClientList(clients, selectedClientId) {
    if (!clients.length) {
      return '<p class="empty-state">Aun no hay clientes registrados.</p>';
    }

    return clients.map((client) => `
      <button class="commercial-list-item ${String(client.id) === String(selectedClientId) ? 'active' : ''}" type="button" data-client-select="${rootShellUi.escapeHtml(client.id)}">
        <span class="commercial-list-item__title">${rootShellUi.escapeHtml(client.name || 'Cliente sin nombre')}</span>
        <span class="commercial-list-item__meta">${rootShellUi.escapeHtml(client.code || 'Sin codigo')} · ${rootShellUi.escapeHtml(client.classification?.name || 'Sin clasificacion')}</span>
        <span class="commercial-list-item__badges">
          ${rootShellUi.renderStatusBadge(client.isActive !== false, 'Activo', 'Inactivo')}
          <span class="badge">${rootShellUi.escapeHtml(String(client.storesCount || 0))} tienda(s)</span>
          <span class="badge">${rootShellUi.escapeHtml(String(client.documents?.length || 0))} documento(s)</span>
        </span>
      </button>
    `).join('');
  }

  function renderClientDetail(client, classifications, documentTypes, zoneOptions, canDeactivate) {
    if (!client) {
      return '<p class="empty-state">Selecciona un cliente del listado para abrir el detalle contextual.</p>';
    }

    return `
      <section class="stack-section">
        <div class="page-header">
          <div>
            <h4>${rootShellUi.escapeHtml(client.name || 'Cliente sin nombre')}</h4>
            <p class="muted">${rootShellUi.escapeHtml(client.code || 'Sin codigo')} · ${rootShellUi.escapeHtml(client.phone || 'Sin telefono')}</p>
          </div>
          <div class="status-stack">
            ${rootShellUi.renderStatusBadge(client.isActive !== false, 'Activo', 'Inactivo')}
            <span class="badge">Detalle contextual</span>
          </div>
        </div>
      </section>

      <section class="stack-section">
        <h4>Resumen</h4>
        <form id="clients-update-form" class="root-form">
          <div class="root-form-grid">
            <input type="hidden" name="clientId" value="${rootShellUi.escapeHtml(client.id)}" />
            <label class="root-form-grid__full"><span>Nombre *</span><input name="name" type="text" required minlength="2" maxlength="255" value="${rootShellUi.escapeHtml(client.name || '')}" /></label>
            <label><span>Codigo</span><input name="code" type="text" maxlength="50" value="${rootShellUi.escapeHtml(client.code || '')}" /></label>
            <label><span>Clasificacion</span><select name="clientClassificationId"><option value="">Sin clasificacion</option>${(classifications || []).map((classification) => `<option value="${rootShellUi.escapeHtml(classification.id)}" ${String(classification.id) === String(client.clientClassificationId || client.classification?.id || '') ? 'selected' : ''}>${rootShellUi.escapeHtml(classification.name)}</option>`).join('')}</select></label>
            <label><span>Identificacion</span><input name="legalId" type="text" maxlength="100" value="${rootShellUi.escapeHtml(client.legalId || '')}" /></label>
            <label><span>Tipo de documento</span><input name="documentType" type="text" maxlength="50" value="${rootShellUi.escapeHtml(client.documentType || '')}" list="clients-document-types-list" /></label>
            <label><span>Telefono</span><input name="phone" type="text" maxlength="50" value="${rootShellUi.escapeHtml(client.phone || '')}" /></label>
            <label><span>Correo facturacion</span><input name="emailBilling" type="email" maxlength="255" value="${rootShellUi.escapeHtml(client.emailBilling || '')}" /></label>
            <label><span>Tipo de pago</span><select name="paymentType"><option value="">Selecciona</option><option value="CASH" ${client.paymentType === 'CASH' ? 'selected' : ''}>Contado</option><option value="CREDIT" ${client.paymentType === 'CREDIT' ? 'selected' : ''}>Credito</option><option value="TRANSFER" ${client.paymentType === 'TRANSFER' ? 'selected' : ''}>Transferencia</option><option value="CARD" ${client.paymentType === 'CARD' ? 'selected' : ''}>Tarjeta</option></select></label>
            <label><span>Dias de pago</span><input name="paymentDays" type="number" min="0" value="${rootShellUi.escapeHtml(client.paymentDays || '')}" /></label>

            <label class="root-form-grid__full"><span>Direccion</span><textarea name="address" rows="3" maxlength="1000">${rootShellUi.escapeHtml(client.address || '')}</textarea></label>
          </div>
          <div class="action-row compact-action-row">
            <button type="submit">Guardar cambios</button>
            <button id="clients-lookup-taxpayer-button" class="secondary-button" type="button">Consultar identificacion</button>
            ${canDeactivate ? '<button id="clients-deactivate-button" class="secondary-button danger-button" type="button">Desactivar cliente</button>' : ''}
          </div>
        </form>
        <datalist id="clients-document-types-list">${(documentTypes || []).map((item) => `<option value="${rootShellUi.escapeHtml(item.value || item.code || item.name || '')}"></option>`).join('')}</datalist>
      </section>

      <section class="stack-section">
        <div class="page-header">
          <h4>Tiendas</h4>
          <button
            type="button"
            id="clients-add-store-button"
            data-client-id="${rootShellUi.escapeHtml(client.id)}"
            data-client-name="${rootShellUi.escapeHtml(client.name || '')}"
          >+ Agregar tienda</button>
        </div>
        <div id="clients-stores-list" class="inline-card-grid">
          ${renderInlineEntries(client.stores || [], 'Este cliente aun no tiene tiendas registradas.', (store) => `
            <article class="inline-card" data-store-id="${rootShellUi.escapeHtml(store.id)}">
              <strong>${rootShellUi.escapeHtml(store.name || 'Tienda')}</strong>
              <p class="muted">${rootShellUi.escapeHtml(store.code || 'Sin codigo')} · ${rootShellUi.escapeHtml(store.subregion?.name || store.subregionName || 'Sin subzona')}</p>
              ${store.latitude && store.longitude ? `<p class="muted" style="font-size:0.78rem;">📍 ${rootShellUi.escapeHtml(String(store.latitude))}, ${rootShellUi.escapeHtml(String(store.longitude))}</p>` : '<p class="muted" style="font-size:0.78rem;">Sin coordenadas</p>'}
              <form class="clients-store-credit-form" data-client-id="${rootShellUi.escapeHtml(client.id)}" data-store-id="${rootShellUi.escapeHtml(store.id)}" style="margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                <label style="font-size:0.8rem;display:flex;align-items:center;gap:4px;">
                  <span style="white-space:nowrap;">Límite crédito</span>
                  <input name="creditLimit" type="number" min="0" step="0.01" value="${rootShellUi.escapeHtml(String(store.creditLimit ?? 0))}" style="width:100px;" />
                </label>
                <span class="muted" style="font-size:0.78rem;">Saldo: ${rootShellUi.escapeHtml(String(Number(store.creditBalance ?? 0).toFixed(2)))}</span>
                <button type="submit" class="secondary-button" style="font-size:0.78rem;padding:4px 10px;">Guardar</button>
                <span class="clients-store-credit-msg" style="font-size:0.78rem;"></span>
              </form>
            </article>
          `)}
        </div>
      </section>

      <section class="stack-section">
        <h4>Documentos</h4>
        <div class="inline-card-grid">
          ${renderInlineEntries(client.documents || [], 'Este cliente aun no tiene documentos cargados.', (document) => `
            <article class="inline-card">
              <strong>${rootShellUi.escapeHtml(document.documentType || document.fileName || 'Documento')}</strong>
              <p class="muted">${rootShellUi.escapeHtml(document.fileName || 'Sin archivo')}</p>
              <button class="secondary-button" type="button" data-document-download="${rootShellUi.escapeHtml(document.id)}">Descargar</button>
            </article>
          `)}
        </div>
        <form id="clients-document-form" class="root-form root-form--compact">
          <input type="hidden" name="clientId" value="${rootShellUi.escapeHtml(client.id)}" />
          <div class="root-form-grid">
            <label><span>Tipo de documento *</span><select name="documentType" required><option value="">Selecciona</option>${(documentTypes || []).map((item) => `<option value="${rootShellUi.escapeHtml(item.value || item.code || item.name || '')}">${rootShellUi.escapeHtml(item.label || item.name || item.value || item.code || 'Documento')}</option>`).join('')}</select></label>
            <label><span>Numero</span><input name="documentNumber" type="text" maxlength="120" /></label>
            <label><span>Nombre de archivo *</span><input name="fileName" type="text" required maxlength="255" /></label>
            <label><span>Tipo MIME</span><input name="mimeType" type="text" maxlength="120" placeholder="application/pdf" /></label>
            <label class="root-form-grid__full"><span>Contenido Base64 *</span><textarea name="fileContentBase64" rows="4" required></textarea></label>
            <label class="root-form-grid__full"><span>Notas</span><textarea name="notes" rows="2"></textarea></label>
          </div>
          <div class="action-row compact-action-row"><button type="submit">Agregar documento</button></div>
        </form>
      </section>

      <section class="stack-section">
        <h4>Referencias</h4>
        <div class="inline-card-grid">
          ${renderInlineEntries(client.references || [], 'Este cliente aun no tiene referencias registradas.', (reference) => `
            <article class="inline-card">
              <strong>${rootShellUi.escapeHtml(reference.name || 'Referencia')}</strong>
              <p class="muted">${rootShellUi.escapeHtml(reference.contact || 'Sin contacto')} · ${rootShellUi.escapeHtml(reference.phone1 || 'Sin telefono')}</p>
            </article>
          `)}
        </div>
        <form id="clients-reference-form" class="root-form root-form--compact">
          <input type="hidden" name="clientId" value="${rootShellUi.escapeHtml(client.id)}" />
          <div class="root-form-grid">
            <label><span>Nombre *</span><input name="name" type="text" required minlength="2" maxlength="255" /></label>
            <label><span>Contacto</span><input name="contact" type="text" maxlength="255" /></label>
            <label><span>Telefono 1</span><input name="phone1" type="text" maxlength="50" /></label>
            <label><span>Telefono 2</span><input name="phone2" type="text" maxlength="50" /></label>
            <label><span>Dias</span><input name="termDays" type="number" min="0" /></label>
            <label><span>Monto</span><input name="amount" type="number" min="0" step="0.01" /></label>
          </div>
          <div class="action-row compact-action-row"><button type="submit">Agregar referencia</button></div>
        </form>
      </section>
    `;
  }

  rootShell.register('views.clientsAdminRenderers', {
    renderClientDetail,
    renderClientList,
    renderInlineEntries,
  });
}(window));
