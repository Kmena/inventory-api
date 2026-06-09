const STORAGE_KEY = 'inventory-api-auth';
const session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
const sessionLabel = document.getElementById('roles-session');
const logoutButton = document.getElementById('logout-button');
const form = document.getElementById('role-form');
const message = document.getElementById('roles-message');
const createButton = document.getElementById('create-role-button');
const permissionsList = document.getElementById('permissions-list');
const rolesList = document.getElementById('roles-list');

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

function renderPermissions(permissions) {
  permissionsList.innerHTML = permissions
    .map((permission) => `
      <label class="permission-option">
        <input type="checkbox" name="permissionCodes" value="${permission.code}" />
        <span>
          <strong>${permission.code}</strong>
          <small>${permission.description || permission.module}</small>
        </span>
      </label>
    `)
    .join('');
}

function renderRoles(roles) {
  if (!roles.length) {
    rolesList.innerHTML = '<p class="muted">No hay roles disponibles.</p>';
    return;
  }

  rolesList.innerHTML = roles
    .map((role) => `
      <article class="role-card">
        <div>
          <h3>${role.name}</h3>
          <p class="muted">${role.companyId ? 'Rol personalizado' : 'Rol base'}</p>
        </div>
        <div class="permission-tags">
          ${role.permissions.map((permission) => `<span>${permission.code}</span>`).join('')}
        </div>
      </article>
    `)
    .join('');
}

async function loadPermissions() {
  const response = await fetch('/api/roles/permissions', {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar los permisos');
  }

  renderPermissions(data);
}

async function loadRoles() {
  const response = await fetch('/api/roles/company', {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar los roles');
  }

  renderRoles(data);
}

logoutButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = '/';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  message.className = 'message';
  createButton.disabled = true;
  createButton.textContent = 'Creando...';

  const data = new FormData(form);
  const permissionCodes = data.getAll('permissionCodes').map((value) => value.toString());
  const payload = {
    name: data.get('name').toString().trim(),
    permissionCodes,
  };

  try {
    const response = await fetch('/api/roles/company', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'No se pudo crear el rol');
    }

    form.reset();
    message.textContent = 'Rol creado correctamente';
    await loadRoles();
  } catch (error) {
    message.textContent = error.message || 'No se pudo crear el rol';
    message.classList.add('error');
  } finally {
    createButton.disabled = false;
    createButton.textContent = 'Crear rol';
  }
});

Promise.all([loadPermissions(), loadRoles()]).catch((error) => {
  message.textContent = error.message || 'No se pudieron cargar los roles';
  message.classList.add('error');
});
}
