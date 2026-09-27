const express = require('express');

const prisma = require('../lib/prisma');
const browserSessionService = require('../services/browser-session.service');
const fiscalSchedulerService = require('../services/fiscal-scheduler.service');

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

  // TASK-015B: Report fiscal scheduler state.
  // Does NOT fail readiness — the scheduler is a background worker, not a
  // mandatory synchronous dependency for HTTP request handling.
  // Never exposes API keys, secret references or fiscal payload data.
  const schedulerStatus = fiscalSchedulerService.getApplicationSchedulerStatus();
  checks.fiscalScheduler = schedulerStatus.running ? 'running' : 'stopped';

  return res.status(isReady ? 200 : 503).json({
    ok: isReady,
    service: 'inventory-api',
    checks,
  });
});

module.exports = router;
