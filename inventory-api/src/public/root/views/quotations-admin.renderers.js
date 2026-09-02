(function attachRootShellQuotationsAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');
  const helpers = rootShell.require('views.quotationsAdminHelpers');

  function renderMetricCard(label, value) {
    return `
      <article class="card root-card metric-card">
        <p class="muted">${rootShellUi.escapeHtml(label)}</p>
        <strong>${rootShellUi.escapeHtml(String(value))}</strong>
      </article>
    `;
  }

  function renderMetrics(metrics) {
    return [
      renderMetricCard('Total cotizables', metrics.total),
      renderMetricCard('Con faltante', metrics.withShortage),
      renderMetricCard('Seleccionados', metrics.selectedProducts),
    ].join('');
  }

  function renderEmptyState(title, description) {
    return `
      <div class="card root-card">
        <h3>${rootShellUi.escapeHtml(title)}</h3>
        <p class="muted">${rootShellUi.escapeHtml(description)}</p>
      </div>
    `;
  }

  function renderProductsTable(products, selectionByProductId) {
    if (!products.length) {
      return '';
    }

    return `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Seleccion</th>
              <th>Producto</th>
              <th>SKU</th>
              <th>Faltante</th>
              <th>Stock</th>
              <th>Proveedores</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            ${products.map((product) => {
              const isSelected = helpers.hasReadySelectionForProduct(product.id, selectionByProductId);
              return `
                <tr>
                  <td data-label="Seleccion">${isSelected ? '<span class="badge badge-success">Listo</span>' : '<span class="badge">Pendiente</span>'}</td>
                  <td data-label="Producto"><strong>${rootShellUi.escapeHtml(product.name || 'Producto')}</strong></td>
                  <td data-label="SKU">${rootShellUi.escapeHtml(product.sku || '—')}</td>
                  <td data-label="Faltante">${rootShellUi.escapeHtml(helpers.formatQuantity(product.shortage))}</td>
                  <td data-label="Stock">${rootShellUi.escapeHtml(helpers.formatQuantity(product.quantity))}</td>
                  <td data-label="Proveedores">${rootShellUi.escapeHtml(String(product.supplierCount || 0))}</td>
                  <td data-label="Accion">
                    <button class="secondary-button quotations-open-detail-button" type="button" data-product-id="${rootShellUi.escapeHtml(String(product.id))}">Ver proveedores</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderSelectionSummary(items) {
    if (!items.length) {
      return '<p class="muted">Aun no hay productos listos para generar una cotización agrupada.</p>';
    }

    return `
      <div class="tag-list">
        ${items.map((item) => `
          <span class="tag">${rootShellUi.escapeHtml(item.productName || 'Producto')} · ${rootShellUi.escapeHtml(String(item.supplierCount))} proveedor(es) · Cant. ${rootShellUi.escapeHtml(String(item.quantity))}</span>
        `).join('')}
      </div>
    `;
  }

  function renderProductPricingDetail(detail, selectionDraft) {
    if (!detail) {
      return '<p class="muted">Selecciona un producto para revisar sus proveedores.</p>';
    }

    const selectedSupplierIds = new Set((selectionDraft?.selectedSuppliers || []).map((supplier) => String(supplier.supplierId)));

    return `
      <section class="stack-section">
        <div class="page-header">
          <div>
            <h4>${rootShellUi.escapeHtml(detail.productName || 'Producto')}</h4>
            <p class="muted">SKU ${rootShellUi.escapeHtml(detail.sku || '—')} · Faltante ${rootShellUi.escapeHtml(helpers.formatQuantity(detail.shortage))} · Stock ${rootShellUi.escapeHtml(helpers.formatQuantity(detail.quantity))}</p>
          </div>
          <span class="badge">${rootShellUi.escapeHtml(String((detail.suppliers || []).length))} proveedor(es)</span>
        </div>
      </section>

      <fieldset class="root-form__section">
        <legend>Configuración de la selección</legend>
        <div class="root-form-grid">
          <label><span>Cantidad a cotizar *</span><input id="quotations-detail-quantity" name="quantity" type="number" min="0.01" step="0.01" value="${rootShellUi.escapeHtml(String(selectionDraft?.quantity || ''))}" required /></label>
          <label class="field-wide"><span>Notas del producto</span><textarea id="quotations-detail-notes" name="notes" maxlength="500" rows="2">${rootShellUi.escapeHtml(selectionDraft?.notes || '')}</textarea></label>
        </div>
      </fieldset>

      ${!(detail.suppliers || []).length
        ? '<p class="muted">Este producto no tiene proveedores disponibles para cotizar.</p>'
        : `
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Seleccionar</th>
                  <th>Proveedor</th>
                  <th>Precio</th>
                  <th>Moneda</th>
                  <th>Lead time</th>
                  <th>MOQ</th>
                  <th>Preferido</th>
                </tr>
              </thead>
              <tbody>
                ${(detail.suppliers || []).map((supplier) => `
                  <tr>
                    <td data-label="Seleccionar">
                      <input type="checkbox" class="quotations-supplier-checkbox" data-supplier-id="${rootShellUi.escapeHtml(String(supplier.supplierId))}" ${selectedSupplierIds.has(String(supplier.supplierId)) ? 'checked' : ''} />
                    </td>
                    <td data-label="Proveedor"><strong>${rootShellUi.escapeHtml(supplier.supplierName || 'Proveedor')}</strong></td>
                    <td data-label="Precio">${supplier.unitPrice != null ? rootShellUi.escapeHtml(helpers.formatCurrency(supplier.unitPrice, supplier.currency || 'CRC')) : '—'}</td>
                    <td data-label="Moneda">${rootShellUi.escapeHtml(supplier.currency || 'CRC')}</td>
                    <td data-label="Lead time">${supplier.leadTimeDays != null ? rootShellUi.escapeHtml(String(supplier.leadTimeDays)) + ' dias' : '—'}</td>
                    <td data-label="MOQ">${supplier.minimumOrderQuantity != null ? rootShellUi.escapeHtml(String(supplier.minimumOrderQuantity)) : '—'}</td>
                    <td data-label="Preferido">${supplier.isPreferred ? 'Si' : 'No'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
    `;
  }

  function renderGenerationSummary(items) {
    if (!items.length) {
      return '<p class="muted">No hay productos listos para generar.</p>';
    }

    return `
      <div class="stack-section">
        <p class="muted">Se generará una solicitud agrupada para ${rootShellUi.escapeHtml(String(items.length))} producto(s).</p>
        <ul>
          ${items.map((item) => `<li>${rootShellUi.escapeHtml(item.productName || 'Producto')} · ${rootShellUi.escapeHtml(String(item.supplierCount))} proveedor(es) · Cant. ${rootShellUi.escapeHtml(String(item.quantity))}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  function renderRfqStatusSummary(statusCounts) {
    return `
      <div class="tag-list" aria-live="polite">
        <span class="badge badge-info">${rootShellUi.escapeHtml(String(statusCounts.prepared))} Preparadas</span>
        <span class="badge badge-success">${rootShellUi.escapeHtml(String(statusCounts.responded))} Respondidas</span>
        <span class="badge badge-warning">${rootShellUi.escapeHtml(String(statusCounts.expired))} Expiradas</span>
        <span class="badge badge-danger">${rootShellUi.escapeHtml(String(statusCounts.cancelled))} Canceladas</span>
      </div>
    `;
  }

  function renderRfqInvitationsTable(invitations, canManage) {
    if (!invitations || !invitations.length) {
      return '<div class="empty-state"><p class="muted">No hay invitaciones generadas para esta solicitud.</p></div>';
    }

    return `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Email</th>
              <th>Estado</th>
              <th>Expira</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${invitations.map((inv) => {
              const statusInfo = helpers.mapInvitationStatusLabel(inv.status);
              const actions = helpers.getAvailableActionsForStatus(inv.status, canManage);
              const supplierName = inv.supplier?.name || inv.supplierName || 'Proveedor';
              const emailTo = inv.emailTo || inv.supplier?.email || '—';
              const expiresAt = helpers.formatDate(inv.expiresAt);

              const actionButtons = [
                actions.canCopyMachote ? `<button class="secondary-button rfq-copy-machote-button" type="button" data-invitation-id="${rootShellUi.escapeHtml(String(inv.id))}" title="Copiar machote" aria-label="Copiar machote de correo para ${rootShellUi.escapeHtml(supplierName)}">📋</button>` : '',
                actions.canRefresh ? `<button class="secondary-button rfq-refresh-button" type="button" data-invitation-id="${rootShellUi.escapeHtml(String(inv.id))}" title="Refrescar template" aria-label="Refrescar template para ${rootShellUi.escapeHtml(supplierName)}">↻</button>` : '',
                actions.canCancel ? `<button class="secondary-button rfq-cancel-button" type="button" data-invitation-id="${rootShellUi.escapeHtml(String(inv.id))}" data-supplier-name="${rootShellUi.escapeHtml(supplierName)}" title="Cancelar invitación" aria-label="Cancelar invitación para ${rootShellUi.escapeHtml(supplierName)}">✖</button>` : '',
                actions.canManualResponse ? `<button class="secondary-button rfq-manual-response-button" type="button" data-invitation-id="${rootShellUi.escapeHtml(String(inv.id))}" data-supplier-name="${rootShellUi.escapeHtml(supplierName)}" title="Registrar respuesta manual" aria-label="Registrar respuesta manual para ${rootShellUi.escapeHtml(supplierName)}">📝</button>` : '',
              ].filter(Boolean).join(' ');

              return `
                <tr>
                  <td data-label="Proveedor"><strong>${rootShellUi.escapeHtml(supplierName)}</strong></td>
                  <td data-label="Email">${rootShellUi.escapeHtml(emailTo)}</td>
                  <td data-label="Estado"><span class="${rootShellUi.escapeHtml(statusInfo.badgeClass)}">${rootShellUi.escapeHtml(statusInfo.label)}</span></td>
                  <td data-label="Expira">${rootShellUi.escapeHtml(expiresAt)}</td>
                  <td data-label="Acciones">${actionButtons || '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderMachoteDialogContent(machoteData) {
    return `
      <fieldset class="root-form__section">
        <legend>Contenido del correo</legend>
        <div class="root-form-grid">
          <label class="root-form-grid__full">
            <span>Asunto</span>
            <input id="rfq-machote-subject" type="text" readonly aria-readonly="true" value="${rootShellUi.escapeHtml(machoteData.emailSubject || '')}" />
          </label>
          <label class="root-form-grid__full">
            <span>Cuerpo</span>
            <textarea id="rfq-machote-body" rows="10" readonly aria-readonly="true">${rootShellUi.escapeHtml(machoteData.emailBody || '')}</textarea>
          </label>
          <label>
            <span>Enlace seguro</span>
            <input id="rfq-machote-link" type="text" readonly aria-readonly="true" value="${rootShellUi.escapeHtml(machoteData.secureLink || '')}" />
          </label>
          <div style="display:flex;align-items:flex-end;">
            <button id="rfq-copy-link-button" class="secondary-button" type="button">Copiar enlace</button>
          </div>
        </div>
        <p class="muted">Copia este contenido y pégalo en tu cliente de correo.</p>
      </fieldset>
    `;
  }

  function renderManualResponseFormContent(invitation, purchaseRequestItems) {
    const supplierName = invitation?.supplier?.name || invitation?.supplierName || 'Proveedor';
    const items = purchaseRequestItems || [];

    return `
      <fieldset class="root-form__section">
        <legend>Datos generales</legend>
        <div class="root-form-grid">
          <label>
            <span>Moneda *</span>
            <select id="rfq-manual-currency" name="currency" required>
              <option value="CRC">CRC — Colón</option>
              <option value="USD">USD — Dólar</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </label>
          <label>
            <span>Notas del proveedor</span>
            <textarea id="rfq-manual-notes" name="notes" maxlength="2000" rows="2"></textarea>
          </label>
        </div>
      </fieldset>
      <fieldset class="root-form__section">
        <legend>Productos cotizados — ${rootShellUi.escapeHtml(supplierName)}</legend>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad *</th>
                <th>Precio unit. *</th>
                <th>Lead time (días)</th>
              </tr>
            </thead>
            <tbody id="rfq-manual-items-body">
              ${items.map((item) => {
                const productName = item.product?.name || item.productName || `Producto #${item.productId}`;
                const qty = item.quantity || 0;
                return `
                  <tr data-product-id="${rootShellUi.escapeHtml(String(item.productId))}">
                    <td data-label="Producto">
                      <strong>${rootShellUi.escapeHtml(productName)}</strong>
                      <br><span class="muted">${rootShellUi.escapeHtml(String(qty))} solicitadas</span>
                    </td>
                    <td data-label="Cantidad">
                      <input type="number" name="quantity" min="0.01" step="0.01" value="${rootShellUi.escapeHtml(String(qty))}" required aria-label="Cantidad para ${rootShellUi.escapeHtml(productName)}" />
                    </td>
                    <td data-label="Precio unit.">
                      <input type="number" name="unitPrice" min="0.01" step="0.01" required placeholder="0.00" aria-label="Precio unitario para ${rootShellUi.escapeHtml(productName)}" />
                    </td>
                    <td data-label="Lead time">
                      <input type="number" name="leadTimeDays" min="0" step="1" placeholder="Días" aria-label="Tiempo de entrega para ${rootShellUi.escapeHtml(productName)}" />
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <p class="muted">Los productos se pre-cargan de la solicitud de compra.</p>
      </fieldset>
    `;
  }

  function renderActiveRequestSummary(activeRequest) {
    if (!activeRequest) {
      return renderEmptyState('Sin solicitud activa', 'Aún no has generado una solicitud de cotización. Selecciona productos y genera una cotización agrupada para comenzar.');
    }

    const hasInvitations = Boolean(activeRequest.hasInvitations);
    return `
      <div class="stack-section">
        <div class="page-header">
          <div>
            <h4>${rootShellUi.escapeHtml(activeRequest.title || `Solicitud #${activeRequest.purchaseRequestId}`)}</h4>
            <p class="muted">Creada: ${rootShellUi.escapeHtml(helpers.formatDate(activeRequest.createdAt))} · ${rootShellUi.escapeHtml(String(activeRequest.itemCount || 0))} producto(s)</p>
          </div>
          <span class="badge">${rootShellUi.escapeHtml(activeRequest.status || 'OPEN')}</span>
        </div>
        <div class="tag-list">
          <span class="badge ${hasInvitations ? 'badge-info' : ''}">${rootShellUi.escapeHtml(hasInvitations ? `Invitaciones: ${activeRequest.invitations?.length || 0}` : 'Sin invitaciones')}</span>
          <span class="badge badge-success">${rootShellUi.escapeHtml(`Respondidas: ${activeRequest.respondedInvitationCount || 0}`)}</span>
          <span class="badge">${rootShellUi.escapeHtml(`Manual: ${activeRequest.manualResponseCount || 0}`)}</span>
          <span class="badge">${rootShellUi.escapeHtml(`Pública: ${activeRequest.publicResponseCount || 0}`)}</span>
          <span class="badge badge-info">${rootShellUi.escapeHtml(`Ingresadas: ${activeRequest.directEntryCount || 0}`)}</span>
        </div>
        <p class="muted">${rootShellUi.escapeHtml(hasInvitations ? 'Solicitud activa: continúa con invitaciones y consulta respuestas sin salir del workspace.' : 'Esta solicitud todavía no tiene invitaciones RFQ. Genera invitaciones para solicitar respuesta a los proveedores seleccionados.')}</p>
      </div>
    `;
  }

  function renderResponseSummary(summary) {
    if (!summary || !summary.responseGroups?.length) {
      return renderEmptyState('Sin respuestas', 'Todavía no hay respuestas registradas para esta solicitud. Las respuestas manuales y públicas aparecerán aquí.');
    }

    return `
      <div class="stack-section">
        <div class="tag-list">
          <span class="badge badge-success">${rootShellUi.escapeHtml(`Proveedores: ${summary.supplierResponseCount}`)}</span>
          <span class="badge">${rootShellUi.escapeHtml(`Productos cotizados: ${summary.quotedProductCount}`)}</span>
          <span class="badge">${rootShellUi.escapeHtml(`Manual: ${summary.manualResponseCount}`)}</span>
          <span class="badge">${rootShellUi.escapeHtml(`Pública: ${summary.publicResponseCount}`)}</span>
          <span class="badge badge-info">${rootShellUi.escapeHtml(`Ingresadas: ${summary.directEntryCount || 0}`)}</span>
        </div>
      </div>
    `;
  }

  function renderResponseDetails(responseGroups) {
    if (!responseGroups || !responseGroups.length) {
      return '<p class="muted">Todavía no hay respuestas registradas para esta solicitud.</p>';
    }

    return responseGroups.map((group) => `
      <article class="card root-card stack-section">
        <div class="page-header">
          <div>
            <h4>${rootShellUi.escapeHtml(group.supplierName || 'Proveedor')}</h4>
            <p class="muted">${rootShellUi.escapeHtml(group.supplierEmail || 'Sin correo')} · ${rootShellUi.escapeHtml(group.responseSource || 'Sin origen de respuesta')}</p>
          </div>
          <span class="badge badge-success">${rootShellUi.escapeHtml(group.currency || 'CRC')}</span>
        </div>
        <p class="muted">Fecha: ${rootShellUi.escapeHtml(helpers.formatDate(group.submittedAt))} · Total: ${rootShellUi.escapeHtml(helpers.formatCurrency(group.totalAmount, group.currency || 'CRC'))}</p>
        ${group.notes ? `<p class="muted">Notas: ${rootShellUi.escapeHtml(group.notes)}</p>` : ''}
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio unitario</th>
                <th>Lead time</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              ${(group.items || []).map((item) => `
                <tr>
                  <td data-label="Producto"><strong>${rootShellUi.escapeHtml(item.productName || 'Producto')}</strong></td>
                  <td data-label="Cantidad">${rootShellUi.escapeHtml(String(item.quantity || 0))}</td>
                  <td data-label="Precio unitario">${rootShellUi.escapeHtml(helpers.formatCurrency(item.unitPrice, group.currency || 'CRC'))}</td>
                  <td data-label="Lead time">${item.leadTimeDays != null ? rootShellUi.escapeHtml(String(item.leadTimeDays)) + ' días' : '—'}</td>
                  <td data-label="Observaciones">${rootShellUi.escapeHtml(item.notes || item.availabilityNotes || '—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </article>
    `).join('');
  }

  function renderOpenRequestsTable(trackingData, activeRequestId) {
    if (!trackingData || !trackingData.length) {
      return '<div class="empty-state"><p class="muted">No hay solicitudes abiertas para mostrar.</p></div>';
    }

    return `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Solicitud</th>
              <th>Estado</th>
              <th>Invitaciones</th>
              <th>Respuestas</th>
              <th>Creada</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${trackingData.map((req) => `
              <tr>
                <td data-label="Solicitud"><strong>${rootShellUi.escapeHtml(req.title || `Solicitud #${req.purchaseRequestId}`)}</strong>${String(req.purchaseRequestId) === String(activeRequestId) ? ' <span class="badge badge-info">Activa</span>' : ''}</td>
                <td data-label="Estado"><span class="badge">${rootShellUi.escapeHtml(req.status || '—')}</span></td>
                <td data-label="Invitaciones">${rootShellUi.escapeHtml(String(req.invitations?.length || 0))}</td>
                <td data-label="Respuestas">${rootShellUi.escapeHtml(String(req.respondedInvitationCount || 0))}</td>
                <td data-label="Creada">${rootShellUi.escapeHtml(helpers.formatDate(req.createdAt))}</td>
                <td data-label="Acción"><button class="secondary-button quotations-open-request-context-button" type="button" data-purchase-request-id="${rootShellUi.escapeHtml(String(req.purchaseRequestId))}">Ver en esta vista</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Renderiza el formulario del modal de cotizacion directa.
   * @param {any[]} suppliers   - Lista de proveedores activos de la empresa
   * @param {any[]} requestItems - Items de la solicitud de compra activa
   */
  function renderDirectQuotationForm(suppliers, requestItems) {
    const ui = rootShell.require('ui');
    const esc = ui.escapeHtml.bind(ui);

    const supplierOptions = (Array.isArray(suppliers) ? suppliers : [])
      .map((s) => `<option value="${esc(String(s.id))}">${esc(s.name)}</option>`)
      .join('');

    const itemRows = (Array.isArray(requestItems) ? requestItems : []).map((item) => `
      <tr data-product-id="${esc(String(item.productId))}">
        <td>${esc(item.product?.name || item.productName || String(item.productId))}</td>
        <td>${esc(String(Number(item.quantity || 0).toFixed(3)))} ${esc(item.product?.unit || item.unit || '')}</td>
        <td><input type="number" name="unitPrice" min="0.01" step="0.01" required
                   style="width:100px" placeholder="0.00"
                   aria-label="Precio unitario de ${esc(item.productName || String(item.productId))}" /></td>
        <td><input type="number" name="quantity" min="0.001" step="0.001"
                   value="${esc(String(Number(item.quantity || 0)))}" required
                   style="width:90px"
                   aria-label="Cantidad ofertada" /></td>
        <td><input type="number" name="leadTimeDays" min="0" step="1"
                   style="width:70px" placeholder="0"
                   aria-label="Dias de entrega" /></td>
      </tr>
    `).join('');

    return `
      <div style="display:flex;flex-direction:column;gap:0.75rem">
        <label style="display:block">
          <span>Proveedor <strong style="color:var(--color-danger,#c00)">*</strong></span>
          <select id="direct-q-supplier" required style="width:100%;margin-top:0.25rem">
            <option value="">Selecciona un proveedor...</option>
            ${supplierOptions}
          </select>
        </label>

        <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
          <label style="flex:1;min-width:120px">
            <span>Moneda</span>
            <select id="direct-q-currency" style="width:100%;margin-top:0.25rem">
              <option value="CRC" selected>CRC</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label style="flex:2;min-width:200px">
            <span>Referencia (opcional)</span>
            <input type="text" id="direct-q-reference" maxlength="120"
                   placeholder="Ej: Cotización #123" style="width:100%;margin-top:0.25rem" />
          </label>
        </div>

        <label style="display:block">
          <span>Notas del proveedor (opcional)</span>
          <textarea id="direct-q-notes" rows="2" maxlength="2000"
                    style="width:100%;margin-top:0.25rem"
                    placeholder="Condiciones, vigencia, etc."></textarea>
        </label>

        <div style="overflow-x:auto">
          <table class="wh-table" style="width:100%;min-width:520px">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Requerido</th>
                <th>Precio unitario *</th>
                <th>Cantidad ofertada *</th>
                <th>Días entrega</th>
              </tr>
            </thead>
            <tbody id="direct-q-items-body">${itemRows}</tbody>
          </table>
        </div>
        ${!itemRows ? '<p class="muted">No hay productos en la solicitud activa.</p>' : ''}
      </div>
    `;
  }

  rootShell.register('views.quotationsAdminRenderers', {
    renderEmptyState,
    renderGenerationSummary,
    renderMachoteDialogContent,
    renderManualResponseFormContent,
    renderMetrics,
    renderProductPricingDetail,
    renderProductsTable,
    renderActiveRequestSummary,
    renderResponseDetails,
    renderResponseSummary,
    renderRfqInvitationsTable,
    renderRfqStatusSummary,
    renderOpenRequestsTable,
    renderSelectionSummary,
    renderDirectQuotationForm,
  });
}(window));
