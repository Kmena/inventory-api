const crypto = require('crypto');

function generateRequestId() {
  return crypto.randomUUID();
}

function createRequestContext(req, requestId = generateRequestId()) {
  return {
    requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip || null,
    userAgent: typeof req.get === 'function' ? req.get('user-agent') || null : req.headers?.['user-agent'] || null,
    actor: null,
  };
}

function createRequestContextMiddleware() {
  return (req, res, next) => {
    const requestId = generateRequestId();
    req.requestContext = createRequestContext(req, requestId);
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  };
}

function attachAuthenticatedActor(req, auth) {
  if (!req.requestContext) {
    req.requestContext = createRequestContext(req);
  }

  req.requestContext.actor = {
    userId: auth?.sub || null,
    username: auth?.username || null,
    roleCode: auth?.role || null,
    companyId: auth?.companyId || null,
  };
}

function buildRoutePattern(req) {
  if (!req.route?.path) {
    return null;
  }

  const routePath = typeof req.route.path === 'string' ? req.route.path : null;
  if (!routePath) {
    return null;
  }

  return `${req.baseUrl || ''}${routePath}`;
}

function getRequestAuditContext(req) {
  const requestContext = req?.requestContext || null;
  const actor = requestContext?.actor || null;

  return {
    requestId: requestContext?.requestId || null,
    httpMethod: requestContext?.method || req?.method || null,
    path: requestContext?.path || req?.originalUrl || req?.url || null,
    routePattern: buildRoutePattern(req),
    ip: requestContext?.ip || req?.ip || null,
    userAgent: requestContext?.userAgent || null,
    actorUserId: actor?.userId || req?.auth?.sub || null,
    actorUsername: actor?.username || req?.auth?.username || null,
    actorRoleCode: actor?.roleCode || req?.auth?.role || null,
    companyId: actor?.companyId || req?.auth?.companyId || null,
  };
}

module.exports = {
  attachAuthenticatedActor,
  createRequestContext,
  createRequestContextMiddleware,
  generateRequestId,
  getRequestAuditContext,
};
