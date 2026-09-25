'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const { getDb } = require('../db');
const { syncAttendance, getSyncStatus } = require('../lib/pulse');
const { hashPin, basicAuthAdmin } = require('../lib/auth');
const { setFlash } = require('../lib/flash');
const { apprenticeResults, juryResults } = require('../lib/scoring');

// Limita intentos de fuerza bruta contra la contraseña de admin. No distingue
// aciertos de fallos (express-rate-limit cuenta todo), pero como el panel se
// usa poco durante el evento, un límite generoso igual frena el brute force.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.',
});

router.use(adminLimiter);
router.use(basicAuthAdmin);
router.use((req, res, next) => {
  res.locals.mainClass = 'main--wide';
  next();
});

// ---------- Panel principal ----------

router.get('/', (req, res) => {
  const db = getDb();
  const stats = {
    projects: db.prepare('SELECT COUNT(*) AS n FROM projects WHERE is_active = 1').get().n,
    fichas: db.prepare('SELECT COUNT(*) AS n FROM visiting_fichas WHERE is_active = 1').get().n,
    judges: db.prepare('SELECT COUNT(*) AS n FROM judges WHERE is_active = 1').get().n,
    votes: db.prepare('SELECT COUNT(*) AS n FROM apprentice_votes').get().n,
    evaluationsSubmitted: db.prepare('SELECT COUNT(*) AS n FROM jury_evaluations WHERE submitted_at IS NOT NULL').get().n,
    evaluationsExpected: stats_judges_times_projects(db),
  };

  const fichas = db.prepare('SELECT * FROM visiting_fichas WHERE is_active = 1 ORDER BY label').all();
  const syncByFicha = fichas.map((f) => ({
    ficha: f,
    sync: getSyncStatus(f.ficha_code, res.locals.event.event_date),
  }));

  res.render('admin/dashboard', {
    title: 'Panel de administración',
    stats,
    syncByFicha,
  });
});

function stats_judges_times_projects(db) {
  const j = db.prepare('SELECT COUNT(*) AS n FROM judges WHERE is_active = 1').get().n;
  const p = db.prepare('SELECT COUNT(*) AS n FROM projects WHERE is_active = 1').get().n;
  return j * p;
}

router.post('/evento/aprendices', (req, res) => {
  const db = getDb();
  const open = req.body.open === '1' ? 1 : 0;
  db.prepare('UPDATE event SET apprentice_voting_open = ?, updated_at = datetime(\'now\') WHERE id = 1').run(open);
  setFlash(req, 'done', open ? 'Votación de aprendices abierta.' : 'Votación de aprendices cerrada.');
  res.redirect('/admin');
});

router.post('/evento/jurados', (req, res) => {
  const db = getDb();
  const open = req.body.open === '1' ? 1 : 0;
  db.prepare('UPDATE event SET jury_voting_open = ?, updated_at = datetime(\'now\') WHERE id = 1').run(open);
  setFlash(req, 'done', open ? 'Calificación de jurados abierta.' : 'Calificación de jurados cerrada.');
  res.redirect('/admin');
});

router.post('/evento/config', (req, res) => {
  const db = getDb();
  const name = String(req.body.name || '').trim();
  const date = String(req.body.event_date || '').trim();
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    setFlash(req, 'warn', 'Revisa el nombre del evento y la fecha (formato AAAA-MM-DD).');
    return res.redirect('/admin');
  }
  db.prepare('UPDATE event SET name = ?, event_date = ?, updated_at = datetime(\'now\') WHERE id = 1').run(name, date);
  setFlash(req, 'done', 'Configuración del evento actualizada.');
  res.redirect('/admin');
});

// ---------- Fichas visitantes ----------

router.get('/fichas', (req, res) => {
  const db = getDb();
  const fichas = db.prepare('SELECT * FROM visiting_fichas ORDER BY is_active DESC, label').all();
  const syncByFicha = fichas.map((f) => ({ ficha: f, sync: getSyncStatus(f.ficha_code, res.locals.event.event_date) }));
  res.render('admin/fichas', { title: 'Fichas visitantes', syncByFicha });
});

router.post('/fichas', (req, res) => {
  const db = getDb();
  const fichaCode = String(req.body.ficha_code || '').trim();
  const label = String(req.body.label || '').trim() || fichaCode;
  if (!fichaCode) {
    setFlash(req, 'warn', 'Escribe el código de la ficha.');
    return res.redirect('/admin/fichas');
  }
  try {
    db.prepare('INSERT INTO visiting_fichas (ficha_code, label) VALUES (?, ?)').run(fichaCode, label);
    setFlash(req, 'done', `Ficha ${fichaCode} agregada.`);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      db.prepare('UPDATE visiting_fichas SET is_active = 1, label = ? WHERE ficha_code = ?').run(label, fichaCode);
      setFlash(req, 'done', `Ficha ${fichaCode} reactivada.`);
    } else {
      throw err;
    }
  }
  res.redirect('/admin/fichas');
});

