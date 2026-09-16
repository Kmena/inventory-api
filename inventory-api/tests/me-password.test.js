/**
 * me-password.test.js
 *
 * Tests funcionales HTTP del endpoint PATCH /api/me/password.
 *
 * Casos de dominio (integración HTTP real con stubs de repositorio):
 *   1.  Cambio exitoso — hash nuevo válido, hash viejo invalido
 *   2.  Contraseña actual incorrecta → 400 CURRENT_PASSWORD_INVALID, hash sin cambios
 *   3.  Nueva contraseña igual a actual → 400 PASSWORD_SAME_AS_CURRENT, sin cambios
 *   4.  Contraseña demasiado corta → 400 validation_error, sin cambios
 *   5.  currentPassword faltante → 400 validation_error, sin cambios
 *   6.  newPassword faltante → 400 validation_error, sin cambios
 *   7.  Usuario no autenticado → 401
 *   8.  Cookie de sesion inválida → 401
 *   9.  Intento de modificar otro usuario — userId extra en body es ignorado
 *  10.  Aislamiento multiempresa — user de empresa B no afecta user de empresa A
 *  11a. Respuesta 204 sin body ni headers sensibles
 *  11b. Respuesta de error sin passwordHash ni datos internos
 *
 * Casos CSRF (integración HTTP real, sin mockear el middleware authenticate):
 *  12.  Cookie válida + Origin ausente → 403, hash sin cambios
 *  13.  Cookie válida + Origin malicioso → 403, hash sin cambios
 *  (Origin correcto → 204 ya cubierto por CASO 1)
 *
 * Tests unitarios del service (meService, sin HTTP):
 *  Verifican errores de dominio y que el userId se obtiene del parámetro, no del body.
 *
 * Test estructural:
 *  Verifica que la ruta PATCH /password existe y que authenticate es el primer middleware.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'test';

const bcrypt = require('bcrypt');
const app = require('../src/app');
const meService = require('../src/services/me.service');
const userRepository = require('../src/repositories/user.repository');
const browserSessionService = require('../src/services/browser-session.service');
const audit = require('../src/lib/audit');

// ─── Contraseñas de prueba ─────────────────────────────────────────────────────
// Se usa rounds=1 para mantener las pruebas rápidas.
const CURRENT_PASSWORD = 'CurrentPass1';
const NEW_PASSWORD = 'NewPassword2';
const CURRENT_HASH = bcrypt.hashSync(CURRENT_PASSWORD, 1);

// ─── Usuarios ficticio de prueba ───────────────────────────────────────────────

function buildMockUser(overrides = {}) {
  return {
    id: 42n,
    username: 'test-user',
    fullName: 'Usuario de Prueba',
    passwordHash: CURRENT_HASH,
    status: 'ACTIVE',
    companyId: 1n,
    role: {
      code: 'admin',
      isActive: true,
      rolePermissions: [],
    },
    company: {
      isActive: true,
    },
    ...overrides,
  };
}

// ─── Stub de sesion browser ────────────────────────────────────────────────────

const MOCK_SESSION_ID = 'mock-browser-session-id-42';

function buildMockBrowserSession(userId = 42n) {
  return {
    sessionId: MOCK_SESSION_ID,
    userId: userId.toString(),
    expiresAt: new Date(Date.now() + 86_400_000),
  };
}

// ─── Helpers de test ──────────────────────────────────────────────────────────

function withModuleStubs(stubsByModule, run) {
  const originals = [];
  for (const [moduleRef, stubs] of stubsByModule) {
    for (const [key, value] of Object.entries(stubs)) {
      originals.push([moduleRef, key, moduleRef[key]]);
      moduleRef[key] = value;
    }
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [moduleRef, key, value] of originals) {
        moduleRef[key] = value;
      }
    });
}

async function withHttpServer(run) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

/**
 * Realiza PATCH /api/me/password con sesion browser simulada (cookie).
 *
 * @param {string} baseUrl      URL base del servidor de prueba
 * @param {object} body         Body JSON a enviar
 * @param {object} [options]
 * @param {string|null}  [options.sessionId=MOCK_SESSION_ID]  Cookie de sesion (null omite la cookie)
 * @param {boolean}      [options.includeOrigin=true]         Si false, omite el header Origin
 * @param {string|null}  [options.originOverride=null]        Valor personalizado del header Origin
 *                                                            (ignora includeOrigin si se proporciona)
 */
