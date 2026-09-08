(function attachRootShellFeedbackAdminView(globalScope) {
  const rootShell = /** @type {any} */ (globalScope).RootShell;
  const feedbackApi = rootShell.require('feedbackApi');
  const ui = rootShell.require('ui');

  const RATING_EMOJI = { 1: '😞', 2: '😐', 3: '😊', 4: '😄', 5: '🤩' };
  const CATEGORY_LABEL = { bug: '🐛 Bug', sugerencia: '💡 Sugerencia', elogio: '👏 Elogio' };

  function renderRatingEmoji(rating) {
    return RATING_EMOJI[rating] || ui.escapeHtml(String(rating));
  }

  function renderCategoryLabel(category) {
    return CATEGORY_LABEL[category] || ui.escapeHtml(String(category));
  }

  function renderStatusBadge(resolved) {
    if (resolved) {
      return '<span class="badge badge-success">Resuelto</span>';
    }
    return '<span class="badge badge-warning">Pendiente</span>';
  }

  function formatDate(dateStr, opts) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('es-CR', opts);
  }

  function openDetailModal(item) {
    const existing = globalScope.document.getElementById('feedback-detail-overlay');
    if (existing) existing.parentNode.removeChild(existing);

    const overlay = globalScope.document.createElement('div');
    overlay.id = 'feedback-detail-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:10000',
      'background:rgba(0,0,0,0.5)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'padding:16px',
    ].join(';');

    const createdAt = formatDate(item.createdAt, { dateStyle: 'long', timeStyle: 'short' });
    const resolvedAt = formatDate(item.resolvedAt, { dateStyle: 'long', timeStyle: 'short' });

    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="feedback-detail-title"
           style="background:#fff;color:#1e293b;border-radius:12px;padding:24px;max-width:580px;width:100%;max-height:90vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 id="feedback-detail-title" style="margin:0;font-size:1.1rem;">
            ${renderRatingEmoji(item.rating)} ${renderCategoryLabel(item.category)}
          </h2>
          <button id="feedback-detail-close" type="button" aria-label="Cerrar"
                  style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:4px;">✕</button>
        </div>

        <dl style="display:grid;grid-template-columns:140px 1fr;gap:8px 16px;margin:0;">
          <dt style="font-weight:600;">Usuario</dt>
          <dd style="margin:0;">${ui.escapeHtml(item.userEmail || '—')}<br><small class="muted">${ui.escapeHtml(item.userName || '')}</small></dd>

          <dt style="font-weight:600;">Empresa ID</dt>
          <dd style="margin:0;">${item.companyId != null ? ui.escapeHtml(String(item.companyId)) : '—'}</dd>

          <dt style="font-weight:600;">Contexto</dt>
          <dd style="margin:0;">${ui.escapeHtml(item.context || '—')}</dd>

          <dt style="font-weight:600;">Ruta</dt>
          <dd style="margin:0;">${ui.escapeHtml(item.route || '—')}</dd>

          <dt style="font-weight:600;">Fecha</dt>
          <dd style="margin:0;">${ui.escapeHtml(createdAt)}</dd>

          <dt style="font-weight:600;">Estado</dt>
          <dd style="margin:0;">${renderStatusBadge(item.resolved)}${resolvedAt ? ` <small class="muted">${ui.escapeHtml(resolvedAt)}</small>` : ''}</dd>

          <dt style="font-weight:600;align-self:start;">Comentario</dt>
          <dd style="margin:0;white-space:pre-wrap;">${ui.escapeHtml(item.comment || '—')}</dd>

          <dt style="font-weight:600;align-self:start;">Mejora</dt>
          <dd style="margin:0;white-space:pre-wrap;">${ui.escapeHtml(item.improvement || '—')}</dd>
        </dl>
      </div>`;

    function closeModal() {
      overlay.parentNode && overlay.parentNode.removeChild(overlay);
      globalScope.document.removeEventListener('keydown', onKeydown);
    }
    function onKeydown(e) { if (e.key === 'Escape') closeModal(); }

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    overlay.querySelector('#feedback-detail-close').addEventListener('click', closeModal);
    globalScope.document.addEventListener('keydown', onKeydown);

    globalScope.document.body.appendChild(overlay);
    overlay.querySelector('#feedback-detail-close').focus();
  }

  function renderFeedbackRow(item) {
    const resolvedAtText = formatDate(item.resolvedAt, { dateStyle: 'short' });
    const createdAtText = formatDate(item.createdAt, { dateStyle: 'short', timeStyle: 'short' });
    const commentTruncated = ui.escapeHtml(
      item.comment && item.comment.length > 120
        ? `${item.comment.slice(0, 117)}...`
        : (item.comment || ''),
    );
    const userEmail = ui.escapeHtml(item.userEmail || '—');
    const userName = ui.escapeHtml(item.userName || '—');
    const context = ui.escapeHtml(item.context || '—');
    const route = ui.escapeHtml(item.route || '—');
    const companyId = item.companyId != null ? ui.escapeHtml(String(item.companyId)) : '—';
    const improvement = item.improvement
      ? ui.escapeHtml(item.improvement.length > 120 ? `${item.improvement.slice(0, 117)}...` : item.improvement)
      : '—';

    const actionButton = item.resolved
      ? `<button type="button" class="secondary-button" disabled>Resuelto</button>`
      : `<button type="button" class="secondary-button" data-resolve-feedback-id="${item.id}">Marcar como resuelto</button>`;

    return `
      <tr data-feedback-id="${item.id}" style="cursor:pointer;" title="Click para ver detalle">
        <td>${renderRatingEmoji(item.rating)}</td>
        <td>${renderCategoryLabel(item.category)}</td>
        <td>${commentTruncated}</td>
        <td>${improvement}</td>
        <td>${userEmail}<br><small class="muted">${userName}</small></td>
        <td>${companyId}</td>
        <td>${context}</td>
        <td>${route}</td>
        <td><small>${createdAtText}</small></td>
        <td>${renderStatusBadge(item.resolved)}${resolvedAtText ? `<br><small>${resolvedAtText}</small>` : ''}</td>
        <td>${actionButton}</td>
      </tr>`;
  }

  function renderFeedbackTable(items) {
    if (!items || items.length === 0) {
      return '<p class="muted">No hay feedback para mostrar.</p>';
    }
    const rows = items.map(renderFeedbackRow).join('');
    return `
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rating</th>
              <th>Categoría</th>
              <th>Comentario</th>
              <th>Mejora</th>
              <th>Usuario</th>
              <th>Empresa</th>
              <th>Contexto</th>
              <th>Ruta</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function render() {
    return `
      <section class="root-hero" aria-labelledby="feedback-view-title">
        <p class="eyebrow">Panel root</p>
        <h2 id="feedback-view-title">Feedback</h2>
        <p class="muted">Consulta y gestiona el feedback enviado por los usuarios del sistema.</p>
      </section>

      <section class="commercial-page" id="feedback-page">
        <div class="page-header">
          <div>
            <h3>Listado de feedback</h3>
          </div>
          <div class="action-row compact-action-row">
            <label>
              <span>Filtrar por estado</span>
              <select id="feedback-filter">
                <option value="all">Todos</option>
                <option value="false">Pendientes</option>
                <option value="true">Resueltos</option>
              </select>
            </label>
          </div>
        </div>

        <div id="feedback-page-message"></div>
        <div id="feedback-list-region" aria-live="polite"></div>
      </section>
    `.trim();
  }

  async function mount(container, session, helpers = {}) {
    const setShellStatus = helpers.setShellStatus || (() => {});

    container.innerHTML = render(session);

    const filterSelect = container.querySelector('#feedback-filter');
    const listRegion = container.querySelector('#feedback-list-region');
    const pageMessage = container.querySelector('#feedback-page-message');

    if (!filterSelect || !listRegion || !pageMessage) {
      setShellStatus('Error al inicializar la vista de feedback.', 'error');
      return;
    }

    let currentItems = [];

    async function loadAndRender(resolvedFilter) {
      setShellStatus('Cargando feedback...');
      listRegion.innerHTML = '<p class="muted">Cargando...</p>';
      pageMessage.innerHTML = '';
      try {
        currentItems = await feedbackApi.listFeedback(session, resolvedFilter);
        listRegion.innerHTML = renderFeedbackTable(currentItems);
        setShellStatus('');
      } catch (err) {
        const msg = ui.escapeHtml(err?.message || 'No se pudo cargar el feedback.');
        listRegion.innerHTML = '';
        pageMessage.innerHTML = `<p class="message error" role="status">${msg}</p>`;
        setShellStatus('Error al cargar feedback.', 'error');
      }
    }

    filterSelect.addEventListener('change', () => {
      loadAndRender(filterSelect.value);
    });

    listRegion.addEventListener('click', async (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;

      // Resolver feedback — no abrir modal
      const resolveButton = target.closest('[data-resolve-feedback-id]');
      if (resolveButton instanceof HTMLElement) {
        const feedbackId = resolveButton.getAttribute('data-resolve-feedback-id');
        if (!feedbackId) return;
        resolveButton.disabled = true;
        resolveButton.textContent = 'Resolviendo...';
        try {
          await feedbackApi.resolveFeedback(session, feedbackId);
          await loadAndRender(filterSelect.value);
        } catch (err) {
          const msg = ui.escapeHtml(err?.message || 'No se pudo marcar como resuelto.');
          pageMessage.innerHTML = `<p class="message error" role="status">${msg}</p>`;
          resolveButton.disabled = false;
          resolveButton.textContent = 'Marcar como resuelto';
        }
        return;
      }

      // Click en fila — abrir modal de detalle
      const row = target.closest('[data-feedback-id]');
      if (!(row instanceof HTMLElement)) return;
      const feedbackId = parseInt(row.getAttribute('data-feedback-id') || '', 10);
      const item = currentItems.find((i) => i.id === feedbackId);
      if (item) openDetailModal(item);
    });

    await loadAndRender('all');
  }

  rootShell.register('views.feedbackAdmin', { render, mount });
}(window));
