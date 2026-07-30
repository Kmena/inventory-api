(function attachRootShellInProcessView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  function renderInProcessView() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Panel root</p>
        <h2 id="root-view-title">Pendientes</h2>
        <p class="muted">Algunos modulos administrativos todavia estan en proceso de incorporacion al nuevo shell.</p>
      </section>

      <article class="card root-card root-card--wide">
        <p class="root-badge">En proceso</p>
        <p class="muted">Esta primera ola incluye el acceso autenticado, navegacion minima y cierre seguro. Los modulos del panel root se integraran gradualmente.</p>
        <h3>Proximas incorporaciones</h3>
        <ul class="root-list">
          <li>Navegacion ampliada del panel root.</li>
          <li>Modulos root migrados desde el inventario legacy preservado.</li>
          <li>Ajustes de visibilidad por permisos en specs posteriores aprobados.</li>
        </ul>
        <div class="action-row">
          <a class="button-link" href="/root/#home">Volver a Inicio</a>
        </div>
      </article>
    `;
  }

  rootShell.register('views.inProcess', {
    render: renderInProcessView,
  });
}(window));
