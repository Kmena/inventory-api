(function attachRootShellQuotationsAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const quotationsApi = rootShell.require('quotationsApi');
  const rootShellUi = rootShell.require('ui');
  const sessionAdapter = rootShell.require('sessionAdapter');
  const helpers = rootShell.require('views.quotationsAdminHelpers');
  const renderers = rootShell.require('views.quotationsAdminRenderers');
  const comparison = rootShell.require('views.quotationsComparison');

  function render() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Compras</p>
        <h2 id="root-view-title">Cotizaciones</h2>
        <p class="muted">Gestiona solicitudes de cotización, invitaciones RFQ y comparación de proveedores.</p>
      </section>

      <div id="quotations-page-message"></div>

      <div style="display:grid;grid-template-columns:300px 1fr;gap:1.5rem;align-items:start;">

        <!-- ═══ SIDEBAR: lista de solicitudes abiertas ═══ -->
        <aside id="rfq-tracking-section">
          <article class="card root-card">
            <div class="page-header">
              <div>
                <h3>Solicitudes</h3>
                <p id="rfq-tracking-summary" class="muted" style="font-size:0.8rem;">Cargando...</p>
              </div>
              <button id="quotations-new-request-button" type="button" style="font-size:0.8rem;padding:0.3rem 0.6rem;">+ Nueva</button>
            </div>
            <div id="rfq-tracking-message"></div>
            <div id="rfq-tracking-region" aria-live="polite"></div>
            <div style="margin-top:0.75rem;">
              <button id="rfq-tracking-refresh-button" class="secondary-button" type="button" style="width:100%;font-size:0.8rem;">Actualizar estado</button>
            </div>
          </article>
        </aside>

        <!-- ═══ PANEL PRINCIPAL ═══ -->
        <main>
          <div id="quotations-metrics" class="commercial-metrics" aria-live="polite"></div>

          <!-- Estado vacío: ninguna solicitud seleccionada y no creando -->
          <div id="quotations-empty-state" class="card root-card" style="text-align:center;padding:2.5rem 1.5rem;">
            <p style="font-size:1.1rem;font-weight:600;margin:0 0 0.5rem;">Seleccioná una solicitud</p>
            <p class="muted" style="margin:0 0 1.5rem;">Elegí una solicitud abierta del panel izquierdo o creá una cotización agrupada nueva.</p>
            <button id="quotations-new-request-button-main" type="button">Crear cotización agrupada</button>
          </div>

          <!-- Panel de creación: Productos cotizables (oculto hasta que se pulse Nueva) -->
          <article class="card root-card" id="quotations-create-panel" hidden>
            <div class="page-header">
              <div>
                <h3>Productos cotizables</h3>
                <p id="quotations-list-summary" class="muted">Cargando productos cotizables...</p>
              </div>
              <div class="action-row compact-action-row">
                <button id="quotations-back-button" class="secondary-button" type="button">← Solicitudes</button>
                <button id="quotations-refresh-button" class="secondary-button" type="button">Actualizar</button>
                <button id="quotations-generate-button" type="button" disabled>Generar cotizaciones</button>
              </div>
            </div>
            <div class="client-command-bar">
              <label class="client-search-field"><span>Buscar</span><input id="quotations-search-input" type="search" placeholder="Nombre o SKU del producto" /></label>
            </div>
            <div class="stack-section">
              <h4>Resumen de selección</h4>
              <div id="quotations-selection-summary"></div>
            </div>
            <div id="quotations-list-region" aria-live="polite"></div>
          </article>

          <!-- Panel de detalle de solicitud (oculto hasta que se seleccione una) -->
          <div id="quotations-request-detail" hidden>
            <!-- Solicitud activa + RFQ -->
            <article class="card root-card" id="rfq-section">
              <div class="page-header">
                <div>
                  <h3 id="rfq-detail-title">Solicitud</h3>
                  <p id="rfq-section-summary" class="muted">Invitaciones, respuestas y comparación de cotizaciones.</p>
                </div>
                <div class="compact-action-row">
                  <button id="rfq-generate-button" type="button" disabled>Generar invitaciones RFQ</button>
                  <button id="rfq-direct-quotation-button" class="secondary-button" type="button" hidden>📝 Ingresar cotización</button>
                  <button id="rfq-view-responses-button" class="secondary-button" type="button" hidden>Ver respuestas</button>
                </div>
              </div>
              <div id="rfq-active-request-summary" aria-live="polite"></div>
              <div id="rfq-response-summary" aria-live="polite"></div>
              <div id="rfq-status-summary" class="tag-list" aria-live="polite"></div>
              <div id="rfq-invitations-message"></div>
              <div id="rfq-invitations-region" aria-live="polite"></div>
            </article>

            <!-- Comparación inline (antes era una card separada debajo) -->
            <div id="quotations-comparison-inline"></div>
          </div>
        </main>
      </div>

      <dialog id="quotations-detail-dialog" class="modal-card">
        <div class="page-header">
          <div>
            <h3 id="quotations-detail-title">Detalle de proveedores</h3>
            <p id="quotations-detail-subtitle" class="muted">Revisa precios y selecciona proveedores.</p>
          </div>
          <button id="quotations-close-detail-button" class="secondary-button" type="button">Cerrar</button>
        </div>
        <div id="quotations-detail-message"></div>
        <div id="quotations-detail-content"></div>
        <div class="action-row">
          <button id="quotations-save-selection-button" type="button">Guardar selección</button>
          <button id="quotations-cancel-selection-button" class="secondary-button" type="button">Cancelar</button>
        </div>
      </dialog>

      <dialog id="rfq-machote-dialog" class="modal-card">
        <div class="page-header">
          <div>
            <h3 id="rfq-machote-title">Machote de correo</h3>
            <p class="muted">Copia este contenido y pégalo en tu cliente de correo.</p>
          </div>
          <button id="rfq-machote-close-button" class="secondary-button" type="button">Cerrar</button>
        </div>
        <div id="rfq-machote-message"></div>
        <div id="rfq-machote-content"></div>
        <div class="action-row">
          <button id="rfq-copy-all-button" type="button">Copiar todo al portapapeles</button>
          <button id="rfq-machote-close-button-2" class="secondary-button" type="button">Cerrar</button>
        </div>
      </dialog>

      <dialog id="rfq-manual-response-dialog" class="modal-card">
        <div class="page-header">
          <div>
            <h3 id="rfq-manual-title">Registrar respuesta</h3>
            <p id="rfq-manual-subtitle" class="muted">Captura la cotización recibida por correo.</p>
          </div>
          <button id="rfq-manual-close-button" class="secondary-button" type="button">Cerrar</button>
        </div>
        <div id="rfq-manual-response-message"></div>
        <div id="rfq-manual-response-content"></div>
        <div class="action-row">
          <button id="rfq-manual-submit-button" type="button">Registrar respuesta</button>
          <button id="rfq-manual-cancel-button" class="secondary-button" type="button">Cancelar</button>
        </div>
      </dialog>

      <dialog id="direct-quotation-dialog" class="modal-card">
        <div class="page-header">
          <div>
            <h3 id="direct-quotation-title">Ingresar cotización de proveedor</h3>
            <p id="direct-quotation-subtitle" class="muted">Registra la cotización recibida directamente, sin invitación RFQ.</p>
          </div>
          <button id="direct-quotation-close-button" class="secondary-button" type="button">Cerrar</button>
        </div>
        <div id="direct-quotation-message"></div>
        <div id="direct-quotation-content"></div>
        <div class="action-row">
          <button id="direct-quotation-submit-button" type="button">Registrar cotización</button>
          <button id="direct-quotation-cancel-button" class="secondary-button" type="button">Cancelar</button>
        </div>
      </dialog>

      <dialog id="rfq-response-details-dialog" class="modal-card">
        <div class="page-header">
          <div>
            <h3 id="rfq-response-details-title">Respuestas recibidas</h3>
            <p class="muted">Consulta el detalle por proveedor y línea de producto.</p>
          </div>
          <button id="rfq-response-details-close-button" class="secondary-button" type="button">Cerrar</button>
        </div>
        <div id="rfq-response-details-content"></div>
        <div class="action-row">
          <button id="rfq-response-details-dismiss-button" class="secondary-button" type="button">Cerrar</button>
        </div>
      </dialog>

      <dialog id="rfq-cancel-dialog" class="modal-card">
        <div class="page-header">
          <div>
            <h3>Cancelar invitación</h3>
            <p class="muted">Esta acción no se puede deshacer.</p>
          </div>
          <button id="rfq-cancel-close-button" class="secondary-button" type="button">Cerrar</button>
        </div>
        <div id="rfq-cancel-message"></div>
        <div id="rfq-cancel-content" class="stack-section">
          <p>¿Seguro que deseas cancelar la invitación para <strong id="rfq-cancel-supplier-name"></strong>?</p>
          <p class="muted">El proveedor ya no podrá responder a través del enlace seguro.</p>
        </div>
        <div class="action-row">
          <button id="rfq-cancel-confirm-button" class="secondary-button" type="button" style="background:#fee2e2;color:#7f1d1d;border:1px solid #fca5a5;">Confirmar cancelación</button>
          <button id="rfq-cancel-dismiss-button" class="secondary-button" type="button">No cancelar</button>
        </div>
      </dialog>

      <dialog id="quotations-confirm-dialog" class="modal-card">
        <div class="page-header">
          <div>
            <h3>Confirmar generación</h3>
            <p class="muted">Se generará una solicitud agrupada con las selecciones actuales.</p>
          </div>
          <button id="quotations-close-confirm-button" class="secondary-button" type="button">Cerrar</button>
        </div>
        <div id="quotations-confirm-message"></div>
        <div id="quotations-confirm-content"></div>
        <div class="action-row">
          <button id="quotations-confirm-submit-button" type="button">Confirmar generación</button>
          <button id="quotations-confirm-cancel-button" class="secondary-button" type="button">Cancelar</button>
        </div>
      </dialog>
    `;
  }

  async function mount(container, session, helpersBag = {}) {
    const setShellStatus = typeof helpersBag.setShellStatus === 'function' ? helpersBag.setShellStatus : () => {};
    const canManage = sessionAdapter.hasPermission(session, 'procurement.manage');

    const metricsRegion = container.querySelector('#quotations-metrics');
    const pageMessage = container.querySelector('#quotations-page-message');
    const listSummary = container.querySelector('#quotations-list-summary');
    const selectionSummary = container.querySelector('#quotations-selection-summary');
    const listRegion = container.querySelector('#quotations-list-region');
    const searchInput = container.querySelector('#quotations-search-input');
    const refreshButton = container.querySelector('#quotations-refresh-button');
    const generateButton = container.querySelector('#quotations-generate-button');
    const detailDialog = container.querySelector('#quotations-detail-dialog');
    const detailTitle = container.querySelector('#quotations-detail-title');
    const detailSubtitle = container.querySelector('#quotations-detail-subtitle');
    const detailMessage = container.querySelector('#quotations-detail-message');
    const detailContent = container.querySelector('#quotations-detail-content');
    const closeDetailButton = container.querySelector('#quotations-close-detail-button');
    const saveSelectionButton = container.querySelector('#quotations-save-selection-button');
    const cancelSelectionButton = container.querySelector('#quotations-cancel-selection-button');
    const confirmDialog = container.querySelector('#quotations-confirm-dialog');
    const confirmMessage = container.querySelector('#quotations-confirm-message');
    const confirmContent = container.querySelector('#quotations-confirm-content');
    const closeConfirmButton = container.querySelector('#quotations-close-confirm-button');
    const confirmSubmitButton = container.querySelector('#quotations-confirm-submit-button');
    const confirmCancelButton = container.querySelector('#quotations-confirm-cancel-button');

    if (!metricsRegion || !pageMessage || !listSummary || !selectionSummary || !listRegion || !searchInput || !refreshButton || !generateButton || !detailDialog || !detailTitle || !detailSubtitle || !detailMessage || !detailContent || !closeDetailButton || !saveSelectionButton || !cancelSelectionButton || !confirmDialog || !confirmMessage || !confirmContent || !closeConfirmButton || !confirmSubmitButton || !confirmCancelButton) {
      return;
    }

    let products = [];
    let searchText = '';
    let currentProduct = null;
    let currentPricingDetail = null;
    let currentSelectionDraft = null;
    const selectionByProductId = new Map();

    function syncGenerateButton() {
      generateButton.hidden = !canManage;
      generateButton.disabled = !canManage || !helpers.canGenerateGroupedQuotation(products, selectionByProductId);
    }

    function renderCurrentState() {
      const visibleProducts = helpers.filterQuotableProducts(products, searchText);
      const metrics = helpers.buildQuotationsMetrics(products, selectionByProductId);
      const summaryItems = helpers.buildSelectionSummary(products, selectionByProductId);
      metricsRegion.innerHTML = renderers.renderMetrics(metrics);
      selectionSummary.innerHTML = renderers.renderSelectionSummary(summaryItems);
      syncGenerateButton();

      if (!products.length) {
        listSummary.textContent = 'No hay productos cotizables disponibles.';
        listRegion.innerHTML = renderers.renderEmptyState(
          'No hay productos cotizables',
          'No hay productos con proveedores disponibles para cotizar en este momento.',
        );
        return;
      }

      if (!visibleProducts.length) {
        listSummary.textContent = `0 de ${products.length} productos visibles con el filtro actual.`;
        listRegion.innerHTML = renderers.renderEmptyState(
          'Sin resultados',
          'No hay productos que coincidan con la búsqueda actual.',
        );
        return;
      }

      listSummary.textContent = searchText
        ? `${visibleProducts.length} de ${products.length} productos visibles.`
        : `${products.length} productos cotizables disponibles.`;
      listRegion.innerHTML = renderers.renderProductsTable(visibleProducts, selectionByProductId);

      listRegion.querySelectorAll('.quotations-open-detail-button').forEach((button) => {
        button.addEventListener('click', () => {
          openProductDetail(button.getAttribute('data-product-id'));
        });
      });
    }

    async function loadProducts(statusMessage) {
      listRegion.innerHTML = '<p class="empty-state">Cargando productos cotizables...</p>';
      pageMessage.innerHTML = '';
      setShellStatus(statusMessage || 'Cargando productos cotizables...');
      try {
        const response = await quotationsApi.listQuotableProducts(session);
        products = Array.isArray(response) ? response : [];
        renderCurrentState();
        setShellStatus('Sesion lista.');
      } catch (error) {
        products = [];
        metricsRegion.innerHTML = renderers.renderMetrics({ total: 0, withShortage: 0, selectedProducts: 0 });
        listSummary.textContent = 'No se pudieron cargar los productos cotizables.';
        listRegion.innerHTML = renderers.renderEmptyState('Error al cargar', error.message || 'No se pudieron cargar los productos cotizables.');
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudieron cargar las cotizaciones.', 'error');
        setShellStatus('Error al cargar cotizaciones.', 'error');
      }
    }

    async function openProductDetail(productId) {
      currentProduct = products.find((entry) => String(entry.id) === String(productId)) || null;
      currentPricingDetail = null;
      currentSelectionDraft = null;
      detailTitle.textContent = currentProduct?.name || 'Detalle de proveedores';
      detailSubtitle.textContent = 'Cargando precios y condiciones...';
      detailMessage.innerHTML = '';
      detailContent.innerHTML = '<p class="empty-state">Cargando precios de proveedores...</p>';
      detailDialog.showModal();
      setShellStatus('Cargando detalle de proveedores...');

      try {
        const response = await quotationsApi.getProductSuppliersPricing(session, productId);
        currentPricingDetail = response;
        currentSelectionDraft = helpers.buildProductSelectionDraft(currentProduct, currentPricingDetail, helpers.getSelectionForProduct(productId, selectionByProductId));
        detailTitle.textContent = currentPricingDetail?.productName || currentProduct?.name || 'Detalle de proveedores';
        detailSubtitle.textContent = 'Selecciona uno o más proveedores para este producto.';
        detailContent.innerHTML = renderers.renderProductPricingDetail(currentPricingDetail, currentSelectionDraft);
        bindDetailInputs();
        setShellStatus('Detalle cargado.');
      } catch (error) {
        detailContent.innerHTML = renderers.renderEmptyState('Error al cargar', error.message || 'No se pudo cargar el detalle de proveedores.');
        detailMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo cargar el detalle de proveedores.', 'error');
        setShellStatus('Error al cargar detalle.', 'error');
      }
    }

    function bindDetailInputs() {
      const quantityInput = detailContent.querySelector('#quotations-detail-quantity');
      const notesInput = detailContent.querySelector('#quotations-detail-notes');
      const supplierCheckboxes = detailContent.querySelectorAll('.quotations-supplier-checkbox');

      if (quantityInput) {
        quantityInput.addEventListener('input', () => {
          currentSelectionDraft.quantity = Number(quantityInput.value || 0);
        });
      }

      if (notesInput) {
        notesInput.addEventListener('input', () => {
          currentSelectionDraft.notes = notesInput.value;
        });
      }

      supplierCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
          const supplier = (currentPricingDetail?.suppliers || []).find((entry) => String(entry.supplierId) === String(checkbox.getAttribute('data-supplier-id')));
          if (!supplier) {
            return;
          }

          currentSelectionDraft = helpers.toggleSupplierSelection(currentSelectionDraft, supplier, checkbox.checked);
        });
      });
    }

    function closeDetailDialog() {
      detailDialog.close();
      currentProduct = null;
      currentPricingDetail = null;
      currentSelectionDraft = null;
    }

    function saveCurrentSelection() {
      if (!currentProduct || !currentSelectionDraft) {
        return;
      }

      if (!(Number(currentSelectionDraft.quantity) > 0)) {
        detailMessage.innerHTML = rootShellUi.renderInlineMessage('Debes indicar una cantidad válida para cotizar.', 'warning');
        return;
      }

      if (!Array.isArray(currentSelectionDraft.selectedSuppliers) || !currentSelectionDraft.selectedSuppliers.length) {
        detailMessage.innerHTML = rootShellUi.renderInlineMessage('Debes seleccionar al menos un proveedor para este producto.', 'warning');
        return;
      }

      selectionByProductId.set(String(currentProduct.id), {
        productId: currentProduct.id,
        quantity: Number(currentSelectionDraft.quantity),
        notes: currentSelectionDraft.notes || '',
        selectedSuppliers: currentSelectionDraft.selectedSuppliers.map((supplier) => ({ ...supplier })),
      });

      closeDetailDialog();
      renderCurrentState();
      pageMessage.innerHTML = rootShellUi.renderInlineMessage('Selección guardada para el producto.', 'success');
    }

    function openConfirmDialog() {
      const summaryItems = helpers.buildSelectionSummary(products, selectionByProductId);
      confirmMessage.innerHTML = '';
      confirmContent.innerHTML = renderers.renderGenerationSummary(summaryItems);
      confirmDialog.showModal();
    }

    async function submitGroupedQuotation() {
      confirmSubmitButton.disabled = true;
      confirmSubmitButton.textContent = 'Generando...';
      confirmMessage.innerHTML = '';
      setShellStatus('Generando cotización agrupada...');

      try {
        const payload = helpers.buildGroupedQuotationPayload(products, selectionByProductId);
        const supplierIds = [...new Set(
          payload.products.flatMap((product) => (product.suppliers || []).map((supplier) => supplier.supplierId)).filter(Boolean)
        )];
        const response = await quotationsApi.requestGroupedQuotations(session, payload);
        const purchaseRequestId = response?.purchaseRequestId || response?.purchaseRequest?.id || response?.id || null;
        selectionByProductId.clear();
        confirmDialog.close();
        renderCurrentState();
        pageMessage.innerHTML = rootShellUi.renderInlineMessage(
          `Solicitud agrupada creada correctamente para ${response?.quotations?.length || payload.products.length} proveedor(es). El siguiente paso es generar invitaciones RFQ.`,
          'success',
        );
        await loadProducts('Actualizando productos cotizables...');
        if (purchaseRequestId && typeof showRfqSection === 'function') {
          showRfqSection(purchaseRequestId, response?.purchaseRequest?.items || response?.items || [], supplierIds);
        }
      } catch (error) {
        confirmMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo generar la solicitud agrupada.', 'error');
        setShellStatus('Error al generar cotización.', 'error');
      } finally {
        confirmSubmitButton.disabled = false;
        confirmSubmitButton.textContent = 'Confirmar generación';
      }
    }

    searchInput.addEventListener('input', () => {
      searchText = searchInput.value;
      renderCurrentState();
    });

    refreshButton.addEventListener('click', () => {
      loadProducts('Actualizando productos cotizables...');
    });

    generateButton.addEventListener('click', () => {
      openConfirmDialog();
    });

    closeDetailButton.addEventListener('click', closeDetailDialog);
    cancelSelectionButton.addEventListener('click', closeDetailDialog);
    saveSelectionButton.addEventListener('click', saveCurrentSelection);
    closeConfirmButton.addEventListener('click', () => confirmDialog.close());
    confirmCancelButton.addEventListener('click', () => confirmDialog.close());
    confirmSubmitButton.addEventListener('click', submitGroupedQuotation);

    // --- RFQ Section ---
    const rfqSectionSummary = container.querySelector('#rfq-section-summary');
    const rfqActiveRequestSummary = container.querySelector('#rfq-active-request-summary');
    const rfqResponseSummary = container.querySelector('#rfq-response-summary');
    const rfqStatusSummary = container.querySelector('#rfq-status-summary');
    const rfqInvitationsMessage = container.querySelector('#rfq-invitations-message');
    const rfqInvitationsRegion = container.querySelector('#rfq-invitations-region');
    const rfqGenerateButton = container.querySelector('#rfq-generate-button');
    const rfqViewResponsesButton = container.querySelector('#rfq-view-responses-button');

    const rfqTrackingSection = container.querySelector('#rfq-tracking-section');
    const rfqTrackingSummary = container.querySelector('#rfq-tracking-summary');
    const rfqTrackingMessage = container.querySelector('#rfq-tracking-message');
    const rfqTrackingRegion = container.querySelector('#rfq-tracking-region');
    const rfqTrackingRefreshButton = container.querySelector('#rfq-tracking-refresh-button');

    // Split-view panels
    const emptyState = container.querySelector('#quotations-empty-state');
    const createPanel = container.querySelector('#quotations-create-panel');
    const requestDetail = container.querySelector('#quotations-request-detail');
    const newRequestButton = container.querySelector('#quotations-new-request-button');
    const newRequestButtonMain = container.querySelector('#quotations-new-request-button-main');
    const backButton = container.querySelector('#quotations-back-button');

    const machoteDialog = container.querySelector('#rfq-machote-dialog');
    const machoteContent = container.querySelector('#rfq-machote-content');
    const machoteMessage = container.querySelector('#rfq-machote-message');
    const machoteTitle = container.querySelector('#rfq-machote-title');
    const machoteCloseButton = container.querySelector('#rfq-machote-close-button');
    const machoteCloseButton2 = container.querySelector('#rfq-machote-close-button-2');
    const machoteCopyAllButton = container.querySelector('#rfq-copy-all-button');

    const manualDialog = container.querySelector('#rfq-manual-response-dialog');
    const manualContent = container.querySelector('#rfq-manual-response-content');
    const manualMessage = container.querySelector('#rfq-manual-response-message');
    const manualTitle = container.querySelector('#rfq-manual-title');
    const manualSubtitle = container.querySelector('#rfq-manual-subtitle');
    const manualCloseButton = container.querySelector('#rfq-manual-close-button');
    const manualCancelButton = container.querySelector('#rfq-manual-cancel-button');
    const manualSubmitButton = container.querySelector('#rfq-manual-submit-button');

    const responseDetailsDialog = container.querySelector('#rfq-response-details-dialog');
    const responseDetailsTitle = container.querySelector('#rfq-response-details-title');
    const responseDetailsContent = container.querySelector('#rfq-response-details-content');
    const responseDetailsCloseButton = container.querySelector('#rfq-response-details-close-button');
    const responseDetailsDismissButton = container.querySelector('#rfq-response-details-dismiss-button');

    // Cotizacion directa (sin invitacion RFQ)
    const directQuotationDialog = container.querySelector('#direct-quotation-dialog');
    const directQuotationContent = container.querySelector('#direct-quotation-content');
    const directQuotationMessage = container.querySelector('#direct-quotation-message');
    const directQuotationSubmitButton = container.querySelector('#direct-quotation-submit-button');
    const directQuotationCancelButton = container.querySelector('#direct-quotation-cancel-button');
    const directQuotationCloseButton = container.querySelector('#direct-quotation-close-button');
    const directQuotationButton = container.querySelector('#rfq-direct-quotation-button');

    const cancelDialog = container.querySelector('#rfq-cancel-dialog');
    const cancelMessage = container.querySelector('#rfq-cancel-message');
    const cancelSupplierName = container.querySelector('#rfq-cancel-supplier-name');
    const cancelCloseButton = container.querySelector('#rfq-cancel-close-button');
    const cancelConfirmButton = container.querySelector('#rfq-cancel-confirm-button');
    const cancelDismissButton = container.querySelector('#rfq-cancel-dismiss-button');

    let currentPurchaseRequestId = null;
    let currentTrackingRequests = [];
    let rfqInvitations = [];
    let currentMachoteData = null;
    let currentManualInvitation = null;
    let currentCancelInvitationId = null;
    let currentPurchaseRequestItems = [];
    let currentRfqSupplierIds = [];
    let cachedSuppliers = null;

    function syncActiveRequestFromTracking() {
      const activeRequest = helpers.findTrackingRequestById(currentTrackingRequests, currentPurchaseRequestId);
      const responseSummary = helpers.buildActiveRequestResponseSummary(activeRequest);

      if (rfqActiveRequestSummary) {
        rfqActiveRequestSummary.innerHTML = renderers.renderActiveRequestSummary(activeRequest);
      }
      if (rfqResponseSummary) {
        rfqResponseSummary.innerHTML = renderers.renderResponseSummary(responseSummary);
      }
      if (rfqViewResponsesButton) {
        rfqViewResponsesButton.hidden = !responseSummary.responseGroups.length;
      }
      if (rfqSectionSummary) {
        rfqSectionSummary.textContent = activeRequest
          ? 'Solicitud activa: continúa con invitaciones y consulta respuestas sin salir del workspace.'
          : 'Aún no has generado una solicitud de cotización.';
      }
    }

    function openResponseDetailsDialog() {
      const activeRequest = helpers.findTrackingRequestById(currentTrackingRequests, currentPurchaseRequestId);
      const responseSummary = helpers.buildActiveRequestResponseSummary(activeRequest);
      if (!responseDetailsDialog || !responseDetailsContent || !responseDetailsTitle) {
        return;
      }
      responseDetailsTitle.textContent = activeRequest?.title || 'Respuestas recibidas';
      responseDetailsContent.innerHTML = renderers.renderResponseDetails(responseSummary.responseGroups);
      responseDetailsDialog.showModal();
    }

    function showPanel(panel) {
      // Show one of: 'empty' | 'create' | 'detail'
      if (emptyState) emptyState.hidden = panel !== 'empty';
      if (createPanel) createPanel.hidden = panel !== 'create';
      if (requestDetail) requestDetail.hidden = panel !== 'detail';
    }

    function setActiveRequestContext(purchaseRequestId, items, supplierIds = []) {
      currentPurchaseRequestId = purchaseRequestId;
      currentPurchaseRequestItems = items || [];
      currentRfqSupplierIds = Array.isArray(supplierIds)
        ? [...new Set(supplierIds.filter(Boolean))]
        : [];
      showPanel('detail');
      // Update the detail panel title from tracking data
      const activeReq = helpers.findTrackingRequestById(currentTrackingRequests, purchaseRequestId);
      const rfqDetailTitle = container.querySelector('#rfq-detail-title');
      if (rfqDetailTitle && activeReq?.title) rfqDetailTitle.textContent = activeReq.title;
      if (rfqGenerateButton) rfqGenerateButton.disabled = !canManage || !currentRfqSupplierIds.length;
      if (directQuotationButton) directQuotationButton.hidden = !canManage;
      syncActiveRequestFromTracking();
      loadRfqInvitations();
      // Re-render sidebar to highlight active item without a full API reload
      if (rfqTrackingRegion && currentTrackingRequests.length) {
        rfqTrackingRegion.innerHTML = renderers.renderOpenRequestsTable(currentTrackingRequests, purchaseRequestId);
        bindTrackingContextButtons();
      }
      // Refresh the inline comparison for this request
      comparison.refreshForRequest(purchaseRequestId);
    }

    function showRfqSection(purchaseRequestId, items, supplierIds = []) {
      setActiveRequestContext(purchaseRequestId, items, supplierIds);
      loadRfqTracking();
    }

    async function loadRfqInvitations() {
      if (!currentPurchaseRequestId || !rfqInvitationsRegion) return;
      rfqInvitationsMessage.innerHTML = '';
      rfqInvitationsRegion.innerHTML = '<p class="empty-state">Cargando invitaciones...</p>';
      try {
        rfqInvitations = await quotationsApi.listRfqInvitations(session, currentPurchaseRequestId);
        const counts = helpers.buildRfqStatusCounts(rfqInvitations);
        const activeRequest = helpers.findTrackingRequestById(currentTrackingRequests, currentPurchaseRequestId);
        rfqStatusSummary.innerHTML = renderers.renderRfqStatusSummary(counts);
        rfqInvitationsRegion.innerHTML = renderers.renderRfqInvitationsTable(rfqInvitations, canManage);
        rfqSectionSummary.textContent = rfqInvitations.length
          ? `${rfqInvitations.length} invitación(es) generadas para la solicitud activa.`
          : 'Esta solicitud todavía no tiene invitaciones RFQ.';
        if (!currentPurchaseRequestItems.length && activeRequest?.items?.length) {
          currentPurchaseRequestItems = activeRequest.items;
        }
        syncActiveRequestFromTracking();
        bindRfqInvitationButtons();
      } catch (error) {
        rfqInvitationsRegion.innerHTML = renderers.renderEmptyState('Error', error.message || 'No se pudieron cargar las invitaciones.');
        rfqInvitationsMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'Error al cargar invitaciones.', 'error');
      }
    }

    async function loadRfqTracking() {
      if (!rfqTrackingRegion) return;
      rfqTrackingMessage.innerHTML = '';
      rfqTrackingRegion.innerHTML = '<p class="empty-state">Cargando solicitudes abiertas...</p>';
      try {
        const tracking = await quotationsApi.getRfqTrackingSummary(session);
        currentTrackingRequests = Array.isArray(tracking) ? tracking : [];
        const trackingMetrics = helpers.buildTrackingMetrics(currentTrackingRequests);
        if (rfqTrackingSection && currentTrackingRequests.length) {
          rfqTrackingSection.hidden = false;
        }
        syncActiveRequestFromTracking();
        rfqTrackingRegion.innerHTML = renderers.renderOpenRequestsTable(currentTrackingRequests, currentPurchaseRequestId);
        rfqTrackingSummary.textContent = `${currentTrackingRequests.length} solicitud(es) abiertas · ${trackingMetrics.requestsWithResponses} con respuestas.`;
        bindTrackingContextButtons();
      } catch (error) {
        currentTrackingRequests = [];
        rfqTrackingRegion.innerHTML = renderers.renderEmptyState('Error', error.message || 'No se pudo cargar el seguimiento.');
        rfqTrackingMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo cargar el estado de las solicitudes abiertas.', 'error');
      }
    }

    function bindTrackingContextButtons() {
      rfqTrackingRegion.querySelectorAll('.quotations-sidebar-item').forEach((button) => {
        button.addEventListener('click', () => {
          const purchaseRequestId = button.getAttribute('data-purchase-request-id');
          const selectedRequest = helpers.findTrackingRequestById(currentTrackingRequests, purchaseRequestId);
          if (!selectedRequest) {
            return;
          }
          const supplierIdsFromInvitations = (selectedRequest.invitations || []).map((inv) => inv.supplierId).filter(Boolean);
          const supplierIdsFromQuotations = (selectedRequest.quotations || []).map((q) => q.supplierId).filter(Boolean);
          const resolvedSupplierIds = supplierIdsFromInvitations.length ? supplierIdsFromInvitations : supplierIdsFromQuotations;
          setActiveRequestContext(selectedRequest.purchaseRequestId, selectedRequest.items || [], resolvedSupplierIds);
          pageMessage.innerHTML = rootShellUi.renderInlineMessage('Solicitud cargada en esta vista para continuar su seguimiento.', 'success');
        });
      });
    }

    function bindRfqInvitationButtons() {
      rfqInvitationsRegion.querySelectorAll('.rfq-copy-machote-button').forEach((btn) => {
        btn.addEventListener('click', () => openMachoteDialog(btn.getAttribute('data-invitation-id')));
      });
      rfqInvitationsRegion.querySelectorAll('.rfq-refresh-button').forEach((btn) => {
        btn.addEventListener('click', () => refreshInvitation(btn.getAttribute('data-invitation-id')));
      });
      rfqInvitationsRegion.querySelectorAll('.rfq-cancel-button').forEach((btn) => {
        btn.addEventListener('click', () => openCancelDialog(btn.getAttribute('data-invitation-id'), btn.getAttribute('data-supplier-name')));
      });
      rfqInvitationsRegion.querySelectorAll('.rfq-manual-response-button').forEach((btn) => {
        btn.addEventListener('click', () => openManualResponseDialog(btn.getAttribute('data-invitation-id'), btn.getAttribute('data-supplier-name')));
      });
    }

    async function handleGenerateRfq() {
      const supplierIds = currentRfqSupplierIds.length
        ? [...currentRfqSupplierIds]
        : [...new Set(
          Array.from(selectionByProductId.values())
            .flatMap((sel) => (sel.selectedSuppliers || []).map((s) => s.supplierId))
            .filter(Boolean)
        )];

      if (!supplierIds.length) {
        rfqInvitationsMessage.innerHTML = rootShellUi.renderInlineMessage('Debes seleccionar al menos un proveedor primero.', 'warning');
        return;
      }

      rfqGenerateButton.disabled = true;
      rfqGenerateButton.textContent = 'Generando...';
      rfqInvitationsMessage.innerHTML = '';

      try {
        const results = await quotationsApi.createRfqInvitations(session, currentPurchaseRequestId, { supplierIds });
        currentMachoteData = Array.isArray(results) && results.length > 0 ? results[0] : null;
        rfqInvitationsMessage.innerHTML = rootShellUi.renderInlineMessage(`Se generaron ${(results || []).length} invitación(es) correctamente.`, 'success');
        await loadRfqInvitations();
        await loadRfqTracking();
        if (currentMachoteData) openMachoteDialogWithData(currentMachoteData);
      } catch (error) {
        rfqInvitationsMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'Error al generar invitaciones.', 'error');
      } finally {
        rfqGenerateButton.disabled = !canManage;
        rfqGenerateButton.textContent = 'Generar invitaciones RFQ';
      }
    }

    function openMachoteDialog(invitationId) {
      const inv = rfqInvitations.find((i) => String(i.id) === String(invitationId));
      if (!inv) return;
      openMachoteDialogWithData({
        emailSubject: inv.emailSubject,
        emailBody: inv.emailBody,
        secureLink: '',
        invitation: inv,
      });
    }

    function openMachoteDialogWithData(data) {
      currentMachoteData = data;
      machoteTitle.textContent = `Machote — ${data.invitation?.supplier?.name || 'Proveedor'}`;
      machoteContent.innerHTML = renderers.renderMachoteDialogContent(data);
      machoteMessage.innerHTML = '';

      const copyLinkBtn = machoteContent.querySelector('#rfq-copy-link-button');
      if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => copyToClipboard(data.secureLink || '', copyLinkBtn, 'Copiar enlace'));
      }

      machoteDialog.showModal();
    }

    function closeMachoteDialog() {
      machoteDialog.close();
      currentMachoteData = null;
    }

    async function copyAllMachote() {
      if (!currentMachoteData) return;
      const text = `${currentMachoteData.emailSubject || ''}\n\n${currentMachoteData.emailBody || ''}`;
      await copyToClipboard(text, machoteCopyAllButton, 'Copiar todo al portapapeles');
    }

    async function copyToClipboard(text, button, originalLabel) {
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = '✓ Copiado';
        setTimeout(() => { button.textContent = originalLabel; }, 2000);
      } catch (_e) {
        button.textContent = 'Error al copiar';
        setTimeout(() => { button.textContent = originalLabel; }, 2000);
      }
    }

    async function refreshInvitation(invitationId) {
      rfqInvitationsMessage.innerHTML = '';
      try {
        const result = await quotationsApi.refreshInvitationTemplate(session, invitationId);
        rfqInvitationsMessage.innerHTML = rootShellUi.renderInlineMessage('Template refrescado correctamente.', 'success');
        await loadRfqInvitations();
        if (result) openMachoteDialogWithData(result);
      } catch (error) {
        rfqInvitationsMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'Error al refrescar template.', 'error');
      }
    }

    function openCancelDialog(invitationId, supplierName) {
      currentCancelInvitationId = invitationId;
      cancelSupplierName.textContent = supplierName || 'este proveedor';
      cancelMessage.innerHTML = '';
      cancelDialog.showModal();
    }

    async function confirmCancelInvitation() {
      if (!currentCancelInvitationId) return;
      cancelConfirmButton.disabled = true;
      cancelConfirmButton.textContent = 'Cancelando...';
      cancelMessage.innerHTML = '';
      try {
        await quotationsApi.cancelRfqInvitation(session, currentCancelInvitationId);
        cancelDialog.close();
        rfqInvitationsMessage.innerHTML = rootShellUi.renderInlineMessage('Invitación cancelada.', 'success');
        await loadRfqInvitations();
        await loadRfqTracking();
      } catch (error) {
        cancelMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'Error al cancelar invitación.', 'error');
      } finally {
        cancelConfirmButton.disabled = false;
        cancelConfirmButton.textContent = 'Confirmar cancelación';
        currentCancelInvitationId = null;
      }
    }

    // ── Cotizacion directa (sin invitacion RFQ) ───────────────────────────

    async function openDirectQuotationDialog() {
      if (!directQuotationDialog) return;
      if (directQuotationMessage) directQuotationMessage.innerHTML = '';
      if (directQuotationContent) directQuotationContent.innerHTML = '<p class="muted">Cargando proveedores...</p>';
      directQuotationDialog.showModal();

      try {
        if (!cachedSuppliers) {
          const result = await quotationsApi.listSuppliers(session);
          cachedSuppliers = Array.isArray(result?.items) ? result.items
            : Array.isArray(result) ? result : [];
        }
        if (directQuotationContent) {
          directQuotationContent.innerHTML = renderers.renderDirectQuotationForm(
            cachedSuppliers,
            currentPurchaseRequestItems,
          );
        }
      } catch (err) {
        if (directQuotationMessage) {
          directQuotationMessage.innerHTML = rootShellUi.renderInlineMessage(
            err?.message || 'No se pudieron cargar los proveedores.', 'error',
          );
        }
        if (directQuotationContent) directQuotationContent.innerHTML = '';
      }
    }

    function closeDirectQuotationDialog() {
      if (directQuotationDialog) directQuotationDialog.close();
    }

    async function submitDirectQuotation() {
      if (!currentPurchaseRequestId) return;
      if (directQuotationMessage) directQuotationMessage.innerHTML = '';

      const supplierId = directQuotationContent?.querySelector('#direct-q-supplier')?.value?.trim();
      const currency   = directQuotationContent?.querySelector('#direct-q-currency')?.value || 'CRC';
      const reference  = directQuotationContent?.querySelector('#direct-q-reference')?.value?.trim() || null;
      const notes      = directQuotationContent?.querySelector('#direct-q-notes')?.value?.trim() || null;

      if (!supplierId) {
        if (directQuotationMessage) {
          directQuotationMessage.innerHTML = rootShellUi.renderInlineMessage('Selecciona un proveedor.', 'warning');
        }
        return;
      }

      const itemRows = directQuotationContent?.querySelectorAll('#direct-q-items-body tr') || [];
      const items = Array.from(itemRows).map((row) => ({
        productId: Number(row.getAttribute('data-product-id')),
        unitPrice: Number(row.querySelector('[name="unitPrice"]')?.value || 0),
        quantity:  Number(row.querySelector('[name="quantity"]')?.value || 0),
        leadTimeDays: row.querySelector('[name="leadTimeDays"]')?.value
          ? Number(row.querySelector('[name="leadTimeDays"]').value) : null,
      })).filter((item) => item.unitPrice > 0 && item.quantity > 0);

      if (!items.length) {
        if (directQuotationMessage) {
          directQuotationMessage.innerHTML = rootShellUi.renderInlineMessage(
            'Ingresa precio unitario y cantidad para al menos un producto.', 'warning',
          );
        }
        return;
      }

      const payload = { supplierId: Number(supplierId), currency, reference, notes, items };

      if (directQuotationSubmitButton) { directQuotationSubmitButton.disabled = true; directQuotationSubmitButton.textContent = 'Registrando...'; }

      try {
        await quotationsApi.createDirectQuotation(session, currentPurchaseRequestId, payload);
        closeDirectQuotationDialog();
        if (pageMessage) {
          pageMessage.innerHTML = rootShellUi.renderInlineMessage(
            'Cotización registrada. La comparación de proveedores se actualizó.',
            'success',
          );
        }
        // Refresca la seccion de comparacion para mostrar la nueva cotizacion directa
        await comparison.refreshForRequest(currentPurchaseRequestId);
        await loadRfqTracking();
      } catch (err) {
        if (directQuotationMessage) {
          directQuotationMessage.innerHTML = rootShellUi.renderInlineMessage(
            err?.message || 'No se pudo registrar la cotización.', 'error',
          );
        }
      } finally {
        if (directQuotationSubmitButton) { directQuotationSubmitButton.disabled = false; directQuotationSubmitButton.textContent = 'Registrar cotización'; }
      }
    }

    // ── Respuesta manual via invitacion RFQ ────────────────────────────────

    function openManualResponseDialog(invitationId, supplierName) {
      currentManualInvitation = rfqInvitations.find((i) => String(i.id) === String(invitationId)) || { id: invitationId, supplierName };
      manualTitle.textContent = `Registrar respuesta — ${supplierName || 'Proveedor'}`;
      manualSubtitle.textContent = 'Captura la cotización recibida por correo.';
      manualMessage.innerHTML = '';
      manualContent.innerHTML = renderers.renderManualResponseFormContent(currentManualInvitation, currentPurchaseRequestItems);
      manualDialog.showModal();
    }

    function closeManualDialog() {
      manualDialog.close();
      currentManualInvitation = null;
    }

    async function submitManualResponseAction() {
      if (!currentManualInvitation) return;
      manualMessage.innerHTML = '';

      const currencySelect = manualContent.querySelector('#rfq-manual-currency');
      const notesTextarea = manualContent.querySelector('#rfq-manual-notes');
      const itemRows = manualContent.querySelectorAll('#rfq-manual-items-body tr');

      const formItems = Array.from(itemRows).map((row) => ({
        productId: row.getAttribute('data-product-id'),
        quantity: Number(row.querySelector('[name="quantity"]')?.value || 0),
        unitPrice: Number(row.querySelector('[name="unitPrice"]')?.value || 0),
        leadTimeDays: row.querySelector('[name="leadTimeDays"]')?.value || null,
      }));

      const formData = {
        currency: currencySelect?.value || 'CRC',
        notes: notesTextarea?.value || null,
        items: formItems,
      };

      const validation = helpers.validateManualResponseForm(formData);
      if (!validation.valid) {
        manualMessage.innerHTML = rootShellUi.renderInlineMessage(validation.errors.join(' '), 'warning');
        return;
      }

      const payload = helpers.buildManualResponsePayload(formData, currentPurchaseRequestItems);
      manualSubmitButton.disabled = true;
      manualSubmitButton.textContent = 'Registrando...';

      try {
        await quotationsApi.submitManualResponse(session, currentManualInvitation.id, payload);
        manualDialog.close();
        rfqInvitationsMessage.innerHTML = rootShellUi.renderInlineMessage('Respuesta manual registrada exitosamente.', 'success');
        await loadRfqInvitations();
        await loadRfqTracking();
      } catch (error) {
        manualMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'Error al registrar respuesta.', 'error');
      } finally {
        manualSubmitButton.disabled = false;
        manualSubmitButton.textContent = 'Registrar respuesta';
        currentManualInvitation = null;
      }
    }

    // RFQ event bindings
    if (rfqGenerateButton) rfqGenerateButton.addEventListener('click', handleGenerateRfq);
    if (rfqViewResponsesButton) rfqViewResponsesButton.addEventListener('click', openResponseDetailsDialog);
    if (machoteCloseButton) machoteCloseButton.addEventListener('click', closeMachoteDialog);
    if (machoteCloseButton2) machoteCloseButton2.addEventListener('click', closeMachoteDialog);
    if (machoteCopyAllButton) machoteCopyAllButton.addEventListener('click', copyAllMachote);
    if (manualCloseButton) manualCloseButton.addEventListener('click', closeManualDialog);
    if (manualCancelButton) manualCancelButton.addEventListener('click', closeManualDialog);
    if (manualSubmitButton) manualSubmitButton.addEventListener('click', submitManualResponseAction);

    // Cotizacion directa
    if (directQuotationButton) directQuotationButton.addEventListener('click', openDirectQuotationDialog);
    if (directQuotationCloseButton) directQuotationCloseButton.addEventListener('click', closeDirectQuotationDialog);
    if (directQuotationCancelButton) directQuotationCancelButton.addEventListener('click', closeDirectQuotationDialog);
    if (directQuotationSubmitButton) directQuotationSubmitButton.addEventListener('click', submitDirectQuotation);
    if (responseDetailsCloseButton) responseDetailsCloseButton.addEventListener('click', () => responseDetailsDialog?.close());
    if (responseDetailsDismissButton) responseDetailsDismissButton.addEventListener('click', () => responseDetailsDialog?.close());
    if (cancelCloseButton) cancelCloseButton.addEventListener('click', () => cancelDialog.close());
    if (cancelDismissButton) cancelDismissButton.addEventListener('click', () => cancelDialog.close());
    if (cancelConfirmButton) cancelConfirmButton.addEventListener('click', confirmCancelInvitation);
    if (rfqTrackingRefreshButton) rfqTrackingRefreshButton.addEventListener('click', loadRfqTracking);

    // Split-view panel navigation
    const showCreate = () => { showPanel('create'); renderCurrentState(); };
    if (newRequestButton) newRequestButton.addEventListener('click', showCreate);
    if (newRequestButtonMain) newRequestButtonMain.addEventListener('click', showCreate);
    if (backButton) backButton.addEventListener('click', () => showPanel('empty'));

    // Hook into the existing grouped quotation success to show the RFQ section
    const originalSubmitGroupedQuotation = submitGroupedQuotation;
    const rfqSubmitGroupedQuotation = async function rfqSubmitGroupedQuotationWrapper() {
      await originalSubmitGroupedQuotation();
    };
    confirmSubmitButton.removeEventListener('click', submitGroupedQuotation);
    confirmSubmitButton.addEventListener('click', rfqSubmitGroupedQuotation);

    renderCurrentState();
    await loadProducts();
    await loadRfqTracking();

    // Montar comparación en el panel inline del detalle (no en el container exterior)
    const comparisonInline = container.querySelector('#quotations-comparison-inline');
    if (comparisonInline) {
      await comparison.mountComparisonSection(
        comparisonInline,
        session,
        null, // loaded on-demand via refreshForRequest when a request is selected
        helpersBag,
      );
    }
  }

  rootShell.register('views.quotationsAdmin', {
    render,
    mount,
  });
}(window));
