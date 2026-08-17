'use strict';

const express = require('express');

const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { parseBigIntId } = require('../lib/parse');
const {
  createRfqInvitationsSchema,
  manualRfqResponseSchema,
} = require('../schemas/procurement-rfq.schema');
const rfqService = require('../services/procurement-rfq.service');

const router = express.Router();
router.use(authenticate);

// Create RFQ invitations for suppliers in a purchase request
router.post(
  '/requests/:id/rfq-invitations',
  authorizeAccessPolicy('procurement.manage'),
  validate(createRfqInvitationsSchema),
  async (req, res, next) => {
    try {
      const result = await rfqService.createRfqInvitations(
        parseBigIntId(req.params.id),
        req.body,
        req.auth,
        req,
      );
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },
);

// List RFQ invitations for a purchase request
router.get(
  '/requests/:id/rfq-invitations',
  authorizeAccessPolicy('procurement.view'),
  async (req, res, next) => {
    try {
      return res.json(await rfqService.listRfqInvitations(
        parseBigIntId(req.params.id),
        req.auth,
      ));
    } catch (error) {
      return next(error);
    }
  },
);

// Refresh/regenerate template for an invitation
router.post(
  '/rfq-invitations/:id/refresh-template',
  authorizeAccessPolicy('procurement.manage'),
  async (req, res, next) => {
    try {
      return res.json(await rfqService.refreshInvitationTemplate(
        parseBigIntId(req.params.id),
        req.auth,
        req,
      ));
    } catch (error) {
      return next(error);
    }
  },
);

// Cancel an RFQ invitation
router.post(
  '/rfq-invitations/:id/cancel',
  authorizeAccessPolicy('procurement.manage'),
  async (req, res, next) => {
    try {
      return res.json(await rfqService.cancelInvitation(
        parseBigIntId(req.params.id),
        req.auth,
        req,
      ));
    } catch (error) {
      return next(error);
    }
  },
);

// Submit manual response for an invitation (office email capture)
router.post(
  '/rfq-invitations/:id/manual-response',
  authorizeAccessPolicy('procurement.manage'),
  validate(manualRfqResponseSchema),
  async (req, res, next) => {
    try {
      return res.json(await rfqService.submitManualResponse(
        parseBigIntId(req.params.id),
        req.body,
        req.auth,
        req,
      ));
    } catch (error) {
      return next(error);
    }
  },
);

// RFQ tracking summary
router.get(
  '/rfq-tracking',
  authorizeAccessPolicy('procurement.view'),
  async (req, res, next) => {
    try {
      return res.json(await rfqService.getRfqTrackingSummary(req.auth));
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;
