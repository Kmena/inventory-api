const morgan = require('morgan');

function isDevelopmentEnvironment(nodeEnv) {
  return nodeEnv === 'development';
}

function toStructuredLog(payload) {
  return JSON.stringify(payload);
}

function createRequestLogMessage({ nodeEnv, method, path, statusCode, durationMs, errorCode }) {
  return toStructuredLog({
    level: 'info',
    environment: nodeEnv,
    method,
    path,
    statusCode,
    durationMs,
    errorCode: errorCode || '-',
  });
}

function createRequestLogger(nodeEnv) {
  if (isDevelopmentEnvironment(nodeEnv)) {
    return morgan('dev');
  }

  return morgan((tokens, req, res) => {
    const statusToken = tokens.status(req, res);
    const durationToken = tokens['response-time'](req, res);

    return createRequestLogMessage({
      nodeEnv,
      method: tokens.method(req, res),
      path: tokens.url(req, res),
      statusCode: statusToken ? Number(statusToken) : 0,
      durationMs: durationToken ? Number.parseFloat(durationToken) : 0,
      errorCode: res.locals?.errorCode,
    });
  });
}

function buildErrorLogEntry({ error, req, nodeEnv }) {
  if (isDevelopmentEnvironment(nodeEnv)) {
    return error;
  }

  return {
    level: 'error',
    environment: nodeEnv,
    method: req.method,
    path: req.originalUrl || req.url,
    statusCode: error?.statusCode || 500,
    errorCode: error?.code || 'internal_server_error',
  };
}

function logRequestError({ error, req, nodeEnv, errorLogger = console.error }) {
  errorLogger(buildErrorLogEntry({ error, req, nodeEnv }));
}

function logConfigurationWarning({ message, nodeEnv, warnLogger = console.warn }) {
  if (isDevelopmentEnvironment(nodeEnv)) {
    warnLogger(message);
    return;
  }

  warnLogger(
    toStructuredLog({
      level: 'warn',
      environment: nodeEnv,
      code: 'configuration_warning',
      message,
    }),
  );
}

module.exports = {
  buildErrorLogEntry,
  createRequestLogger,
  createRequestLogMessage,
  isDevelopmentEnvironment,
  logConfigurationWarning,
  logRequestError,
};
