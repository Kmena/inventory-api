const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  return res.json({
    ok: true,
    service: 'inventory-api',
  });
});

module.exports = router;
