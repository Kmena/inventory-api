(function attachRootShellRecipesAdminVersionEditor(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  function createVersionEditor(options) {
    const {
      getProducts,
      getSelectedRecipeVersions,
      getEditingVersionId,
      setEditingVersionId,
      recipesHelpers,
      recipesState,
      rootShellUi,
      setDialogVisibility,
      stagesList,
      versionDialog,
      versionForm,
      versionMessage,
      versionTitle,
    } = options;

    // TASK-006: selector de base de cantidades y su hint contextual.
    const quantityBasisSelect = versionForm.querySelector('#recipes-version-quantity-basis');
    const quantityBasisHint = versionForm.querySelector('#recipes-version-quantity-basis-hint');

    const QB_HINTS = {
      PER_OUTPUT_KG: 'Las cantidades de insumos representan material por 1 kg de producto terminado.',
      PER_FINISHED_UNIT: 'Las cantidades de insumos representan material por 1 unidad terminada (modo legado).',
    };

    function updateQuantityBasisHint() {
      if (!quantityBasisHint || !quantityBasisSelect) return;
      quantityBasisHint.textContent = QB_HINTS[quantityBasisSelect.value] || QB_HINTS.PER_OUTPUT_KG;
    }

    if (quantityBasisSelect) {
      quantityBasisSelect.addEventListener('change', updateQuantityBasisHint);
      updateQuantityBasisHint();
    }

    function renderProductOptions(selectedId) {
      return '<option value="">Selecciona producto</option>'
        + getProducts().map((product) => {
          const selected = String(product.id) === String(selectedId) ? ' selected' : '';
          const label = rootShellUi.escapeHtml(`${product.name || 'Producto'}${product.code ? ` · ${product.code}` : ''}`);
          return `<option value="${rootShellUi.escapeHtml(String(product.id))}"${selected}>${label}</option>`;
        }).join('');
    }

    function resolveProductUnit(productId) {
      if (!productId) {
        return null;
      }
      const found = getProducts().find((product) => String(product.id) === String(productId));
      return found?.unit || null;
    }

    // recipe-stage-lineage-validation: balance engine for the editor.
    // Walks all stage sections before `upToSection` and builds a cumulative map
    // of { productId → { recollected, used } } so PROCESSING stage inputs can be
    // filtered to only products with remaining availability.
    // Descriptive inputs without productId are ignored (BR-009).
    function computeRecollectedBalances(upToSection) {
      const balance = new Map(); // productId string → { recollected, used }
      const sections = Array.from(stagesList.querySelectorAll('.stage-section'));
      for (const section of sections) {
        if (section === upToSection) break;
        const sectionTypeEl = section.querySelector('.stage-type');
        const sectionType = sectionTypeEl ? sectionTypeEl.value : 'PROCESSING';
        for (const row of section.querySelectorAll('.stage-input-row')) {
          const productId = row.querySelector('.si-product')?.value;
          const qty = parseFloat(row.querySelector('.si-quantity')?.value || '0') || 0;
          if (!productId || !qty) continue;
          if (sectionType === 'RECOLLECTION') {
            const entry = balance.get(productId) || { recollected: 0, used: 0 };
            entry.recollected += qty;
            balance.set(productId, entry);
          } else if (sectionType === 'PROCESSING') {
            const entry = balance.get(productId);
            if (entry) entry.used += qty;
          }
        }
      }
      return balance;
    }

    // Renders <option> elements for a PROCESSING stage's product selector.
    // Only products present in recollectedBalances are shown.
    // Options with remaining = 0 are visible but disabled (per UX guidance).
    // Includes "disponible: X" in option text so users see availability at a glance.
    function renderProcessingProductOptions(recollectedBalances, selectedId) {
      let html = '<option value="">Selecciona material recolectado</option>';
      for (const [productId, entry] of recollectedBalances) {
        const product = getProducts().find((p) => String(p.id) === productId);
        if (!product) continue;
        const remaining = entry.recollected - entry.used;
        const selected = productId === String(selectedId) ? ' selected' : '';
        const disabled = remaining <= 0 ? ' disabled' : '';
        const label = rootShellUi.escapeHtml(
          `${product.name || 'Producto'}${product.code ? ` · ${product.code}` : ''} (disponible: ${remaining})`
        );
        html += `<option value="${rootShellUi.escapeHtml(productId)}"${selected}${disabled}>${label}</option>`;
      }
      return html;
    }

    // recipe-stage-lineage-validation: addStageInputRow auto-detects PROCESSING mode.
    // When the parent section is a PROCESSING stage, uses renderProcessingProductOptions
    // (filtered to prior-recollected products with "disponible: X" labels) instead of
    // the full catalog. Descriptive inputs without a productId remain allowed (BR-009).
    function addStageInputRow(inputsContainer, data = {}) {
      const row = globalScope.document.createElement('div');
      row.className = 'products-form-grid stage-input-row';
      row.style.alignItems = 'end';

      const existingUnit = data.unit || '';
      const productUnit = resolveProductUnit(data.productId);
      const effectiveUnit = productUnit || existingUnit;
      const unitReadonly = Boolean(data.productId && productUnit);

      // Detect PROCESSING mode: compute recollectedBalances from prior stages.
      const parentSection = inputsContainer.closest ? inputsContainer.closest('.stage-section') : null;
      const parentType = parentSection ? parentSection.querySelector('.stage-type')?.value : null;
      const recollectedBalances = (parentType === 'PROCESSING')
        ? computeRecollectedBalances(parentSection)
        : null;
      const isProcessingMode = recollectedBalances !== null && recollectedBalances.size > 0;

      const productOptionsHtml = isProcessingMode
        ? renderProcessingProductOptions(recollectedBalances, data.productId)
        : renderProductOptions(data.productId);

      row.innerHTML = `
        <label>
          <span>Producto</span>
          <select class="si-product">${productOptionsHtml}</select>
          ${isProcessingMode ? '<small class="muted si-avail-hint" style="display:block;font-size:0.78rem;margin-top:2px;"></small>' : ''}
        </label>
        <label><span>Nombre *</span><input class="si-name" type="text" value="${rootShellUi.escapeHtml(data.name || '')}" required /></label>
        <label><span>Cantidad</span><input class="si-quantity" type="number" min="0" step="0.001" value="${data.quantity || ''}" /></label>
        <label><span>Unidad</span><input class="si-unit" type="text" value="${rootShellUi.escapeHtml(effectiveUnit)}" placeholder="kg, L, unidad" ${unitReadonly ? 'readonly aria-readonly="true" title="Unidad heredada del producto"' : ''} /></label>
        <button type="button" class="secondary-button remove-stage-input-btn" title="Quitar insumo">✕</button>
      `;

      const productSelect = row.querySelector('.si-product');
      const unitInput = row.querySelector('.si-unit');
      const availHint = row.querySelector('.si-avail-hint');

      // Recomputes the availability hint live from current form state so it stays
      // accurate even when the user modifies prior stage quantities after row creation.
      function updateAvailHint() {
        if (!availHint || !parentSection) return;
        const liveBalances = computeRecollectedBalances(parentSection);
        const entry = liveBalances.get(String(productSelect.value));
        const remaining = entry ? entry.recollected - entry.used : null;
        availHint.textContent = remaining !== null ? `Disponible: ${remaining}` : '';
      }

      productSelect.addEventListener('change', () => {
        const selectedProduct = getProducts().find((product) => String(product.id) === String(productSelect.value));
        const unitPatch = recipesHelpers.buildStageInputPatchFromProduct(selectedProduct);
        unitInput.value = unitPatch.unit;
        unitInput.readOnly = Boolean(unitPatch.unitReadonly);
        if (unitPatch.unitReadonly) {
          unitInput.setAttribute('aria-readonly', 'true');
          unitInput.title = 'Unidad heredada del producto';
        } else {
          unitInput.removeAttribute('aria-readonly');
          unitInput.title = '';
        }
        updateAvailHint();
      });

      // Initialize hint if product is already selected (e.g., editing an existing version)
      if (data.productId) updateAvailHint();

      inputsContainer.appendChild(row);

      // AUD-026: wire prior RECOLLECTION stage quantity inputs so the hint refreshes
      // when the user edits quantities — not just when they change the product selector.
      if (isProcessingMode && parentSection) {
        const allSections = Array.from(stagesList.querySelectorAll('.stage-section'));
        for (const section of allSections) {
          if (section === parentSection) break;
          if (section.querySelector('.stage-type')?.value !== 'RECOLLECTION') continue;
          section.querySelectorAll('.si-quantity').forEach((qtyInput) => {
            if (qtyInput.dataset.hintWired) return;
            qtyInput.dataset.hintWired = '1';
            qtyInput.addEventListener('input', updateAvailHint);
          });
        }
      }
    }

    function addQaParameterRow(qaContainer, parameter = {}) {
      const row = globalScope.document.createElement('div');
      row.className = 'products-form-grid qa-param-row';
      row.style.alignItems = 'end';
      row.innerHTML = `
        <label><span>Nombre *</span><input class="qp-name" type="text" value="${rootShellUi.escapeHtml(parameter.name || '')}" required placeholder="pH, Temperatura" /></label>
        <label><span>Unidad</span><input class="qp-unit" type="text" value="${rootShellUi.escapeHtml(parameter.unit || '')}" placeholder="pH, ºC, %" maxlength="40" /></label>
        <label><span>Valor esperado *</span><input class="qp-expected" type="number" step="any" value="${parameter.expectedValue !== undefined ? parameter.expectedValue : ''}" required /></label>
        <label><span>Tol. min (−) <small class="muted">delta debajo del esperado</small></span><input class="qp-min-tol" type="number" step="any" min="0" value="${parameter.minTolerance !== undefined ? parameter.minTolerance : '0'}" /></label>
        <label><span>Tol. max (+) <small class="muted">delta encima del esperado</small></span><input class="qp-max-tol" type="number" step="any" min="0" value="${parameter.maxTolerance !== undefined ? parameter.maxTolerance : '0'}" /></label>
        <button type="button" class="secondary-button remove-qa-param-btn" title="Quitar parametro QA">✕</button>
        <small class="qp-range-preview muted" style="grid-column:1/-1"></small>
      `;
      row.querySelector('.remove-qa-param-btn').addEventListener('click', () => {
        row.remove();
      });

      // Live range preview so user sees resulting bounds as they type
      const expectedInput = row.querySelector('.qp-expected');
      const minTolInput   = row.querySelector('.qp-min-tol');
      const maxTolInput   = row.querySelector('.qp-max-tol');
      const unitInput     = row.querySelector('.qp-unit');
      const rangePreview  = row.querySelector('.qp-range-preview');
      function updateRangePreview() {
        const exp = Number(expectedInput.value);
        const min = Number(minTolInput.value || 0);
        const max = Number(maxTolInput.value || 0);
        const unit = unitInput.value.trim();
        if (!Number.isFinite(exp) || expectedInput.value === '') {
          rangePreview.textContent = '';
          return;
        }
        rangePreview.textContent = `Rango valido: ${exp - min} – ${exp + max}${unit ? ' ' + unit : ''}`;
      }
      [expectedInput, minTolInput, maxTolInput, unitInput].forEach((el) => {
        el?.addEventListener('input', updateRangePreview);
      });
      updateRangePreview();

      qaContainer.appendChild(row);
    }

    // TASK-001 (qa-rejection-material-reconciliation-amendment): processCode catalog
    // Catalog must stay in sync with RECIPE_STAGE_PROCESS_CODES in src/schemas/recipe.schema.js.
    const PROCESS_CODE_OPTIONS = [
      { value: 'MIXING',        label: 'Mezclado' },
      { value: 'HEATING',       label: 'Calentamiento' },
      { value: 'COOLING',       label: 'Enfriamiento' },
      { value: 'CAPPING',       label: 'Tapado' },
      { value: 'SEALING',       label: 'Sellado' },
      { value: 'LABELING_PREP', label: 'Prep. etiquetado' },
      { value: 'PACKING_PREP',  label: 'Prep. empaque' },
      { value: 'OTHER',         label: 'Otro (describe abajo)' },
    ];

    function addStageSection(data = {}) {
      const section = globalScope.document.createElement('div');
      section.className = 'stage-section';
      section.style.cssText = 'border:1px solid var(--border, #ddd); border-radius:8px; padding:1rem; margin-bottom:0.75rem;';
      const qaMandatory = Boolean(data.qaMandatory);
      const stageType = data.stageType || 'PROCESSING';
      const processCode = data.processCode || '';
      const processLabel = data.processLabel || '';

      const processCodeOptionsHtml = PROCESS_CODE_OPTIONS
        .map((opt) => `<option value="${rootShellUi.escapeHtml(opt.value)}"${processCode === opt.value ? ' selected' : ''}>${rootShellUi.escapeHtml(opt.label)}</option>`)
        .join('');

      section.innerHTML = `
        <div class="products-form-grid">
          <label><span>Nombre de etapa *</span><input class="stage-name" type="text" required value="${rootShellUi.escapeHtml(data.name || '')}" /></label>
          <label class="products-checkbox-label"><input class="stage-qa" type="checkbox" ${qaMandatory ? 'checked' : ''} /><span>QA obligatorio</span></label>
          <label class="products-field-full"><span>Instrucciones</span><textarea class="stage-instructions" rows="2">${rootShellUi.escapeHtml(data.instructions || '')}</textarea></label>
        </div>
        <div class="products-form-grid" style="margin-top:0.5rem">
          <label>
            <span>Tipo de etapa</span>
            <select class="stage-type">
              <option value="RECOLLECTION"${stageType === 'RECOLLECTION' ? ' selected' : ''}>Recoleccion</option>
              <option value="PROCESSING"${stageType !== 'RECOLLECTION' ? ' selected' : ''}>Procesamiento</option>
            </select>
          </label>
          <div class="stage-process-code-block"${stageType === 'RECOLLECTION' ? ' style="display:none"' : ''}>
            <label>
              <span>Codigo de proceso *</span>
              <select class="stage-process-code">
                <option value="">Selecciona codigo</option>
                ${processCodeOptionsHtml}
              </select>
            </label>
          </div>
          <div class="stage-process-label-block"${processCode === 'OTHER' ? '' : ' style="display:none"'}>
            <label>
              <span>Descripcion del proceso *</span>
              <input class="stage-process-label" type="text" maxlength="200"
                     value="${rootShellUi.escapeHtml(processLabel)}"
                     placeholder="Describe el proceso no catalogado..." />
            </label>
          </div>
        </div>
        <div class="stage-qa-params" style="margin-top:0.75rem;${qaMandatory ? '' : 'display:none'}">
          <p class="muted" style="margin:0 0 0.5rem"><strong>Parametros QA esperados</strong></p>
          <div class="qa-params-list stack-section"></div>
          <p class="qa-params-empty-msg" style="color:var(--color-danger,#c00);font-size:0.85rem;display:none">Debes definir al menos un parametro esperado.</p>
          <button type="button" class="secondary-button add-qa-param-btn" style="margin-top:0.25rem">+ Añadir parametro</button>
        </div>
        <div style="margin-top:0.75rem">
          <p class="muted" style="margin:0 0 0.5rem"><strong>Insumos de esta etapa</strong></p>
          <div class="stage-inputs-list stack-section"></div>
          <button type="button" class="secondary-button add-stage-input-btn" style="margin-top:0.25rem">+ Agregar insumo</button>
        </div>
        <button type="button" class="secondary-button remove-stage-btn" style="margin-top:0.5rem">Quitar etapa</button>
      `;
      stagesList.appendChild(section);

      const qaCheckbox = section.querySelector('.stage-qa');
      const qaParamsBlock = section.querySelector('.stage-qa-params');
      const qaParamsList = section.querySelector('.qa-params-list');
      const qaEmptyMessage = section.querySelector('.qa-params-empty-msg');
      const addQaButton = section.querySelector('.add-qa-param-btn');

      qaCheckbox.addEventListener('change', () => {
        qaParamsBlock.style.display = qaCheckbox.checked ? '' : 'none';
      });

      // TASK-001 (qa-rejection-material-reconciliation-amendment): stageType + processCode wiring
      const stageTypeSelect = section.querySelector('.stage-type');
      const processCodeBlock = section.querySelector('.stage-process-code-block');
      const processCodeSelect = section.querySelector('.stage-process-code');
      const processLabelBlock = section.querySelector('.stage-process-label-block');

      // recipe-stage-lineage-validation: add-input button visibility for PROCESSING stages.
      // Computes prior recollected balance and conditionally shows the button and an
      // informative note when no materials are available.
      const addInputBtn = section.querySelector('.add-stage-input-btn');

      function applyStageTypeAccent() {
        const currentType = stageTypeSelect ? stageTypeSelect.value : 'PROCESSING';
        if (currentType === 'PROCESSING') {
          section.style.borderLeft = '3px solid var(--primary, #1f6feb)';
          section.style.borderTop = '1px solid var(--border, #ddd)';
          section.style.borderRight = '1px solid var(--border, #ddd)';
          section.style.borderBottom = '1px solid var(--border, #ddd)';
        } else {
          section.style.border = '1px solid var(--border, #ddd)';
        }
      }

      function refreshInputsAreaVisibility() {
        const currentType = stageTypeSelect ? stageTypeSelect.value : 'PROCESSING';
        if (currentType !== 'PROCESSING') {
          addInputBtn.style.display = '';
          addInputBtn.textContent = '+ Agregar insumo';
          const existingNote = section.querySelector('.no-recollected-note');
          if (existingNote) existingNote.remove();
          return;
        }
        const recollectedBalances = computeRecollectedBalances(section);
        if (recollectedBalances.size === 0) {
          addInputBtn.style.display = 'none';
          if (!section.querySelector('.no-recollected-note')) {
            const note = globalScope.document.createElement('p');
            note.className = 'muted no-recollected-note';
            note.style.cssText = 'font-size:0.85rem;margin:0.25rem 0 0;font-style:italic;';
            note.textContent = 'Sin materiales recolectados disponibles para esta etapa.';
            section.querySelector('.stage-inputs-list').after(note);
          }
        } else {
          addInputBtn.style.display = '';
          addInputBtn.textContent = '+ Agregar material recolectado';
          const existingNote = section.querySelector('.no-recollected-note');
          if (existingNote) existingNote.remove();
        }
      }

      if (stageTypeSelect) {
        stageTypeSelect.addEventListener('change', () => {
          const isProcessing = stageTypeSelect.value === 'PROCESSING';
          if (processCodeBlock) { processCodeBlock.style.display = isProcessing ? '' : 'none'; }
          if (processLabelBlock) { processLabelBlock.style.display = 'none'; }
          applyStageTypeAccent();
          refreshInputsAreaVisibility();
        });
      }

      if (processCodeSelect) {
        processCodeSelect.addEventListener('change', () => {
          const isOther = processCodeSelect.value === 'OTHER';
          if (processLabelBlock) { processLabelBlock.style.display = isOther ? '' : 'none'; }
        });
      }

      addQaButton.addEventListener('click', () => {
        addQaParameterRow(qaParamsList, recipesHelpers.buildDefaultQaParameter());
        if (qaEmptyMessage) {
          qaEmptyMessage.style.display = 'none';
        }
      });

      (data.expectedParameters || []).forEach((parameter) => addQaParameterRow(qaParamsList, parameter));

      const inputsContainer = section.querySelector('.stage-inputs-list');
      (data.stageInputs || []).forEach((stageInput) => addStageInputRow(inputsContainer, stageInput));

      // Apply initial visual state
      applyStageTypeAccent();
      refreshInputsAreaVisibility();
    }

    function collectQaParams(section) {
      return Array.from(section.querySelectorAll('.qa-param-row')).map((row) => ({
        name: row.querySelector('.qp-name').value.trim(),
        unit: row.querySelector('.qp-unit').value.trim() || undefined,
        expectedValue: Number(row.querySelector('.qp-expected').value),
        minTolerance: Number(row.querySelector('.qp-min-tol').value || '0'),
        maxTolerance: Number(row.querySelector('.qp-max-tol').value || '0'),
      })).filter((parameter) => parameter.name);
    }

    function validateQaParamsInline(section) {
      const qaMandatory = section.querySelector('.stage-qa')?.checked;
      if (!qaMandatory) {
        return true;
      }

      const parameters = collectQaParams(section);
      const emptyMessage = section.querySelector('.qa-params-empty-msg');
      if (parameters.length === 0) {
        if (emptyMessage) {
          emptyMessage.style.display = '';
        }
        return false;
      }

      if (emptyMessage) {
        emptyMessage.style.display = 'none';
      }
      return true;
    }

    function collectStages() {
      return Array.from(stagesList.querySelectorAll('.stage-section')).map((section) => {
        const inputRows = section.querySelectorAll('.stage-input-row');
        const qaMandatory = section.querySelector('.stage-qa').checked;
        const stageTypeEl = section.querySelector('.stage-type');
        const processCodeEl = section.querySelector('.stage-process-code');
        const processLabelEl = section.querySelector('.stage-process-label');
        const stageType = stageTypeEl ? stageTypeEl.value : 'PROCESSING';
        const processCode = (stageType === 'PROCESSING' && processCodeEl) ? processCodeEl.value.trim() : null;
        const processLabel = (processCode === 'OTHER' && processLabelEl) ? processLabelEl.value.trim() : null;
        return {
          name: section.querySelector('.stage-name').value.trim(),
          instructions: section.querySelector('.stage-instructions').value.trim() || undefined,
          qaMandatory,
          expectedParameters: qaMandatory ? collectQaParams(section) : [],
          // TASK-001: stage typing and processCode
          stageType: stageType || 'PROCESSING',
          processCode: processCode || undefined,
          processLabel: processLabel || undefined,
          stageInputs: Array.from(inputRows).map((row) => ({
            productId: Number(row.querySelector('.si-product').value) || undefined,
            name: row.querySelector('.si-name').value.trim(),
            quantity: Number(row.querySelector('.si-quantity').value) || undefined,
            unit: row.querySelector('.si-unit').value.trim() || undefined,
          })).filter((stageInput) => stageInput.name),
        };
      }).filter((stage) => stage.name);
    }

    function resetVersionForm() {
      versionForm.reset();
      versionTitle.textContent = getEditingVersionId() ? 'Editar version borrador' : 'Nueva version borrador';
      versionMessage.innerHTML = '';
      stagesList.innerHTML = '';
      // TASK-006: el form.reset() devuelve quantityBasis a su primer option (PER_OUTPUT_KG).
      // Actualizar el hint para que refleje el valor reseteado.
      updateQuantityBasisHint();
    }

    function openCreateVersionDialog() {
      setEditingVersionId(null);
      resetVersionForm();
      addStageSection({ name: '', stageInputs: [] });
      setDialogVisibility(versionDialog, true);
    }

    function openEditVersionDialog(versionId) {
      const version = getSelectedRecipeVersions().find((entry) => String(entry?.id) === String(versionId));
      if (!version) {
        return;
      }

      setEditingVersionId(version.id);
      resetVersionForm();
      versionTitle.textContent = 'Editar version borrador';
      versionForm.elements.namedItem('effectiveFrom').value = version.effectiveFrom ? String(version.effectiveFrom).slice(0, 10) : '';
      versionForm.elements.namedItem('effectiveTo').value = version.effectiveTo ? String(version.effectiveTo).slice(0, 10) : '';
      versionForm.elements.namedItem('expectedYield').value = version.expectedYield ?? '';
      versionForm.elements.namedItem('expectedWaste').value = version.expectedWaste ?? '';
      versionForm.elements.namedItem('yieldTolerancePercent').value = version.yieldTolerancePercent ?? '';
      versionForm.elements.namedItem('wasteTolerancePercent').value = version.wasteTolerancePercent ?? '';
      versionForm.elements.namedItem('instructions').value = version.instructions || '';
      versionForm.elements.namedItem('notes').value = version.notes || '';
      // TASK-006: restaurar quantityBasis al editar una versión existente.
      const qbEl = versionForm.elements.namedItem('quantityBasis');
      if (qbEl) qbEl.value = version.quantityBasis || 'PER_OUTPUT_KG';
      updateQuantityBasisHint();

      (version.stages || []).forEach((stage) => addStageSection({
        name: stage.name,
        instructions: stage.instructions,
        qaMandatory: Boolean(stage.qaMandatory),
        expectedParameters: Array.isArray(stage.expectedParameters) ? stage.expectedParameters : [],
        // TASK-001 (qa-rejection-material-reconciliation-amendment)
        stageType: stage.stageType || 'PROCESSING',
        processCode: stage.processCode || '',
        processLabel: stage.processLabel || '',
        stageInputs: (stage.stageInputs || []).map((stageInput) => ({
          productId: stageInput.productId,
          name: stageInput.name,
          quantity: stageInput.quantity,
          unit: stageInput.unit,
        })),
      }));

      if (!version.stages?.length) {
        addStageSection({ name: '', stageInputs: [] });
      }

      setDialogVisibility(versionDialog, true);
    }

    function buildVersionPayload(formData, parseOptionalDate, parseOptionalNumber) {
      const stages = collectStages();
      if (!stages.length) {
        throw new Error('Agrega al menos una etapa.');
      }

      let qaValid = true;
      stagesList.querySelectorAll('.stage-section').forEach((section) => {
        if (!validateQaParamsInline(section)) {
          qaValid = false;
        }
      });

      if (!qaValid) {
        throw new Error('Una etapa con QA obligatorio requiere al menos un parametro esperado.');
      }

      const rawValues = {
        effectiveFrom: parseOptionalDate(formData.get('effectiveFrom')),
        effectiveTo: parseOptionalDate(formData.get('effectiveTo')),
        expectedYield: parseOptionalNumber(formData.get('expectedYield')),
        expectedWaste: parseOptionalNumber(formData.get('expectedWaste')),
        yieldTolerancePercent: parseOptionalNumber(formData.get('yieldTolerancePercent')),
        wasteTolerancePercent: parseOptionalNumber(formData.get('wasteTolerancePercent')),
        instructions: String(formData.get('instructions') || '').trim() || undefined,
        notes: String(formData.get('notes') || '').trim() || undefined,
        // TASK-006: base de cantidades de insumos.
        quantityBasis: String(formData.get('quantityBasis') || 'PER_OUTPUT_KG'),
        stages,
      };

      return recipesState.serializeVersionPayloadFromForm(rawValues);
    }

    return {
      addStageInputRow,
      addStageSection,
      buildVersionPayload,
      openCreateVersionDialog,
      openEditVersionDialog,
      resetVersionForm,
    };
  }

  rootShell.register('views.recipesAdminVersionEditor', {
    createVersionEditor,
  });
}(window));
