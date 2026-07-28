const inventorySession = window.InventorySession;
const inventoryAuth = window.InventoryAuth;
const session = inventorySession.read();
const params = new URLSearchParams(window.location.search);
const storeId = params.get('storeId');
const sessionLabel = document.getElementById('order-session');
const backButton = document.getElementById('order-back-button');
const summary = document.getElementById('order-store-summary');
const productsGrid = document.getElementById('order-products-grid');
const form = document.getElementById('order-form');
const submitButton = document.getElementById('submit-order-button');
const message = document.getElementById('order-message');
let orderContext = null;

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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function currency(value) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(Number(value || 0));
}

function quantity(value) {
  return new Intl.NumberFormat('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(Number(value || 0));
}

function render() {
  if (!orderContext?.store) {
    summary.innerHTML = '<p class="muted">No se pudo cargar la tienda.</p>';
    productsGrid.innerHTML = '<p class="muted">Sin productos disponibles.</p>';
    return;
  }

  const { store, sellableProducts } = orderContext;
  summary.innerHTML = [
    ['Tienda', store.name],
    ['Cliente', store.clientName || '-'],
    ['Ruta', store.routeCode || '-'],
    ['Zona', `${store.regionName || '-'} / ${store.subregionName || '-'}`],
  ].map(([label, value]) => `
    <article class="detail-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `).join('');

  productsGrid.innerHTML = sellableProducts?.products?.length
    ? sellableProducts.products.map((product) => `
      <article class="agent-order-product-card">
        <div>
          <strong>${escapeHtml(product.name)}</strong>
          <p class="muted">${escapeHtml(product.code || 'Sin codigo')} ��� ${escapeHtml(currency(product.price))}</p>
          <p class="muted">Disponible: ${escapeHtml(quantity(product.availableQuantity))}</p>
        </div>
        <label class="field">
          <span>Cantidad</span>
          <input type="number" min="0" max="${product.availableQuantity}" step="0.001" data-product-id="${product.id}" data-unit-price="${product.price}" value="0" />
        </label>
      </article>
    `).join('')
    : '<p class="muted">No hay productos vendibles disponibles.</p>';
}

async function loadContext() {
  orderContext = await inventoryAuth.fetchJson(session, `/api/agent/stores/${storeId}/order-context`, {
    fallbackMessage: 'No se pudo cargar el contexto del pedido',
  });
  render();
}

backButton.addEventListener('click', () => {
  window.location.href = `/agent/workspace.html?storeId=${storeId}`;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');
  submitButton.disabled = true;
  submitButton.textContent = 'Creando...';

  const items = [...productsGrid.querySelectorAll('input[data-product-id]')]
    .map((input) => ({
      productId: input.dataset.productId,
      quantity: Number(input.value || 0),
      unitPrice: Number(input.dataset.unitPrice || 0),
    }))
    .filter((item) => item.quantity > 0);

  if (!items.length) {
    setMessage('Ingrese al menos una cantidad mayor a cero', true);
    submitButton.disabled = false;
    submitButton.textContent = 'Crear pedido borrador';
    return;
  }

  const formData = new FormData(form);
  const payload = {
    responsible: formData.get('responsible')?.toString().trim() || null,
    notes: formData.get('notes')?.toString().trim() || null,
    items,
  };

  try {
    const data = await inventoryAuth.fetchJson(session, `/api/agent/stores/${storeId}/orders`, {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear el pedido',
    });
    form.reset();
    render();
    setMessage(`Pedido borrador #${data.id} creado correctamente`);
  } catch (error) {
    setMessage(error.message || 'No se pudo crear el pedido', true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Crear pedido borrador';
  }
});

sessionLabel.textContent = `Sesion activa: ${session.user.fullName} (${session.user.username})`;
loadContext().catch((error) => {
  setMessage(error.message || 'No se pudo cargar el pedido', true);
});

