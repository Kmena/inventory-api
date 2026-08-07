(() => {
'use strict';

const AgentShell = /** @type {any} */ (window).AgentShell;

// ─── Color de barra de progreso ───────────────────────────────────────────────

function progressColor(pct) {
  if (pct <= 30)  return '#DC2626';
  if (pct <= 70)  return '#F59E0B';
  return '#16A34A';
}

// ─── Render de GoalCard ───────────────────────────────────────────────────────

function renderGoalCard(goal) {
  const h = AgentShell.require('helpers');
  const pct    = goal.progressPercent ?? 0;
  const isHit  = (goal.currentAmount ?? 0) >= (goal.targetAmount ?? Infinity);
  const barW   = isHit ? 100 : Math.max(pct > 0 ? 4 : 0, Math.min(100, pct));
  const barColor = progressColor(pct);
  const badgeBg  = progressColor(pct);

  const badge = isHit
    ? `<span class="agent-goal-percent-badge" style="background:#dcfce7;color:#15803d;">¡Meta alcanzada! 🎉</span>`
    : `<span class="agent-goal-percent-badge" style="background:${badgeBg};color:#fff;">${pct}%</span>`;

  const amountColor = isHit ? '#16A34A' : 'inherit';

  return `
    <article class="agent-goal-card">
      <div class="agent-goal-card__header">
        <div>
          <h3 class="agent-goal-card__title">${h.escapeHtml(goal.title || goal.name || '—')}</h3>
          <p class="agent-goal-card__period">${h.escapeHtml(goal.periodLabel || goal.period || '')}</p>
        </div>
        ${badge}
      </div>
      <div role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" style="background:#e2e8f0;border-radius:999px;height:8px;overflow:hidden;">
        <div style="width:${barW}%;height:100%;background:${barColor};border-radius:999px;transition:width 0.3s;"></div>
      </div>
      <div class="agent-goal-amounts">
        <span style="color:#64748b;">Actual: <strong style="color:${amountColor};">${h.currency(goal.currentAmount ?? 0)}</strong></span>
        <span style="color:#64748b;">Meta: <strong>${h.currency(goal.targetAmount ?? 0)}</strong></span>
      </div>
    </article>`;
}

function renderSkeleton() {
  return `
    <div class="agent-goals-skeleton">
      <div class="agent-skeleton-card"></div>
      <div class="agent-skeleton-card"></div>
    </div>`;
}

function renderGoalsPage(goals) {
  const h = AgentShell.require('helpers');
  const navigate = AgentShell.require('navigate');

  return `
    <div class="agent-page">
      <header class="agent-header" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:0;">
        <button type="button" id="goals-back-btn" class="secondary-button">← Inicio</button>
        <h1 style="margin:0;font-size:1.3rem;">Mis metas</h1>
      </header>
      ${goals.length === 0
        ? `<div style="text-align:center;padding:48px 16px;display:grid;gap:12px;">
             <div style="font-size:3rem;">🎯</div>
             <h2 style="margin:0;font-size:1.1rem;">No tienes metas activas</h2>
           </div>`
        : `<div class="agent-goals-list">${goals.map(renderGoalCard).join('')}</div>`
      }
    </div>`;
}

// ─── Render principal ─────────────────────────────────────────────────────────

async function render(containerEl, session, _params) {
  const api      = AgentShell.require('api.agentApi');
  const state    = AgentShell.require('state');
  const navigate = AgentShell.require('navigate');

  // Reutiliza state si ya tiene datos (no hace re-fetch)
  const cached = state.getGoals();
  if (cached.length > 0) {
    containerEl.innerHTML = renderGoalsPage(cached);
    const backBtn = containerEl.querySelector('#goals-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => navigate('dashboard'));
    return;
  }

  // Skeleton mientras carga
  containerEl.innerHTML = `
    <div class="agent-page">
      <header class="agent-header" style="display:flex;align-items:center;gap:12px;margin-bottom:0;">
        <button type="button" id="goals-back-btn" class="secondary-button">← Inicio</button>
        <h1 style="margin:0;font-size:1.3rem;">Mis metas</h1>
      </header>
      ${renderSkeleton()}
    </div>`;

  const backBtnSkeleton = containerEl.querySelector('#goals-back-btn');
  if (backBtnSkeleton) backBtnSkeleton.addEventListener('click', () => navigate('dashboard'));

  try {
    const data  = await api.fetchGoals(session);
    const goals = data?.goals || [];
    state.setGoals(goals);
    containerEl.innerHTML = renderGoalsPage(goals);
    const backBtn = containerEl.querySelector('#goals-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => navigate('dashboard'));
  } catch (err) {
    containerEl.innerHTML = `
      <div class="agent-page">
        <header class="agent-header" style="display:flex;align-items:center;gap:12px;margin-bottom:0;">
          <button type="button" id="goals-back-btn-err" class="secondary-button">← Inicio</button>
          <h1 style="margin:0;font-size:1.3rem;">Mis metas</h1>
        </header>
        <div class="agent-error-banner">
          <p style="margin:0;font-weight:700;">No se pudieron cargar las metas</p>
          <p style="margin:0;">${AgentShell.require('helpers').escapeHtml(err.message || 'Error de red.')}</p>
          <button type="button" id="goals-retry-btn" class="btn" style="background:#DC2626;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:700;width:max-content;">Reintentar</button>
        </div>
      </div>`;
    const backBtnErr = containerEl.querySelector('#goals-back-btn-err');
    if (backBtnErr) backBtnErr.addEventListener('click', () => navigate('dashboard'));
    const retryBtn = containerEl.querySelector('#goals-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', () => render(containerEl, session, _params));
  }
}

AgentShell.register('views.goals', { render });

})();
