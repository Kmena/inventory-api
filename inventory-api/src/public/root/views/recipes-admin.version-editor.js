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

    function addStageInputRow(inputsContainer, data = {}) {
      const row = globalScope.document.createElement('div');
      row.className = 'products-form-grid stage-input-row';
      row.style.alignItems = 'end';

      const existingUnit = data.unit || '';
      const productUnit = resolveProductUnit(data.productId);
      const effectiveUnit = productUnit || existingUnit;
      const unitReadonly = Boolean(data.productId && productUnit);

      row.innerHTML = `
        <label><span>Producto</span><select class="si-product">${renderProductOptions(data.productId)}</select></label>
        <label><span>Nombre *</span><input class="si-name" type="text" value="${rootShellUi.escapeHtml(data.name || '')}" required /></label>
        <label><span>Cantidad</span><input class="si-quantity" type="number" min="0" step="0.001" value="${data.quantity || ''}" /></label>
        <label><span>Unidad</span><input class="si-unit" type="text" value="${rootShellUi.escapeHtml(effectiveUnit)}" placeholder="kg, L, unidad" ${unitReadonly ? 'readonly aria-readonly="true" title="Unidad heredada del producto"' : ''} /></label>
        <button type="button" class="secondary-button remove-stage-input-btn" title="Quitar insumo">✕</button>
      `;

      const productSelect = row.querySelector('.si-product');
      const unitInput = row.querySelector('.si-unit');
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
      });

      inputsContainer.appendChild(row);
    }

    function addQaParameterRow(qaContainer, parameter = {}) {
      const row = globalScope.document.createElement('div');
      row.className = 'products-form-grid qa-param-row';
      row.style.alignItems = 'end';
      row.innerHTML = `
        <label><span>Nombre *</span><input class="qp-name" type="text" value="${rootShellUi.escapeHtml(parameter.name || '')}" required placeholder="pH, Temperatura" /></label>
        <label><span>Unidad</span><input class="qp-unit" type="text" value="${rootShellUi.escapeHtml(parameter.unit || '')}" placeholder="pH, ºC, %" maxlength="40" /></label>
        <label><span>Valor esperado *</span><input class="qp-expected" type="number" step="any" value="${parameter.expectedValue !== undefined ? parameter.expectedValue : ''}" required /></label>
        <label><span>Tol. min (−)</span><input class="qp-min-tol" type="number" step="any" min="0" value="${parameter.minTolerance !== undefined ? parameter.minTolerance : '0'}" /></label>
        <label><span>Tol. max (+)</span><input class="qp-max-tol" type="number" step="any" min="0" value="${parameter.maxTolerance !== undefined ? parameter.maxTolerance : '0'}" /></label>
        <button type="button" class="secondary-button remove-qa-param-btn" title="Quitar parametro QA">✕</button>
      `;
      row.querySelector('.remove-qa-param-btn').addEventListener('click', () => {
        row.remove();
      });
      qaContainer.appendChild(row);
    }

    function addStageSection(data = {}) {
      const section = globalScope.document.createElement('div');
      section.className = 'stage-section';
      section.style.cssText = 'border:1px solid var(--border, #ddd); border-radius:8px; padding:1rem; margin-bottom:0.75rem;';
      const qaMandatory = Boolean(data.qaMandatory);
      section.innerHTML = `
        <div class="products-form-grid">
          <label><span>Nombre de etapa *</span><input class="stage-name" type="text" required value="${rootShellUi.escapeHtml(data.name || '')}" /></label>
          <label class="products-checkbox-label"><input class="stage-qa" type="checkbox" ${qaMandatory ? 'checked' : ''} /><span>QA obligatorio</span></label>
          <label class="products-field-full"><span>Instrucciones</span><textarea class="stage-instructions" rows="2">${rootShellUi.escapeHtml(data.instructions || '')}</textarea></label>
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

      addQaButton.addEventListener('click', () => {
        addQaParameterRow(qaParamsList, recipesHelpers.buildDefaultQaParameter());
        if (qaEmptyMessage) {
          qaEmptyMessage.style.display = 'none';
        }
      });

      (data.expectedParameters || []).forEach((parameter) => addQaParameterRow(qaParamsList, parameter));

      const inputsContainer = section.querySelector('.stage-inputs-list');
      (data.stageInputs || []).forEach((stageInput) => addStageInputRow(inputsContainer, stageInput));
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
        return {
          name: section.querySelector('.stage-name').value.trim(),
          instructions: section.querySelector('.stage-instructions').value.trim() || undefined,
          qaMandatory,
          expectedParameters: qaMandatory ? collectQaParams(section) : [],
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

      (version.stages || []).forEach((stage) => addStageSection({
        name: stage.name,
        instructions: stage.instructions,
        qaMandatory: Boolean(stage.qaMandatory),
        expectedParameters: Array.isArray(stage.expectedParameters) ? stage.expectedParameters : [],
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
