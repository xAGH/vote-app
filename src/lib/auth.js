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

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.redirect('/admin/ingresar');
  return next();
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
  requireAdmin,
};
