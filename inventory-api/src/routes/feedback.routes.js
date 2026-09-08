const express = require('express');
const authenticate = require('../middlewares/authenticate');
const { authorizeAccessPolicy } = require('../security/access-policies');
const validate = require('../middlewares/validate');
const { createFeedbackSchema } = require('../schemas/feedback.schema');
const feedbackService = require('../services/feedback.service');

const router = express.Router();
router.use(authenticate);

router.post('/', validate(createFeedbackSchema), async (req, res, next) => {
  try {
    const feedback = await feedbackService.submitFeedback(req.body, req);
    return res.status(201).json({ id: feedback.id, createdAt: feedback.createdAt });
  } catch (error) {
    return next(error);
  }
});

router.get('/admin', authorizeAccessPolicy('feedback.list-global'), async (req, res, next) => {
  try {
    const items = await feedbackService.listFeedback(req.query);
    return res.json(items);
  } catch (error) {
    return next(error);
  }
});

router.patch('/admin/:id/resolve', authorizeAccessPolicy('feedback.resolve'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'validation_error', message: 'ID inválido' });
    }
    const updated = await feedbackService.resolveFeedback(id, req);
    return res.json({ id: updated.id, resolved: updated.resolved, resolvedAt: updated.resolvedAt });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
