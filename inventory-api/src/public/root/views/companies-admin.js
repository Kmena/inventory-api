(function attachRootShellCompaniesAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const companiesApi = rootShell.require('companiesApi');
  const rootShellUi = rootShell.require('ui');

  function render(session) {
    const actorName = rootShellUi.escapeHtml(session?.user?.fullName || session?.user?.username || 'Usuario');

    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Panel root</p>
        <h2 id="root-view-title">Empresas</h2>
        <p class="muted">Gestiona el alta y el estado operativo de las empresas desde la sesion de ${actorName}.</p>
      </section>

      <div class="root-admin-layout">
        <article class="card root-card root-admin-form-card">
          <div class="page-header">
            <div>
              <h3>Crear empresa</h3>
              <p class="muted">Completa el registro base, la configuracion fiscal y el usuario administrador inicial.</p>
            </div>
          </div>
          <div id="companies-form-message"></div>
          <form id="companies-create-form" class="root-form" novalidate>
            <fieldset class="root-form__section">
              <legend>Datos de empresa</legend>
              <div class="root-form-grid">
                <label><span>Nombre *</span><input name="company.name" type="text" required minlength="2" maxlength="255" /></label>
                <label><span>Identificacion legal</span><input name="company.legalId" type="text" maxlength="100" /></label>
                <label><span>Correo</span><input name="company.email" type="email" maxlength="255" /></label>
                <label><span>Telefono</span><input name="company.phone" type="text" maxlength="50" /></label>
                <label class="root-form-grid__full"><span>Direccion</span><textarea name="company.address" rows="2" maxlength="1000"></textarea></label>
              </div>
            </fieldset>

            <fieldset class="root-form__section">
              <legend>Datos fiscales</legend>
              <div class="root-form-grid">
                <label><span>Razon social *</span><input name="fiscalConfig.legalName" type="text" required minlength="2" maxlength="255" /></label>
                <label><span>Nombre comercial</span><input name="fiscalConfig.commercialName" type="text" maxlength="255" /></label>
                <label><span>Tipo de identificacion *</span><input name="fiscalConfig.identificationType" type="text" required maxlength="20" /></label>
                <label><span>Numero de identificacion *</span><input name="fiscalConfig.identificationNumber" type="text" required minlength="3" maxlength="100" /></label>
                <label><span>Actividad economica</span><input name="fiscalConfig.economicActivityCode" type="text" maxlength="50" /></label>
                <label><span>Provincia</span><input name="fiscalConfig.province" type="text" maxlength="100" /></label>
                <label><span>Canton</span><input name="fiscalConfig.canton" type="text" maxlength="100" /></label>
                <label><span>Distrito</span><input name="fiscalConfig.district" type="text" maxlength="100" /></label>
                <label><span>Barrio</span><input name="fiscalConfig.neighborhood" type="text" maxlength="100" /></label>
                <label class="root-form-grid__full"><span>Direccion fiscal</span><textarea name="fiscalConfig.address" rows="2" maxlength="1000"></textarea></label>
                <label><span>Correo fiscal</span><input name="fiscalConfig.email" type="email" maxlength="255" /></label>
                <label><span>Telefono fiscal</span><input name="fiscalConfig.phone" type="text" maxlength="50" /></label>
                <label><span>Ambiente Hacienda *</span><select name="fiscalConfig.haciendaEnvironment"><option value="STAGING">STAGING</option><option value="PRODUCTION">PRODUCTION</option></select></label>
                <label><span>Sucursal default *</span><input name="fiscalConfig.defaultBranchCode" type="text" value="001" required minlength="3" maxlength="3" /></label>
                <label><span>Terminal default *</span><input name="fiscalConfig.defaultTerminalCode" type="text" value="00001" required minlength="5" maxlength="5" /></label>
              </div>
            </fieldset>

            <details class="root-form__details">
              <summary>Configuracion avanzada</summary>
              <div class="root-form-grid root-form-grid--details">
                <label><span>Ref. certificado</span><input name="fiscalConfig.certificateStorageRef" type="text" maxlength="500" /></label>
                <label><span>Ref. secreto certificado</span><input name="fiscalConfig.certificatePasswordSecretRef" type="text" maxlength="500" /></label>
                <label><span>Ref. usuario Hacienda</span><input name="fiscalConfig.haciendaUsernameSecretRef" type="text" maxlength="500" /></label>
                <label><span>Ref. password Hacienda</span><input name="fiscalConfig.haciendaPasswordSecretRef" type="text" maxlength="500" /></label>
              </div>
            </details>

            <fieldset class="root-form__section">
              <legend>Usuario administrador inicial</legend>
              <div class="root-form-grid">
                <label><span>Nombre completo *</span><input name="rootUser.fullName" type="text" required minlength="2" maxlength="255" /></label>
                <label><span>Correo</span><input name="rootUser.email" type="email" maxlength="255" /></label>
                <label><span>Usuario *</span><input name="rootUser.username" type="text" required minlength="3" maxlength="100" /></label>
                <label><span>Contrasena *</span><input name="rootUser.password" type="password" required minlength="8" maxlength="100" /></label>
                <label><span>Telefono</span><input name="rootUser.phone" type="text" maxlength="50" /></label>
              </div>
            </fieldset>

            <div class="action-row">
              <button id="companies-submit-button" type="submit">Crear empresa</button>
            </div>
          </form>
        </article>

        <article class="card root-card root-admin-list-card">
          <div class="page-header">
            <div>
              <h3>Empresas registradas</h3>
              <p class="muted">Revisa el estado activo de cada empresa y aplica cambios puntuales sin editar otros datos.</p>
            </div>
          </div>
          <div id="companies-list-message"></div>
          <div id="companies-list-region" class="table-wrapper"></div>
        </article>
      </div>
    `;
  }

  function buildCompanyPayload(formData) {
    return {
      company: {
        name: formData.get('company.name')?.trim(),
        legalId: formData.get('company.legalId')?.trim() || undefined,
        phone: formData.get('company.phone')?.trim() || undefined,
        email: formData.get('company.email')?.trim() || undefined,
        address: formData.get('company.address')?.trim() || undefined,
      },
      fiscalConfig: {
        legalName: formData.get('fiscalConfig.legalName')?.trim(),
        commercialName: formData.get('fiscalConfig.commercialName')?.trim() || undefined,
        identificationType: formData.get('fiscalConfig.identificationType')?.trim(),
        identificationNumber: formData.get('fiscalConfig.identificationNumber')?.trim(),
        economicActivityCode: formData.get('fiscalConfig.economicActivityCode')?.trim() || undefined,
        province: formData.get('fiscalConfig.province')?.trim() || undefined,
        canton: formData.get('fiscalConfig.canton')?.trim() || undefined,
        district: formData.get('fiscalConfig.district')?.trim() || undefined,
        neighborhood: formData.get('fiscalConfig.neighborhood')?.trim() || undefined,
        address: formData.get('fiscalConfig.address')?.trim() || undefined,
        email: formData.get('fiscalConfig.email')?.trim() || undefined,
        phone: formData.get('fiscalConfig.phone')?.trim() || undefined,
        haciendaEnvironment: formData.get('fiscalConfig.haciendaEnvironment')?.trim() || 'STAGING',
        certificateStorageRef: formData.get('fiscalConfig.certificateStorageRef')?.trim() || undefined,
        certificatePasswordSecretRef: formData.get('fiscalConfig.certificatePasswordSecretRef')?.trim() || undefined,
        haciendaUsernameSecretRef: formData.get('fiscalConfig.haciendaUsernameSecretRef')?.trim() || undefined,
        haciendaPasswordSecretRef: formData.get('fiscalConfig.haciendaPasswordSecretRef')?.trim() || undefined,
        defaultBranchCode: formData.get('fiscalConfig.defaultBranchCode')?.trim() || '001',
        defaultTerminalCode: formData.get('fiscalConfig.defaultTerminalCode')?.trim() || '00001',
      },
      rootUser: {
        fullName: formData.get('rootUser.fullName')?.trim(),
        email: formData.get('rootUser.email')?.trim() || undefined,
        username: formData.get('rootUser.username')?.trim(),
        password: formData.get('rootUser.password') || '',
        phone: formData.get('rootUser.phone')?.trim() || undefined,
      },
    };
  }

  function renderCompaniesTable(companies) {
    if (!companies.length) {
      return '<p class="empty-state">Aun no hay empresas registradas. Crea la primera desde este formulario.</p>';
    }

    const rows = companies.map((company) => {
      const adminUser = Array.isArray(company.users) && company.users.length > 0 ? company.users[0] : null;
      const identification = company.legalId || company.fiscalConfig?.identificationNumber || 'Sin identificacion';
      const contact = [company.email, company.phone].filter(Boolean).join(' · ') || 'Sin contacto';
      const adminLabel = adminUser?.fullName || adminUser?.username || 'Sin admin';
      const actionLabel = company.isActive ? 'Desactivar' : 'Activar';
      const nextIsActive = company.isActive ? 'false' : 'true';

      return `
        <tr>
          <td>
            <strong>${rootShellUi.escapeHtml(company.name)}</strong>
            <div class="muted">Creada el ${rootShellUi.escapeHtml(rootShellUi.formatDate(company.createdAt))}</div>
          </td>
          <td>${rootShellUi.escapeHtml(identification)}</td>
          <td>${rootShellUi.escapeHtml(adminLabel)}</td>
          <td>${rootShellUi.escapeHtml(contact)}</td>
          <td>${rootShellUi.renderStatusBadge(Boolean(company.isActive))}</td>
          <td>
            <button class="secondary-button root-inline-button" type="button" data-company-status-button data-company-id="${rootShellUi.escapeHtml(company.id)}" data-next-active="${nextIsActive}">${actionLabel}</button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <table>
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Identificacion</th>
            <th>Admin inicial</th>
            <th>Contacto</th>
            <th>Estado</th>
            <th>Accion</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  async function mount(container, session, helpers = {}) {
    const setShellStatus = typeof helpers.setShellStatus === 'function' ? helpers.setShellStatus : () => {};
    const listRegion = /** @type {HTMLElement | null} */ (container.querySelector('#companies-list-region'));
    const listMessage = /** @type {HTMLElement | null} */ (container.querySelector('#companies-list-message'));
    const formMessage = /** @type {HTMLElement | null} */ (container.querySelector('#companies-form-message'));
    const form = /** @type {HTMLFormElement | null} */ (container.querySelector('#companies-create-form'));
    const submitButton = /** @type {HTMLButtonElement | null} */ (container.querySelector('#companies-submit-button'));

    if (!listRegion || !listMessage || !formMessage || !form || !submitButton) {
      return;
    }

    async function refreshCompanies() {
      setShellStatus('Cargando empresas...');
      listMessage.innerHTML = '';
      listRegion.innerHTML = '<p class="empty-state">Cargando empresas...</p>';

      try {
        const companies = await companiesApi.listCompanies(session);
        listRegion.innerHTML = renderCompaniesTable(companies);
        setShellStatus('Sesion lista.');
      } catch (error) {
        listRegion.innerHTML = '<p class="empty-state">No se pudo cargar la informacion.</p>';
        listMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo cargar la informacion. Intenta nuevamente.', 'error');
        setShellStatus('No se pudo cargar la vista de empresas.', 'error');
      }
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      formMessage.innerHTML = '';

      if (!form.reportValidity()) {
        formMessage.innerHTML = rootShellUi.renderInlineMessage('Revisa los campos obligatorios antes de continuar.', 'error');
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'Creando empresa...';
      setShellStatus('Registrando empresa...');

      try {
        const payload = buildCompanyPayload(new FormData(form));
        await companiesApi.createCompany(session, payload);
        form.reset();
        /** @type {HTMLInputElement | null} */ (form.querySelector('[name="fiscalConfig.defaultBranchCode"]')).value = '001';
        /** @type {HTMLInputElement | null} */ (form.querySelector('[name="fiscalConfig.defaultTerminalCode"]')).value = '00001';
        /** @type {HTMLSelectElement | null} */ (form.querySelector('[name="fiscalConfig.haciendaEnvironment"]')).value = 'STAGING';
        formMessage.innerHTML = rootShellUi.renderInlineMessage('Empresa creada correctamente.');
        setShellStatus('Empresa creada correctamente.');
        await refreshCompanies();
      } catch (error) {
        formMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo crear la empresa. Revisa los datos e intentalo de nuevo.', 'error');
        setShellStatus('No se pudo crear la empresa.', 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Crear empresa';
      }
    });

    listRegion.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof window.HTMLButtonElement) || !target.hasAttribute('data-company-status-button')) {
        return;
      }

      const companyId = target.getAttribute('data-company-id');
      const nextIsActive = target.getAttribute('data-next-active') === 'true';
      if (!companyId) {
        return;
      }

      target.disabled = true;
      target.textContent = 'Guardando...';
      listMessage.innerHTML = '';
      setShellStatus('Actualizando estado de empresa...');

      try {
        await companiesApi.updateCompanyStatus(session, companyId, nextIsActive);
        setShellStatus('Estado de la empresa actualizado.');
        await refreshCompanies();
        listMessage.innerHTML = rootShellUi.renderInlineMessage('Estado de la empresa actualizado.');
      } catch (error) {
        listMessage.innerHTML = rootShellUi.renderInlineMessage(error.message || 'No se pudo actualizar el estado de la empresa.', 'error');
        setShellStatus('No se pudo actualizar el estado de la empresa.', 'error');
        target.disabled = false;
        target.textContent = nextIsActive ? 'Activar' : 'Desactivar';
      }
    });

    await refreshCompanies();
  }

  rootShell.register('views.companiesAdmin', {
    mount,
    render,
  });
}(window));
