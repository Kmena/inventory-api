const express = require('express');

const prisma = require('../lib/prisma');
const browserSessionService = require('../services/browser-session.service');

const router = express.Router();

router.get('/', (_req, res) => {
  return res.json({
    ok: true,
    service: 'inventory-api',
  });
});

router.get('/ready', async (_req, res) => {
  const checks = {};
  let isReady = true;

  try {
    await prisma.checkDatabaseReadiness();
    checks.database = 'up';
  } catch (_error) {
    checks.database = 'down';
    isReady = false;
  }

  const browserSessionStoreReadiness = await browserSessionService.checkBrowserSessionStoreReadiness();
  checks.browserSessionStore = browserSessionStoreReadiness.status;
  if (browserSessionStoreReadiness.mode === 'redis' && browserSessionStoreReadiness.status !== 'up') {
    isReady = false;
  }

  return res.status(isReady ? 200 : 503).json({
    ok: isReady,
    service: 'inventory-api',
    checks,
  });
});

module.exports = router;
