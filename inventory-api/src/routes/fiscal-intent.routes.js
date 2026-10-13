const express = require('express');
const authenticate = require('../middlewares/authenticate');
const validate = require('../middlewares/validate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const { parseBigIntId } = require('../lib/parse');
const { recoverFinalFiscalIntentSchema } = require('../schemas/fiscal-intent-recovery.schema');
const fiscalIntentOperatorRecoveryService = require('../services/fiscal-intent-operator-recovery.service');

const router = express.Router();

router.use(authenticate);

router.post(
  '/:id/recover-after-operator-repair',
  authorizeAccessPolicy('billing.handoff.create'),
  validate(recoverFinalFiscalIntentSchema),
  async (req, res, next) => {
    try {
      const result = await fiscalIntentOperatorRecoveryService.recoverVerifiedIdentityAfterOperatorRequest(
        parseBigIntId(req.params.id, 'id'),
        {
          reason: req.body.reason,
          auth: req.auth,
          req,
        },
      );
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;
