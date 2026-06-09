const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { corsOrigin } = require('./config');
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

const app = express();
app.set('json replacer', (_key, value) => (typeof value === 'bigint' ? value.toString() : value));

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(morgan('dev'));
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

app.use((error, _req, res, _next) => {
  console.error(error);
  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    error: error.code || 'internal_server_error',
    message: error.message || 'Algo explotó. Muy profesional todo.',
  });
});

module.exports = app;
