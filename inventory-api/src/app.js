const path = require('path');
const express = require('express');
const cors = require('cors');

const { createRequestLogger, logRequestError } = require('./lib/logging');
const { createRequestContextMiddleware } = require('./lib/request-context');
const { createHeavyEndpointMetricsMiddleware } = require('./middlewares/heavy-endpoint-metrics');
const { corsOrigin, nodeEnv, trustProxy } = require('./config');
const healthRouter = require('./routes/health.routes');
const authRouter = require('./routes/auth.routes');
const companyRouter = require('./routes/company.routes');
const roleRouter = require('./routes/role.routes');
const userRouter = require('./routes/user.routes');
const clientRouter = require('./routes/client.routes');
const productRouter = require('./routes/product.routes');
const orderRouter = require('./routes/order.routes');
const invoiceRouter = require('./routes/invoice.routes');
const paymentRouter = require('./routes/payment.routes');
const inventoryRouter = require('./routes/inventory.routes');
const warehouseRouter = require('./routes/warehouse.routes');
const regionRouter = require('./routes/region.routes');
const salesRouteRouter = require('./routes/sales-route.routes');
const agentRouter = require('./routes/agent.routes');
const taxpayerRouter = require('./routes/taxpayer.routes');
const geocodingRouter = require('./routes/geocoding.routes');
const economicActivityRouter = require('./routes/economic-activity.routes');
const {
  smallPayloadParsers,
  mediumPayloadParsers,
} = require('./middlewares/request-payload');

const app = express();
const publicRootDirectory = path.join(__dirname, 'public');
const migrationDocumentPath = path.join(publicRootDirectory, 'migration.html');

app.set('trust proxy', trustProxy);
app.set('json replacer', (_key, value) => (typeof value === 'bigint' ? value.toString() : value));

function getFriendlyError(error) {
  const rawMessage = error?.message || '';
  const lowerMessage = rawMessage.toLowerCase();

  if (error?.code === 'P1001' || lowerMessage.includes("can't reach database server")) {
    return {
      statusCode: 503,
      code: 'service_unavailable',
      message: 'No pudimos conectarnos a la base de datos. Intente de nuevo en unos momentos.',
    };
  }

  if (error?.code === 'P1000' || lowerMessage.includes('authentication failed')) {
    return {
      statusCode: 503,
      code: 'service_unavailable',
      message: 'El servicio no pudo conectarse a la base de datos. Intente de nuevo en unos momentos.',
    };
  }

  return {
    statusCode: error?.statusCode || 500,
    code: error?.code || 'internal_server_error',
    message: error?.message || 'Ocurrio un error inesperado.',
  };
}

const strictPublicDocumentPaths = new Set(['/', '/index.html', '/no-access.html', '/migration.html', '/root/', '/root']);
const deprecatedLegacyHtmlPathPattern = /^\/(?:root|warehouse|agent)\/[^/?]+\.html$/;

function buildContentSecurityPolicy(directives) {
  return directives.join('; ');
}

function isDeprecatedLegacyHtmlPath(pathName) {
  return deprecatedLegacyHtmlPathPattern.test(pathName);
}

function selectContentSecurityPolicy(pathName) {
  if (strictPublicDocumentPaths.has(pathName) || isDeprecatedLegacyHtmlPath(pathName)) {
    return buildContentSecurityPolicy([
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
    ]);
  }

  return buildContentSecurityPolicy([
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' https://unpkg.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://unpkg.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://unpkg.com data:",
    "connect-src 'self' https://nominatim.openstreetmap.org",
  ]);
}

function setSecurityHeaders(req, res, next) {
  res.setHeader('Content-Security-Policy', selectContentSecurityPolicy(req.path));
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
}

function serveDeprecatedLegacyHtml(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  if (!isDeprecatedLegacyHtmlPath(req.path)) {
    return next();
  }

  return res.status(410).sendFile(migrationDocumentPath);
}

app.use(cors({ origin: corsOrigin }));
app.use(setSecurityHeaders);
app.use(createRequestContextMiddleware());
app.use(createHeavyEndpointMetricsMiddleware());
app.use(createRequestLogger(nodeEnv));
app.use(serveDeprecatedLegacyHtml);
app.use(express.static(publicRootDirectory));

app.use('/health', healthRouter);
app.use('/api/auth', ...smallPayloadParsers, authRouter);
app.use('/api/companies', ...mediumPayloadParsers, companyRouter);
app.use('/api/roles', ...mediumPayloadParsers, roleRouter);
app.use('/api/users', ...mediumPayloadParsers, userRouter);
app.use('/api/clients', ...mediumPayloadParsers, clientRouter);
app.use('/api/products', ...mediumPayloadParsers, productRouter);
app.use('/api/orders', ...mediumPayloadParsers, orderRouter);
app.use('/api/invoices', ...mediumPayloadParsers, invoiceRouter);
app.use('/api/payments', ...mediumPayloadParsers, paymentRouter);
app.use('/api/inventory', ...mediumPayloadParsers, inventoryRouter);
app.use('/api/warehouses', ...mediumPayloadParsers, warehouseRouter);
app.use('/api/regions', ...mediumPayloadParsers, regionRouter);
app.use('/api/sales-routes', ...mediumPayloadParsers, salesRouteRouter);
app.use('/api/agent', ...mediumPayloadParsers, agentRouter);
app.use('/api/taxpayers', ...smallPayloadParsers, taxpayerRouter);
app.use('/api/geocoding', ...smallPayloadParsers, geocodingRouter);
app.use('/api/economic-activities', ...mediumPayloadParsers, economicActivityRouter);

app.use((error, req, res, _next) => {
  const friendlyError = getFriendlyError(error);
  res.locals.errorCode = friendlyError.code;
  logRequestError({ error: friendlyError, req, nodeEnv });
  return res.status(friendlyError.statusCode).json({
    error: friendlyError.code,
    message: friendlyError.message,
  });
});

module.exports = app;
