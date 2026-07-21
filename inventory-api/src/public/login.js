const form = document.getElementById('login-form');
const message = document.getElementById('login-message');
const loginButton = document.getElementById('login-button');
const STORAGE_KEY = 'inventory-api-auth';

const ROLE_HOME = {
  root: '/root/index.html',
  warehouse: '/warehouse/products.html',
};

function getHomeForSession(session) {
  const roleCode = session?.user?.role?.code;
  const permissions = session?.user?.permissions || [];
  const isOperationalAgent = roleCode === 'sales_agent'
    || (
      permissions.includes('sales.routes.view.own')
      && permissions.includes('sales.orders.create')
      && permissions.includes('customer.activities.manage')
      && !permissions.includes('sales.routes.assign')
      && !permissions.includes('sales.routes.view.all')
    );

  if (roleCode === 'root') {
    return '/root/index.html';
  }
  if (roleCode === 'admin' && session?.user?.companyId) {
    return '/root/dashboard.html';
  }
  if (roleCode === 'sales_supervisor') {
    return '/root/routes.html';
  }
  if (permissions.includes('warehouse.access')) {
    return '/warehouse/products.html';
  }
  if (isOperationalAgent) {
    return '/agent/workspace.html';
  }

  return ROLE_HOME[roleCode] || '/no-access.html';
}

function getFriendlyLoginMessage(statusCode, fallbackMessage) {
  if (statusCode === 401) {
    return 'Usuario o contrasena incorrectos.';
  }

  if (statusCode === 403) {
    return fallbackMessage || 'Tu usuario no tiene acceso en este momento.';
  }

  if (statusCode === 503) {
    return 'El servicio no esta disponible en este momento. Intente de nuevo en unos minutos.';
  }

  return fallbackMessage || 'No se pudo iniciar sesion. Intente de nuevo.';
}

const existingSession = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
if (existingSession?.token) {
  window.location.href = getHomeForSession(existingSession);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  message.className = 'message';
  loginButton.disabled = true;
  loginButton.textContent = 'Entrando...';

  const formData = new FormData(form);
  const payload = {
    username: formData.get('username')?.toString().trim(),
    password: formData.get('password')?.toString(),
  };

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_error) {
      data = null;
    }

    if (!response.ok) {
      throw new Error(getFriendlyLoginMessage(response.status, data?.message));
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.location.href = getHomeForSession(data);
  } catch (error) {
    message.textContent = error.message || 'Ocurrio un error inesperado.';
    message.classList.add('error');
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Entrar';
  }
});
