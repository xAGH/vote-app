'use strict';

/** Mensaje de una sola vista, guardado en sesión y consumido por el middleware. */
function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

function flashMiddleware(req, res, next) {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
}

module.exports = { setFlash, flashMiddleware };
