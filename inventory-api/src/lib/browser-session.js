const crypto = require('crypto');

const {
  nodeEnv,
  jwtSecret,
} = require('../config');

const BROWSER_SESSION_COOKIE_NAME = 'inventory_browser_session';
const BROWSER_SESSION_STATE_COOKIE_NAME = 'inventory_browser_state';
const BROWSER_SESSION_COMPATIBILITY_TOKEN = '__inventory_browser_session__';

function parseCookies(headerValue) {
  const cookies = {};
  const serializedCookies = String(headerValue || '').trim();
  if (!serializedCookies) {
    return cookies;
  }

  for (const entry of serializedCookies.split(';')) {
    const [rawKey, ...rawValueParts] = entry.split('=');
    const key = rawKey?.trim();
    if (!key) {
      continue;
    }

    cookies[key] = rawValueParts.join('=').trim();
  }

  return cookies;
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${value}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly) {
    parts.push('HttpOnly');
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function isSecureRequest(req) {
  return req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

function shouldUseSecureCookie(req) {
  if (String(process.env.FORCE_SECURE_BROWSER_SESSION_COOKIE || '').trim().toLowerCase() === 'true') {
    return true;
  }

  return nodeEnv === 'production' || isSecureRequest(req);
}

function signBrowserState(payload) {
  return crypto
    .createHmac('sha256', jwtSecret)
    .update(payload)
    .digest('hex');
}

function buildBrowserStateCookieValue(user) {
  const serializedUser = JSON.stringify({
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    companyId: user.companyId,
    role: {
      code: user.role?.code || null,
    },
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  });
  const encodedPayload = Buffer.from(serializedUser, 'utf8').toString('base64url');
  return `${encodedPayload}.${signBrowserState(encodedPayload)}`;
}

function verifyBrowserStateCookieValue(cookieValue) {
  const normalizedCookieValue = String(cookieValue || '').trim();
  if (!normalizedCookieValue.includes('.')) {
    return null;
  }

  const [encodedPayload, providedSignature] = normalizedCookieValue.split('.');
  const expectedSignature = signBrowserState(encodedPayload);
  if (!providedSignature || providedSignature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    return {
      user: payload,
      authMode: 'browser-session',
      token: BROWSER_SESSION_COMPATIBILITY_TOKEN,
    };
  } catch (_error) {
    return null;
  }
}

function appendSetCookieHeader(res, cookieValue) {
  const existingSetCookie = res.getHeader('Set-Cookie');
  if (!existingSetCookie) {
    res.setHeader('Set-Cookie', [cookieValue]);
    return;
  }

  if (Array.isArray(existingSetCookie)) {
    res.setHeader('Set-Cookie', [...existingSetCookie, cookieValue]);
    return;
  }

  res.setHeader('Set-Cookie', [existingSetCookie, cookieValue]);
}

function setBrowserSessionCookies(res, req, sessionId, expiresAt, user) {
  const cookieOptions = {
    path: '/',
    sameSite: 'Lax',
    secure: shouldUseSecureCookie(req),
    expires: new Date(expiresAt),
    maxAge: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
  };

  appendSetCookieHeader(res, serializeCookie(BROWSER_SESSION_COOKIE_NAME, sessionId, {
    ...cookieOptions,
    httpOnly: true,
  }));
  appendSetCookieHeader(res, serializeCookie(
    BROWSER_SESSION_STATE_COOKIE_NAME,
    buildBrowserStateCookieValue(user),
    cookieOptions,
  ));
}

function clearBrowserSessionCookies(res, req) {
  const cookieOptions = {
    path: '/',
    sameSite: 'Lax',
    secure: shouldUseSecureCookie(req),
    expires: new Date(0),
    maxAge: 0,
  };

  appendSetCookieHeader(res, serializeCookie(BROWSER_SESSION_COOKIE_NAME, '', {
    ...cookieOptions,
    httpOnly: true,
  }));
  appendSetCookieHeader(res, serializeCookie(BROWSER_SESSION_STATE_COOKIE_NAME, '', cookieOptions));
}

function readBrowserSessionIdFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[BROWSER_SESSION_COOKIE_NAME] || null;
}

module.exports = {
  BROWSER_SESSION_COOKIE_NAME,
  BROWSER_SESSION_STATE_COOKIE_NAME,
  BROWSER_SESSION_COMPATIBILITY_TOKEN,
  buildBrowserStateCookieValue,
  clearBrowserSessionCookies,
  isSecureRequest,
  parseCookies,
  readBrowserSessionIdFromRequest,
  setBrowserSessionCookies,
  shouldUseSecureCookie,
  verifyBrowserStateCookieValue,
};