async function patchPassword(baseUrl, body, options = {}) {
  const { sessionId = MOCK_SESSION_ID, includeOrigin = true, originOverride = null } = options;
  const headers = {
    'content-type': 'application/json',
  };

  if (sessionId) {
    headers['cookie'] = `inventory_browser_session=${sessionId}`;
  }
  if (originOverride !== null) {
    headers['origin'] = originOverride;
  } else if (includeOrigin) {
    headers['origin'] = baseUrl;
  }

  return fetch(`${baseUrl}/api/me/password`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

/**
 * Stubs base para todas las pruebas que necesitan usuario autenticado:
 * - getBrowserSession devuelve sesion valida para userId 42
 * - findAuthenticatedUserById devuelve el usuario mock
 * - recordAuditEventIfAvailable es no-op
 */
function buildBaseStubs(userOverrides = {}) {
  const mockUser = buildMockUser(userOverrides);
  return [
    [browserSessionService, {
      getBrowserSession: async (sessionId) => {
        if (sessionId !== MOCK_SESSION_ID) return null;
        return buildMockBrowserSession(42n);
      },
    }],
    [userRepository, {
      findAuthenticatedUserById: async (id) => {
        if (id.toString() === '42') return mockUser;
        return null;
      },
      updateUserPasswordHash: async () => ({ id: 42n, username: 'test-user' }),
    }],
    [audit, {
      recordAuditEventIfAvailable: async () => {},
      recordAuditEventSafelyIfAvailable: async () => {},
    }],
  ];
}

// ─── CASO 1: Cambio exitoso ────────────────────────────────────────────────────

test('CASO 1 — cambio exitoso: 204, hash nuevo valida, hash viejo invalida', async () => {
  let capturedNewHash = null;

  await withModuleStubs(
    [
      ...buildBaseStubs(),
      [userRepository, {
        findAuthenticatedUserById: async () => buildMockUser(),
        updateUserPasswordHash: async (_id, newHash) => {
          capturedNewHash = newHash;
          return { id: 42n, username: 'test-user' };
        },
      }],
    ],
    () => withHttpServer(async (baseUrl) => {
      const response = await patchPassword(baseUrl, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      });

      assert.equal(response.status, 204);
      assert.ok(capturedNewHash, 'updateUserPasswordHash debe haber sido llamado');

      // El hash nuevo valida con la nueva contraseña
      const newHashValid = await bcrypt.compare(NEW_PASSWORD, capturedNewHash);
      assert.ok(newHashValid, 'El hash nuevo debe validar con la nueva contraseña');

      // El hash nuevo NO valida con la contraseña vieja
      const oldPasswordInvalid = await bcrypt.compare(CURRENT_PASSWORD, capturedNewHash);
      assert.equal(oldPasswordInvalid, false, 'La contraseña vieja no debe validar con el hash nuevo');
    }),
  );
});

// ─── CASO 2: Contraseña actual incorrecta ─────────────────────────────────────

test('CASO 2 — contraseña actual incorrecta: 400 CURRENT_PASSWORD_INVALID, sin cambio de hash', async () => {
  let updateCalled = false;

  await withModuleStubs(
    [
      ...buildBaseStubs(),
      [userRepository, {
        findAuthenticatedUserById: async () => buildMockUser(),
        updateUserPasswordHash: async () => {
          updateCalled = true;
          return { id: 42n, username: 'test-user' };
        },
      }],
    ],
    () => withHttpServer(async (baseUrl) => {
      const response = await patchPassword(baseUrl, {
        currentPassword: 'WrongPassword999',
        newPassword: NEW_PASSWORD,
      });

      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.error, 'CURRENT_PASSWORD_INVALID');
      assert.ok(body.message, 'debe incluir un mensaje');
      assert.equal(updateCalled, false, 'updateUserPasswordHash no debe llamarse');
    }),
  );
});

