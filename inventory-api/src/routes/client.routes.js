const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const { parsePaginationQuery } = require('../lib/pagination');
const {
  updateClientSchema,
  createCompanyClientSchema,
  createClientStoreSchema,
  uploadClientDocumentSchema,
  createClientReferenceSchema,
  updateClientStoreCreditLimitSchema,
} = require('../schemas/client.schema');
const clientService = require('../services/client.service');
const { highPayloadParsers } = require('../middlewares/request-payload');

const router = express.Router();
router.use(authenticate);

router.get('/', authorizeAccessPolicy('client.list'), async (req, res, next) => {
  try { return res.json(await clientService.listClients(req.auth, parsePaginationQuery(req.query))); } catch (error) { return next(error); }
});

router.get('/company', authorizeAccessPolicy('client.list-company'), async (req, res, next) => {
  try { return res.json(await clientService.listCompanyClients(req.auth, parsePaginationQuery(req.query))); } catch (error) { return next(error); }
});

router.get('/classifications/company', authorizeAccessPolicy('client.classifications.list-company'), async (req, res, next) => {
  try { return res.json(await clientService.listCompanyClassifications(req.auth)); } catch (error) { return next(error); }
});

router.get('/document-types', authorizeAccessPolicy('client.document-types.list'), async (_req, res, next) => {
  try { return res.json(clientService.listClientDocumentTypes()); } catch (error) { return next(error); }
});

router.post('/company', authorizeAccessPolicy('client.create-company'), validate(createCompanyClientSchema), async (req, res, next) => {
  try { return res.status(201).json(await clientService.createCompanyClient(req.body, req.auth)); } catch (error) { return next(error); }
});

router.post('/company/:clientId/stores', authorizeAccessPolicy('client.store.create'), validate(createClientStoreSchema), async (req, res, next) => {
  try {
    return res.status(201).json(
      await clientService.createCompanyClientStore(parseBigIntId(req.params.clientId, 'clientId'), req.body, req.auth),
    );
  } catch (error) { return next(error); }
});

router.patch('/company/:clientId/stores/:storeId/credit-limit', authorizeAccessPolicy('client.store.credit.manage'), validate(updateClientStoreCreditLimitSchema), async (req, res, next) => {
  try {
    return res.json(
      await clientService.updateCompanyClientStoreCreditLimit(
        parseBigIntId(req.params.clientId, 'clientId'),
        parseBigIntId(req.params.storeId, 'storeId'),
        req.body,
        req.auth,
      ),
    );
  } catch (error) { return next(error); }
});

router.post('/:clientId/documents', ...highPayloadParsers, authorizeAccessPolicy('client.document.upload'), validate(uploadClientDocumentSchema), async (req, res, next) => {
  try {
    return res.status(201).json(
      await clientService.createCompanyClientDocument(parseBigIntId(req.params.clientId, 'clientId'), req.body, req.auth),
    );
  } catch (error) { return next(error); }
});

router.post('/:clientId/references', authorizeAccessPolicy('client.reference.create'), validate(createClientReferenceSchema), async (req, res, next) => {
  try {
    return res.status(201).json(
      await clientService.createCompanyClientReference(parseBigIntId(req.params.clientId, 'clientId'), req.body, req.auth),
    );
  } catch (error) { return next(error); }
});

router.get('/:clientId/documents/:documentId/download', authorizeAccessPolicy('client.document.download'), async (req, res, next) => {
  try {
    const download = await clientService.getCompanyClientDocumentDownload(
      parseBigIntId(req.params.clientId, 'clientId'),
      parseBigIntId(req.params.documentId, 'documentId'),
      req.auth,
    );
    res.type(download.mimeType);
    return res.download(download.absolutePath, download.fileName);
  } catch (error) { return next(error); }
});

router.get('/:clientId/ledger', authorizeAccessPolicy('billing.ledger.client'), async (req, res, next) => {
  try {
    const options = {};
    if (req.query.take) options.take = Math.max(1, Math.min(500, parseInt(req.query.take, 10) || 100));
    if (req.query.skip) options.skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
    if (req.query.since) options.since = req.query.since;
    return res.json(await clientService.getClientLedger(parseBigIntId(req.params.clientId, 'clientId'), req.auth, options));
  } catch (error) { return next(error); }
});

router.get('/:id', authorizeAccessPolicy('client.detail'), async (req, res, next) => {
  try { return res.json(await clientService.getClient(parseBigIntId(req.params.id), req.auth)); } catch (error) { return next(error); }
});

router.post('/', authorizeAccessPolicy('client.create-legacy'), validate(createCompanyClientSchema), async (req, res, next) => {
  try { return res.status(201).json(await clientService.createCompanyClient(req.body, req.auth)); } catch (error) { return next(error); }
});

router.put('/:id', authorizeAccessPolicy('client.update'), validate(updateClientSchema), async (req, res, next) => {
  try { return res.json(await clientService.updateClient(parseBigIntId(req.params.id), req.body, req.auth)); } catch (error) { return next(error); }
});

router.delete('/:id', authorizeAccessPolicy('client.delete'), async (req, res, next) => {
  try {
    await clientService.removeClient(parseBigIntId(req.params.id), req.auth);
    return res.status(204).send();
  } catch (error) { return next(error); }
});

module.exports = router;
