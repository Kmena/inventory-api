const clientDetailShared = window.RootClientDetailShared;
const clientDetailRenderers = window.RootClientDetailRenderers;
const clientDetailReferences = window.RootClientDetailReferences;

const session = clientDetailShared.readSession();
if (clientDetailShared.redirectUnauthorized(session)) {
  // La redireccion corta la ejecucion interactiva de la pagina.
} else {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('id');
  const elements = {
    sessionLabel: document.getElementById('client-detail-session'),
    logoutButton: document.getElementById('logout-button'),
    message: document.getElementById('client-detail-message'),
    clientTitle: document.getElementById('client-title'),
    summary: document.getElementById('client-summary'),
    tabButtons: [...document.querySelectorAll('.tab-button')],
    tabPanels: [...document.querySelectorAll('.tab-panel')],
    generalPanel: document.getElementById('tab-general'),
    storesPanel: document.getElementById('tab-stores'),
    peoplePanel: document.getElementById('tab-people'),
    documentsPanel: document.getElementById('tab-documents'),
    referencesPanel: document.getElementById('tab-references'),
    creditPanel: document.getElementById('tab-credit'),
  };

  let currentClient = null;

  elements.sessionLabel.textContent = `Sesion activa: ${session.user.fullName} (${session.user.username})`;

  const setMessage = (text, isError = false) => clientDetailShared.setMessage(elements.message, text, isError);

  async function loadClient() {
    if (!clientId) {
      throw new Error('No se indico el cliente a consultar');
    }

    const response = await fetch(`/api/clients/${clientId}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    const client = await response.json();
    if (!response.ok) {
      throw new Error(client.message || 'No se pudo cargar el cliente');
    }

    currentClient = client;
    clientDetailRenderers.renderClient(elements, client);
    clientDetailReferences.renderReferences(elements.referencesPanel, client, {
      session,
      setMessage,
      reloadClient: loadClient,
    });
  }

  async function handleProtectedDocumentDownload(event) {
    const button = event.target.closest('.client-document-download-button');
    if (!button) {
      return;
    }

    button.disabled = true;
    const originalLabel = button.textContent;
    button.textContent = 'Descargando...';

    try {
      setMessage('');
      await clientDetailShared.downloadProtectedClientDocument(session, button.dataset.fileUrl, button.dataset.fileName);
    } catch (error) {
      setMessage(error.message || 'No se pudo descargar el documento', true);
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }

  function activateTab(button) {
    elements.tabButtons.forEach((item) => item.classList.toggle('active', item === button));
    elements.tabPanels.forEach((panel) => panel.classList.toggle('hidden', panel.id !== `tab-${button.dataset.tab}`));
  }

  elements.documentsPanel.addEventListener('click', handleProtectedDocumentDownload);
  elements.tabButtons.forEach((button) => {
    button.addEventListener('click', () => activateTab(button));
  });

  elements.logoutButton.addEventListener('click', () => {
    localStorage.removeItem(clientDetailShared.STORAGE_KEY);
    window.location.href = '/';
  });

  loadClient().catch((error) => {
    setMessage(error.message || 'No se pudo cargar el cliente', true);
  });
}
