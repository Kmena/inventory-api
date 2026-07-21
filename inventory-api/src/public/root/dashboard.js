const STORAGE_KEY = 'inventory-api-auth';
const session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
const sessionLabel = document.getElementById('root-session');
const logoutButton = document.getElementById('logout-button');
const message = document.getElementById('dashboard-message');
const companyName = document.getElementById('company-name');
const employeesCount = document.getElementById('employees-count');
const companyStatus = document.getElementById('company-status');
const companyLegalId = document.getElementById('company-legal-id');
const companyDescription = document.getElementById('company-description');

if (!session?.token || session?.user?.role?.code !== 'admin') {
  window.location.href = '/';
} else if (!session?.user?.companyId) {
  window.location.href = '/no-access.html';
} else {
  sessionLabel.textContent = `Sesion activa: ${session.user.fullName} (${session.user.username})`;

function fallback(value) {
  return value || '-';
}

function renderDashboard(dashboard) {
  const company = dashboard.company;
  companyName.textContent = company.name;
  employeesCount.textContent = dashboard.metrics.employeesCount.toString();
  companyStatus.textContent = company.isActive ? 'Activa' : 'Inactiva';
  companyLegalId.textContent = fallback(company.legalId || company.fiscalConfig?.identificationNumber);
  companyDescription.textContent = dashboard.company.description || 'Sin descripcion registrada.';
}

async function loadDashboard() {
  const response = await fetch('/api/companies/company/dashboard', {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'No se pudo cargar el dashboard');
  }

  renderDashboard(data);
}

logoutButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = '/';
});

loadDashboard().catch((error) => {
  message.textContent = error.message || 'No se pudo cargar el dashboard';
  message.classList.add('error');
});
}
