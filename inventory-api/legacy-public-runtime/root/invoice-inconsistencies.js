const inventorySession = window.InventorySession;
const inventoryAuth = window.InventoryAuth;
const session = inventorySession.read();
const sessionLabel = document.getElementById('invoice-review-session');
const message = document.getElementById('invoice-review-message');
const totalElement = document.getElementById('invoice-review-total');
const assignmentElement = document.getElementById('invoice-review-assignment');
const listElement = document.getElementById('invoice-review-list');
const refreshButton = document.getElementById('refresh-invoice-review-button');
const logoutButton = document.getElementById('logout-button');
const allowedRoles = new Set(['admin']);
const TYPE_LABELS = {
  ASIGNACION_TIENDA: 'Asignacion de tienda o cliente',
};

if (!session?.user || !allowedRoles.has(session?.user?.role?.code) || !session?.user?.companyId) {
  window.location.href = '/';
}

function currency(value) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleDateString('es-CR');
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.className = 'message';
  if (isError) {
    message.classList.add('error');
  }
}

function renderReview(data) {
  totalElement.textContent = data.summary?.total || 0;
  assignmentElement.textContent = data.summary?.assignmentInconsistencies || 0;

  if (!data.invoices?.length) {
    listElement.innerHTML = '<p class="muted">No hay inconsistencias activas para revisar.</p>';
    return;
  }

  listElement.innerHTML = data.invoices.map((invoice) => `
    <article class="role-card">
      <h3>Factura #${invoice.number}</h3>
      <p>${invoice.client?.name || 'Sin cliente'}${invoice.client?.code ? ` - ${invoice.client.code}` : ''}</p>
      <div class="route-agent-stats">
        <span>Saldo pendiente ${currency(invoice.pendingAmount)}</span>
        <span>Emitida ${formatDate(invoice.issuedAt)}</span>
      </div>
      <p class="muted">Tienda origen: ${invoice.order?.clientStoreName || 'Sin asignacion confiable'}</p>
      <p class="muted">Tipos: ${invoice.inconsistencyTypes.map((type) => TYPE_LABELS[type] || type).join(', ')}</p>
    </article>
  `).join('');
}

async function loadReview() {
  setMessage('');
  const data = await inventoryAuth.fetchJson(session, '/api/invoices/inconsistencies', {
    fallbackMessage: 'No se pudo cargar la revision de facturas',
  });
  renderReview(data);
}

logoutButton.addEventListener('click', () => {
  window.InventoryAuth.logout(session);
});

refreshButton.addEventListener('click', async () => {
  try {
    await loadReview();
  } catch (error) {
    setMessage(error.message || 'No se pudo actualizar la revision de facturas', true);
  }
});

sessionLabel.textContent = `Sesion activa: ${session.user.fullName} (${session.user.username})`;
loadReview().catch((error) => {
  setMessage(error.message || 'No se pudo cargar la revision de facturas', true);
});



