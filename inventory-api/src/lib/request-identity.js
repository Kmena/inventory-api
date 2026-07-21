function normalizeHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return String(value || '').trim();
}

function getForwardedForIp(req) {
  const forwardedFor = normalizeHeaderValue(req.headers?.['x-forwarded-for']);
  if (!forwardedFor) {
    return null;
  }

  const [firstIp] = forwardedFor.split(',');
  const normalizedIp = String(firstIp || '').trim();
  return normalizedIp || null;
}

function resolveClientIdentity(req) {
  const expressIp = String(req.ip || '').trim();
  if (expressIp) {
    return {
      clientIp: expressIp,
      source: 'express',
    };
  }

  const forwardedForIp = getForwardedForIp(req);
  if (forwardedForIp) {
    return {
      clientIp: forwardedForIp,
      source: 'x-forwarded-for',
    };
  }

  const socketIp = String(req.socket?.remoteAddress || '').trim();
  if (socketIp) {
    return {
      clientIp: socketIp,
      source: 'socket',
    };
  }

  return {
    clientIp: 'unknown',
    source: 'unknown',
  };
}

function getAuthenticatedActorKey(req) {
  if (req.auth?.sub) {
    return `user:${req.auth.sub}`;
  }

  if (req.auth?.username) {
    return `username:${String(req.auth.username).trim().toLowerCase()}`;
  }

  return 'anonymous';
}

module.exports = {
  getAuthenticatedActorKey,
  getForwardedForIp,
  resolveClientIdentity,
};