router.post('/fichas/:id/eliminar', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE visiting_fichas SET is_active = 0 WHERE id = ?').run(req.params.id);
  setFlash(req, 'done', 'Ficha desactivada.');
  res.redirect('/admin/fichas');
});

router.post('/fichas/:id/sincronizar', async (req, res) => {
  const db = getDb();
  const ficha = db.prepare('SELECT * FROM visiting_fichas WHERE id = ?').get(req.params.id);
  if (!ficha) return res.redirect('/admin/fichas');

  const result = await syncAttendance(ficha.ficha_code, res.locals.event.event_date);
  if (!result.ok) {
    setFlash(req, 'warn', `No se pudo sincronizar la ficha ${ficha.ficha_code}: ${result.error}`);
  } else if (!result.hasSessions) {
    setFlash(req, 'warn', `Ficha ${ficha.ficha_code} sincronizada, pero el instructor aún no registra asistencia hoy.`);
  } else {
    setFlash(req, 'done', `Ficha ${ficha.ficha_code} sincronizada: ${result.rosterCount} aprendices en el roster.`);
  }
  res.redirect('/admin/fichas');
});

router.post('/fichas/sincronizar-todas', async (req, res) => {
  const db = getDb();
  const fichas = db.prepare('SELECT * FROM visiting_fichas WHERE is_active = 1').all();
  let ok = 0;
  let warn = 0;
  for (const ficha of fichas) {
    // eslint-disable-next-line no-await-in-loop
    const result = await syncAttendance(ficha.ficha_code, res.locals.event.event_date);
    if (result.ok && result.hasSessions) ok += 1;
    else warn += 1;
  }
  setFlash(req, warn ? 'warn' : 'done', `Sincronización completa: ${ok} ficha(s) con asistencia, ${warn} con avisos.`);
  res.redirect('/admin/fichas');
});

// ---------- Proyectos ----------

router.get('/proyectos', (req, res) => {
  const db = getDb();
  const projects = db.prepare('SELECT * FROM projects ORDER BY is_active DESC, stand_number').all();
  res.render('admin/projects', { title: 'Proyectos', projects });
});

router.get('/proyectos/nuevo', (req, res) => {
  res.render('admin/project-form', { title: 'Nuevo proyecto', project: null, formError: null });
});

router.post('/proyectos', (req, res) => {
  const db = getDb();
  const data = readProjectForm(req.body);
  if (data.error) {
    return res.render('admin/project-form', { title: 'Nuevo proyecto', project: req.body, formError: data.error });
  }
  try {
    db.prepare(
      `INSERT INTO projects (stand_number, name, ficha_code, program_name, team_members, summary)
       VALUES (@stand_number, @name, @ficha_code, @program_name, @team_members, @summary)`
    ).run(data.values);
    setFlash(req, 'done', `Proyecto "${data.values.name}" creado.`);
    res.redirect('/admin/proyectos');
  } catch (err) {
    const msg = String(err.message).includes('UNIQUE') ? 'Ya existe un proyecto con ese número de stand.' : 'No se pudo guardar el proyecto.';
    res.render('admin/project-form', { title: 'Nuevo proyecto', project: req.body, formError: msg });
  }
});

router.get('/proyectos/:id/editar', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.redirect('/admin/proyectos');
  res.render('admin/project-form', { title: 'Editar proyecto', project, formError: null });
});

router.post('/proyectos/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.redirect('/admin/proyectos');

  const data = readProjectForm(req.body);
  if (data.error) {
    return res.render('admin/project-form', {
      title: 'Editar proyecto',
      project: { ...existing, ...req.body },
      formError: data.error,
    });
  }
  try {
    db.prepare(
      `UPDATE projects SET stand_number=@stand_number, name=@name, ficha_code=@ficha_code,
       program_name=@program_name, team_members=@team_members, summary=@summary WHERE id=@id`
    ).run({ ...data.values, id: req.params.id });
    setFlash(req, 'done', `Proyecto "${data.values.name}" actualizado.`);
    res.redirect('/admin/proyectos');
  } catch (err) {
    const msg = String(err.message).includes('UNIQUE') ? 'Ya existe un proyecto con ese número de stand.' : 'No se pudo guardar el proyecto.';
    res.render('admin/project-form', { title: 'Editar proyecto', project: { ...existing, ...req.body }, formError: msg });
  }
});

