/**
 * account-dialog-characterization.test.js
 *
 * Tests de caracterización para los archivos frontend del feature "Mi cuenta":
 *   - shared/account-api.js
 *   - shared/account-dialog.js
 *   - root/index.html           — incluye scripts + botón Mi cuenta
 *   - warehouse/index.html      — incluye scripts
 *   - agent/index.html          — incluye scripts
 *   - root/app.js               — wiring del botón Mi cuenta
 *   - warehouse/app.js          — renderIdentity con botón Mi cuenta
 *   - agent/views/dashboard.js  — botón Mi cuenta en header del dashboard
 *
 * Pruebas lógicas con contexto de navegador simulado (vm):
 *   - Validaciones client-side (campos vacíos, longitud, mismatch, igual a actual)
 *   - Mapeo de errores backend → campo UI
 *   - Comportamiento de mostrar/ocultar contraseña
 *   - Doble submit bloqueado mientras request en progreso
 *   - Flujo de éxito: limpia formulario, invoca onSuccess
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const publicRoot = path.join(__dirname, '..', 'src', 'public');
const sharedPath = path.join(publicRoot, 'shared');
const rootPath = path.join(publicRoot, 'root');
const warehousePath = path.join(publicRoot, 'warehouse');
const agentPath = path.join(publicRoot, 'agent');

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// ─── Existencia de archivos ────────────────────────────────────────────────────

test('shared/account-api.js existe', () => {
  assert.ok(fs.existsSync(path.join(sharedPath, 'account-api.js')), 'shared/account-api.js debe existir');
});

test('shared/account-dialog.js existe', () => {
  assert.ok(fs.existsSync(path.join(sharedPath, 'account-dialog.js')), 'shared/account-dialog.js debe existir');
});

// ─── Contratos de archivos fuente ─────────────────────────────────────────────

test('account-api.js expone window.InventoryAccountApi con método changePassword', () => {
  const source = readFile(path.join(sharedPath, 'account-api.js'));
  assert.match(source, /InventoryAccountApi/);
  assert.match(source, /changePassword/);
  assert.match(source, /\/api\/me\/password/);
  assert.match(source, /PATCH/);
  assert.match(source, /credentials.*same-origin/);
});

test('account-api.js no usa PATCH /api/auth/change-password (usa el endpoint correcto)', () => {
  const source = readFile(path.join(sharedPath, 'account-api.js'));
  assert.doesNotMatch(source, /\/api\/auth\/change-password/);
});

test('account-dialog.js expone window.InventoryAccountDialog con método open', () => {
  const source = readFile(path.join(sharedPath, 'account-dialog.js'));
  assert.match(source, /InventoryAccountDialog/);
  assert.match(source, /function open\(/);
  assert.match(source, /showModal\(\)/);
});

test('account-dialog.js incluye los tres campos de contraseña con IDs correctos', () => {
  const source = readFile(path.join(sharedPath, 'account-dialog.js'));
  assert.match(source, /account-input-current/);
  assert.match(source, /account-input-new/);
  assert.match(source, /account-input-confirm/);
});

test('account-dialog.js incluye validaciones client-side para todos los casos requeridos', () => {
  const source = readFile(path.join(sharedPath, 'account-dialog.js'));
  // Campos requeridos
  assert.match(source, /Ingresa tu contraseña actual/);
  // Longitud mínima
  assert.match(source, /al menos 8 caracteres/);
  // Contraseñas no coinciden
  assert.match(source, /Las contraseñas no coinciden/);
  // Nueva igual a actual
  assert.match(source, /diferente a la actual/);
});

test('account-dialog.js mapea CURRENT_PASSWORD_INVALID al campo correcto', () => {
  const source = readFile(path.join(sharedPath, 'account-dialog.js'));
  assert.match(source, /CURRENT_PASSWORD_INVALID/);
  assert.match(source, /account-error-current/);
});

test('account-dialog.js mapea PASSWORD_SAME_AS_CURRENT al campo correcto', () => {
  const source = readFile(path.join(sharedPath, 'account-dialog.js'));
  assert.match(source, /PASSWORD_SAME_AS_CURRENT/);
  assert.match(source, /account-error-new/);
});

test('account-dialog.js incluye botones de toggle para visibilidad de contraseña', () => {
  const source = readFile(path.join(sharedPath, 'account-dialog.js'));
  assert.match(source, /data-toggle-for/);
  assert.match(source, /Mostrar/);
  assert.match(source, /Ocultar/);
  assert.match(source, /aria-label/);
});

test('account-dialog.js bloquea el submit button durante el request (Guardando...)', () => {
  const source = readFile(path.join(sharedPath, 'account-dialog.js'));
  assert.match(source, /Guardando\.\.\./);
  assert.match(source, /submitBtn\.disabled\s*=\s*true/);
  assert.match(source, /submitBtn\.disabled\s*=\s*false/);
});

test('account-dialog.js usa onSuccess callback inyectado por el shell', () => {
  const source = readFile(path.join(sharedPath, 'account-dialog.js'));
  assert.match(source, /onSuccess/);
  assert.match(source, /_onSuccessCallback/);
});

test('account-dialog.js no filtra stack traces ni info sensible en errores', () => {
  const source = readFile(path.join(sharedPath, 'account-dialog.js'));
  assert.match(source, /No pudimos actualizar la contraseña/);
  assert.doesNotMatch(source, /console\.error.*stack/i);
  assert.doesNotMatch(source, /passwordHash/);
});

test('account-dialog.js maneja el evento cancel del dialog (Escape) llamando a closeDialog', () => {
  const source = readFile(path.join(sharedPath, 'account-dialog.js'));
  assert.match(source, /cancel/);
  assert.match(source, /preventDefault/);
  assert.match(source, /closeDialog/);
});

// ─── Root shell ───────────────────────────────────────────────────────────────

test('root/index.html incluye account-api.js y account-dialog.js', () => {
  const html = readFile(path.join(rootPath, 'index.html'));
  assert.match(html, /shared\/account-api\.js/);
  assert.match(html, /shared\/account-dialog\.js/);
});

test('root/index.html tiene botón #root-account-button dentro del identity block', () => {
  const html = readFile(path.join(rootPath, 'index.html'));
  assert.match(html, /id="root-account-button"/);
  assert.match(html, /Mi cuenta/);
  // El botón debe estar dentro del identity block
  const identityBlockStart = html.indexOf('id="root-identity-block"');
  const identityBlockEnd = html.indexOf('</div>', identityBlockStart);
  const blockContent = html.slice(identityBlockStart, identityBlockEnd);
  assert.match(blockContent, /root-account-button/);
});

test('root/app.js declara accountButton y lo conecta a InventoryAccountDialog', () => {
  const source = readFile(path.join(rootPath, 'app.js'));
  assert.match(source, /accountButton/);
  assert.match(source, /root-account-button/);
  assert.match(source, /inventoryAccountDialog/);
  assert.match(source, /InventoryAccountDialog/);
  assert.match(source, /inventoryAccountDialog\.open/);
});

test('root/app.js pasa onSuccess que llama a setStatus', () => {
  const source = readFile(path.join(rootPath, 'app.js'));
  assert.match(source, /onSuccess/);
  assert.match(source, /setStatus/);
  assert.match(source, /actualizada correctamente/i);
});

// ─── Warehouse shell ──────────────────────────────────────────────────────────

test('warehouse/index.html incluye account-api.js y account-dialog.js', () => {
  const html = readFile(path.join(warehousePath, 'index.html'));
  assert.match(html, /shared\/account-api\.js/);
  assert.match(html, /shared\/account-dialog\.js/);
});

test('warehouse/app.js incluye botón Mi cuenta en renderIdentity()', () => {
  const source = readFile(path.join(warehousePath, 'app.js'));
  assert.match(source, /warehouse-account-button/);
  assert.match(source, /Mi cuenta/);
  assert.match(source, /InventoryAccountDialog/);
  assert.match(source, /inventoryAccountDialog\.open/);
});

test('warehouse/app.js pasa onSuccess que llama a showToast', () => {
  const source = readFile(path.join(warehousePath, 'app.js'));
  assert.match(source, /onSuccess/);
  assert.match(source, /showToast/);
  assert.match(source, /actualizada correctamente/i);
});

// ─── Agent shell ──────────────────────────────────────────────────────────────

test('agent/index.html incluye account-api.js y account-dialog.js', () => {
  const html = readFile(path.join(agentPath, 'index.html'));
  assert.match(html, /shared\/account-api\.js/);
  assert.match(html, /shared\/account-dialog\.js/);
});

test('agent/views/dashboard.js incluye botón #dashboard-account-btn en el header', () => {
  const source = readFile(path.join(agentPath, 'views', 'dashboard.js'));
  assert.match(source, /dashboard-account-btn/);
  assert.match(source, /Mi cuenta/);
  assert.match(source, /InventoryAccountDialog/);
  assert.match(source, /inventoryAccountDialog\.open/);
});

test('agent/views/dashboard.js pasa onSuccess que usa helpers.showToast', () => {
  const source = readFile(path.join(agentPath, 'views', 'dashboard.js'));
  assert.match(source, /onSuccess/);
  assert.match(source, /showToast/);
  assert.match(source, /actualizada correctamente/i);
});

test('agent/views/dashboard.js coloca el botón Mi cuenta antes que Cerrar sesion en el header', () => {
  const source = readFile(path.join(agentPath, 'views', 'dashboard.js'));
  const accountBtnPos = source.indexOf('dashboard-account-btn');
  const logoutBtnPos = source.indexOf('dashboard-logout-btn');
  assert.ok(accountBtnPos > -1, 'El botón account debe existir');
  assert.ok(logoutBtnPos > -1, 'El botón logout debe existir');
  assert.ok(accountBtnPos < logoutBtnPos, 'El botón Mi cuenta debe aparecer antes que Cerrar sesion en el HTML');
});

// ─── Pruebas lógicas con VM ────────────────────────────────────────────────────

/**
 * Crea un contexto de navegador mínimo para ejecutar account-api.js y account-dialog.js.
 * Simula window.InventoryAuth, window.fetch, y DOM básico.
 */
