const inventorySession = /** @type {any} */ (window).InventorySession;
const logoutButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('logout-button'));

if (!logoutButton) {
  throw new Error('No se encontro el boton para cerrar sesion.');
}

logoutButton.addEventListener('click', () => {
  inventorySession.clearAndRedirectToLogin();
});
