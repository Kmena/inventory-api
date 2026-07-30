(function attachRootShellInProcessView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;

  function renderInProcessView() {
    return `
      <section class="root-hero" aria-labelledby="root-view-title">
        <p class="eyebrow">Panel root</p>
        <h2 id="root-view-title">Modulo en progreso</h2>
        <p class="muted">Proximamente podras gestionar este modulo desde aqui.</p>
      </section>

      <article class="card root-card root-card--wide root-card--placeholder">
        <p class="root-badge">En proceso</p>
        <p class="muted">Esta seccion ya forma parte de la navegacion aprobada del shell administrativo, pero su flujo funcional aun no esta disponible en esta primera ola.</p>
      </article>
    `;
  }

  rootShell.register('views.inProcess', {
    render: renderInProcessView,
  });
}(window));