// ─── CASO 3: Nueva contraseña igual a actual ──────────────────────────────────

test('CASO 3 — nueva contraseña igual a actual: 400 PASSWORD_SAME_AS_CURRENT, sin cambio', async () => {
  let updateCalled = false;

  await withModuleStubs(
    [
      ...buildBaseStubs(),
      [userRepository, {
        findAuthenticatedUserById: async () => buildMockUser(),
        updateUserPasswordHash: async () => {
          updateCalled = true;
          return { id: 42n, username: 'test-user' };
        },
      }],
    ],
    () => withHttpServer(async (baseUrl) => {
      const response = await patchPassword(baseUrl, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: CURRENT_PASSWORD, // misma que la actual
      });

      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.error, 'PASSWORD_SAME_AS_CURRENT');
      assert.equal(updateCalled, false, 'updateUserPasswordHash no debe llamarse');
    }),
  );
});

// ─── CASO 4: Nueva contraseña demasiado corta ─────────────────────────────────

test('CASO 4 — nueva contraseña demasiado corta (<8 chars): 400 validation_error, sin cambio', async () => {
  let updateCalled = false;

  await withModuleStubs(
    [
      ...buildBaseStubs(),
      [userRepository, {
        findAuthenticatedUserById: async () => buildMockUser(),
        updateUserPasswordHash: async () => {
          updateCalled = true;
          return { id: 42n, username: 'test-user' };
        },
      }],
    ],
    () => withHttpServer(async (baseUrl) => {
      const response = await patchPassword(baseUrl, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: 'short', // menos de 8 caracteres
      });

      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.error, 'validation_error');
      assert.ok(body.details, 'debe incluir details de validacion');
      assert.equal(updateCalled, false, 'updateUserPasswordHash no debe llamarse');
    }),
  );
});

// ─── CASO 5: currentPassword faltante ─────────────────────────────────────────

test('CASO 5 — currentPassword faltante: 400 validation_error, sin cambio', async () => {
  let updateCalled = false;

  await withModuleStubs(
    [
      ...buildBaseStubs(),
      [userRepository, {
        findAuthenticatedUserById: async () => buildMockUser(),
        updateUserPasswordHash: async () => {
          updateCalled = true;
          return { id: 42n, username: 'test-user' };
        },
      }],
    ],
    () => withHttpServer(async (baseUrl) => {
      const response = await patchPassword(baseUrl, {
        // currentPassword ausente
        newPassword: NEW_PASSWORD,
      });

      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.error, 'validation_error');
      assert.equal(updateCalled, false, 'updateUserPasswordHash no debe llamarse');
    }),
  );
});

// ─── CASO 6: newPassword faltante ─────────────────────────────────────────────

test('CASO 6 — newPassword faltante: 400 validation_error, sin cambio', async () => {
  let updateCalled = false;

  await withModuleStubs(
    [
      ...buildBaseStubs(),
      [userRepository, {
        findAuthenticatedUserById: async () => buildMockUser(),
        updateUserPasswordHash: async () => {
          updateCalled = true;
          return { id: 42n, username: 'test-user' };
        },
      }],
    ],
    () => withHttpServer(async (baseUrl) => {
      const response = await patchPassword(baseUrl, {
        currentPassword: CURRENT_PASSWORD,
        // newPassword ausente
      });

      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.error, 'validation_error');
      assert.equal(updateCalled, false, 'updateUserPasswordHash no debe llamarse');
    }),
  );
});

// ─── CASO 7: Usuario no autenticado (sin cookie) ──────────────────────────────

test('CASO 7 — sin sesion autenticada: 401', async () => {
  await withHttpServer(async (baseUrl) => {
    const response = await patchPassword(baseUrl, {
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    }, { sessionId: null });

    assert.equal(response.status, 401);
  });
});

// ─── CASO 8: Cookie de sesion invalida/expirada ───────────────────────────────

