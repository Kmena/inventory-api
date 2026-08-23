'use strict';

const express = require('express');

const {
  LOOKUP_THROTTLE_WINDOW_MS,
  RFQ_PUBLIC_READ_THROTTLE_MAX_REQUESTS,
  RFQ_PUBLIC_SUBMIT_THROTTLE_MAX_REQUESTS,
  createRequestThrottle,
} = require('../middlewares/request-throttle');
const validate = require('../middlewares/validate');
const { publicRfqResponseSchema } = require('../schemas/procurement-rfq.schema');
const rfqService = require('../services/procurement-rfq.service');

const publicInvitationReadThrottle = createRequestThrottle({
  scope: 'rfq.public.read',
  maxRequests: RFQ_PUBLIC_READ_THROTTLE_MAX_REQUESTS,
  windowMs: LOOKUP_THROTTLE_WINDOW_MS,
  message: 'Demasiadas solicitudes públicas de cotización en poco tiempo. Intente de nuevo más tarde.',
});

const publicInvitationResponseSubmitThrottle = createRequestThrottle({
  scope: 'rfq.public.submit',
  maxRequests: RFQ_PUBLIC_SUBMIT_THROTTLE_MAX_REQUESTS,
  windowMs: LOOKUP_THROTTLE_WINDOW_MS,
  message: 'Demasiados envíos de cotización en poco tiempo. Intente de nuevo más tarde.',
});

const router = express.Router();

// Public: Get invitation details by token (no authentication required)
router.get('/:token', publicInvitationReadThrottle, async (req, res, next) => {
  try {
    return res.json(await rfqService.getPublicInvitation(req.params.token, req));
  } catch (error) {
    return next(error);
  }
});

// Public: Submit supplier response by token (no authentication required)
router.post('/:token/response', publicInvitationResponseSubmitThrottle, validate(publicRfqResponseSchema), async (req, res, next) => {
  try {
    return res.status(201).json(await rfqService.submitPublicResponse(req.params.token, req.body, req));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
