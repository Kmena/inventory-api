/**
 * me.routes.js — Rutas del usuario autenticado (/api/me/*).
 *
 * Todas las rutas derivan el userId de req.auth.sub (identidad autenticada).
 * Nunca aceptan userId, companyId ni identificadores externos en el body.
 */

const express = require('express');

const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const { changeOwnPasswordSchema } = require('../schemas/me.schema');
const meService = require('../services/me.service');

const router = express.Router();

/**
 * PATCH /api/me/password
 *
 * Permite al usuario autenticado cambiar su propia contraseña.
 * El userId se obtiene exclusivamente de req.auth.sub.
 *
 * Respuestas:
 *   204 — contraseña actualizada correctamente
 *   400 — validación fallida (campo o dominio)
 *   401 — no autenticado
 *   403 — origen no permitido para sesion browser
 */
router.patch('/password', authenticate, validate(changeOwnPasswordSchema), async (req, res, next) => {
  try {
    await meService.changeOwnPassword(req.auth.sub, req.body, req);
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
