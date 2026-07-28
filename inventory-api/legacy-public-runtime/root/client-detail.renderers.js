(function attachRootClientDetailRenderers(globalScope) {
  const shared = globalScope.RootClientDetailShared;
  const {
    text,
    money,
    dateText,
    detailItem,
    paymentTypeText,
    documentTypeText,
  } = shared;

  function renderSummary(elements, client) {
    const creditEnabled = client.paymentType === 'CREDIT' || Number(client.creditLimit || 0) > 0 || Number(client.creditBalance || 0) > 0;

    elements.clientTitle.textContent = client.name;
    elements.summary.innerHTML = `
      <article class="dashboard-tile">
        <span>Clasificacion</span>
        <strong>${text(client.classification?.name)}</strong>
      </article>
      <article class="dashboard-tile">
        <span>Codigo</span>
        <strong>${text(client.code)}</strong>
      </article>
      <article class="dashboard-tile">
        <span>Tiendas</span>
        <strong>${client.stores?.length || 0}</strong>
      </article>
      <article class="dashboard-tile">
        <span>Tipo de pago</span>
        <strong>${paymentTypeText(client.paymentType)}</strong>
      </article>
      <article class="dashboard-tile">
        <span>Deuda actual</span>
        <strong>${money(client.creditBalance)}</strong>
      </article>
      <article class="dashboard-tile">
        <span>Credito</span>
        <strong>${creditEnabled ? 'Activo' : 'No configurado'}</strong>
      </article>
    `;
  }

  function renderGeneral(panel, client) {
    panel.innerHTML = `
      <section class="import-panel">
        <div>
          <h2>Datos generales</h2>
        </div>
        <div class="detail-grid">
          ${detailItem('Nombre comercial', client.name)}
          ${detailItem('Razon social', client.legalEntity?.legalName)}
          ${detailItem('Nombre fiscal', client.legalEntity?.commercialName)}
          ${detailItem('Tipo identificacion', client.documentType)}
          ${detailItem('Identificacion', client.legalId)}
          ${detailItem('Actividad economica', client.economicActivityName)}
          ${detailItem('Codigo actividad', client.economicActivityCode)}
          ${detailItem('Correo facturacion', client.emailBilling)}
          ${detailItem('Telefono', client.phone)}
          ${detailItem('Direccion', client.address)}
        </div>
        <div class="import-actions">
          <button type="button" disabled>Editar datos generales</button>
        </div>
      </section>
    `;
  }

  function renderStores(panel, client) {
    const stores = client.stores || [];
    panel.innerHTML = `
      <section class="import-panel">
        <div>
          <h2>Tiendas</h2>
        </div>
        <div class="role-list">
          ${stores.length ? stores.map((store) => `
            <article class="role-card">
              <div>
                <h3>${store.name}</h3>
                <p class="muted">${store.isPrimary ? 'Principal' : 'Tienda adicional'} / ${store.isActive ? 'Activa' : 'Inactiva'}</p>
                <p class="muted">${text(store.subregion?.region?.name)} / ${text(store.subregion?.name)}</p>
                <p class="muted">${text(store.storeType)} / ${text(store.attentionSchedule)}</p>
                <p class="muted">${text(store.locationReference)}</p>
              </div>
              <div class="permission-tags">
                <span>${store.code || 'Sin codigo'}</span>
                <span>${store.representatives?.length || 0} persona(s)</span>
              </div>
            </article>
          `).join('') : '<p class="muted">Sin tiendas registradas.</p>'}
        </div>
        <div class="import-actions">
          <button type="button" disabled>Agregar tienda</button>
          <button class="secondary-button" type="button" disabled>Editar tienda</button>
        </div>
      </section>
    `;
  }

  function renderPeople(panel, client) {
    const people = (client.stores || []).flatMap((store) => (
      store.representatives || []
    ).map((person) => ({ ...person, storeName: store.name })));

    panel.innerHTML = `
      <section class="import-panel">
        <div>
          <h2>Representantes y personal</h2>
        </div>
        <div class="role-list">
          ${people.length ? people.map((person) => `
            <article class="role-card">
              <div>
                <h3>${person.fullName}</h3>
                <p class="muted">${text(person.storeName)} / ${text(person.position)} / ${text(person.role)}</p>
                <p class="muted">${text(person.email)} / ${text(person.phonePrimary)}</p>
                <p class="muted">Cumpleanos: ${dateText(person.birthday)} / Fecha importante: ${dateText(person.importantDate)}</p>
              </div>
              <div class="permission-tags">
                <span>${person.isPrimaryContact ? 'Principal' : 'Adicional'}</span>
                <span>${person.identificationNumber || 'Sin identificacion'}</span>
              </div>
            </article>
          `).join('') : '<p class="muted">Sin representantes registrados.</p>'}
        </div>
        <div class="import-actions">
          <button type="button" disabled>Agregar personal</button>
          <button class="secondary-button" type="button" disabled>Editar personal</button>
        </div>
      </section>
    `;
  }

  function renderDocuments(panel, client) {
    const documents = client.documents || [];
    panel.innerHTML = `
      <section class="import-panel">
        <div>
          <h2>Documentos</h2>
          <p class="muted">Archivos adjuntos del cliente segun los tipos documentales definidos.</p>
        </div>
        <div class="role-list">
          ${documents.length ? documents.map((document) => `
            <article class="role-card">
              <div>
                <h3>${documentTypeText(document.documentType)}</h3>
                <p class="muted">${text(document.fileName)}</p>
                <p class="muted">${text(document.documentNumber)}${document.notes ? ` / ${document.notes}` : ''}</p>
              </div>
              <div class="import-actions">
                <span class="badge badge-success">${text(document.status)}</span>
                <button class="secondary-button table-action-link client-document-download-button" type="button" data-file-url="${document.fileUrl}" data-file-name="${document.fileName}">Descargar</button>
              </div>
            </article>
          `).join('') : '<p class="muted">No hay documentos registrados para este cliente.</p>'}
        </div>
      </section>
    `;
  }

  function renderCredit(panel, client) {
    const creditEnabled = client.paymentType === 'CREDIT' || Number(client.creditLimit || 0) > 0 || Number(client.creditBalance || 0) > 0;

    panel.innerHTML = `
      <section class="import-panel">
        <div>
          <h2>Credito</h2>
          <p class="muted">Resumen de condiciones comerciales y saldo vigente del cliente.</p>
        </div>
        <div class="detail-grid">
          ${detailItem('Tipo de pago actual', paymentTypeText(client.paymentType))}
          ${detailItem('Dias de credito', client.paymentDays)}
          ${detailItem('Limite de credito', money(client.creditLimit))}
          ${detailItem('Deuda actual', money(client.creditBalance))}
          ${detailItem('Credito habilitado', creditEnabled ? 'Si' : 'No')}
          ${detailItem('Saldo disponible', money(Math.max(Number(client.creditLimit || 0) - Number(client.creditBalance || 0), 0)))}
          ${detailItem('Fecha deuda inicial', 'Pendiente')}
          ${detailItem('Estado actividad', 'Pendiente')}
          ${detailItem('Ultima compra', 'Pendiente')}
        </div>
        <div class="import-actions">
          <button type="button" disabled>Enviar solicitud de credito</button>
          <button class="secondary-button" type="button" disabled>Editar condiciones</button>
        </div>
      </section>
    `;
  }

  function renderClient(elements, client) {
    renderSummary(elements, client);
    renderGeneral(elements.generalPanel, client);
    renderStores(elements.storesPanel, client);
    renderPeople(elements.peoplePanel, client);
    renderDocuments(elements.documentsPanel, client);
    renderCredit(elements.creditPanel, client);
  }

  globalScope.RootClientDetailRenderers = {
    renderClient,
  };
}(window));
