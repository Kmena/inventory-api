(function attachRootShellHomeView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function renderHomeView(session) {
    const fullName = escapeHtml(session?.user?.fullName || session?.user?.username || 'Usuario');
    const roleCode = escapeHtml(session?.user?.role?.code || 'sin rol');

    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Panel root</p>
        <h2 id="root-view-title">Inicio</h2>
        <p class="muted">Este es el acceso inicial del panel root. Desde aqui puedes confirmar tu sesion activa y navegar a los modulos disponibles en esta primera ola.</p>
      </section>

      <div class="root-card-grid">
        <article class="card root-card">
          <h3>Resumen rapido</h3>
          <ul class="root-list">
            <li>Sesion autenticada para <strong>${fullName}</strong>.</li>
            <li>Rol detectado: <strong>${roleCode}</strong>.</li>
            <li>Acceso al shell root validado con la sesion browser actual.</li>
          </ul>
        </article>

        <article class="card root-card">
          <h3>Que puedes hacer hoy</h3>
          <ul class="root-list">
            <li>Confirmar que tu acceso al panel root esta activo.</li>
            <li>Revisar los modulos pendientes de incorporacion.</li>
            <li>Cerrar sesion de forma segura.</li>
          </ul>
        </article>

        <article class="card root-card root-card--wide">
          <h3>Proximos modulos</h3>
          <p class="muted">Los modulos administrativos del panel root se habilitaran por etapas. Esta primera ola establece el acceso seguro, la navegacion minima y el fallback controlado para trabajo futuro.</p>
          <div class="action-row">
            <a class="button-link" href="/root/#in_process">Ver pendientes</a>
          </div>
        </article>
      </div>
    `;
  }

  rootShell.register('views.home', {
    render: renderHomeView,
  });
}(window));
