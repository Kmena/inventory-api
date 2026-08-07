(function attachRootShellLotsAdminRenderers(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const rootShellUi = rootShell.require('ui');
  const lotsHelpers = rootShell.require('views.lotsAdminHelpers');

  function escapeHtml(value) {
    return rootShellUi.escapeHtml(String(value == null ? '' : value));
  }

  // --- KPIs ---

  function renderKpiCard(label, value, variant) {
    const variantClass = variant ? ` kpi-card--${escapeHtml(variant)}` : '';
    return `
      <div class="kpi-card${variantClass}" role="status">
        <span class="kpi-card__value">${escapeHtml(value)}</span>
        <span class="kpi-card__label">${escapeHtml(label)}</span>
      </div>
    `;
  }

  function renderLotsKpis(kpis, gate) {
    if (!gate.passed) {
      return '';
    }

    const isEstimated = !gate.passed;
    const estimatedNote = isEstimated
      ? '<span class="kpi-estimated-note" title="Calculado con los datos disponibles en esta carga.">Estimado</span>'
      : '';

    return `
      <div class="commercial-metrics lots-kpis" aria-label="Metricas de lotes">
        ${estimatedNote}
        ${renderKpiCard('Total lotes', kpis.total, '')}
        ${renderKpiCard('Con alerta', kpis.withAlert, kpis.withAlert > 0 ? 'warning' : '')}
        ${renderKpiCard('Proximos a vencer', kpis.expiringSoon, kpis.expiringSoon > 0 ? 'warning' : '')}
        ${renderKpiCard('Vencidos', kpis.expired, kpis.expired > 0 ? 'error' : '')}
        ${renderKpiCard('QA pendiente/bloqueado', kpis.qaPendingOrBlocked, kpis.qaPendingOrBlocked > 0 ? 'warning' : '')}
        ${renderKpiCard('Stock disponible', lotsHelpers.formatQuantity(kpis.totalAvailable), '')}
      </div>
    `;
  }

  // --- Filter bar ---

  function renderWarehouseOptions(warehouses, selectedId) {
    const options = warehouses.map((w) => {
      const selected = String(w.id) === String(selectedId) ? ' selected' : '';
      return `<option value="${escapeHtml(w.id)}"${selected}>${escapeHtml(w.name)}</option>`;
    }).join('');
    return options;
  }

  // --- State markup (empty / error) ---

  function renderLotsState(title, description, ctaHtml) {
    return `
      <div class="empty-state-block" role="status">
        <p class="empty-state-title">${escapeHtml(title)}</p>
        <p class="muted">${escapeHtml(description)}</p>
        ${ctaHtml || ''}
      </div>
    `;
  }

  // --- Degraded state ---

  function renderDegradedState(gate) {
    return `
      <div class="lots-degraded-state" role="alert" aria-live="assertive">
        <div class="lots-degraded-state__icon" aria-hidden="true">⚠</div>
        <h3 class="lots-degraded-state__title">Datos de lote insuficientes</h3>
        <p class="lots-degraded-state__reason">${escapeHtml(gate.reason || 'La consulta de existencias no incluye datos suficientes de lote.')}</p>
        <p class="muted">Para implementar esta vista completa, confirmar o ampliar la fuente de datos de lotes en el backend.</p>
        <p class="muted">Secciones deshabilitadas: KPIs de lotes, filtros, tabla de lotes, drawer de detalle y accion QA.</p>
      </div>
    `;
  }

  // --- Lot badges ---

  function renderStatusBadge(label, variant) {
    return `<span class="status-badge status-badge--${escapeHtml(variant || 'default')}">${escapeHtml(label)}</span>`;
  }

  function renderExpiryBadge(expirationDate) {
    const days = lotsHelpers.calculateDaysToExpiry(expirationDate);
    const formatted = lotsHelpers.formatExpirationDate(expirationDate);

    if (days === null) {
      return `<span class="status-badge status-badge--default">Sin fecha</span>`;
    }

    if (lotsHelpers.isExpired(days)) {
      return `<span class="status-badge status-badge--error" title="Vencio hace ${Math.abs(days)} dias">${escapeHtml(formatted)}</span>`;
    }

    if (lotsHelpers.isExpiringSoon(days)) {
      return `<span class="status-badge status-badge--warning" title="Vence en ${days} dias">${escapeHtml(formatted)}</span>`;
    }

    return `<span class="status-badge status-badge--default">${escapeHtml(formatted)}</span>`;
  }

  function renderConfidenceBadge(confidence) {
    const label = lotsHelpers.getSourceConfidenceLabel(confidence);
    if (!label) {
      return '';
    }
    return `<span class="confidence-badge confidence-badge--${escapeHtml(confidence)}" title="Informacion construida con datos incompletos.">${escapeHtml(label)}</span>`;
  }

  // --- Table (desktop) ---

  function renderLotsTableRow(lot) {
    const qaLabel = lotsHelpers.getQaStatusLabel(lot.qaStatus);
    const qaVariant = lotsHelpers.getQaStatusVariant(lot.qaStatus);
    const lotStatusLabel = lotsHelpers.getLotStatusLabel(lot.lotStatus);
    const lotStatusVariant = lotsHelpers.getLotStatusVariant(lot.lotStatus);
    const alertIndicator = lot.alertIds && lot.alertIds.length > 0
      ? '<span class="alert-indicator" title="Este lote tiene alertas activas" aria-label="Con alerta">⚠</span>'
      : '';

    return `
      <tr>
        <td data-label="Lote">
          ${escapeHtml(lot.lotCode)}
          ${renderConfidenceBadge(lot.sourceConfidence)}
          ${alertIndicator}
        </td>
        <td data-label="Producto">${escapeHtml(lot.productName)}${lot.productCode ? ` <span class="muted">${escapeHtml(lot.productCode)}</span>` : ''}</td>
        <td data-label="Bodega">${escapeHtml(lot.warehouseName)}</td>
        <td data-label="Stock disp.">${escapeHtml(lotsHelpers.formatQuantity(lot.availableQuantity))}</td>
        <td data-label="Estado QA">${renderStatusBadge(qaLabel, qaVariant)}</td>
        <td data-label="Estado lote">${renderStatusBadge(lotStatusLabel, lotStatusVariant)}</td>
        <td data-label="Vencimiento">${renderExpiryBadge(lot.expirationDate)}</td>
        <td data-label="Acciones">
          <button class="secondary-button secondary-button--sm" type="button" data-lot-detail="${escapeHtml(lot.lotId)}" aria-label="Ver detalle del lote ${escapeHtml(lot.lotCode)}">
            Ver detalle
          </button>
        </td>
      </tr>
    `;
  }

  function renderLotsTable(lots) {
    if (!lots || lots.length === 0) {
      return '';
    }

    const rows = lots.map(renderLotsTableRow).join('');
    return `
      <div class="responsive-table-wrapper">
        <table class="commercial-table lots-table" aria-label="Listado de lotes">
          <thead>
            <tr>
              <th scope="col">Lote</th>
              <th scope="col">Producto</th>
              <th scope="col">Bodega</th>
              <th scope="col">Stock disp.</th>
              <th scope="col">Estado QA</th>
              <th scope="col">Estado lote</th>
              <th scope="col">Vencimiento</th>
              <th scope="col"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  // --- Detail drawer ---

  function renderLotDetailBody(lot, canQa) {
    if (!lot) {
      return '<p class="muted">Selecciona un lote para revisar su trazabilidad.</p>';
    }

    const qaLabel = lotsHelpers.getQaStatusLabel(lot.qaStatus);
    const qaVariant = lotsHelpers.getQaStatusVariant(lot.qaStatus);
    const lotStatusLabel = lotsHelpers.getLotStatusLabel(lot.lotStatus);
    const lotStatusVariant = lotsHelpers.getLotStatusVariant(lot.lotStatus);

    const qaButton = canQa
      ? `<button id="lots-register-qa-button" class="secondary-button" type="button" data-lot-id="${escapeHtml(lot.lotId)}">Registrar QA</button>`
      : '';

    const movementsLink = `<a href="#movements" class="secondary-button" aria-label="Ver movimientos relacionados con este lote">Ver en movimientos</a>`;

    return `
      <dl class="detail-list lots-detail-list">
        <div class="detail-list__row">
          <dt>Lote</dt>
          <dd>${escapeHtml(lot.lotCode)} ${renderConfidenceBadge(lot.sourceConfidence)}</dd>
        </div>
        <div class="detail-list__row">
          <dt>Producto</dt>
          <dd>${escapeHtml(lot.productName)}${lot.productCode ? ` <span class="muted">(${escapeHtml(lot.productCode)})</span>` : ''}</dd>
        </div>
        ${lot.categoryName ? `
        <div class="detail-list__row">
          <dt>Categoria</dt>
          <dd>${escapeHtml(lot.categoryName)}</dd>
        </div>` : ''}
        <div class="detail-list__row">
          <dt>Bodega</dt>
          <dd>${escapeHtml(lot.warehouseName)}</dd>
        </div>
        <div class="detail-list__row">
          <dt>Stock disponible</dt>
          <dd>${escapeHtml(lotsHelpers.formatQuantity(lot.availableQuantity))}</dd>
        </div>
        <div class="detail-list__row">
          <dt>Stock total</dt>
          <dd>${escapeHtml(lotsHelpers.formatQuantity(lot.quantity))}</dd>
        </div>
        <div class="detail-list__row">
          <dt>Reservado</dt>
          <dd>${escapeHtml(lotsHelpers.formatQuantity(lot.reservedQuantity))}</dd>
        </div>
        <div class="detail-list__row">
          <dt>Estado QA</dt>
          <dd>${renderStatusBadge(qaLabel, qaVariant)}</dd>
        </div>
        <div class="detail-list__row">
          <dt>Estado lote</dt>
          <dd>${renderStatusBadge(lotStatusLabel, lotStatusVariant)}</dd>
        </div>
        <div class="detail-list__row">
          <dt>Vencimiento</dt>
          <dd>${renderExpiryBadge(lot.expirationDate)}</dd>
        </div>
        ${lot.alertIds && lot.alertIds.length > 0 ? `
        <div class="detail-list__row">
          <dt>Alertas activas</dt>
          <dd><span class="status-badge status-badge--warning">${escapeHtml(String(lot.alertIds.length))} alerta(s)</span></dd>
        </div>` : ''}
      </dl>
      <p class="muted">Esta vista muestra el estado actual del lote. Para ver el historial, consulta Movimientos.</p>
      <div class="detail-actions">
        ${qaButton}
        ${movementsLink}
      </div>
    `;
  }

  // --- Entry dialog ---

  /**
   * Renders the reason-code options for the entry form.
   * @returns {string}
   */
  function renderEntryReasonOptions() {
    return lotsHelpers.ENTRY_REASON_CODES
      .map((r) => `<option value="${escapeHtml(r.value)}">${escapeHtml(r.label)}</option>`)
      .join('');
  }

  /**
   * Renders product <option> elements from a list of products.
   * @param {Array<any>} products
   * @returns {string}
   */
  function renderProductOptions(products) {
    if (!Array.isArray(products) || products.length === 0) {
      return '<option value="">No hay productos en esta seleccion</option>';
    }
    return products.map((p) => {
      const label = p.code ? `${escapeHtml(p.name)} — ${escapeHtml(p.code)}` : escapeHtml(p.name);
      return `<option value="${escapeHtml(String(p.id))}">${label}</option>`;
    }).join('');
  }

  /**
   * Renders category <option> elements from a category index.
   * @param {Array<{ id: string, name: string }>} categoryIndex
   * @returns {string}
   */
  function renderCategoryOptions(categoryIndex) {
    if (!Array.isArray(categoryIndex) || categoryIndex.length === 0) {
      return '';
    }
    return categoryIndex
      .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
      .join('');
  }

  /**
   * Renders subcategory <option> elements.
   * @param {Array<{ id: string, name: string }>} subcategories
   * @returns {string}
   */
  function renderSubcategoryOptions(subcategories) {
    if (!Array.isArray(subcategories) || subcategories.length === 0) {
      return '';
    }
    return subcategories
      .map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`)
      .join('');
  }

  /**
   * Renders the full stock entry dialog with warehouse options pre-populated.
   * Product select is populated lazily when the dialog opens.
   * @param {Array<any>} warehouses
   * @returns {string}
   */
  function renderEntryDialog(warehouses) {
    const warehouseOptions = (Array.isArray(warehouses) ? warehouses : []).map((w) =>
      `<option value="${escapeHtml(String(w.id))}">${escapeHtml(w.name)}</option>`
    ).join('');

    return `
      <dialog id="lots-entry-dialog" class="root-dialog" aria-labelledby="lots-entry-dialog-title">
        <div class="dialog-header">
          <div>
            <h3 id="lots-entry-dialog-title">Registrar entrada de inventario</h3>
            <p class="muted">Crea un nuevo lote e ingresa la cantidad a bodega.</p>
          </div>
          <button id="lots-close-entry-button" type="button" class="secondary-button" aria-label="Cerrar formulario de entrada">Cerrar</button>
        </div>
        <form id="lots-entry-form" class="root-form" novalidate>
          <div id="lots-entry-message"></div>
          <fieldset class="root-form__section">
            <legend>Datos de la entrada</legend>
            <div class="root-form-grid">
              <label>
                <span>Bodega *</span>
                <select name="warehouseId" required>
                  <option value="">Selecciona una bodega</option>
                  ${warehouseOptions}
                </select>
              </label>
              <label class="field-wide">
                <span>Buscar producto</span>
                <input
                  type="search"
                  id="lots-entry-product-search"
                  placeholder="Escriba nombre, codigo o categoria..."
                  autocomplete="off"
                  aria-label="Buscar producto por nombre, codigo o categoria"
                />
              </label>
              <label class="field-wide">
                <span>Producto *</span>
                <select name="productId" id="lots-entry-product-select" required>
                  <option value="">Cargando productos...</option>
                </select>
              </label>
              <label>
                <span>Cantidad *</span>
                <input name="quantity" type="number" min="0.001" step="any" required placeholder="Ej: 100" />
              </label>
              <label>
                <span>Numero de lote interno *</span>
                <input name="internalLotNumber" type="text" required minlength="1" maxlength="100" placeholder="Ej: LOT-2025-001" />
              </label>
              <label>
                <span>Motivo de entrada *</span>
                <select name="reasonCode" required>
                  ${renderEntryReasonOptions()}
                </select>
              </label>
              <label>
                <span>Fecha de vencimiento</span>
                <input name="expirationDate" type="date" />
              </label>
              <label>
                <span>Fecha de produccion</span>
                <input name="productionDate" type="date" />
              </label>
              <label>
                <span>Lote del proveedor</span>
                <input name="manufacturerLotNumber" type="text" maxlength="100" placeholder="Opcional" />
              </label>
              <label>
                <span>Numero de factura</span>
                <input name="invoiceNumber" type="text" maxlength="100" placeholder="Opcional" />
              </label>
              <label class="field-wide">
                <span>Nota</span>
                <textarea name="note" maxlength="500" rows="2" placeholder="Opcional"></textarea>
              </label>
            </div>
          </fieldset>
          <div class="action-row">
            <button type="submit" id="lots-entry-submit-button">Registrar entrada</button>
            <button type="button" id="lots-cancel-entry-button" class="secondary-button">Cancelar</button>
          </div>
        </form>
      </dialog>
    `;
  }

  // --- QA form ---

  function renderQaForm(lot) {
    if (!lot) {
      return '';
    }

    return `
      <form id="lots-qa-form" class="root-form" novalidate>
        <div id="lots-qa-form-message"></div>
        <fieldset class="root-form__section">
          <legend>Registrar QA para ${escapeHtml(lot.lotCode)}</legend>
          <div class="root-form-grid">
            <label class="field-wide">
              <span>Accion QA *</span>
              <select name="qaAction" required>
                <option value="">Selecciona una accion</option>
                <option value="APPROVE">Aprobar</option>
                <option value="REJECT">Rechazar</option>
                <option value="FAIL">Falla QA</option>
                <option value="BLOCK">Bloquear</option>
                <option value="REACTIVATE">Reactivar</option>
              </select>
            </label>
            <label class="field-wide">
              <span>Motivo *</span>
              <textarea name="qaReason" required minlength="3" maxlength="500" rows="3" placeholder="Describe el resultado de la inspeccion QA"></textarea>
            </label>
          </div>
        </fieldset>
        <div class="action-row">
          <button id="lots-qa-submit-button" type="submit">Confirmar QA</button>
          <button id="lots-qa-cancel-button" class="secondary-button" type="button">Cancelar</button>
        </div>
      </form>
    `;
  }

  rootShell.register('views.lotsAdminRenderers', {
    renderCategoryOptions,
    renderDegradedState,
    renderEntryDialog,
    renderLotsKpis,
    renderLotsState,
    renderLotsTable,
    renderLotDetailBody,
    renderProductOptions,
    renderQaForm,
    renderSubcategoryOptions,
    renderWarehouseOptions,
  });
}(window));
