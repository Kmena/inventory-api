const STORAGE_KEY = 'inventory-api-auth';
const session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
const params = new URLSearchParams(window.location.search);
const clientId = params.get('id');
const sessionLabel = document.getElementById('client-detail-session');
const logoutButton = document.getElementById('logout-button');
const message = document.getElementById('client-detail-message');
const clientTitle = document.getElementById('client-title');
const summary = document.getElementById('client-summary');
const tabButtons = [...document.querySelectorAll('.tab-button')];
const tabPanels = [...document.querySelectorAll('.tab-panel')];
let currentClient = null;
const CLIENT_DOCUMENT_TYPE_LABELS = {
  IDENTIFICACION: 'Identificacion',
  CONSTANCIA_FISCAL: 'Constancia fiscal',
  SOLICITUD_CREDITO: 'Solicitud de credito',
  REFERENCIA_COMERCIAL: 'Soporte de referencia',
  SOPORTE_REFERENCIA: 'Soporte de referencia',
  PAGARE: 'Pagare',
  CONTRATO: 'Contrato',
  KYC: 'KYC',
  OTRO: 'Otro',
};

if (!session?.token || session?.user?.role?.code !== 'admin' || !session?.user?.companyId) {
  window.location.href = '/';
} else {
  sessionLabel.textContent = `Sesion activa: ${session.user.fullName} (${session.user.username})`;

function setMessage(text, isError = false) {
  message.textContent = text;
  message.className = 'message';
  if (isError) {
    message.classList.add('error');
  }
}

async function downloadProtectedClientDocument(fileUrl, fileName) {
  const response = await fetch(fileUrl, {
    headers: { Authorization: `Bearer ${session.token}` },
  });

  if (!response.ok) {
    let result = null;
    try {
      result = await response.json();
    } catch (_error) {
      result = null;
    }

    throw new Error(result?.message || 'No se pudo descargar el documento');
  }

  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName || 'documento';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

function authHeaders() {
  return {
    Authorization: `Bearer ${session.token}`,
    'Content-Type': 'application/json',
  };
}

function text(value) {
  return value || '-';
}

function optional(value) {
  const normalized = value?.toString().trim();
  return normalized || undefined;
}

function optionalNumber(value) {
  const normalized = optional(value);
  if (normalized === undefined) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function money(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(amount);
}

function paymentTypeText(value) {
  const labels = {
    CASH: 'Contado',
    CREDIT: 'Credito',
    TRANSFER: 'Transferencia',
    CARD: 'Tarjeta',
  };

  return labels[value] || value || '-';
}

function documentTypeText(value) {
  return CLIENT_DOCUMENT_TYPE_LABELS[value] || value || '-';
}

function dateText(value) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('es-CR').format(new Date(value));
}

function detailItem(label, value) {
  return `
    <div class="detail-item">
      <span>${label}</span>
      <strong>${text(value)}</strong>
    </div>
  `;
}

function pendingPanel(title, items) {
  return `
    <section class="import-panel">
      <div>
        <p class="eyebrow">Vista prevista</p>
        <h2>${title}</h2>
        <p class="muted">Esta seccion queda preparada visualmente. La funcionalidad de crear, editar y adjuntar se implementara en la siguiente etapa.</p>
      </div>
      <div class="detail-grid">
        ${items.map((item) => detailItem(item, 'Pendiente')).join('')}
      </div>
      <div class="import-actions">
        <button type="button" disabled>Agregar</button>
        <button class="secondary-button" type="button" disabled>Editar</button>
      </div>
    </section>
  `;
}

function renderSummary(client) {
  const creditEnabled = client.paymentType === 'CREDIT' || Number(client.creditLimit || 0) > 0 || Number(client.creditBalance || 0) > 0;

  clientTitle.textContent = client.name;
  summary.innerHTML = `
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

function renderGeneral(client) {
  document.getElementById('tab-general').innerHTML = `
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

function renderStores(client) {
  const stores = client.stores || [];
  document.getElementById('tab-stores').innerHTML = `
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

function renderPeople(client) {
  const people = (client.stores || []).flatMap((store) => (
    store.representatives || []
  ).map((person) => ({ ...person, storeName: store.name })));

  document.getElementById('tab-people').innerHTML = `
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

function renderDocuments(client) {
  const documents = client.documents || [];
  document.getElementById('tab-documents').innerHTML = `
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

function renderReferences(client) {
  const references = client.references || [];
  document.getElementById('tab-references').innerHTML = `
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
    setMessage('');

    const data = new FormData(form);
    const name = data.get('name').toString().trim();
    if (!name) {
      setMessage('Ingrese el nombre de la referencia', true);
      form.elements.name.focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Guardando...';

    try {
      const response = await fetch(`/api/clients/${client.id}/references`, {
        method: 'POST',
        headers: authHeaders(),
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

      setMessage('Referencia agregada correctamente.');
      await loadClient();
    } catch (error) {
      setMessage(error.message || 'No se pudo guardar la referencia', true);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Agregar referencia';
    }
  });
}

function renderCredit(client) {
  const creditEnabled = client.paymentType === 'CREDIT' || Number(client.creditLimit || 0) > 0 || Number(client.creditBalance || 0) > 0;

  document.getElementById('tab-credit').innerHTML = `
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

function renderClient(client) {
  currentClient = client;
  renderSummary(client);
  renderGeneral(client);
  renderStores(client);
  renderPeople(client);
  renderDocuments(client);
  renderReferences(client);
  renderCredit(client);
}

document.getElementById('tab-documents').addEventListener('click', async (event) => {
  const button = event.target.closest('.client-document-download-button');
  if (!button) {
    return;
  }

  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = 'Descargando...';

  try {
    setMessage('');
    await downloadProtectedClientDocument(button.dataset.fileUrl, button.dataset.fileName);
  } catch (error) {
    setMessage(error.message || 'No se pudo descargar el documento', true);
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
});

async function loadClient() {
  if (!clientId) {
    throw new Error('No se indico el cliente a consultar');
  }

  const response = await fetch(`/api/clients/${clientId}`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const client = await response.json();
  if (!response.ok) {
    throw new Error(client.message || 'No se pudo cargar el cliente');
  }

  currentClient = client;
  renderClient(client);
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    tabButtons.forEach((item) => item.classList.toggle('active', item === button));
    tabPanels.forEach((panel) => panel.classList.toggle('hidden', panel.id !== `tab-${button.dataset.tab}`));
  });
});

logoutButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = '/';
});

loadClient().catch((error) => {
  setMessage(error.message || 'No se pudo cargar el cliente', true);
});
}