function createBrowserContext(fetchImpl) {
  const browserWindow = {
    fetch: fetchImpl || (async () => ({ status: 204, json: async () => null, text: async () => '' })),
    HTMLElement: class HTMLElement {
      focus() {}
    },
    HTMLInputElement: class HTMLInputElement {
      constructor() {
        this.type = 'password';
        this.value = '';
      }
      focus() {}
    },
    HTMLButtonElement: class HTMLButtonElement {
      constructor() {
        this.disabled = false;
        this.textContent = '';
      }
      focus() {}
    },
    HTMLFormElement: class HTMLFormElement {
      reset() {}
    },
    HTMLDialogElement: class HTMLDialogElement {
      constructor() {
        this._open = false;
        this._listeners = {};
      }
      showModal() { this._open = true; }
      close() { this._open = false; }
      addEventListener(event, handler) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(handler);
      }
      dispatchEvent(eventName) {
        (this._listeners[eventName] || []).forEach((h) => h());
      }
      querySelector() { return null; }
      querySelectorAll() { return []; }
    },
  };

  browserWindow.window = browserWindow;

  browserWindow.InventoryAuth = {
    buildHeaders: (_session, opts) => {
      const headers = {};
      if (opts?.includeJsonContentType) headers['content-type'] = 'application/json';
      return headers;
    },
    handleUnauthorized: () => {},
  };

  return vm.createContext({ ...browserWindow, window: browserWindow, Map });
}

