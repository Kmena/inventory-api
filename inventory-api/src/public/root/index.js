const STORAGE_KEY = 'inventory-api-auth';
const session = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
const sessionLabel = document.getElementById('root-session');
const logoutButton = document.getElementById('logout-button');
const form = document.getElementById('company-form');
const message = document.getElementById('company-message');
const createButton = document.getElementById('create-company-button');
const refreshButton = document.getElementById('refresh-companies-button');
const companiesBody = document.getElementById('companies-body');

if (!session?.token || session?.user?.role?.code !== 'root') {
  window.location.href = '/';
}

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

function renderCompanies(companies) {
  if (!companies.length) {
    companiesBody.innerHTML = '<tr><td class="empty-state" colspan="5">No hay empresas registradas.</td></tr>';
    return;
  }

  companiesBody.innerHTML = companies
    .map((company) => {
      const fiscalConfig = company.fiscalConfigs?.[0];
      const rootUser = company.users?.[0];
      return `<tr>
        <td>${company.name}</td>
        <td>${company.legalId || '-'}</td>
        <td>${company.isActive ? 'Activa' : 'Inactiva'}</td>
        <td>${fiscalConfig?.haciendaEnvironment || '-'}</td>
        <td>${rootUser ? `${rootUser.username} (${rootUser.fullName})` : '-'}</td>
      </tr>`;
    })
    .join('');
}

async function loadCompanies() {
  const response = await fetch('/api/companies/root/companies', {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'No se pudieron cargar las empresas');
  }
  renderCompanies(data);
}

logoutButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = '/';
});

refreshButton.addEventListener('click', async () => {
  message.textContent = '';
  message.className = 'message';
  try {
    await loadCompanies();
  } catch (error) {
    message.textContent = error.message || 'No se pudieron cargar las empresas';
    message.classList.add('error');
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  message.className = 'message';
  createButton.disabled = true;
  createButton.textContent = 'Creando...';

  const data = new FormData(form);
  const payload = {
    company: {
      name: data.get('companyName').toString().trim(),
      legalId: optional(data.get('companyLegalId')),
      email: optional(data.get('companyEmail')),
      phone: optional(data.get('companyPhone')),
      address: optional(data.get('companyAddress')),
    },
    fiscalConfig: {
      legalName: data.get('legalName').toString().trim(),
      commercialName: optional(data.get('commercialName')),
      identificationType: data.get('identificationType').toString().trim(),
      identificationNumber: data.get('identificationNumber').toString().trim(),
      economicActivityCode: optional(data.get('economicActivityCode')),
      email: optional(data.get('companyEmail')),
      phone: optional(data.get('companyPhone')),
      address: optional(data.get('companyAddress')),
      haciendaEnvironment: data.get('haciendaEnvironment').toString(),
      defaultBranchCode: data.get('defaultBranchCode').toString().trim(),
      defaultTerminalCode: data.get('defaultTerminalCode').toString().trim(),
    },
    rootUser: {
      fullName: data.get('rootFullName').toString().trim(),
      username: data.get('rootUsername').toString().trim(),
      email: optional(data.get('rootEmail')),
      phone: optional(data.get('rootPhone')),
      password: data.get('rootPassword').toString(),
    },
  };

  try {
    const response = await fetch('/api/companies/root/companies', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'No se pudo crear la empresa');
    }

    form.reset();
    form.elements.identificationType.value = '02';
    form.elements.haciendaEnvironment.value = 'STAGING';
    form.elements.defaultBranchCode.value = '001';
    form.elements.defaultTerminalCode.value = '00001';
    message.textContent = 'Empresa creada correctamente';
    await loadCompanies();
  } catch (error) {
    message.textContent = error.message || 'No se pudo crear la empresa';
    message.classList.add('error');
  } finally {
    createButton.disabled = false;
    createButton.textContent = 'Crear empresa';
  }
});

loadCompanies().catch((error) => {
  message.textContent = error.message || 'No se pudieron cargar las empresas';
  message.classList.add('error');
});
