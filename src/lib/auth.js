'use strict';

const crypto = require('crypto');

const SCRYPT_KEYLEN = 64;

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

/** Genera un CSRF token por sesión y lo guarda si no existe todavía. */
function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  return req.session.csrfToken;
}

function verifyCsrf(req) {
  const token = req.body && req.body._csrf;
  return typeof token === 'string' && req.session.csrfToken && timingSafeEqualStrings(token, req.session.csrfToken);
}

function csrfMiddleware(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    // Estas páginas llevan un csrfToken atado a la sesión: si un proxy/CDN
    // delante (Traefik, Cloudflare) las cachea, todos los visitantes reciben
    // el mismo token sin la cookie de sesión que lo respalda y el login falla
    // siempre con "Solicitud inválida".
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