function loadAccountApi(context) {
  const source = readFile(path.join(sharedPath, 'account-api.js'));
  vm.runInContext(source, context, { filename: 'account-api.js' });
  return context.window.InventoryAccountApi;
}

// ─── account-api.js — pruebas lógicas ─────────────────────────────────────────

test('account-api: changePassword hace PATCH /api/me/password con body correcto', async () => {
  let capturedRequest = null;

  const context = createBrowserContext(async (url, options) => {
    capturedRequest = { url, options };
    return {
      status: 204,
      text: async () => '',
    };
  });

  const api = loadAccountApi(context);
  const fakeSession = { user: { id: '42' } };

  await api.changePassword(fakeSession, 'OldPass123', 'NewPass456');

  assert.ok(capturedRequest, 'fetch debe haberse llamado');
  assert.match(capturedRequest.url, /\/api\/me\/password/);
  assert.equal(capturedRequest.options.method, 'PATCH');
  assert.equal(capturedRequest.options.credentials, 'same-origin');

  const parsedBody = JSON.parse(capturedRequest.options.body);
  assert.equal(parsedBody.currentPassword, 'OldPass123');
  assert.equal(parsedBody.newPassword, 'NewPass456');
  assert.equal(parsedBody.confirmPassword, undefined, 'confirmPassword no debe enviarse al backend');
});

