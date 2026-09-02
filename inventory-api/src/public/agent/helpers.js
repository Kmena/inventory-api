(() => {
'use strict';

const AgentShell = /** @type {any} */ (window).AgentShell;

// ─── Prioridad de status para sortStores ─────────────────────────────────────
// Replica la lógica de agent-workspace-store-state.service.js del backend.
const STATUS_ORDER = {
  VENCIDA:          0,
  PROXIMA_A_VENCER: 1,
  NUEVA:            2,
  AL_DIA:           3,
};

const STATUS_BADGE_STYLES = {
  VENCIDA:          { bg: '#DC2626', color: '#fff', label: 'Vencida'         },
  PROXIMA_A_VENCER: { bg: '#F59E0B', color: '#fff', label: 'Próxima a vencer'},
  NUEVA:            { bg: '#16A34A', color: '#fff', label: 'Nueva'           },
  AL_DIA:           { bg: '#E2E8F0', color: '#374151', label: 'Al día'       },
};

const ORDER_STATUS_BADGE_STYLES = {
  DRAFT:         { bg: '#FEF3C7', color: '#92400E', label: 'Pendiente de aprobación' },
  APPROVED:      { bg: '#D1FAE5', color: '#065F46', label: 'Aprobado'                },
  IN_PRODUCTION: { bg: '#DBEAFE', color: '#1E40AF', label: 'En producción'           },
  DELIVERED:     { bg: '#E2E8F0', color: '#374151', label: 'Entregado'               },
  CANCELLED:     { bg: '#F1F5F9', color: '#64748B', label: 'Cancelado'               },
  REJECTED:      { bg: '#FEE2E2', color: '#991B1B', label: '↩️ Devuelto para corrección' },
};

// ─── Funciones puras ─────────────────────────────────────────────────────────

/**
 * Formatea un número como moneda CRC con símbolo ₡.
 * @param {number} amount
 * @returns {string}
 */
function currency(amount) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
}

/**
 * Ordena stores: VENCIDA > PROXIMA_A_VENCER > NUEVA > AL_DIA,
 * desempate por daysSinceReference desc, luego por nombre asc.
 * @param {any[]} stores
 * @returns {any[]}
 */
function sortStores(stores) {
  return [...(stores || [])].sort((a, b) => {
    const orderA = STATUS_ORDER[a.status] ?? 99;
    const orderB = STATUS_ORDER[b.status] ?? 99;
    if (orderA !== orderB) return orderA - orderB;

    const daysA = a.daysSinceReference ?? 0;
    const daysB = b.daysSinceReference ?? 0;
    if (daysB !== daysA) return daysB - daysA;

    return (a.name || '').localeCompare(b.name || '', 'es');
  });
}

/**
 * Escapa caracteres HTML especiales para uso seguro en innerHTML.
 * @param {any} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formatea un ISO string como DD/MM/YYYY.
 * @param {string | null | undefined} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (_err) {
    return '—';
  }
}

/**
 * Retorna el HTML del badge de status de una tienda.
 * @param {string} status
 * @returns {string}
 */
function buildStatusBadge(status) {
  const style = STATUS_BADGE_STYLES[status] || { bg: '#E2E8F0', color: '#374151', label: status || '—' };
  return `<span class="badge" style="background:${style.bg};color:${style.color};padding:2px 10px;border-radius:999px;font-size:0.78rem;font-weight:700;white-space:nowrap;">${escapeHtml(style.label)}</span>`;
}

function buildOrderStatusBadge(status) {
  const style = ORDER_STATUS_BADGE_STYLES[status] || { bg: '#E2E8F0', color: '#374151', label: status || '—' };
  return `<span class="badge" style="background:${style.bg};color:${style.color};padding:2px 10px;border-radius:999px;font-size:0.78rem;font-weight:700;white-space:nowrap;">${escapeHtml(style.label)}</span>`;
}

/**
 * Inserta un toast en containerEl y lo elimina tras durationMs ms.
 * @param {string} message
 * @param {HTMLElement} containerEl
 * @param {number} [durationMs]
 */
function showToast(message, containerEl, durationMs = 3000) {
  if (!containerEl) return;
  const p = document.createElement('p');
  p.setAttribute('role', 'status');
  p.setAttribute('aria-live', 'polite');
  p.className = 'agent-toast';
  p.textContent = message;
  containerEl.appendChild(p);
  setTimeout(() => {
    if (p.parentNode) p.parentNode.removeChild(p);
  }, durationMs);
}

// ─── Registro ────────────────────────────────────────────────────────────────

AgentShell.register('helpers', {
  currency,
  sortStores,
  escapeHtml,
  formatDate,
  buildStatusBadge,
  buildOrderStatusBadge,
  showToast,
});

})();
