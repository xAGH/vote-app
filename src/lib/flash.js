'use strict';

const crypto = require('crypto');

function _secret() {
  return process.env.SESSION_SECRET || 'dev-only-secret-not-for-production';
}

/**
 * Codifica un mensaje flash en un query param firmado `_f=...`.
 * Úsalo para redirecciones cuando la sesión no es confiable (proxy sin cookies).
 */
function makeFlashParam(type, message) {
  const payload = Buffer.from(JSON.stringify({ type, message })).toString('base64url');
  const sig = crypto.createHmac('sha256', _secret()).update(`f:${payload}`).digest('hex').slice(0, 20);
  return `_f=${payload}.${sig}`;
}

function _readFlashParam(param) {
  if (!param || typeof param !== 'string') return null;
  const dot = param.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = param.slice(0, dot);
  const sig = param.slice(dot + 1);
  const expectedSig = crypto.createHmac('sha256', _secret()).update(`f:${payload}`).digest('hex').slice(0, 20);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/** Mensaje de una sola vista, guardado en sesión y consumido por el middleware. */
function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

function flashMiddleware(req, res, next) {
  // Sesión (cuando las cookies funcionan)
  if (req.session && req.session.flash) {
    res.locals.flash = req.session.flash;
    delete req.session.flash;
  } else if (req.query && req.query._f) {
    // Parámetro firmado en URL (cuando las cookies no llegan por el proxy)
    res.locals.flash = _readFlashParam(req.query._f);
  } else {
    res.locals.flash = null;
  }
  next();
}

module.exports = { setFlash, makeFlashParam, flashMiddleware };