test('CASO 8 — cookie de sesion invalida: 401', async () => {
  await withModuleStubs(
    [[browserSessionService, {
      getBrowserSession: async () => null, // sesion no encontrada
    }]],
    () => withHttpServer(async (baseUrl) => {
      const response = await patchPassword(baseUrl, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      }, { sessionId: 'invalid-session-token' });

      assert.equal(response.status, 401);
    }),
  );
});

// ─── CASO 9: Intento de modificar otro usuario via body ───────────────────────

test('CASO 9 — campos extra en body (userId, companyId) son ignorados; solo modifica el usuario autenticado', async () => {
  const userBPasswordHash = bcrypt.hashSync('OtherUserPass1', 1);
  const userBId = 99n;
  let updatedUserId = null;

  const mockUserA = buildMockUser({ id: 42n });
  const mockUserB = buildMockUser({
    id: userBId,
    username: 'user-b',
    passwordHash: userBPasswordHash,
    companyId: 2n,
  });

  await withModuleStubs(
    [
      [browserSessionService, {
        getBrowserSession: async (sessionId) => {
          if (sessionId !== MOCK_SESSION_ID) return null;
          return buildMockBrowserSession(42n); // autenticado como user A
        },
      }],
      [userRepository, {
        findAuthenticatedUserById: async (id) => {
          if (id.toString() === '42') return mockUserA;
          if (id.toString() === userBId.toString()) return mockUserB;
          return null;
        },
        updateUserPasswordHash: async (id, _hash) => {
          updatedUserId = id.toString();
          return { id, username: 'test-user' };
        },
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => {},
        recordAuditEventSafelyIfAvailable: async () => {},
      }],
    ],
    () => withHttpServer(async (baseUrl) => {
      // Intenta inyectar userId y companyId del usuario B en el body
      const response = await patchPassword(baseUrl, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
        userId: userBId.toString(),       // campo extra — debe ignorarse
        companyId: '2',                    // campo extra — debe ignorarse
      });

      // El endpoint deberia tener éxito (con la contraseña correcta del usuario A)
      assert.equal(response.status, 204);

      // Solo se modificó el usuario autenticado (user A = id 42)
      assert.equal(updatedUserId, '42', 'Solo debe modificarse el usuario autenticado (42)');
      assert.notEqual(updatedUserId, userBId.toString(), 'El usuario B no debe ser modificado');
    }),
  );
});

// ─── CASO 10: Aislamiento multiempresa ────────────────────────────────────────

test('CASO 10 — aislamiento multiempresa: user B de empresa B permanece sin cambios', async () => {
  const companyAPassword = 'CompanyAPass1';
  const companyAHash = bcrypt.hashSync(companyAPassword, 1);

  const userA = buildMockUser({
    id: 10n,
    username: 'user-empresa-a',
    companyId: 100n,
    passwordHash: companyAHash,
  });

  const userBOriginalHash = bcrypt.hashSync('CompanyBPass1', 1);
  const userB = buildMockUser({
    id: 20n,
    username: 'user-empresa-b',
    companyId: 200n,
    passwordHash: userBOriginalHash,
  });

  let userBHashUpdated = false;

  // Sesion del usuario A
  const SESSION_A = 'session-empresa-a-token';

  await withModuleStubs(
    [
      [browserSessionService, {
        getBrowserSession: async (sessionId) => {
          if (sessionId === SESSION_A) return { userId: '10', expiresAt: new Date(Date.now() + 86_400_000) };
          return null;
        },
      }],
      [userRepository, {
        findAuthenticatedUserById: async (id) => {
          if (id.toString() === '10') return userA;
          if (id.toString() === '20') return userB;
          return null;
        },
        updateUserPasswordHash: async (id, _hash) => {
          if (id.toString() === '20') userBHashUpdated = true;
          return { id, username: 'test' };
        },
      }],
      [audit, {
        recordAuditEventIfAvailable: async () => {},
        recordAuditEventSafelyIfAvailable: async () => {},
      }],
    ],
    () => withHttpServer(async (baseUrl) => {
      // Usuario A cambia su contraseña correctamente
      const response = await fetch(`${baseUrl}/api/me/password`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'cookie': `inventory_browser_session=${SESSION_A}`,
          'origin': baseUrl,
        },
        body: JSON.stringify({
          currentPassword: companyAPassword,
          newPassword: NEW_PASSWORD,
        }),
      });

      assert.equal(response.status, 204, 'El usuario A debe poder cambiar su contraseña');
      assert.equal(userBHashUpdated, false, 'El hash del usuario B no debe haberse actualizado');
    }),
  );
});

