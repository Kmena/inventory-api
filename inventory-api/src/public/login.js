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
  if (roleCode === 'admin' && session?.user?.companyId) {
    return '/root/dashboard.html';
  }
  if (permissions.includes('warehouse.access')) {
    return '/warehouse/products.html';
  }

  return ROLE_HOME[roleCode] || '/no-access.html';
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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'No se pudo iniciar sesión');
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.location.href = getHomeForSession(data);
  } catch (error) {
    message.textContent = error.message || 'Ocurrió un error inesperado';
    message.classList.add('error');
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Entrar';
  }
});
