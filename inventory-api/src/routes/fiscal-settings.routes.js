const express = require('express');

const authenticate = require('../middlewares/authenticate');
const validate = require('../middlewares/validate');
const { parseFiscalCertificateUpload } = require('../middlewares/fiscal-certificate-upload');
const { authorizeAccessPolicy } = require('../security/access-policies');
const audit = require('../lib/audit');
const fiscalSettingsService = require('../services/fiscal-settings.service');
const {
  haciendaCredentialsSchema,
  updateFiscalActivitySchema,
  setDefaultFiscalActivitySchema,
  fiscalAdministrationProvisionSchema,
  fiscalAdministrationUpdateSchema,
  fiscalBranchUpsertSchema,
  fiscalTerminalUpsertSchema,
  fiscalActiveStateSchema,
  fiscalDefaultPointSchema,
  fiscalSequenceReadSchema,
  fiscalInitialSequenceSchema,
  fiscalTestInvoiceSchema,
} = require('../schemas/fiscal-settings.schema');

const router = express.Router();
router.use(authenticate);

function buildContext(req) {
  return {
    requestId: req.requestContext?.requestId || null,
    correlationId: req.requestContext?.correlationId || req.requestContext?.requestId || null,
  };
}

async function recordFiscalSettingsAudit(req, { action, activityCode = null }) {
  await audit.recordAuditEventSafelyIfAvailable({
    req,
    action,
    resourceType: 'fiscal-settings',
    resourceId: activityCode,
    outcome: 'SUCCESS',
    metadata: activityCode ? { activityCode } : null,
  });
}