// ─── CASO 11: No filtrar datos sensibles ──────────────────────────────────────

test('CASO 11 — respuesta exitosa (204) no contiene body con datos sensibles', async () => {
  await withModuleStubs(
    buildBaseStubs(),
    () => withHttpServer(async (baseUrl) => {
      const response = await patchPassword(baseUrl, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      });

      assert.equal(response.status, 204);

      // 204 No Content — el body debe estar vacío
      const text = await response.text();
      assert.equal(text, '', 'El body de respuesta 204 debe estar vacio');

      // Sin cabeceras que filtren información sensible
      assert.equal(response.headers.get('x-password-hash'), null);
    }),
  );
});

test('CASO 11b — respuesta de error no contiene passwordHash ni tokens internos', async () => {
  await withModuleStubs(
    buildBaseStubs(),
    () => withHttpServer(async (baseUrl) => {
      const response = await patchPassword(baseUrl, {
        currentPassword: 'WrongPassword999',
        newPassword: NEW_PASSWORD,
      });

      assert.equal(response.status, 400);
      const body = await response.json();

      // El body no debe contener el hash de la contraseña
      const bodyStr = JSON.stringify(body);
      assert.doesNotMatch(bodyStr, /\$2[aby]\$/, 'El body no debe contener hashes bcrypt');
      assert.doesNotMatch(bodyStr, /passwordHash/, 'El body no debe contener el campo passwordHash');
      assert.doesNotMatch(bodyStr, /password_hash/i, 'El body no debe contener campo sensible');
    }),
  );
});

// ─── CASO 12: CSRF — cookie válida, Origin ausente → 403 ───────────────────────

test('CASO 12 — CSRF: cookie válida + Origin ausente → 403, hash sin cambios', async () => {
  let updateCalled = false;

  await withModuleStubs(
    [
      ...buildBaseStubs(),
      [userRepository, {
        findAuthenticatedUserById: async () => buildMockUser(),
        updateUserPasswordHash: async () => {
          updateCalled = true;
          return { id: 42n, username: 'test-user' };
        },
      }],
    ],
    () => withHttpServer(async (baseUrl) => {
      // Cookie válida pero sin header Origin — el middleware authenticate debe rechazar con 403.
      const response = await patchPassword(baseUrl, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      }, { includeOrigin: false });

      assert.equal(response.status, 403, 'Sin Origin el endpoint debe devolver 403');
      assert.equal(updateCalled, false, 'No debe actualizarse el hash cuando el CSRF check falla');
    }),
  );
});

// ─── CASO 13: CSRF — cookie válida, Origin malicioso → 403 ───────────────────

test('CASO 13 — CSRF: cookie válida + Origin malicioso → 403, hash sin cambios', async () => {
  let updateCalled = false;

  await withModuleStubs(
    [
      ...buildBaseStubs(),
      [userRepository, {
        findAuthenticatedUserById: async () => buildMockUser(),
        updateUserPasswordHash: async () => {
          updateCalled = true;
          return { id: 42n, username: 'test-user' };
        },
      }],
    ],
    () => withHttpServer(async (baseUrl) => {
      // Cookie válida pero Origin de otro dominio — debe rechazar con 403.
      const response = await patchPassword(baseUrl, {
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      }, { originOverride: 'https://evil.example.com' });

      assert.equal(response.status, 403, 'Origin de otro dominio debe devolver 403');
      assert.equal(updateCalled, false, 'No debe actualizarse el hash cuando el CSRF check falla');
    }),
  );
});

