const app = require('./app');
const { port } = require('./config');
const {
  startApplicationScheduler,
  stopApplicationScheduler,
} = require('./services/fiscal-scheduler.service');

const server = app.listen(port, () => {
  console.log(`Inventory API corriendo en http://localhost:${port}`);
  // TASK-015B: Start fiscal scheduler after HTTP server is accepting connections.
  // Scheduler is no-op if FISCAL_SCHEDULER_ENABLED !== 'true' or BILLING_BASE_URL is unset.
  startApplicationScheduler();
});

// ---------------------------------------------------------------------------
// Graceful shutdown — SIGTERM (container/orchestrator) and SIGINT (Ctrl+C)
// ---------------------------------------------------------------------------

let _shutdownInProgress = false;

async function gracefulShutdown(signal) {
  if (_shutdownInProgress) return;
  _shutdownInProgress = true;

  console.log(`${signal}: iniciando apagado controlado del servidor...`);

  // 1. Stop fiscal scheduler — wait for any active poll cycle to complete
  try {
    await stopApplicationScheduler();
    console.log('Fiscal scheduler detenido.');
  } catch (err) {
    console.error('Error al detener fiscal scheduler:', err?.message || err);
  }

  // 2. Stop accepting new HTTP connections
  server.close((err) => {
    if (err) {
      console.error('Error al cerrar servidor HTTP:', err.message);
    } else {
      console.log('Servidor HTTP cerrado.');
    }
    process.exit(0);
  });

  // 3. Force exit if server.close() takes too long (e.g., keep-alive connections)
  setTimeout(() => {
    console.error('Apagado forzado por timeout. Terminando proceso.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => { gracefulShutdown('SIGTERM'); });
process.on('SIGINT', () => { gracefulShutdown('SIGINT'); });
