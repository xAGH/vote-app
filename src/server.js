'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');

const { init } = require('./db');
const { flashMiddleware } = require('./lib/flash');

init();

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET || SESSION_SECRET.length < 16) {
  if (process.env.NODE_ENV === 'production') {
    console.error('SESSION_SECRET debe estar configurado (mínimo 16 caracteres) en producción.');
    process.exit(1);
  }
  console.warn('⚠ SESSION_SECRET no configurado o muy corto: usando uno temporal solo para desarrollo.');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');
app.set('trust proxy', 1);

app.use(expressLayouts);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Sonda de salud para Docker/orquestadores. Antes de la sesión a propósito:
// no debe crear cookies ni tocar el store de sesión en cada ping.
app.get('/healthz', (req, res) => {
  try {
    const { getDb } = require('./db');
    getDb().prepare('SELECT 1').get();
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

app.use(
  session({
    name: 'showroom.sid',
    secret: SESSION_SECRET || 'dev-only-secret-not-for-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8, // 8 horas: dura toda la jornada del evento
    },
  })
);

// Datos del evento disponibles en todas las vistas.
app.use((req, res, next) => {
  const { getDb } = require('./db');
  res.locals.event = getDb().prepare('SELECT * FROM event WHERE id = 1').get();
  res.locals.voter = req.session.voter || null;
  res.locals.judge = req.session.judge || null;
  res.locals.isAdmin = !!req.session.isAdmin;
  res.locals.currentPath = req.path;
  next();
});
app.use(flashMiddleware);

app.use('/', require('./routes/public'));
app.use('/', require('./routes/apprentice'));
app.use('/', require('./routes/jury'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Página no encontrada',
    message: 'La página que buscas no existe o la dirección está mal escrita.',
    backHref: '/',
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Algo salió mal',
    message: 'Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.',
    backHref: '/',
  });
});

app.listen(PORT, () => {
  console.log(`ShowRoom Vote escuchando en http://localhost:${PORT}`);
});
