(function attachRootClientDetailShared(globalScope) {
  const STORAGE_KEY = 'inventory-api-auth';
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
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  }

  function redirectUnauthorized(session) {
    if (!session?.token || session?.user?.role?.code !== 'admin' || !session?.user?.companyId) {
      window.location.href = '/';
      return true;
    }
    return false;
  }

  function authHeaders(session) {
    return {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    };
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
    const response = await fetch(fileUrl, {
      headers: { Authorization: `Bearer ${session.token}` },
    });

    if (!response.ok) {
      let result = null;
      try {
        result = await response.json();
      } catch (_error) {
        result = null;
      }

      throw new Error(result?.message || 'No se pudo descargar el documento');
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName || 'documento';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  globalScope.RootClientDetailShared = {
    STORAGE_KEY,
    CLIENT_DOCUMENT_TYPE_LABELS,
    readSession,
    redirectUnauthorized,
    authHeaders,
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
