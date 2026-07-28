const inventorySession = window.InventorySession;
const inventoryAuth = window.InventoryAuth;
const session = inventorySession.read();
const sessionLabel = document.getElementById('roles-session');
const logoutButton = document.getElementById('logout-button');
const form = document.getElementById('role-form');
const message = document.getElementById('roles-message');
const createButton = document.getElementById('create-role-button');
const permissionsList = document.getElementById('permissions-list');
const rolesList = document.getElementById('roles-list');
const roleTemplateMessage = document.getElementById('role-template-message');

const roleTemplates = {
  admin: {
    name: 'Administrador',
    permissionCodes: [
      'companies.manage',
      'users.manage',
      'settings.manage',
      'clients.manage',
      'clients.view',
      'clients.view.all',
      'products.manage',
      'products.view',
      'products.import',
      'inventory.manage',
      'inventory.view',
      'warehouse.access',
      'procurement.manage',
      'sales.manage',
      'sales.orders.create',
      'sales.routes.view.own',
      'sales.routes.view.all',
      'sales.routes.assign',
      'sales.goals.view.own',
      'sales.goals.view.all',
      'sales.goals.assign',
      'customer.activities.manage',
      'customer.activities.view.all',
      'collections.manage.own',
      'collections.view.all',
      'collections.assign',
    ],
    description: 'Plantilla administrativa completa para la empresa.',
  },
  sales_agent: {
    name: 'Agente comercial',
    permissionCodes: [
      'clients.view',
      'sales.orders.create',
      'sales.routes.view.own',
      'sales.goals.view.own',
      'customer.activities.manage',
    ],
    description: 'Base para agentes. Agregue collections.manage.own si este perfil tambien realiza cobros.',
  },
  sales_supervisor: {
    name: 'Supervisor comercial',
    permissionCodes: [
      'clients.view',
      'clients.view.all',
      'clients.manage',
      'sales.manage',
      'sales.orders.create',
      'sales.routes.view.own',
      'sales.routes.view.all',
      'sales.routes.assign',
      'sales.goals.view.own',
      'sales.goals.view.all',
      'sales.goals.assign',
      'customer.activities.manage',
      'customer.activities.view.all',
      'collections.view.all',
      'collections.assign',
    ],
    description: 'Perfil para supervisar operacion comercial, metas y asignacion de rutas.',
  },
  warehouse: {
    name: 'Bodega',
    permissionCodes: [
      'warehouse.access',
      'products.view',
      'products.import',
      'products.manage',
      'inventory.view',
      'inventory.manage',
      'procurement.manage',
    ],
    description: 'Perfil operativo para inventario, bodega y compras.',
  },
  sales: {
    name: 'Ventas legado',
    permissionCodes: [
      'clients.view',
      'clients.manage',
      'sales.manage',
    ],
    description: 'Perfil simple historico. Recomendado solo para compatibilidad o transicion.',
  },
};

const permissionLabels = {
  'companies.manage': 'Manejo de empresas',
  'users.manage': 'Manejo de usuarios',
  'settings.manage': 'Configuracion de empresa',
  'clients.manage': 'Creacion y edicion de clientes',
  'clients.view': 'Consulta de clientes asignados',
  'clients.view.all': 'Consulta de todos los clientes',
  'products.manage': 'Manejo de articulos',
  'products.view': 'Consulta de articulos',
  'products.import': 'Importacion de articulos',
  'inventory.manage': 'Manejo de inventario',
  'inventory.view': 'Consulta de inventario',
  'warehouse.access': 'Acceso a bodega',
  'procurement.manage': 'Manejo de compras y proveedores',
  'sales.manage': 'Manejo de ventas, facturas y pagos',
  'sales.orders.create': 'Creacion de pedidos comerciales',
  'sales.routes.view.own': 'Consulta de rutas propias',
  'sales.routes.view.all': 'Consulta de todas las rutas',
  'sales.routes.assign': 'Asignacion de rutas',
  'sales.goals.view.own': 'Consulta de metas propias',
  'sales.goals.view.all': 'Consulta de metas del equipo',
  'sales.goals.assign': 'Asignacion de metas',
  'customer.activities.manage': 'Registro de gestiones y visitas',
  'customer.activities.view.all': 'Consulta de gestiones del equipo',
  'collections.manage.own': 'Cobro propio del agente',
  'collections.view.all': 'Consulta de cobranza comercial',
  'collections.assign': 'Asignacion de tareas de cobro',
};

if (!session?.user || session?.user?.role?.code !== 'admin' || !session?.user?.companyId) {
  window.location.href = '/';
} else {
  sessionLabel.textContent = `Sesion activa: ${session.user.fullName} (${session.user.username})`;

function humanizePermissionCode(code) {
  if (permissionLabels[code]) {
    return permissionLabels[code];
  }

  return code
    .split('.')
    .filter(Boolean)
    .map((part) => {
      const normalized = part.replace(/-/g, ' ');
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    })
    .join(' - ');
}

function renderPermissions(permissions) {
  permissionsList.innerHTML = permissions
    .map((permission) => `
      <label class="permission-option">
        <input type="checkbox" name="permissionCodes" value="${permission.code}" />
        <span>
          <strong>${humanizePermissionCode(permission.code)}</strong>
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
          ${role.permissions.map((permission) => `<span>${humanizePermissionCode(permission.code)}</span>`).join('')}
        </div>
      </article>
    `)
    .join('');
}

function applyRoleTemplate(templateName) {
  const template = roleTemplates[templateName];
  if (!template) {
    return;
  }

  form.elements.name.value = template.name;
  const selectedCodes = new Set(template.permissionCodes);
  [...form.querySelectorAll('input[name="permissionCodes"]')].forEach((checkbox) => {
    checkbox.checked = selectedCodes.has(checkbox.value);
  });
  roleTemplateMessage.textContent = template.description;
  roleTemplateMessage.className = 'message';
}

async function loadPermissions() {
  const data = await inventoryAuth.fetchJson(session, '/api/roles/permissions', {
    fallbackMessage: 'No se pudieron cargar los permisos',
  });

  renderPermissions(data);
}

async function loadRoles() {
  const data = await inventoryAuth.fetchJson(session, '/api/roles/company', {
    fallbackMessage: 'No se pudieron cargar los roles',
  });

  renderRoles(data);
}

logoutButton.addEventListener('click', () => {
  window.InventoryAuth.logout(session);
});

document.querySelectorAll('.role-template-button').forEach((button) => {
  button.addEventListener('click', () => {
    applyRoleTemplate(button.dataset.roleTemplate);
  });
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
    await inventoryAuth.fetchJson(session, '/api/roles/company', {
      method: 'POST',
      body: JSON.stringify(payload),
      fallbackMessage: 'No se pudo crear el rol',
    });

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
