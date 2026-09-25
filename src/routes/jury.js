'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const { getDb } = require('../db');
const { verifyPin, csrfMiddleware, ensureCsrfToken, requireJudge, signJudgeToken } = require('../lib/auth');
const { setFlash } = require('../lib/flash');
const { JURY_RUBRIC, JURY_CRITERIA_KEYS, JURY_CRITERIA_COUNT } = require('../lib/rubric');
const { round1 } = require('../lib/scoring');

router.use(csrfMiddleware);

const enterLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
});

// ---------- Ingreso ----------

router.get('/jurado', (req, res) => {
  if (req.session.judge) {
    const tok = signJudgeToken(req.session.judge.id);
    return res.redirect(`/jurado/proyectos?_j=${tok}`);
  }
  const db = getDb();
  const judges = db.prepare('SELECT id, name FROM judges WHERE is_active = 1 ORDER BY name').all();
  res.render('jury/enter', {
    title: 'Ingreso de jurado',
    judges,
    csrfToken: ensureCsrfToken(req),
    formError: null,
  });
});

router.post('/jurado/ingresar', enterLimiter, (req, res) => {
  const db = getDb();
  const judges = db.prepare('SELECT id, name FROM judges WHERE is_active = 1 ORDER BY name').all();
  const render = (formError) =>
    res.render('jury/enter', { title: 'Ingreso de jurado', judges, csrfToken: ensureCsrfToken(req), formError });

  const judgeId = Number(req.body.judge_id);
  const pin = String(req.body.pin || '').trim();
  const judgeRow = db.prepare('SELECT * FROM judges WHERE id = ? AND is_active = 1').get(judgeId);

  if (!judgeRow) return render('Selecciona tu nombre de la lista.');
  if (!pin) return render('Escribe tu PIN.');
  if (!verifyPin(pin, judgeRow.pin_hash)) return render('El PIN no es correcto.');

  req.session.judge = { id: judgeRow.id, name: judgeRow.name };
  const tok = signJudgeToken(judgeRow.id);
  res.redirect(`/jurado/proyectos?_j=${tok}`);
});

router.get('/jurado/salir', (req, res) => {
  delete req.session.judge;
  res.redirect('/');
});

// ---------- Directorio de evaluación ----------

router.get('/jurado/proyectos', requireJudge, (req, res) => {
  const db = getDb();
  const judgeId = req.session.judge.id;
  const tok = res.locals.judgeToken;
  const projects = db.prepare('SELECT * FROM projects WHERE is_active = 1 ORDER BY stand_number').all();

  const evaluations = db
    .prepare('SELECT * FROM jury_evaluations WHERE judge_id = ?')
    .all(judgeId);
  const evalByProject = new Map(evaluations.map((e) => [e.project_id, e]));

  const scoreCounts = db
    .prepare(
      `SELECT e.project_id, COUNT(*) AS n
       FROM jury_scores s JOIN jury_evaluations e ON e.id = s.evaluation_id
       WHERE e.judge_id = ?
       GROUP BY e.project_id`
    )
    .all(judgeId);
  const countByProject = new Map(scoreCounts.map((r) => [r.project_id, r.n]));

  const rows = projects.map((p) => {
    const ev = evalByProject.get(p.id);
    const answered = countByProject.get(p.id) || 0;
    let status = 'not_started';
    if (ev && ev.submitted_at) status = 'submitted';
    else if (answered > 0) status = 'draft';
    return { project: p, status, answered, total: JURY_CRITERIA_COUNT };
  });

  res.render('jury/gallery', {
    title: 'Estación de evaluación',
    rows,
    judgeToken: tok,
    submittedCount: rows.filter((r) => r.status === 'submitted').length,
    total: rows.length,
    votingOpen: !!res.locals.event.jury_voting_open,
  });
});

// ---------- Evaluación de un proyecto ----------

function loadEvaluation(db, judgeId, projectId) {
  let evaluation = db
    .prepare('SELECT * FROM jury_evaluations WHERE judge_id = ? AND project_id = ?')
    .get(judgeId, projectId);
  if (!evaluation) {
    const info = db
      .prepare('INSERT INTO jury_evaluations (judge_id, project_id) VALUES (?, ?)')
      .run(judgeId, projectId);
    evaluation = db.prepare('SELECT * FROM jury_evaluations WHERE id = ?').get(info.lastInsertRowid);
  }
  return evaluation;
}

router.get('/jurado/proyectos/:id', requireJudge, (req, res) => {
  const db = getDb();
  const judgeId = req.session.judge.id;
  const tok = res.locals.judgeToken;
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND is_active = 1').get(req.params.id);

  if (!project) {
    return res.status(404).render('error', {
      title: 'Proyecto no encontrado',
      message: 'Ese proyecto no existe o ya no está activo.',
      backHref: `/jurado/proyectos?_j=${tok}`,
    });
  }

  const evaluation = loadEvaluation(db, judgeId, project.id);
  const scoreRows = db
    .prepare('SELECT criterion_key, score FROM jury_scores WHERE evaluation_id = ?')
    .all(evaluation.id);
  const scores = Object.fromEntries(scoreRows.map((r) => [r.criterion_key, r.score]));

  res.render('jury/evaluate', {
    title: project.name,
    project,
    evaluation,
    rubric: JURY_RUBRIC,
    scores,
    judgeToken: tok,
    csrfToken: ensureCsrfToken(req),
    formError: null,
    votingOpen: !!res.locals.event.jury_voting_open,
  });
});

