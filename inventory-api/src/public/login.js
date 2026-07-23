const form = document.getElementById('login-form');
const message = document.getElementById('login-message');
const loginButton = document.getElementById('login-button');

const STORAGE_KEY = 'inventory-api-auth';
const LOGIN_ENDPOINT = '/api/auth/login';
const DEFAULT_LOGIN_ERROR_MESSAGE = 'No se pudo iniciar sesion. Intente de nuevo.';
const UNEXPECTED_LOGIN_ERROR_MESSAGE = 'Ocurrio un error inesperado.';
const LANDING_BY_ROLE = {
  root: '/root/index.html',
  warehouse: '/warehouse/products.html',
};

function clearStoredSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function readStoredSession() {
  const serializedSession = localStorage.getItem(STORAGE_KEY);

  if (!serializedSession) {
    return null;
  }

  try {
    return JSON.parse(serializedSession);
  } catch (_error) {
    clearStoredSession();
    return null;
  }
}

function hasOperationalAgentPermissions(permissions) {
  return permissions.includes('sales.routes.view.own')
    && permissions.includes('sales.orders.create')
    && permissions.includes('customer.activities.manage')
    && !permissions.includes('sales.routes.assign')
    && !permissions.includes('sales.routes.view.all');
}

function isOperationalAgentSession(session) {
  const roleCode = session?.user?.role?.code;
  const permissions = session?.user?.permissions || [];

  return roleCode === 'sales_agent' || hasOperationalAgentPermissions(permissions);
}

function getHomeForSession(session) {
  const roleCode = session?.user?.role?.code;
  const permissions = session?.user?.permissions || [];

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

  if (isOperationalAgentSession(session)) {
    return '/agent/workspace.html';
  }

  return LANDING_BY_ROLE[roleCode] || '/no-access.html';
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

  return fallbackMessage || DEFAULT_LOGIN_ERROR_MESSAGE;
}

function setMessage(text, tone = 'default') {
  message.textContent = text;
  message.className = 'message';

  if (tone !== 'default') {
    message.classList.add(tone);
  }
}

function setSubmittingState(isSubmitting) {
  loginButton.disabled = isSubmitting;
  loginButton.textContent = isSubmitting ? 'Validando...' : 'Iniciar sesión';
  form.setAttribute('aria-busy', isSubmitting ? 'true' : 'false');
}

function buildLoginPayload() {
  const formData = new FormData(form);

  return {
    username: formData.get('username')?.toString().trim(),
    password: formData.get('password')?.toString(),
  };
}

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

async function requestLogin(payload) {
  const response = await fetch(LOGIN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(getFriendlyLoginMessage(response.status, data?.message));
  }

  return data;
}

function persistSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function redirectToSessionHome(session) {
  window.location.href = getHomeForSession(session);
}

function restoreExistingSession() {
  const existingSession = readStoredSession();
  if (existingSession?.token) {
    redirectToSessionHome(existingSession);
  }
}

restoreExistingSession();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('Validando acceso...');
  setSubmittingState(true);

  try {
    const session = await requestLogin(buildLoginPayload());
    persistSession(session);
    redirectToSessionHome(session);
  } catch (error) {
    setMessage(error.message || UNEXPECTED_LOGIN_ERROR_MESSAGE, 'error');
  } finally {
    setSubmittingState(false);
  }
});
