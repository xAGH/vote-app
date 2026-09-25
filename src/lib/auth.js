'use strict';

const crypto = require('crypto');

const SCRYPT_KEYLEN = 64;
const CSRF_WINDOW_MS = 15 * 60 * 1000;

// ---- PIN ----

function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPin(pin, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(String(pin), salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---- CSRF stateless (HMAC por ventana de tiempo) ----
// El token se deriva del secreto + bucket de tiempo. No necesita sesión ni
// cookies: aunque Cloudflare/Traefik cachee la página o corte el Set-Cookie,
// el servidor puede verificar el token sin estado almacenado.

function _appSecret() {
  return process.env.SESSION_SECRET || 'dev-only-secret-not-for-production';
}

function makeCsrfToken() {
  const bucket = Math.floor(Date.now() / CSRF_WINDOW_MS);
  return crypto.createHmac('sha256', _appSecret()).update(`csrf:${bucket}`).digest('hex');
}

function _verifyCsrfHmac(token) {
  if (typeof token !== 'string' || !token) return false;
  const bucket = Math.floor(Date.now() / CSRF_WINDOW_MS);
  // Acepta bucket actual y el anterior (margen de 15 min en cambio de ventana)
  for (const b of [bucket, bucket - 1]) {
    const expected = crypto.createHmac('sha256', _appSecret()).update(`csrf:${b}`).digest('hex');
    if (timingSafeEqualStrings(token, expected)) return true;
  }
  return false;
}

/** Devuelve un token CSRF. No depende de que la sesión funcione. */
function ensureCsrfToken(req) {
  const token = makeCsrfToken();
  // Guardar en sesión solo como respaldo; no se depende de ello para verificar.
  if (req.session) req.session.csrfToken = token;
  return token;
}

function verifyCsrf(req) {
  const token = req.body && req.body._csrf;
  if (typeof token !== 'string') return false;
  // Verificación stateless (no necesita sesión ni cookies)
  if (_verifyCsrfHmac(token)) return true;
  // Respaldo: verificación basada en sesión (por si hay sesiones viejas activas)
  return !!(req.session && req.session.csrfToken && timingSafeEqualStrings(token, req.session.csrfToken));
}

function csrfMiddleware(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    // Previene que proxies/CDN cacheen la página y sirvan el mismo token a
    // todos los usuarios (lo que causaría "Solicitud inválida" al enviar).
    res.set('Cache-Control', 'no-store');
    ensureCsrfToken(req);
    return next();
  }
  if (!verifyCsrf(req)) {
    if (req.is('application/json')) {
      return res.status(403).json({ success: false, message: 'Sesión inválida, recarga la página.' });
    }
    return res.status(403).render('error', {
      title: 'Solicitud inválida',
      message: 'Tu sesión expiró o la página se envió dos veces. Vuelve a intentarlo.',
      backHref: '/',
    });
  }
  return next();
}

function requireVoter(req, res, next) {
  if (!req.session.voter) return res.redirect('/aprendiz');
  return next();
}

function requireJudge(req, res, next) {
  if (!req.session.judge) return res.redirect('/jurado');
  return next();
}

/**
 * Protege /admin con HTTP Basic Auth en vez de sesión + CSRF: no depende de
 * cookies ni de Set-Cookie llegando al navegador (esto último resultó no
 * viajar de forma confiable a través de Cloudflare Tunnel + Traefik en
 * producción). El navegador reenvía el header Authorization en cada request.
 */
function basicAuthAdmin(req, res, next) {
  const expected = process.env.ADMIN_PASSWORD || '';
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

  if (expected && scheme === 'Basic' && encoded) {
    let password = '';
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      password = decoded.slice(decoded.indexOf(':') + 1);
    } catch {
      password = '';
    }
    if (timingSafeEqualStrings(password, expected)) {
      req.isAdmin = true;
      return next();
    }
  }

  res.set('WWW-Authenticate', 'Basic realm="Administracion ShowRoom"');
  return res.status(401).send('Autenticación requerida.');
}

module.exports = {
  hashPin,
  verifyPin,
  timingSafeEqualStrings,
  ensureCsrfToken,
  verifyCsrf,
  csrfMiddleware,
  requireVoter,
  requireJudge,
  basicAuthAdmin,
};