router.get('/fiscal-settings/readiness', authorizeAccessPolicy('fiscal-settings.readiness'), async (req, res, next) => {
  try {
    const readiness = await fiscalSettingsService.getFiscalReadiness(req.auth, buildContext(req));
    return res.json(readiness);
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/fiscal-settings/test-invoices',
  authorizeAccessPolicy('fiscal-settings.test-invoices.create'),
  validate(fiscalTestInvoiceSchema),
  async (req, res, next) => {
    try {
      const result = await fiscalSettingsService.initiateFiscalTestInvoice(req.auth, req.body, buildContext(req));
      await audit.recordAuditEventSafelyIfAvailable({
        req,
        action: 'fiscal.test-invoice.requested',
        resourceType: 'fiscal-test-invoice',
        resourceId: result?.executionId || null,
        outcome: 'SUCCESS',
        metadata: { environment: result?.environment || 'SANDBOX', mode: result?.mode || null },
      });
      return res.status(202).json(result);
    } catch (error) { return next(error); }
  },
);

router.get(
  '/fiscal-settings/test-invoices/:executionId',
  authorizeAccessPolicy('fiscal-settings.test-invoices.view'),
  async (req, res, next) => {
    try {
      return res.json(await fiscalSettingsService.getFiscalTestInvoiceStatus(req.auth, req.params.executionId, buildContext(req)));
    } catch (error) { return next(error); }
  },
);

router.get(
  '/fiscal-settings/test-invoices/:executionId/artifacts/:artifactType',
  authorizeAccessPolicy('fiscal-settings.test-invoices.view'),
  async (req, res, next) => {
    try {
      const artifactType = String(req.params.artifactType || '').toUpperCase();
      const result = await fiscalSettingsService.getFiscalTestInvoiceArtifact(
        req.auth,
        req.params.executionId,
        artifactType,
        buildContext(req),
      );
      const extension = artifactType === 'PDF' ? 'pdf' : 'xml';
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="sandbox-${req.params.executionId}-${artifactType.toLowerCase()}.${extension}"`);
      res.setHeader('Content-Length', String(result.bytes.length));
      return res.send(result.bytes);
    } catch (error) { return next(error); }
  },
);

router.get('/fiscal-settings/issuer', authorizeAccessPolicy('fiscal-settings.issuer.view'), async (req, res, next) => {
  try {
    return res.json(await fiscalSettingsService.getFiscalAdministration(req.auth, buildContext(req)));
  } catch (error) { return next(error); }
});

router.get('/fiscal-settings/security', authorizeAccessPolicy('fiscal-settings.view'), async (req, res, next) => {
  try {
    return res.json(await fiscalSettingsService.getFiscalSecurityConfiguration(req.auth, buildContext(req)));
  } catch (error) { return next(error); }
});

router.post(
  '/fiscal-settings/issuer/provision',
  authorizeAccessPolicy('fiscal-settings.issuer.provision'),
  validate(fiscalAdministrationProvisionSchema),
  async (req, res, next) => {
    try {
      const result = await fiscalSettingsService.provisionFiscalAdministration(req.auth, buildContext(req));
      await audit.recordAuditEventSafelyIfAvailable({ req, action: 'fiscal.issuer.provisioned', resourceType: 'fiscal-settings', resourceId: null, outcome: 'SUCCESS', metadata: { environment: result?.association?.environment || null } });
      return res.json(result);
    } catch (error) { return next(error); }
  },
);

async function handleCertificateWrite(req, res, next, replace) {
  const upload = req.fiscalCertificateUpload;
  try {
    const result = await fiscalSettingsService.writeFiscalCertificate(
      req.auth,
      upload,
      replace,
      buildContext(req),
    );
    await audit.recordAuditEventSafelyIfAvailable({
      req,
      action: replace ? 'fiscal.certificate.replaced' : 'fiscal.certificate.uploaded',
      resourceType: 'fiscal-settings',
      resourceId: null,
      outcome: 'SUCCESS',
      metadata: {
        environment: result?.environment || null,
        status: result?.certificate?.status || null,
      },
    });
    return res.status(replace ? 200 : 201).json(result);
  } catch (error) {
    return next(error);
  } finally {
    upload?.certificateBytes?.fill(0);
    req.fiscalCertificateUpload = null;
  }
}

router.post(
  '/fiscal-settings/certificate',
  authorizeAccessPolicy('fiscal-settings.credentials.manage'),
  parseFiscalCertificateUpload,
  (req, res, next) => handleCertificateWrite(req, res, next, false),
);

router.put(
  '/fiscal-settings/certificate',
  authorizeAccessPolicy('fiscal-settings.credentials.manage'),
  parseFiscalCertificateUpload,
  (req, res, next) => handleCertificateWrite(req, res, next, true),
);

router.put(
  '/fiscal-settings/issuer',
  authorizeAccessPolicy('fiscal-settings.issuer.manage'),
  validate(fiscalAdministrationUpdateSchema),
  async (req, res, next) => {
    try {
      const result = await fiscalSettingsService.updateFiscalAdministration(req.auth, req.body, buildContext(req));
      await audit.recordAuditEventSafelyIfAvailable({ req, action: 'fiscal.issuer-profile.updated', resourceType: 'fiscal-settings', resourceId: null, outcome: 'SUCCESS', metadata: { environment: result?.association?.environment || null } });
      return res.json(result);
    } catch (error) { return next(error); }
  },
);

router.get('/fiscal-settings/issuance-points', authorizeAccessPolicy('fiscal-settings.issuer.view'), async (req, res, next) => {
  try {
    return res.json(await fiscalSettingsService.getFiscalIssuanceAdministration(req.auth, buildContext(req)));
  } catch (error) { return next(error); }
});

router.post(
  '/fiscal-settings/branches',
  authorizeAccessPolicy('fiscal-settings.issuer.manage'),
  validate(fiscalBranchUpsertSchema),
  async (req, res, next) => {
    try {
      const result = await fiscalSettingsService.upsertFiscalBranch(req.auth, req.body, buildContext(req));
      await audit.recordAuditEventSafelyIfAvailable({ req, action: 'fiscal.branch.upserted', resourceType: 'fiscal-settings', resourceId: null, outcome: 'SUCCESS', metadata: { environment: result?.environment || null, branchCode: req.body.code } });
      return res.json(result);
    } catch (error) { return next(error); }
  },
);

router.patch(
  '/fiscal-settings/branches/:branchId/status',
  authorizeAccessPolicy('fiscal-settings.issuer.manage'),
  validate(fiscalActiveStateSchema),
  async (req, res, next) => {
    try {
      const result = await fiscalSettingsService.setFiscalBranchActive(req.auth, req.params.branchId, req.body.active, buildContext(req));
      await audit.recordAuditEventSafelyIfAvailable({ req, action: 'fiscal.branch.status-changed', resourceType: 'fiscal-settings', resourceId: null, outcome: 'SUCCESS', metadata: { environment: result?.environment || null, active: req.body.active } });
      return res.json(result);
    } catch (error) { return next(error); }
  },
);

router.post(
  '/fiscal-settings/branches/:branchId/terminals',
  authorizeAccessPolicy('fiscal-settings.issuer.manage'),
  validate(fiscalTerminalUpsertSchema),
  async (req, res, next) => {
    try {
      const result = await fiscalSettingsService.upsertFiscalTerminal(req.auth, req.params.branchId, req.body, buildContext(req));
      await audit.recordAuditEventSafelyIfAvailable({ req, action: 'fiscal.terminal.upserted', resourceType: 'fiscal-settings', resourceId: null, outcome: 'SUCCESS', metadata: { environment: result?.environment || null, terminalCode: req.body.code } });
      return res.json(result);
    } catch (error) { return next(error); }
  },
);

router.patch(
  '/fiscal-settings/terminals/:terminalId/status',
  authorizeAccessPolicy('fiscal-settings.issuer.manage'),
  validate(fiscalActiveStateSchema),
  async (req, res, next) => {
    try {
      const result = await fiscalSettingsService.setFiscalTerminalActive(req.auth, req.params.terminalId, req.body.active, buildContext(req));
      await audit.recordAuditEventSafelyIfAvailable({ req, action: 'fiscal.terminal.status-changed', resourceType: 'fiscal-settings', resourceId: null, outcome: 'SUCCESS', metadata: { environment: result?.environment || null, active: req.body.active } });
      return res.json(result);
    } catch (error) { return next(error); }
  },
);

router.put(
  '/fiscal-settings/issuance-points/default',
  authorizeAccessPolicy('fiscal-settings.issuer.manage'),
  validate(fiscalDefaultPointSchema),
  async (req, res, next) => {
    try {
      const result = await fiscalSettingsService.selectDefaultIssuancePoint(req.auth, req.body.terminalId, buildContext(req));
      await audit.recordAuditEventSafelyIfAvailable({ req, action: 'fiscal.issuance-point.default-selected', resourceType: 'fiscal-settings', resourceId: null, outcome: 'SUCCESS', metadata: { environment: result?.environment || null } });
      return res.json(result);
    } catch (error) { return next(error); }
  },
);

router.post(
  '/fiscal-settings/sequences/read',
  authorizeAccessPolicy('fiscal-settings.issuer.view'),
  validate(fiscalSequenceReadSchema),
  async (req, res, next) => {
    try {
      return res.json(await fiscalSettingsService.readFiscalSequence(req.auth, req.body.terminalId, req.body.documentType, buildContext(req)));
    } catch (error) { return next(error); }
  },
);

router.put(
  '/fiscal-settings/sequences/initial',
  authorizeAccessPolicy('fiscal-settings.issuer.manage'),
  validate(fiscalInitialSequenceSchema),
  async (req, res, next) => {
    try {
      const result = await fiscalSettingsService.configureInitialFiscalSequence(req.auth, req.body, buildContext(req));
      await audit.recordAuditEventSafelyIfAvailable({ req, action: 'fiscal.sequence.initialized', resourceType: 'fiscal-settings', resourceId: null, outcome: 'SUCCESS', metadata: { environment: result?.environment || null, documentType: req.body.documentType } });
      return res.json(result);
    } catch (error) { return next(error); }
  },
);

router.get('/fiscal-settings', authorizeAccessPolicy('fiscal-settings.view'), async (req, res, next) => {
  try {
    const settings = await fiscalSettingsService.getFiscalSettings(req.auth, buildContext(req));
    return res.json(settings);
  } catch (error) {
    return next(error);
  }
});

router.put(
  '/fiscal-settings/hacienda-credentials',
  authorizeAccessPolicy('fiscal-settings.credentials.manage'),
  validate(haciendaCredentialsSchema),
  async (req, res, next) => {
    try {
      const result = await fiscalSettingsService.configureHaciendaCredentials(req.auth, req.body, buildContext(req));
      await audit.recordAuditEventSafelyIfAvailable({
        req,
        action: 'fiscal.hacienda-credentials.updated',
        resourceType: 'fiscal-settings',
        resourceId: null,
        outcome: 'SUCCESS',
        metadata: {
          environment: result?.connection?.environment || null,
          status: result?.connection?.status || null,
        },
      });
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  '/fiscal-settings/hacienda-credentials/validate',
  authorizeAccessPolicy('fiscal-settings.credentials.manage'),
  async (req, res, next) => {
    try {
      const result = await fiscalSettingsService.validateHaciendaCredentials(req.auth, buildContext(req));
      await audit.recordAuditEventSafelyIfAvailable({
        req,
        action: 'fiscal.hacienda-credentials.validation-result',
        resourceType: 'fiscal-settings',
        resourceId: null,
        outcome: 'SUCCESS',
        metadata: {
          environment: result?.connection?.environment || null,
          status: result?.connection?.status || null,
        },
      });
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  '/fiscal-settings/hacienda-credentials/disable',
  authorizeAccessPolicy('fiscal-settings.credentials.manage'),
  async (req, res, next) => {
    try {
      const result = await fiscalSettingsService.disableHaciendaConnection(req.auth, buildContext(req));
      await audit.recordAuditEventSafelyIfAvailable({
        req,
        action: 'fiscal.hacienda-connection.disabled',
        resourceType: 'fiscal-settings',
        resourceId: null,
        outcome: 'SUCCESS',
        metadata: {
          environment: result?.connection?.environment || null,
          status: result?.connection?.status || null,
        },
      });
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },
);

router.post('/fiscal-settings/activities/refresh', authorizeAccessPolicy('fiscal-settings.activities.refresh'), async (req, res, next) => {
  try {
    const settings = await fiscalSettingsService.refreshFiscalActivities(req.auth, buildContext(req));
    await recordFiscalSettingsAudit(req, { action: 'fiscal.activities.refresh.requested' });
    return res.json(settings);
  } catch (error) {
    return next(error);
  }
});

router.patch(
  '/fiscal-settings/activities/:code',
  authorizeAccessPolicy('fiscal-settings.activities.manage'),
  validate(updateFiscalActivitySchema),
  async (req, res, next) => {
    try {
      const settings = await fiscalSettingsService.updateFiscalActivity(
        req.auth,
        req.params.code,
        req.body.billingEnabled,
        buildContext(req),
      );
      await recordFiscalSettingsAudit(req, {
        action: req.body.billingEnabled ? 'fiscal.activity.enabled' : 'fiscal.activity.disabled',
        activityCode: req.params.code,
      });
      return res.json(settings);
    } catch (error) {
      return next(error);
    }
  },
);

router.put(
  '/fiscal-settings/activities/default',
  authorizeAccessPolicy('fiscal-settings.activities.default.update'),
  validate(setDefaultFiscalActivitySchema),
  async (req, res, next) => {
    try {
      const settings = await fiscalSettingsService.setDefaultFiscalActivity(
        req.auth,
        req.body.code,
        buildContext(req),
      );
      await recordFiscalSettingsAudit(req, {
        action: 'fiscal.activity.default_changed',
        activityCode: req.body.code,
      });
      return res.json(settings);
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;
