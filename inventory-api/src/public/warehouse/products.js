const STORAGE_KEY = 'inventory-api-auth';
const session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
const message = document.getElementById('products-message');
const importMessage = document.getElementById('import-message');
const importProgress = document.getElementById('import-progress');
const welcomeMessage = document.getElementById('welcome-message');
const productsBody = document.getElementById('products-body');
const logoutButton = document.getElementById('logout-button');
const excelFileInput = document.getElementById('excel-file');
const importButton = document.getElementById('import-button');
const importPreviewWrapper = document.getElementById('import-preview-wrapper');
const importPreviewBody = document.getElementById('import-preview-body');

const IMPORT_CHUNK_SIZE = 100;

let currentProducts = [];
let importRows = [];
const permissions = session?.user?.permissions || [];
const canAccessWarehouse = session?.user?.role?.code === 'warehouse' || permissions.includes('warehouse.access');
const canImportProducts = permissions.includes('products.import') || permissions.includes('products.manage');

if (!session?.token || !canAccessWarehouse) {
  window.location.href = '/';
}

welcomeMessage.textContent = `Sesión activa: ${session.user.fullName} (${session.user.username})`;

logoutButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = '/';
});

if (!canImportProducts) {
  document.querySelector('.import-panel')?.classList.add('hidden');
}

excelFileInput.addEventListener('change', handleExcelSelection);
importButton.addEventListener('click', submitSelectedImports);

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  return value;
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = Number(String(value).replace(/,/g, ''));
  return Number.isNaN(normalized) ? null : normalized;
}

function buildDescription(row) {
  const parts = [
    normalizeText(row['Codigo Barras']) && `Código barras: ${normalizeText(row['Codigo Barras'])}`,
    normalizeText(row['Codigo Cabys']) && `CABYS: ${normalizeText(row['Codigo Cabys'])}`,
    normalizeText(row.Registromedicamento) && `Registro: ${normalizeText(row.Registromedicamento)}`,
  ].filter(Boolean);

  return parts.join(' | ') || null;
}

function renderProducts(products) {
  if (!products.length) {
    productsBody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay productos registrados.</td></tr>';
    return;
  }

  productsBody.innerHTML = products
    .map((product) => `
      <tr>
        <td>${formatValue(product.id)}</td>
        <td>${formatValue(product.code)}</td>
        <td>${formatValue(product.name)}</td>
        <td>${formatValue(product.unit)}</td>
        <td>${formatValue(product.price)}</td>
        <td>${formatValue(product.quantity)}</td>
        <td>${formatValue(product.reservedQuantity)}</td>
      </tr>
    `)
    .join('');
}

function renderImportPreview() {
  if (!importRows.length) {
    importPreviewWrapper.classList.add('hidden');
    importButton.disabled = true;
    return;
  }

  importPreviewWrapper.classList.remove('hidden');
  importButton.disabled = false;

  importPreviewBody.innerHTML = importRows
    .map((row, index) => `
      <tr>
        <td>
          <input type="checkbox" data-index="${index}" class="row-selector" ${row.selected ? 'checked' : ''} />
        </td>
        <td>
          <span class="badge ${row.exists ? 'badge-warning' : 'badge-success'}">${row.exists ? 'Actualizar' : 'Crear'}</span>
        </td>
        <td>${row.id}</td>
        <td>${formatValue(row.name)}</td>
        <td>${formatValue(row.code)}</td>
        <td>${formatValue(row.price)}</td>
        <td>${formatValue(row.quantity)}</td>
        <td>${formatValue(row.categoryName)}</td>
      </tr>
    `)
    .join('');

  document.querySelectorAll('.row-selector').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const index = Number(event.target.dataset.index);
      importRows[index].selected = event.target.checked;
    });
  });
}

async function loadProducts() {
  try {
    const response = await fetch('/api/products', {
      headers: { Authorization: `Bearer ${session.token}` },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem(STORAGE_KEY);
        window.location.href = '/';
        return;
      }

      throw new Error(data.message || 'No se pudieron cargar los productos');
    }

    currentProducts = data;
    renderProducts(data);
  } catch (error) {
    productsBody.innerHTML = '<tr><td colspan="7" class="empty-state">No fue posible cargar los productos.</td></tr>';
    message.textContent = error.message || 'Ocurrió un error inesperado';
    message.classList.add('error');
  }
}