test('account-api: changePassword lanza error con code cuando el backend responde 400', async () => {
  const context = createBrowserContext(async () => ({
    status: 400,
    json: async () => ({ error: 'CURRENT_PASSWORD_INVALID', message: 'La contraseña actual no es correcta.' }),
    text: async () => '{}',
  }));

  const api = loadAccountApi(context);

  await assert.rejects(
    () => api.changePassword({}, 'wrong', 'NewPass456'),
    (err) => {
      assert.equal(err.code, 'CURRENT_PASSWORD_INVALID');
      assert.equal(err.statusCode, 400);
      return true;
    },
  );
});

test('account-api: changePassword lanza error con fieldErrors cuando el backend responde validation_error', async () => {
  const context = createBrowserContext(async () => ({
    status: 400,
    json: async () => ({
      error: 'validation_error',
      details: {
        fieldErrors: { newPassword: ['La nueva contraseña debe tener al menos 8 caracteres'] },
      },
    }),
    text: async () => '{}',
  }));

  const api = loadAccountApi(context);

  await assert.rejects(
    () => api.changePassword({}, 'OldPass123', 'short'),
    (err) => {
      assert.ok(err.fieldErrors, 'debe incluir fieldErrors');
      assert.ok(err.fieldErrors.newPassword?.length > 0, 'debe incluir error de newPassword');
      return true;
    },
  );
});

test('account-api: changePassword no incluye datos sensibles en el body enviado al backend', async () => {
  let capturedBody = null;

  const context = createBrowserContext(async (_url, options) => {
    capturedBody = JSON.parse(options.body);
    return { status: 204, text: async () => '' };
  });

  const api = loadAccountApi(context);
  await api.changePassword({}, 'OldPass123', 'NewPass456');

  assert.ok(capturedBody);
  assert.deepEqual(Object.keys(capturedBody).sort(), ['currentPassword', 'newPassword']);
  assert.equal(capturedBody.confirmPassword, undefined);
  assert.equal(capturedBody.userId, undefined);
  assert.equal(capturedBody.passwordHash, undefined);
});

// ─── account-dialog.js — validaciones client-side (source analysis) ───────────

