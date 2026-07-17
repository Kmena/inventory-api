const express = require('express');

const prisma = require('../lib/prisma');

const router = express.Router();

router.get('/', (_req, res) => {
  return res.json({
    ok: true,
    service: 'inventory-api',
  });
});

router.get('/ready', async (_req, res) => {
  try {
    await prisma.checkDatabaseReadiness();
    return res.json({
      ok: true,
      service: 'inventory-api',
      checks: {
        database: 'up',
      },
    });
  } catch (_error) {
    return res.status(503).json({
      ok: false,
      service: 'inventory-api',
      checks: {
        database: 'down',
      },
    });
  }
});

module.exports = router;