async function handleExcelSelection(event) {
  importMessage.textContent = '';
  importMessage.className = 'message';
  const [file] = event.target.files;

  if (!file) {
    importRows = [];
    renderImportPreview();
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    const existingIds = new Set(currentProducts.map((product) => String(product.id)));

    importRows = rows
      .map((row) => {
        const id = normalizeNumber(row['Codigo Cliente']);
        const name = normalizeText(row.Descripcion);

        if (!id || !name) return null;

        return {
          id: String(Math.trunc(id)),
          selected: true,
          exists: existingIds.has(String(Math.trunc(id))),
          code: normalizeText(row['Codigo Cliente']),
          name,
          description: buildDescription(row),
          unit: 'UN',
          currency: 'CRC',
          price: normalizeNumber(row['Precio Con Iva']) ?? normalizeNumber(row['Valor Unitario']),
          quantity: normalizeNumber(row.Existencias) ?? 0,
          categoryName: normalizeText(row['Familia Producto']) || null,
        };
      })
      .filter(Boolean);

    if (!importRows.length) {
      throw new Error('El archivo no contiene filas válidas para importar');
    }

    const existingCount = importRows.filter((row) => row.exists).length;
    importMessage.textContent = `Archivo cargado: ${importRows.length} filas válidas. ${existingCount} ya existen y requerirán confirmación para actualizar.`;
    renderImportPreview();
  } catch (error) {
    importRows = [];
    renderImportPreview();
    importMessage.textContent = error.message || 'No se pudo leer el archivo Excel';
    importMessage.className = 'message error';
  }
}

function buildImportPayloadRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    unit: row.unit,
    currency: row.currency,
    price: row.price,
    quantity: row.quantity,
    categoryName: row.categoryName,
    inCatalog: true,
    overwrite: row.exists,
  }));
}

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function sendImportChunk(rows) {
  const response = await fetch('/api/products/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ rows: buildImportPayloadRows(rows) }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron importar los productos');
  }

  return data;
}

async function submitSelectedImports() {
  const selectedRows = importRows.filter((row) => row.selected);
  if (!selectedRows.length) {
    importMessage.textContent = 'Seleccione al menos un producto para importar.';
    importMessage.className = 'message error';
    return;
  }

  const rowsToUpdate = selectedRows.filter((row) => row.exists);
  if (rowsToUpdate.length) {
    const confirmed = window.confirm(`Hay ${rowsToUpdate.length} producto(s) con ID existente. ¿Desea actualizarlos?`);
    if (!confirmed) {
      importMessage.textContent = 'Importación cancelada. No se actualizó ningún producto existente.';
      importMessage.className = 'message';
      return;
    }
  }

  importButton.disabled = true;
  importButton.textContent = 'Importando...';
  importMessage.textContent = '';
  importMessage.className = 'message';
  importProgress.textContent = '';
  importProgress.className = 'message';

  const chunks = chunkArray(selectedRows, IMPORT_CHUNK_SIZE);
  const totals = { created: 0, updated: 0, skipped: 0 };

  try {
    for (let index = 0; index < chunks.length; index += 1) {
      importProgress.textContent = `Procesando bloque ${index + 1} de ${chunks.length}...`;
      const result = await sendImportChunk(chunks[index]);
      totals.created += result.created.length;
      totals.updated += result.updated.length;
      totals.skipped += result.skipped.length;
    }

    importMessage.textContent = `Importación completada. Creados: ${totals.created}, actualizados: ${totals.updated}, omitidos: ${totals.skipped}.`;
    importProgress.textContent = `Se procesaron ${selectedRows.length} fila(s) en ${chunks.length} bloque(s) de hasta ${IMPORT_CHUNK_SIZE}.`;
    importRows = [];
    excelFileInput.value = '';
    renderImportPreview();
    await loadProducts();
  } catch (error) {
    importMessage.textContent = error.message || 'No se pudo completar la importación';
    importMessage.className = 'message error';
    importProgress.textContent = 'La importación se detuvo antes de completar todos los bloques.';
    importProgress.className = 'message error';
  } finally {
    importButton.disabled = false;
    importButton.textContent = 'Subir seleccionados';
  }
}

loadProducts();
