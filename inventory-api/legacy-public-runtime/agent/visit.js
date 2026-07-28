const inventorySession = window.InventorySession;
const inventoryAuth = window.InventoryAuth;
const session = inventorySession.read();
const params = new URLSearchParams(window.location.search);
const storeId = params.get('storeId');
const sessionLabel = document.getElementById('visit-session');
const backButton = document.getElementById('visit-back-button');
const openOrderButton = document.getElementById('visit-open-order-button');
const summary = document.getElementById('visit-store-summary');
const visitHistoryPanel = document.getElementById('visit-history');
const form = document.getElementById('visit-form');
const submitButton = document.getElementById('visit-submit-button');
const message = document.getElementById('visit-message');
let storeDetail = null;

if (!session?.user || !session?.user?.companyId || !storeId) {
  window.location.href = '/agent/workspace.html';
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.className = 'message';
  if (isError) {
    message.classList.add('error');
  }
}

function currency(value) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(Number(value || 0));
}

function render() {
  if (!storeDetail?.store) {
    summary.innerHTML = '<p class="muted">No se pudo cargar la tienda.</p>';
    visitHistoryPanel.innerHTML = '<p class="muted">Sin historial disponible.</p>';
    return;
  }

  const { store, latestVisit, visitHistory, purchaseHistory } = storeDetail;
  summary.innerHTML = [
    ['Tienda', store.name],
    ['Cliente', store.clientName || '-'],
    ['Ruta', store.routeCode || '-'],
    ['Zona', `${store.regionName || '-'} / ${store.subregionName || '-'}`],
    ['Ultima visita', latestVisit?.visitedAt ? new Date(latestVisit.visitedAt).toLocaleString('es-CR') : 'Sin visitas'],
    ['Saldo pendiente', currency(purchaseHistory?.pendingBalance || 0)],
  ].map(([label, value]) => `
    <article class="detail-item">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `).join('');

  visitHistoryPanel.innerHTML = visitHistory?.length
    ? visitHistory.slice(0, 6).map((visit) => `
      <div class="agent-block-card">
        <strong>${visit.motive} ��� ${visit.result}</strong>
        <span class="muted">${new Date(visit.visitedAt).toLocaleString('es-CR')}</span>
        <span>${visit.comment || 'Sin comentario'}</span>
      </div>
    `).join('')
    : '<p class="muted">No hay visitas previas registradas.</p>';
}

async function loadDetail() {
  storeDetail = await inventoryAuth.fetchJson(session, `/api/agent/stores/${storeId}`, {
    fallbackMessage: 'No se pudo cargar la tienda',
  });
  render();
}

backButton.addEventListener('click', () => {
  window.location.href = `/agent/workspace.html?storeId=${storeId}`;
});

openOrderButton.addEventListener('click', () => {
  window.location.href = `/agent/order-entry.html?storeId=${storeId}`;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  submitButton.textContent = 'Guardando...';
  setMessage('');

  const formData = new FormData(form);
  const suggestedNextVisitAt = formData.get('suggestedNextVisitAt')?.toString();
  const payload = {
    clientStoreId: storeId,
    motive: formData.get('motive'),
    result: formData.get('result'),
    comment: formData.get('comment')?.toString().trim() || null,
    suggestedNextVisitAt: suggestedNextVisitAt ? new Date(suggestedNextVisitAt).toISOString() : null,
  };

  try {
    await inventoryAuth.fetchJson(session, '/api/agent/visits', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo guardar la visita',
    });
    form.reset();
    setMessage('Visita registrada correctamente');
    await loadDetail();
  } catch (error) {
    setMessage(error.message || 'No se pudo guardar la visita', true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Guardar visita';
  }
});

sessionLabel.textContent = `Sesion activa: ${session.user.fullName} (${session.user.username})`;
loadDetail().catch((error) => {
  setMessage(error.message || 'No se pudo cargar la visita', true);
});