// ─── Tests unitarios del servicio ─────────────────────────────────────────────

test('meService.changeOwnPassword — lanza 400 CURRENT_PASSWORD_INVALID cuando la contrasena actual es incorrecta', async () => {
  const mockUser = buildMockUser();
  let updateCalled = false;

  await withModuleStubs(
    [
      [userRepository, {
        findAuthenticatedUserById: async () => mockUser,
        updateUserPasswordHash: async () => {
          updateCalled = true;
          return {};
        },
      }],
      [audit, { recordAuditEventIfAvailable: async () => {} }],
    ],
    async () => {
      await assert.rejects(
        () => meService.changeOwnPassword('42', {
          currentPassword: 'BadPassword99',
          newPassword: NEW_PASSWORD,
        }),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'CURRENT_PASSWORD_INVALID');
          return true;
        },
      );
      assert.equal(updateCalled, false);
    },
  );
});

test('meService.changeOwnPassword — lanza 400 PASSWORD_SAME_AS_CURRENT cuando nueva == actual', async () => {
  const mockUser = buildMockUser();
  let updateCalled = false;

  await withModuleStubs(
    [
      [userRepository, {
        findAuthenticatedUserById: async () => mockUser,
        updateUserPasswordHash: async () => {
          updateCalled = true;
          return {};
        },
      }],
      [audit, { recordAuditEventIfAvailable: async () => {} }],
    ],
    async () => {
      await assert.rejects(
        () => meService.changeOwnPassword('42', {
          currentPassword: CURRENT_PASSWORD,
          newPassword: CURRENT_PASSWORD, // misma contraseña
        }),
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'PASSWORD_SAME_AS_CURRENT');
          return true;
        },
      );
      assert.equal(updateCalled, false);
    },
  );
});

test('meService.changeOwnPassword — usuario autenticado no puede modificar a otro usuario pasando userId distinto', async () => {
  // El servicio recibe el userId de req.auth.sub, no del body.
  // Esta prueba verifica que incluso si se llama con un userId diferente directamente,
  // solo modifica el usuario cuyo id se pasa (el que viene de req.auth.sub en la ruta).
  const mockUser = buildMockUser({ id: 42n });
  const calls = [];

  await withModuleStubs(
    [
      [userRepository, {
        findAuthenticatedUserById: async (id) => {
          calls.push(id.toString());
          if (id.toString() === '42') return mockUser;
          return null; // userId 99 no existe en esta empresa
        },
        updateUserPasswordHash: async () => ({}),
      }],
      [audit, { recordAuditEventIfAvailable: async () => {} }],
    ],
    async () => {
      // El endpoint PATCH /api/me/password siempre pasa req.auth.sub (= '42')
      // al servicio, sin importar lo que venga en el body.
      // Aqui simulamos que alguien intentara pasar '99' directamente al servicio:
      await assert.rejects(
        () => meService.changeOwnPassword('99', {
          currentPassword: CURRENT_PASSWORD,
          newPassword: NEW_PASSWORD,
        }),
        (err) => {
          assert.equal(err.statusCode, 404);
          return true;
        },
      );

      // Solo se consulto el usuario 99 (no el 42 — no se produjo escalada de privilegio)
      assert.ok(calls.every((c) => c === '99'), 'Solo se debe consultar el userId pasado al servicio');
    },
  );
});

// ─── Verificacion de estructura del endpoint ──────────────────────────────────

test('PATCH /api/me/password existe y usa el middleware authenticate', async () => {
  const meRouter = require('../src/routes/me.routes');
  const stack = meRouter.stack;
  const patchPasswordRoute = stack.find(
    (layer) => layer.route && layer.route.path === '/password' && layer.route.methods.patch,
  );
  assert.ok(patchPasswordRoute, 'La ruta PATCH /password debe existir en me.routes');
  // El primer middleware de la ruta es authenticate
  const firstMiddlewareName = patchPasswordRoute.route.stack[0]?.handle?.name || '';
  assert.equal(firstMiddlewareName, 'authenticate', 'El primer middleware debe ser authenticate');
});
