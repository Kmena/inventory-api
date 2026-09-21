const express = require('express');

const authenticate = require('../middlewares/authenticate');
const validate = require('../middlewares/validate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const { parseBigIntId } = require('../lib/parse');
const { parsePaginationQuery } = require('../lib/pagination');
const {
  cancelEntitlementSchema,
  manualActivateEntitlementSchema,
  renewEntitlementSchema,
} = require('../schemas/entitlement.schema');
const entitlementService = require('../services/entitlement.service');

const router = express.Router();
router.use(authenticate);

router.get(
  '/',
  authorizeAccessPolicy('entitlements.view'),
  async (req, res, next) => {
    try {
      return res.json(
        await entitlementService.listCompanyEntitlements(
          req.auth,
          parsePaginationQuery(req.query),
          req.query,
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  '/manual-activate',
  authorizeAccessPolicy('entitlements.activate.manual'),
  validate(manualActivateEntitlementSchema),
  async (req, res, next) => {
    try {
      return res.status(201).json(
        await entitlementService.manuallyActivateEntitlement(req.body, req.auth, req),
      );
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  '/:id',
  authorizeAccessPolicy('entitlements.view'),
  async (req, res, next) => {
    try {
      return res.json(
        await entitlementService.getCompanyEntitlement(parseBigIntId(req.params.id), req.auth),
      );
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  '/:id/cancel',
  authorizeAccessPolicy('entitlements.manage'),
  validate(cancelEntitlementSchema),
  async (req, res, next) => {
    try {
      return res.json(
        await entitlementService.cancelEntitlement(
          parseBigIntId(req.params.id),
          req.body,
          req.auth,
          req,
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  '/:id/renew',
  authorizeAccessPolicy('entitlements.manage'),
  validate(renewEntitlementSchema),
  async (req, res, next) => {
    try {
      return res.status(201).json(
        await entitlementService.renewEntitlement(
          parseBigIntId(req.params.id),
          req.body,
          req.auth,
          req,
        ),
      );
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;