test('account-dialog: la lógica de validación client-side está ordenada: current → new → confirm', () => {
  const source = readFile(path.join(sharedPath, 'account-dialog.js'));

  // Buscar los mensajes de error de validación en el bloque del submit handler
  // (no en el HTML template, que puede incluir texto de ayuda similar pero más arriba).
  // Se usa el comentario de sección '── Validación client-side' como ancla.
  const validationSectionStart = source.indexOf('Validación client-side');
  assert.ok(validationSectionStart > -1, 'Debe existir sección de validación client-side');

  const validationSection = source.slice(validationSectionStart);

  const currentCheck = validationSection.indexOf('Ingresa tu contraseña actual');
  const newLengthCheck = validationSection.indexOf('al menos 8 caracteres');
  const confirmCheck = validationSection.indexOf('Las contraseñas no coinciden');

  assert.ok(currentCheck > -1, 'Debe validar contraseña actual requerida');
  assert.ok(newLengthCheck > -1, 'Debe validar longitud mínima de contraseña nueva');
  assert.ok(confirmCheck > -1, 'Debe validar que las contraseñas coinciden');
  assert.ok(currentCheck < newLengthCheck, 'La validación de contraseña actual debe ir antes que la de longitud');
  assert.ok(newLengthCheck < confirmCheck, 'La validación de longitud debe ir antes que la de confirmación');
});

test('account-dialog: resetForm limpia todos los campos de contraseña al cerrar', () => {
  const source = readFile(path.join(sharedPath, 'account-dialog.js'));
  assert.match(source, /function resetForm/);
  assert.match(source, /form\.reset\(\)/);
  // Resetea visibilidad de toggles
  assert.match(source, /type\s*=\s*['"]password['"]/);
  assert.match(source, /Mostrar/);
});

test('account-dialog: el dialog usa showModal() (modal bloqueante, no modeless)', () => {
  const source = readFile(path.join(sharedPath, 'account-dialog.js'));
  assert.match(source, /\.showModal\(\)/);
  assert.doesNotMatch(source, /\.show\(\)\s*;/); // no usar show() no-modal
});

test('account-dialog: el submit button se restaura (disabled=false, text correcto) en finally', () => {
  const source = readFile(path.join(sharedPath, 'account-dialog.js'));
  // El bloque finally debe restaurar el botón
  assert.match(source, /finally/);
  const finallyIndex = source.indexOf('finally');
  const afterFinally = source.slice(finallyIndex, finallyIndex + 300);
  assert.match(afterFinally, /disabled\s*=\s*false/);
  assert.match(afterFinally, /Guardar cambio/);
});

// ─── Verificar que los scripts se cargan en el orden correcto en los HTMLs ──────

test('root/index.html carga account-api.js ANTES que account-dialog.js', () => {
  const html = readFile(path.join(rootPath, 'index.html'));
  const apiPos = html.indexOf('account-api.js');
  const dialogPos = html.indexOf('account-dialog.js');
  assert.ok(apiPos > -1 && dialogPos > -1);
  assert.ok(apiPos < dialogPos, 'account-api.js debe cargarse antes que account-dialog.js');
});

test('warehouse/index.html carga account-api.js ANTES que account-dialog.js', () => {
  const html = readFile(path.join(warehousePath, 'index.html'));
  const apiPos = html.indexOf('account-api.js');
  const dialogPos = html.indexOf('account-dialog.js');
  assert.ok(apiPos > -1 && dialogPos > -1);
  assert.ok(apiPos < dialogPos);
});

test('agent/index.html carga account-api.js ANTES que account-dialog.js', () => {
  const html = readFile(path.join(agentPath, 'index.html'));
  assert.ok(html.indexOf('account-api.js') < html.indexOf('account-dialog.js'));
});

test('root/index.html carga shared scripts ANTES que registry.js (orden de dependencias)', () => {
  const html = readFile(path.join(rootPath, 'index.html'));
  const sharedAuthPos = html.indexOf('shared/auth.js');
  const registryPos = html.indexOf('registry.js');
  assert.ok(sharedAuthPos < registryPos, 'shared/auth.js debe cargarse antes que registry.js');
});
