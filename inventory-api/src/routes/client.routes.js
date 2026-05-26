const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const { createClientSchema, updateClientSchema } = require('../schemas/client.schema');
const clientService = require('../services/client.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin', 'sales'), async (_req, res, next) => {
  try { return res.json(await clientService.listClients()); } catch (error) { return next(error); }
});

router.get('/:id', authorize('admin', 'sales'), async (req, res, next) => {
  try { return res.json(await clientService.getClient(parseBigIntId(req.params.id))); } catch (error) { return next(error); }
});

router.post('/', authorize('admin', 'sales'), validate(createClientSchema), async (req, res, next) => {
  try { return res.status(201).json(await clientService.createClient(req.body)); } catch (error) { return next(error); }
});

router.put('/:id', authorize('admin', 'sales'), validate(updateClientSchema), async (req, res, next) => {
  try { return res.json(await clientService.updateClient(parseBigIntId(req.params.id), req.body)); } catch (error) { return next(error); }
});

router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    await clientService.removeClient(parseBigIntId(req.params.id));
    return res.status(204).send();
  } catch (error) { return next(error); }
});

module.exports = router;
