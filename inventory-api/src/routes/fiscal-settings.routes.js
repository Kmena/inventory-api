const express = require('express');

const authenticate = require('../middlewares/authenticate');
const validate = require('../middlewares/validate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const audit = require('../lib/audit');
const fiscalSettingsService = require('../services/fiscal-settings.service');
const {
  updateFiscalActivitySchema,
  setDefaultFiscalActivitySchema,
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

router.get('/fiscal-settings', authorizeAccessPolicy('fiscal-settings.view'), async (req, res, next) => {
  try {
    const settings = await fiscalSettingsService.getFiscalSettings(req.auth, buildContext(req));
    return res.json(settings);
  } catch (error) {
    return next(error);
  }
});

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
