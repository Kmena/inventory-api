(function attachRootClientDetailShared(globalScope) {
  const inventorySession = globalScope.InventorySession;
  const inventoryAuth = globalScope.InventoryAuth;
  const STORAGE_KEY = inventorySession.STORAGE_KEY;
  const CLIENT_DOCUMENT_TYPE_LABELS = {
    IDENTIFICACION: 'Identificacion',
    CONSTANCIA_FISCAL: 'Constancia fiscal',
    SOLICITUD_CREDITO: 'Solicitud de credito',
    REFERENCIA_COMERCIAL: 'Soporte de referencia',
    SOPORTE_REFERENCIA: 'Soporte de referencia',
    PAGARE: 'Pagare',
    CONTRATO: 'Contrato',
    KYC: 'KYC',
    OTRO: 'Otro',
  };

  function readSession() {
    return inventorySession.read();
  }

  function redirectUnauthorized(session) {
    if (!session?.user || session?.user?.role?.code !== 'admin' || !session?.user?.companyId) {
      window.location.href = '/';
      return true;
    }
    return false;
  }

  function setMessage(element, text, isError = false) {
    element.textContent = text;
    element.className = 'message';
    if (isError) {
      element.classList.add('error');
    }
  }

  function text(value) {
    return value || '-';
  }

  function optional(value) {
    const normalized = value?.toString().trim();
    return normalized || undefined;
  }

  function optionalNumber(value) {
    const normalized = optional(value);
    if (normalized === undefined) {
      return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function money(value) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(amount);
  }

  function paymentTypeText(value) {
    const labels = {
      CASH: 'Contado',
      CREDIT: 'Credito',
      TRANSFER: 'Transferencia',
      CARD: 'Tarjeta',
    };

    return labels[value] || value || '-';
  }

  function documentTypeText(value) {
    return CLIENT_DOCUMENT_TYPE_LABELS[value] || value || '-';
  }

  function dateText(value) {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('es-CR').format(new Date(value));
  }

  function detailItem(label, value) {
    return `
      <div class="detail-item">
        <span>${label}</span>
        <strong>${text(value)}</strong>
      </div>
    `;
  }

  async function downloadProtectedClientDocument(session, fileUrl, fileName) {
    return inventoryAuth.downloadProtectedFile(session, fileUrl, {
      fileName,
      fallbackMessage: 'No se pudo descargar el documento',
      storageKey: STORAGE_KEY,
    });
  }

  globalScope.RootClientDetailShared = {
    STORAGE_KEY,
    CLIENT_DOCUMENT_TYPE_LABELS,
    readSession,
    redirectUnauthorized,
    setMessage,
    text,
    optional,
    optionalNumber,
    money,
    paymentTypeText,
    documentTypeText,
    dateText,
    detailItem,
    downloadProtectedClientDocument,
  };
}(window));
