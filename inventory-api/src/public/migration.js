const inventorySession = /** @type {any} */ (window).InventorySession;
const migrationTitle = /** @type {HTMLElement | null} */ (document.getElementById('migration-title'));
const migrationPrimaryMessage = /** @type {HTMLElement | null} */ (document.getElementById('migration-primary-message'));
const migrationSecondaryMessage = /** @type {HTMLElement | null} */ (document.getElementById('migration-secondary-message'));
const migrationStatusNote = /** @type {HTMLElement | null} */ (document.getElementById('migration-status-note'));
const logoutButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('migration-logout-button'));

const POST_LOGIN_TRANSITION_MODE = 'post-login-transition';

if (!migrationTitle || !migrationPrimaryMessage || !migrationSecondaryMessage || !migrationStatusNote) {
  throw new Error('No se encontraron los elementos esperados de la pantalla de migracion.');
}

if (!logoutButton) {
  throw new Error('No se encontro el boton de cierre de sesion de migracion.');
}

function readMigrationMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('mode');
}

function renderDeprecatedRouteMode() {
  migrationTitle.textContent = 'Esta ruta ya no se encuentra disponible';
  migrationPrimaryMessage.textContent = 'El acceso publico a esta URL fue retirado como parte de una actualizacion de la plataforma. Para continuar, ingresa desde el acceso principal.';
  migrationSecondaryMessage.textContent = 'Si necesitas acceder a una funcion vigente, contacta al administrador de tu empresa.';
  migrationStatusNote.hidden = false;
}

function renderPostLoginTransitionMode() {
  migrationTitle.textContent = 'Iniciaste sesion correctamente';
  migrationPrimaryMessage.textContent = 'Tu cuenta ingreso correctamente, pero el modulo de destino aun no esta implementado en esta version.';
  migrationSecondaryMessage.textContent = 'Esta es una pagina temporal informativa. Puedes volver al inicio de sesion o cerrar sesion de forma segura mientras se implementan los destinos finales por rol.';
  migrationStatusNote.hidden = true;
  const homeLink = /** @type {HTMLAnchorElement | null} */ (document.getElementById('migration-home-link'));
  if (homeLink) {
    homeLink.textContent = 'Volver al inicio de sesion';
  }
}

function renderMigrationView() {
  if (readMigrationMode() === POST_LOGIN_TRANSITION_MODE) {
    renderPostLoginTransitionMode();
    return;
  }

  renderDeprecatedRouteMode();
}

logoutButton.addEventListener('click', () => {
  inventorySession.clearAndRedirectToLogin();
});

renderMigrationView();
