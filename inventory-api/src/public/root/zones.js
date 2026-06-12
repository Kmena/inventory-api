const STORAGE_KEY = 'inventory-api-auth';
const session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
const sessionLabel = document.getElementById('zones-session');
const logoutButton = document.getElementById('logout-button');
const zoneForm = document.getElementById('zone-form');
const subzoneForm = document.getElementById('subzone-form');
const message = document.getElementById('zones-message');
const createZoneButton = document.getElementById('create-zone-button');
const createSubzoneButton = document.getElementById('create-subzone-button');
const refreshButton = document.getElementById('refresh-zones-button');
const zonesList = document.getElementById('zones-list');
let zones = [];

if (!session?.token || session?.user?.role?.code !== 'admin' || !session?.user?.companyId) {
  window.location.href = '/';
} else {
  sessionLabel.textContent = `Sesion activa: ${session.user.fullName} (${session.user.username})`;

function authHeaders() {
  return {
    Authorization: `Bearer ${session.token}`,
    'Content-Type': 'application/json',
  };
}

function optional(value) {
  const normalized = value?.toString().trim();
  return normalized || undefined;
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.className = 'message';
  if (isError) {
    message.classList.add('error');
  }
}

function renderZoneOptions() {
  const select = subzoneForm.elements.regionId;
  if (!zones.length) {
    select.innerHTML = '<option value="">Cree una zona primero</option>';
    return;
  }

  select.innerHTML = zones
    .map((zone) => `<option value="${zone.id}">${zone.name}</option>`)
    .join('');
}

function renderZones() {
  if (!zones.length) {
    zonesList.innerHTML = '<p class="muted">No hay zonas registradas.</p>';
    renderZoneOptions();
    return;
  }

  zonesList.innerHTML = zones
    .map((zone) => {
      const subzones = zone.subregions?.length
        ? zone.subregions.map((subzone) => `<span>${subzone.name}${subzone.routeCode ? ` (${subzone.routeCode})` : ''}</span>`).join('')
        : '<p class="muted">Sin subzonas registradas.</p>';

      return `
        <article class="role-card">
          <div>
            <h3>${zone.name}</h3>
            <p class="muted">${zone.routeCode || 'Sin codigo de ruta'}</p>
          </div>
          <div class="permission-tags">
            ${subzones}
          </div>
        </article>
      `;
    })
    .join('');

  renderZoneOptions();
}

async function loadZones() {
  const response = await fetch('/api/regions/company', {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar las zonas');
  }

  zones = data;
  renderZones();
}

logoutButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = '/';
});

refreshButton.addEventListener('click', async () => {
  setMessage('');
  try {
    await loadZones();
  } catch (error) {
    setMessage(error.message || 'No se pudieron cargar las zonas', true);
  }
});

zoneForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');
  createZoneButton.disabled = true;
  createZoneButton.textContent = 'Creando...';

  const data = new FormData(zoneForm);
  const payload = {
    name: data.get('name').toString().trim(),
    routeCode: optional(data.get('routeCode')),
  };

  try {
    const response = await fetch('/api/regions/company', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'No se pudo crear la zona');
    }

    zoneForm.reset();
    setMessage('Zona creada correctamente');
    await loadZones();
  } catch (error) {
    setMessage(error.message || 'No se pudo crear la zona', true);
  } finally {
    createZoneButton.disabled = false;
    createZoneButton.textContent = 'Crear zona';
  }
});

subzoneForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');
  createSubzoneButton.disabled = true;
  createSubzoneButton.textContent = 'Creando...';

  const data = new FormData(subzoneForm);
  const regionId = data.get('regionId').toString();
  const payload = {
    name: data.get('name').toString().trim(),
    routeCode: optional(data.get('routeCode')),
  };

  try {
    const response = await fetch(`/api/regions/company/${regionId}/subregions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'No se pudo crear la subzona');
    }

    subzoneForm.reset();
    setMessage('Subzona creada correctamente');
    await loadZones();
  } catch (error) {
    setMessage(error.message || 'No se pudo crear la subzona', true);
  } finally {
    createSubzoneButton.disabled = false;
    createSubzoneButton.textContent = 'Crear subzona';
  }
});

loadZones().catch((error) => {
  zonesList.innerHTML = '<p class="muted">No fue posible cargar las zonas.</p>';
  setMessage(error.message || 'No se pudieron cargar las zonas', true);
});
}
