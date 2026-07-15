const express = require('express');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const {
  updateClientSchema,
  createCompanyClientSchema,
  createClientStoreSchema,
  uploadClientDocumentSchema,
  createClientReferenceSchema,
} = require('../schemas/client.schema');
const clientService = require('../services/client.service');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('admin', 'sales'), async (req, res, next) => {
  try { return res.json(await clientService.listClients(req.auth)); } catch (error) { return next(error); }
});

router.get('/company', authorize('admin', 'sales'), async (req, res, next) => {
  try { return res.json(await clientService.listCompanyClients(req.auth)); } catch (error) { return next(error); }
});

router.get('/classifications/company', authorize('admin', 'sales'), async (req, res, next) => {
  try { return res.json(await clientService.listCompanyClassifications(req.auth)); } catch (error) { return next(error); }
});

router.get('/document-types', authorize('admin', 'sales'), async (_req, res, next) => {
  try { return res.json(clientService.listClientDocumentTypes()); } catch (error) { return next(error); }
});

router.post('/company', authorize('admin', 'sales'), validate(createCompanyClientSchema), async (req, res, next) => {
  try { return res.status(201).json(await clientService.createCompanyClient(req.body, req.auth)); } catch (error) { return next(error); }
});

router.post('/company/:clientId/stores', authorize('admin', 'sales'), validate(createClientStoreSchema), async (req, res, next) => {
  try {
    return res.status(201).json(
      await clientService.createCompanyClientStore(parseBigIntId(req.params.clientId, 'clientId'), req.body, req.auth),
    );
  } catch (error) { return next(error); }
});

router.post('/:clientId/documents', authorize('admin', 'sales'), validate(uploadClientDocumentSchema), async (req, res, next) => {
  try {
    return res.status(201).json(
      await clientService.createCompanyClientDocument(parseBigIntId(req.params.clientId, 'clientId'), req.body, req.auth),
    );
  } catch (error) { return next(error); }
});

router.post('/:clientId/references', authorize('admin', 'sales'), validate(createClientReferenceSchema), async (req, res, next) => {
  try {
    return res.status(201).json(
      await clientService.createCompanyClientReference(parseBigIntId(req.params.clientId, 'clientId'), req.body, req.auth),
    );
  } catch (error) { return next(error); }
});

router.get('/:clientId/documents/:documentId/download', authorize('admin', 'sales'), async (req, res, next) => {
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

router.get('/:id', authorize('admin', 'sales'), async (req, res, next) => {
  try { return res.json(await clientService.getClient(parseBigIntId(req.params.id), req.auth)); } catch (error) { return next(error); }
});

router.post('/', authorize('admin', 'sales'), validate(createCompanyClientSchema), async (req, res, next) => {
  try { return res.status(201).json(await clientService.createCompanyClient(req.body, req.auth)); } catch (error) { return next(error); }
});

router.put('/:id', authorize('admin', 'sales'), validate(updateClientSchema), async (req, res, next) => {
  try { return res.json(await clientService.updateClient(parseBigIntId(req.params.id), req.body, req.auth)); } catch (error) { return next(error); }
});

router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    await clientService.removeClient(parseBigIntId(req.params.id), req.auth);
    return res.status(204).send();
  } catch (error) { return next(error); }
});

module.exports = router;