router.post('/proyectos/:id/estado', (req, res) => {
  const db = getDb();
  const active = req.body.active === '1' ? 1 : 0;
  db.prepare('UPDATE projects SET is_active = ? WHERE id = ?').run(active, req.params.id);
  setFlash(req, 'done', active ? 'Proyecto activado.' : 'Proyecto desactivado.');
  res.redirect('/admin/proyectos');
});

function readProjectForm(body) {
  const stand_number = Number(body.stand_number);
  const name = String(body.name || '').trim();
  const ficha_code = String(body.ficha_code || '').trim();
  const program_name = String(body.program_name || '').trim() || null;
  const team_members = String(body.team_members || '').trim() || null;
  const summary = String(body.summary || '').trim() || null;

  if (!Number.isInteger(stand_number) || stand_number < 1) return { error: 'El número de stand debe ser un entero positivo.' };
  if (!name) return { error: 'Escribe el nombre del proyecto.' };
  if (!ficha_code) return { error: 'Escribe la ficha expositora.' };

  return { values: { stand_number, name, ficha_code, program_name, team_members, summary } };
}

// ---------- Jurados ----------

function listJudges(db) {
  return db.prepare('SELECT id, name, is_active, created_at FROM judges ORDER BY is_active DESC, name').all();
}

router.get('/jurados', (req, res) => {
  const db = getDb();
  res.render('admin/judges', { title: 'Jurados', judges: listJudges(db), newPin: null });
});

// Renderiza la respuesta directamente en vez de hacer redirect: /admin usa
// Basic Auth y no sesión (ver lib/auth.js#basicAuthAdmin), así que un flash
// guardado en req.session.flash puede perderse si la cookie de sesión no
// vuelve al servidor en el siguiente GET. El PIN solo se muestra una vez,
// así que no podemos arriesgarnos a perderlo en ese round-trip.
router.post('/jurados', (req, res) => {
  const db = getDb();
  const name = String(req.body.name || '').trim();
  if (!name) {
    return res.render('admin/judges', {
      title: 'Jurados',
      judges: listJudges(db),
      newPin: null,
      formError: 'Escribe el nombre del jurado.',
    });
  }
  const pin = String(Math.floor(1000 + Math.random() * 9000));
  db.prepare('INSERT INTO judges (name, pin_hash) VALUES (?, ?)').run(name, hashPin(pin));
  res.render('admin/judges', { title: 'Jurados', judges: listJudges(db), newPin: { name, pin } });
});

router.post('/jurados/:id/regenerar-pin', (req, res) => {
  const db = getDb();
  const judge = db.prepare('SELECT * FROM judges WHERE id = ?').get(req.params.id);
  if (!judge) return res.render('admin/judges', { title: 'Jurados', judges: listJudges(db), newPin: null });
  const pin = String(Math.floor(1000 + Math.random() * 9000));
  db.prepare('UPDATE judges SET pin_hash = ? WHERE id = ?').run(hashPin(pin), judge.id);
  res.render('admin/judges', {
    title: 'Jurados',
    judges: listJudges(db),
    newPin: { name: judge.name, pin },
  });
});

router.post('/jurados/:id/estado', (req, res) => {
  const db = getDb();
  const active = req.body.active === '1' ? 1 : 0;
  db.prepare('UPDATE judges SET is_active = ? WHERE id = ?').run(active, req.params.id);
  setFlash(req, 'done', active ? 'Jurado activado.' : 'Jurado desactivado.');
  res.redirect('/admin/jurados');
});

// ---------- Resultados ----------

router.get('/resultados', (req, res) => {
  const apprentice = apprenticeResults();
  const { results: jury, judges } = juryResults();
  res.render('admin/results', { title: 'Resultados', apprentice, jury, judges });
});

router.get('/resultados.csv', (req, res) => {
  const apprentice = apprenticeResults();
  const { results: jury } = juryResults();

  const lines = [];
  lines.push('=== Voto de aprendices ===');
  lines.push(['stand', 'proyecto', 'ficha', 'promedio', 'votos'].join(','));
  for (const r of apprentice) {
    lines.push([r.project.stand_number, csvSafe(r.project.name), r.project.ficha_code, r.average ?? '', r.voteCount].join(','));
  }
  lines.push('');
  lines.push('=== Nota de jurados ===');
  lines.push(['stand', 'proyecto', 'ficha', 'nota_final', 'nivel', 'jurados_enviados', 'jurados_total'].join(','));
  for (const r of jury) {
    lines.push([r.project.stand_number, csvSafe(r.project.name), r.project.ficha_code, r.finalAverage ?? '', r.level ?? '', r.judgesSubmitted, r.judgesTotal].join(','));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="resultados-showroom.csv"');
  res.send('﻿' + lines.join('\n'));
});

function csvSafe(value) {
  const s = String(value || '');
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}

module.exports = router;
