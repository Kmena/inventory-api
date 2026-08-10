const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const { parsePaginationQuery } = require('../lib/pagination');
const { createInvoiceSchema, updateInvoiceSchema } = require('../schemas/invoice.schema');
const invoiceService = require('../services/invoice.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorizeAccessPolicy('invoice.list'), async (req, res, next) => {
  try {
    const filters = {
      clientId: req.query.clientId || undefined,
      status: req.query.status ? String(req.query.status).split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      orderId: req.query.orderId || undefined,
    };
    return res.json(await invoiceService.listInvoices(req.auth, parsePaginationQuery(req.query), filters));
  } catch (error) { return next(error); }
});

router.get('/inconsistencies', authorizeAccessPolicy('invoice.inconsistencies'), async (req, res, next) => {
  try { return res.json(await invoiceService.listInvoiceDebtInconsistencies(req.auth)); } catch (error) { return next(error); }
});

router.get('/:id', authorizeAccessPolicy('invoice.detail'), async (req, res, next) => {
  try { return res.json(await invoiceService.getInvoice(parseBigIntId(req.params.id), req.auth)); } catch (error) { return next(error); }
});

router.post('/', authorizeAccessPolicy('invoice.create'), validate(createInvoiceSchema), async (req, res, next) => {
  try { return res.status(201).json(await invoiceService.createInvoice(req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.put('/:id', authorizeAccessPolicy('invoice.update'), validate(updateInvoiceSchema), async (req, res, next) => {
  try { return res.json(await invoiceService.updateInvoice(parseBigIntId(req.params.id), req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.delete('/:id', authorizeAccessPolicy('invoice.delete'), async (req, res, next) => {
  try {
    await invoiceService.removeInvoice(parseBigIntId(req.params.id), req.auth, req);
    return res.status(204).send();
  } catch (error) { return next(error); }
});

module.exports = router;

