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

// ---- Tokens de sesión en URL (viajan en query/body, no en cookie) ----
// Mismo principio que el Basic Auth del admin: el token va en cada request.
// Mismo principio que el Basic Auth del admin: el token va en cada request
// en vez de depender de que una cookie sobreviva el proxy.

const JUDGE_TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

function signJudgeToken(judgeId) {
  const expiry = Math.floor((Date.now() + JUDGE_TOKEN_TTL_MS) / 1000);
  const payload = `${judgeId}.${expiry}`;
  const sig = crypto.createHmac('sha256', _appSecret()).update(`jtok:${payload}`).digest('hex');
  return `${payload}.${sig}`;
}

function verifyJudgeToken(token) {
  if (!token || typeof token !== 'string') return null;
  // formato: judgeId.expiry.hmac (64 hex chars sin punto)
  const last = token.lastIndexOf('.');
  const mid = token.indexOf('.');
  if (last < 0 || mid === last) return null;
  const payload = token.slice(0, last);
  const sig = token.slice(last + 1);
  const [idStr, expiryStr] = payload.split('.');
  const judgeId = Number(idStr);
  const expiry = Number(expiryStr);
  if (!Number.isFinite(judgeId) || judgeId < 1) return null;
  if (!Number.isFinite(expiry) || Math.floor(Date.now() / 1000) > expiry) return null;
  const expected = crypto.createHmac('sha256', _appSecret()).update(`jtok:${payload}`).digest('hex');
  if (!timingSafeEqualStrings(sig, expected)) return null;
  return judgeId;
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

const VOTER_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function signVoterToken(voterId) {
  const expiry = Math.floor((Date.now() + VOTER_TOKEN_TTL_MS) / 1000);
  const payload = `${voterId}.${expiry}`;
  const sig = crypto.createHmac('sha256', _appSecret()).update(`vtok:${payload}`).digest('hex');
  return `${payload}.${sig}`;
}

function verifyVoterToken(token) {
  if (!token || typeof token !== 'string') return null;
  const last = token.lastIndexOf('.');
  const mid = token.indexOf('.');
  if (last < 0 || mid === last) return null;
  const payload = token.slice(0, last);
  const sig = token.slice(last + 1);
  const [idStr, expiryStr] = payload.split('.');
  const voterId = Number(idStr);
  const expiry = Number(expiryStr);
  if (!Number.isFinite(voterId) || voterId < 1) return null;
  if (!Number.isFinite(expiry) || Math.floor(Date.now() / 1000) > expiry) return null;
  const expected = crypto.createHmac('sha256', _appSecret()).update(`vtok:${payload}`).digest('hex');
  if (!timingSafeEqualStrings(sig, expected)) return null;
  return voterId;
}

function requireVoter(req, res, next) {
  const rawToken = (req.query && req.query._v) || (req.body && req.body._v) || '';
  if (rawToken) {
    const voterId = verifyVoterToken(rawToken);
    if (voterId) {
      const { getDb } = require('../db');
      const voter = getDb()
        .prepare('SELECT id, full_name, ficha_code FROM voters WHERE id = ?')
        .get(voterId);
      if (voter) {
        req.session.voter = { id: voter.id, fullName: voter.full_name, fichaCode: voter.ficha_code };
        res.locals.voter = { id: voter.id, fullName: voter.full_name, fichaCode: voter.ficha_code };
        res.locals.voterToken = rawToken;
        return next();
      }
    }
  }
  if (req.session && req.session.voter) {
    res.locals.voter = req.session.voter;
    res.locals.voterToken = signVoterToken(req.session.voter.id);
    return next();
  }
  return res.redirect('/aprendiz');
}

function requireJudge(req, res, next) {
  // Token en URL/body (sin cookies — igual que admin usa Authorization header)
  const rawToken = (req.query && req.query._j) || (req.body && req.body._j) || '';
  if (rawToken) {
    const judgeId = verifyJudgeToken(rawToken);
    if (judgeId) {
      const { getDb } = require('../db');
      const judge = getDb()
        .prepare('SELECT id, name FROM judges WHERE id = ? AND is_active = 1')
        .get(judgeId);
      if (judge) {
        req.session.judge = { id: judge.id, name: judge.name };
        res.locals.judge = { id: judge.id, name: judge.name };
        res.locals.judgeToken = rawToken;
        return next();
      }
    }
  }
  // Respaldo: sesión (para entornos donde las cookies sí funcionan)
  if (req.session && req.session.judge) {
    res.locals.judge = req.session.judge;
    res.locals.judgeToken = signJudgeToken(req.session.judge.id);
    return next();
  }
  return res.redirect('/jurado');
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
  signJudgeToken,
  verifyJudgeToken,
  signVoterToken,
  verifyVoterToken,
  requireVoter,
  requireJudge,
  basicAuthAdmin,
};
