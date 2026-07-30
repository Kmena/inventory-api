(() => {
const inventorySession = /** @type {any} */ (window).InventorySession;
const inventoryAuth = /** @type {any} */ (window).InventoryAuth;
const form = /** @type {HTMLFormElement | null} */ (document.getElementById('login-form'));
const message = /** @type {HTMLElement | null} */ (document.getElementById('login-message'));
const loginButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('login-button'));

const LOGIN_ENDPOINT = '/api/auth/login';
const DEFAULT_LOGIN_ERROR_MESSAGE = 'No se pudo iniciar sesion. Intente de nuevo.';
const UNEXPECTED_LOGIN_ERROR_MESSAGE = 'Ocurrio un error inesperado.';
const ROOT_SHELL_PATH = '/root/';
const POST_LOGIN_TRANSITION_PATH = '/migration.html?mode=post-login-transition';

let loginAttemptInProgress = false;
let sessionEstablished = false;

function readStoredSession() {
  return inventorySession.read();
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
    return ROOT_SHELL_PATH;
  }

  if (roleCode === 'admin' && session?.user?.companyId) {
    return ROOT_SHELL_PATH;
  }

  if (roleCode === 'sales_supervisor') {
    return POST_LOGIN_TRANSITION_PATH;
  }

  if (permissions.includes('warehouse.access')) {
    return POST_LOGIN_TRANSITION_PATH;
  }

  if (isOperationalAgentSession(session)) {
    return POST_LOGIN_TRANSITION_PATH;
  }

  return '/no-access.html';
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

function getLoginReasonMessage() {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get('reason');
  if (reason === 'session-expired') {
    return 'Tu sesion expiro. Inicia sesion de nuevo.';
  }
  if (reason === 'signed-out') {
    return 'Sesion cerrada correctamente.';
  }
  return '';
}

function setMessage(text, tone = 'default') {
  if (!message) {
    return;
  }

  message.textContent = text;
  message.className = 'message';

  if (tone !== 'default') {
    message.classList.add(tone);
  }
}

function setSubmittingState(isSubmitting, text = null) {
  if (!loginButton || !form) {
    return;
  }

  loginButton.disabled = isSubmitting;
  loginButton.textContent = text || (isSubmitting ? 'Validando...' : 'Iniciar sesión');
  form.setAttribute('aria-busy', isSubmitting ? 'true' : 'false');
}

function buildLoginPayload() {
  if (!form) {
    return { username: '', password: '' };
  }

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
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Inventory-Browser-Session': 'cookie',
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(getFriendlyLoginMessage(response.status, data?.message));
  }

  return data;
}

function persistSession(session) {
  return inventorySession.write(session);
}

function redirectToSessionHome(session) {
  window.location.href = getHomeForSession(session);
}

async function restoreExistingSession() {
  const loginReasonMessage = getLoginReasonMessage();
  const shouldTrustStoredSession = !loginReasonMessage || loginReasonMessage === 'Sesion cerrada correctamente.';
  const existingSession = shouldTrustStoredSession ? readStoredSession() : null;
  if (existingSession?.user) {
    redirectToSessionHome(existingSession);
    return;
  }

  try {
    const bootstrappedSession = await inventoryAuth.bootstrapSession();
    if (bootstrappedSession?.user) {
      sessionEstablished = true;
      redirectToSessionHome(bootstrappedSession);
    }
  } catch (_error) {
    if (!loginAttemptInProgress && !sessionEstablished) {
      inventorySession.clear();
    }
  }
}

const loginReasonMessage = getLoginReasonMessage();
if (loginReasonMessage) {
  setMessage(loginReasonMessage);
}
restoreExistingSession();

if (!form) {
  throw new Error('No se encontro el formulario de inicio de sesion.');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('Validando acceso...');
  setSubmittingState(true);
  loginAttemptInProgress = true;

  try {
    const session = persistSession(await requestLogin(buildLoginPayload()));
    sessionEstablished = true;
    redirectToSessionHome(session);
  } catch (error) {
    setMessage(error.message || UNEXPECTED_LOGIN_ERROR_MESSAGE, 'error');
  } finally {
    if (!sessionEstablished) {
      loginAttemptInProgress = false;
    }
    setSubmittingState(false);
  }
});
})();
