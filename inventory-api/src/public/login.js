const form = document.getElementById('login-form');
const message = document.getElementById('login-message');
const loginButton = document.getElementById('login-button');
const STORAGE_KEY = 'inventory-api-auth';

const existingSession = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
if (existingSession?.token && existingSession?.user?.role?.code === 'warehouse') {
  window.location.href = '/warehouse/products.html';
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

    if (data.user?.role?.code !== 'warehouse') {
      localStorage.removeItem(STORAGE_KEY);
      throw new Error('Este login sencillo solo redirige al flujo de bodega. Use el usuario bodega.');
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.location.href = '/warehouse/products.html';
  } catch (error) {
    message.textContent = error.message || 'Ocurrió un error inesperado';
    message.classList.add('error');
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Entrar';
  }
});
