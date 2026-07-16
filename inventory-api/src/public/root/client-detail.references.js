(function attachRootClientDetailReferences(globalScope) {
  const shared = globalScope.RootClientDetailShared;
  const {
    text,
    money,
    optional,
    optionalNumber,
    authHeaders,
  } = shared;

  function renderReferences(panel, client, dependencies) {
    const references = client.references || [];
    panel.innerHTML = `
      <section class="import-panel">
        <div>
          <h2>Referencias</h2>
          <p class="muted">Las referencias comerciales se gestionan como datos estructurados del cliente.</p>
        </div>
        <form id="client-detail-reference-form" class="pricing-grid">
          <label class="field">
            <span>Nombre referencia</span>
            <input name="name" type="text" placeholder="Empresa o persona" />
          </label>
          <label class="field">
            <span>Contacto</span>
            <input name="contact" type="text" placeholder="Nombre del contacto" />
          </label>
          <label class="field">
            <span>Telefono principal</span>
            <input name="phone1" type="text" />
          </label>
          <label class="field">
            <span>Telefono secundario</span>
            <input name="phone2" type="text" />
          </label>
          <label class="field">
            <span>Plazo (dias)</span>
            <input name="termDays" type="number" min="0" step="1" />
          </label>
          <label class="field">
            <span>Monto</span>
            <input name="amount" type="number" min="0" step="0.01" />
          </label>
          <label class="field">
            <span>Aprobado por</span>
            <input name="approvedBy" type="text" placeholder="Nombre de validacion" />
          </label>
          <label class="field checkbox-field">
            <span>Referencia aprobada</span>
            <input name="approved" type="checkbox" />
          </label>
        </form>
        <div class="import-actions">
          <button id="save-client-reference-button" type="submit" form="client-detail-reference-form">Agregar referencia</button>
        </div>
        <div class="role-list">
          ${references.length ? references.map((reference) => `
            <article class="role-card">
              <div>
                <h3>${reference.name}</h3>
                <p class="muted">${text(reference.contact)} / ${text(reference.phone1)}</p>
                <p class="muted">${reference.termDays ? `${reference.termDays} dia(s)` : 'Sin plazo'}${reference.amount !== null && reference.amount !== undefined ? ` / ${money(reference.amount)}` : ''}</p>
              </div>
              <div class="import-actions">
                <span>${reference.approved ? 'Aprobada' : 'Pendiente'}</span>
                <span>${reference.approvedBy || 'Sin validador'}</span>
              </div>
            </article>
          `).join('') : '<p class="muted">Sin referencias registradas.</p>'}
        </div>
      </section>
    `;

    const form = document.getElementById('client-detail-reference-form');
    const submitButton = document.getElementById('save-client-reference-button');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      dependencies.setMessage('');

      const data = new FormData(form);
      const name = data.get('name').toString().trim();
      if (!name) {
        dependencies.setMessage('Ingrese el nombre de la referencia', true);
        form.elements.name.focus();
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'Guardando...';

      try {
        const response = await fetch(`/api/clients/${client.id}/references`, {
          method: 'POST',
          headers: authHeaders(dependencies.session),
          body: JSON.stringify({
            name,
            contact: optional(data.get('contact')),
            phone1: optional(data.get('phone1')),
            phone2: optional(data.get('phone2')),
            termDays: optionalNumber(data.get('termDays')),
            amount: optionalNumber(data.get('amount')),
            approved: data.get('approved') === 'on',
            approvedBy: optional(data.get('approvedBy')),
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || 'No se pudo guardar la referencia');
        }

        dependencies.setMessage('Referencia agregada correctamente.');
        await dependencies.reloadClient();
      } catch (error) {
        dependencies.setMessage(error.message || 'No se pudo guardar la referencia', true);
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Agregar referencia';
      }
    });
  }

  globalScope.RootClientDetailReferences = {
    renderReferences,
  };
}(window));
