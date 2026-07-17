const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const { parsePaginationQuery } = require('../lib/pagination');
const { createInvoiceSchema, updateInvoiceSchema } = require('../schemas/invoice.schema');
const invoiceService = require('../services/invoice.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin', 'sales'), async (req, res, next) => {
  try { return res.json(await invoiceService.listInvoices(req.auth, parsePaginationQuery(req.query))); } catch (error) { return next(error); }
});

router.get('/inconsistencies', authorize('admin'), async (req, res, next) => {
  try { return res.json(await invoiceService.listInvoiceDebtInconsistencies(req.auth)); } catch (error) { return next(error); }
});

router.get('/:id', authorize('admin', 'sales'), async (req, res, next) => {
  try { return res.json(await invoiceService.getInvoice(parseBigIntId(req.params.id), req.auth)); } catch (error) { return next(error); }
});

router.post('/', authorize('admin', 'sales'), validate(createInvoiceSchema), async (req, res, next) => {
  try { return res.status(201).json(await invoiceService.createInvoice(req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.put('/:id', authorize('admin', 'sales'), validate(updateInvoiceSchema), async (req, res, next) => {
  try { return res.json(await invoiceService.updateInvoice(parseBigIntId(req.params.id), req.body, req.auth, req)); } catch (error) { return next(error); }
});

router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    await invoiceService.removeInvoice(parseBigIntId(req.params.id), req.auth, req);
    return res.status(204).send();
  } catch (error) { return next(error); }
});

module.exports = router;

