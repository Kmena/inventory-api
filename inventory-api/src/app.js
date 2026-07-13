const path = require('path');
const express = require('express');
const cors = require('cors');

const { createRequestLogger, logRequestError } = require('./lib/logging');
const { corsOrigin, nodeEnv } = require('./config');
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

const app = express();
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

function setSecurityHeaders(_req, res, next) {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: https:",
      "font-src 'self' https://unpkg.com data:",
      "connect-src 'self' https://nominatim.openstreetmap.org",
    ].join('; '),
  );
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
}

app.use(cors({ origin: corsOrigin }));
app.use(setSecurityHeaders);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(createRequestLogger(nodeEnv));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/companies', companyRouter);
app.use('/api/roles', roleRouter);
app.use('/api/users', userRouter);
app.use('/api/clients', clientRouter);
app.use('/api/products', productRouter);
app.use('/api/orders', orderRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/warehouses', warehouseRouter);
app.use('/api/regions', regionRouter);
app.use('/api/sales-routes', salesRouteRouter);
app.use('/api/agent', agentRouter);
app.use('/api/taxpayers', taxpayerRouter);
app.use('/api/geocoding', geocodingRouter);
app.use('/api/economic-activities', economicActivityRouter);

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