// Autoguardado por criterio (AJAX, JSON).
router.post('/jurado/proyectos/:id/criterio', requireJudge, (req, res) => {
  const db = getDb();
  const judgeId = req.session.judge.id;
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!project) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });

  const { criterion, score } = req.body || {};
  if (!JURY_CRITERIA_KEYS.includes(criterion)) {
    return res.status(400).json({ success: false, message: 'Criterio inválido' });
  }
  const scoreNum = Number(score);
  if (!Number.isInteger(scoreNum) || scoreNum < 1 || scoreNum > 5) {
    return res.status(400).json({ success: false, message: 'Puntaje inválido' });
  }

  const evaluation = loadEvaluation(db, judgeId, project.id);
  if (evaluation.submitted_at) {
    return res.status(409).json({ success: false, message: 'Esta evaluación ya fue enviada' });
  }

  db.prepare(
    `INSERT INTO jury_scores (evaluation_id, criterion_key, score) VALUES (?, ?, ?)
     ON CONFLICT(evaluation_id, criterion_key) DO UPDATE SET score = excluded.score`
  ).run(evaluation.id, criterion, scoreNum);

  res.json({ success: true });
});

router.post('/jurado/proyectos/:id/enviar', requireJudge, (req, res) => {
  const db = getDb();
  const judgeId = req.session.judge.id;
  const tok = res.locals.judgeToken;
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND is_active = 1').get(req.params.id);

  if (!project) {
    return res.status(404).render('error', {
      title: 'Proyecto no encontrado',
      message: 'Ese proyecto no existe o ya no está activo.',
      backHref: `/jurado/proyectos?_j=${tok}`,
    });
  }
  if (!res.locals.event.jury_voting_open) {
    setFlash(req, 'warn', 'La calificación de jurados ya no está abierta.');
    return res.redirect(`/jurado/proyectos?_j=${tok}`);
  }

  const evaluation = loadEvaluation(db, judgeId, project.id);
  if (evaluation.submitted_at) {
    setFlash(req, 'warn', `Ya habías enviado tu evaluación de ${project.name}.`);
    return res.redirect(`/jurado/proyectos?_j=${tok}`);
  }

  const upsert = db.prepare(
    `INSERT INTO jury_scores (evaluation_id, criterion_key, score) VALUES (?, ?, ?)
     ON CONFLICT(evaluation_id, criterion_key) DO UPDATE SET score = excluded.score`
  );
  const tx = db.transaction(() => {
    for (const key of JURY_CRITERIA_KEYS) {
      const raw = Number(req.body[key]);
      if (Number.isInteger(raw) && raw >= 1 && raw <= 5) {
        upsert.run(evaluation.id, key, raw);
      }
    }
    db.prepare('UPDATE jury_evaluations SET observations = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
      String(req.body.observations || '').trim() || null,
      evaluation.id
    );
  });
  tx();

  const scoreRows = db
    .prepare('SELECT criterion_key FROM jury_scores WHERE evaluation_id = ?')
    .all(evaluation.id);
  const answeredKeys = new Set(scoreRows.map((r) => r.criterion_key));
  const missing = JURY_CRITERIA_KEYS.filter((k) => !answeredKeys.has(k));

  if (missing.length) {
    const scores = Object.fromEntries(
      db.prepare('SELECT criterion_key, score FROM jury_scores WHERE evaluation_id = ?').all(evaluation.id).map((r) => [r.criterion_key, r.score])
    );
    return res.render('jury/evaluate', {
      title: project.name,
      project,
      evaluation,
      rubric: JURY_RUBRIC,
      scores,
      judgeToken: tok,
      csrfToken: ensureCsrfToken(req),
      votingOpen: true,
      formError: `Faltan ${missing.length} criterios por calificar antes de enviar.`,
    });
  }

  db.prepare('UPDATE jury_evaluations SET submitted_at = datetime(\'now\') WHERE id = ?').run(evaluation.id);
  setFlash(req, 'done', `Evaluación enviada para ${project.name}.`);
  res.redirect(`/jurado/proyectos?_j=${tok}`);
});

router.post('/jurado/proyectos/:id/editar', requireJudge, (req, res) => {
  const db = getDb();
  const judgeId = req.session.judge.id;
  const tok = res.locals.judgeToken;
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND is_active = 1').get(req.params.id);

  if (!project) {
    return res.status(404).render('error', {
      title: 'Proyecto no encontrado',
      message: 'Ese proyecto no existe o ya no está activo.',
      backHref: `/jurado/proyectos?_j=${tok}`,
    });
  }
  if (!res.locals.event.jury_voting_open) {
    setFlash(req, 'warn', 'La calificación de jurados ya no está abierta, no puedes editarla.');
    return res.redirect(`/jurado/proyectos?_j=${tok}`);
  }

  const evaluation = db
    .prepare('SELECT * FROM jury_evaluations WHERE judge_id = ? AND project_id = ?')
    .get(judgeId, project.id);
  if (evaluation && evaluation.submitted_at) {
    db.prepare('UPDATE jury_evaluations SET submitted_at = NULL WHERE id = ?').run(evaluation.id);
    setFlash(req, 'done', `Evaluación de ${project.name} habilitada para edición.`);
  }
  res.redirect(`/jurado/proyectos/${project.id}?_j=${tok}`);
});

module.exports = router;
