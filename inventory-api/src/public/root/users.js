const STORAGE_KEY = 'inventory-api-auth';
const session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
const sessionLabel = document.getElementById('users-session');
const logoutButton = document.getElementById('logout-button');
const form = document.getElementById('user-form');
const message = document.getElementById('users-message');
const createButton = document.getElementById('create-user-button');
const usersBody = document.getElementById('users-body');
const roleHelpPanel = document.getElementById('role-help-panel');
let availableRoles = [];

const roleDescriptions = {
  sales_agent: 'Agente comercial: consulta clientes asignados, rutas y metas propias. El cobro depende de los permisos del rol.',
  sales_supervisor: 'Supervisor comercial: consulta la informacion comercial completa y puede asignar rutas y metas.',
  sales: 'Rol legado de ventas. Conviene migrar nuevos usuarios a agente o supervisor comercial.',
  admin: 'Administrador de la empresa con acceso total al panel administrativo, incluida la asignacion de rutas.',
  warehouse: 'Usuario operativo de bodega con acceso a inventario y compras.',
};

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

function roleLabel(roleCode) {
  const role = availableRoles.find((item) => item.code === roleCode);
  return role?.name || roleCode || '-';
}

function renderRoleOptions(roles) {
  const roleSelect = form.elements.roleId;
  roleSelect.innerHTML = roles
    .map((role) => `<option value="${role.id}">${role.name}</option>`)
    .join('');
  updateRoleHelp();
}

function updateRoleHelp() {
  const selectedRoleId = form.elements.roleId.value;
  const selectedRole = availableRoles.find((role) => role.id === selectedRoleId);
  if (!selectedRole) {
    roleHelpPanel.textContent = '';
    roleHelpPanel.className = 'message';
    return;
  }

  const commercialPermissions = (selectedRole.permissions || []).map((permission) => permission.code)
    .filter((code) => code.startsWith('sales.') || code.startsWith('collections.') || code.startsWith('customer.activities') || code.startsWith('clients.view'));
  const description = roleDescriptions[selectedRole.code]
    || `Rol ${selectedRole.name}. Permisos comerciales detectados: ${commercialPermissions.length || 0}.`;

  roleHelpPanel.textContent = description;
  roleHelpPanel.className = 'message';
}

async function loadRoles() {
  const response = await fetch('/api/roles/company', {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar los roles');
  }

  availableRoles = data;
  renderRoleOptions(data);
}

function renderUsers(users) {
  if (!users.length) {
    usersBody.innerHTML = '<tr><td class="empty-state" colspan="5">No hay usuarios registrados.</td></tr>';
    return;
  }

  usersBody.innerHTML = users
    .map((user) => `
      <tr>
        <td>${user.fullName}</td>
        <td>${user.username}</td>
        <td>${user.email || '-'}</td>
        <td>${user.role?.name || roleLabel(user.role?.code)}</td>
        <td>${user.status}</td>
      </tr>
    `)
    .join('');
}

async function loadUsers() {
  const response = await fetch('/api/users/company', {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar los usuarios');
  }

  renderUsers(data);
}

logoutButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = '/';
});

form.elements.roleId.addEventListener('change', updateRoleHelp);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  message.className = 'message';
  createButton.disabled = true;
  createButton.textContent = 'Creando...';

  const data = new FormData(form);
  const payload = {
    fullName: data.get('fullName').toString().trim(),
    username: data.get('username').toString().trim(),
    email: optional(data.get('email')),
    phone: optional(data.get('phone')),
    roleId: data.get('roleId').toString(),
    password: data.get('password').toString(),
  };

  try {
    const response = await fetch('/api/users/company', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'No se pudo crear el usuario');
    }

    form.reset();
    if (availableRoles.length) {
      form.elements.roleId.value = availableRoles[0].id;
      updateRoleHelp();
    }
    message.textContent = 'Usuario creado correctamente';
    await loadUsers();
  } catch (error) {
    message.textContent = error.message || 'No se pudo crear el usuario';
    message.classList.add('error');
  } finally {
    createButton.disabled = false;
    createButton.textContent = 'Crear usuario';
  }
});

Promise.all([loadRoles(), loadUsers()]).catch((error) => {
  usersBody.innerHTML = '<tr><td class="empty-state" colspan="5">No fue posible cargar los usuarios.</td></tr>';
  message.textContent = error.message || 'No se pudieron cargar los usuarios';
  message.classList.add('error');
});
}
