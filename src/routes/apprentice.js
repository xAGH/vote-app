'use strict';

const express = require('express');
const router = express.Router();

const { getDb } = require('../db');
const { verifyAttendance } = require('../lib/pulse');
const { csrfMiddleware, ensureCsrfToken, requireVoter, signVoterToken } = require('../lib/auth');
const { makeFlashParam } = require('../lib/flash');
const { APPRENTICE_RUBRIC } = require('../lib/rubric');

router.use(csrfMiddleware);

const ATTENDANCE_MESSAGES = {
  NOT_SYNCED: 'Todavía no hemos sincronizado la asistencia de tu ficha. Avísale al organizador del evento.',
  NO_SESSION: 'Tu instructor aún no ha registrado la asistencia de hoy. Avísale al organizador del evento.',
  NOT_FOUND: 'No encontramos tu número de documento en el registro de asistencia de esa ficha.',
  ABSENT: 'Según el registro de asistencia de hoy no estuviste presente en tu ficha.',
};

// ---------- Ingreso ----------

router.get('/aprendiz', (req, res) => {
  if (req.session.voter) {
    const tok = signVoterToken(req.session.voter.id);
    return res.redirect(`/proyectos?_v=${tok}`);
  }
  const db = getDb();
  const fichas = db
    .prepare('SELECT ficha_code, label FROM visiting_fichas WHERE is_active = 1 ORDER BY label')
    .all();
  res.render('apprentice/enter', {
    title: 'Ingreso de aprendiz',
    fichas,
    csrfToken: ensureCsrfToken(req),
    formError: null,
    formValues: { ficha_code: '', doc_number: '' },
  });
});

router.post('/aprendiz/ingresar', (req, res) => {
  const db = getDb();
  const fichas = db
    .prepare('SELECT ficha_code, label FROM visiting_fichas WHERE is_active = 1 ORDER BY label')
    .all();

  const render = (formError) =>
    res.render('apprentice/enter', {
      title: 'Ingreso de aprendiz',
      fichas,
      csrfToken: ensureCsrfToken(req),
      formError,
      formValues: {
        ficha_code: String(req.body.ficha_code || ''),
        doc_number: String(req.body.doc_number || ''),
      },
    });

  if (!res.locals.event.apprentice_voting_open) {
    return render('La votación de aprendices todavía no está abierta. Espera el anuncio del organizador.');
  }

  const fichaCode = String(req.body.ficha_code || '').trim();
  const docNumber = String(req.body.doc_number || '').trim();

  const ficha = fichas.find((f) => f.ficha_code === fichaCode);
  if (!ficha) return render('Selecciona tu ficha de la lista.');
  if (!docNumber) return render('Escribe tu número de documento.');
  if (!/^[0-9]{4,15}$/.test(docNumber)) return render('El número de documento no parece válido.');

  const result = verifyAttendance(fichaCode, res.locals.event.event_date, docNumber);
  if (!result.ok) {
    return render(ATTENDANCE_MESSAGES[result.reason] || 'No pudimos verificar tu asistencia.');
  }

  db.prepare(
    `INSERT INTO voters (ficha_code, doc_number, full_name)
     VALUES (?, ?, ?)
     ON CONFLICT(ficha_code, doc_number) DO UPDATE SET full_name = excluded.full_name`
  ).run(fichaCode, docNumber, result.fullName);

  const voterRow = db
    .prepare('SELECT id, full_name, ficha_code FROM voters WHERE ficha_code = ? AND doc_number = ?')
    .get(fichaCode, docNumber);

  req.session.voter = { id: voterRow.id, fullName: voterRow.full_name, fichaCode: voterRow.ficha_code };
  const tok = signVoterToken(voterRow.id);
  res.redirect(`/proyectos?_v=${tok}`);
});

router.get('/aprendiz/salir', (req, res) => {
  delete req.session.voter;
  res.redirect('/');
});

// ---------- Directorio de stands ----------

router.get('/proyectos', requireVoter, (req, res) => {
  const db = getDb();
  const voter = req.session.voter;
  const tok = res.locals.voterToken;

  const projects = db
    .prepare('SELECT * FROM projects WHERE is_active = 1 AND ficha_code != ? ORDER BY stand_number')
    .all(voter.fichaCode);

  const votedIds = new Set(
    db.prepare('SELECT project_id FROM apprentice_votes WHERE voter_id = ?').all(voter.id).map((r) => r.project_id)
  );

  const total = projects.length;
  const votedCount = projects.filter((p) => votedIds.has(p.id)).length;

  res.render('apprentice/gallery', {
    title: 'Directorio de stands',
    projects,
    votedIds,
    voterToken: tok,
    total,
    votedCount,
    votingOpen: !!res.locals.event.apprentice_voting_open,
  });
});

// ---------- Votación de un stand ----------

router.get('/proyectos/:id', requireVoter, (req, res) => {
  const db = getDb();
  const voter = req.session.voter;
  const tok = res.locals.voterToken;
  const project = db
    .prepare('SELECT * FROM projects WHERE id = ? AND is_active = 1')
    .get(req.params.id);

  if (!project) {
    return res.status(404).render('error', {
      title: 'Stand no encontrado',
      message: 'Ese proyecto no existe o ya no está activo.',
      backHref: `/proyectos?_v=${tok}`,
    });
  }

  if (project.ficha_code === voter.fichaCode) {
    return res.redirect(`/proyectos?_v=${tok}&${makeFlashParam('warn', 'No puedes votar el stand de tu propia ficha.')}`);
  }

  const existingVote = db
    .prepare('SELECT * FROM apprentice_votes WHERE voter_id = ? AND project_id = ?')
    .get(voter.id, project.id);

  res.render('apprentice/project', {
    title: project.name,
    project,
    rubric: APPRENTICE_RUBRIC,
    existingVote: existingVote || null,
    voterToken: tok,
    csrfToken: ensureCsrfToken(req),
    votingOpen: !!res.locals.event.apprentice_voting_open,
  });
});

router.post('/proyectos/:id/voto', requireVoter, (req, res) => {
  const db = getDb();
  const voter = req.session.voter;
  const tok = res.locals.voterToken;
  const project = db
    .prepare('SELECT * FROM projects WHERE id = ? AND is_active = 1')
    .get(req.params.id);

  if (!project) {
    return res.status(404).render('error', {
      title: 'Stand no encontrado',
      message: 'Ese proyecto no existe o ya no está activo.',
      backHref: `/proyectos?_v=${tok}`,
    });
  }
  if (project.ficha_code === voter.fichaCode) {
    return res.redirect(`/proyectos?_v=${tok}&${makeFlashParam('warn', 'No puedes votar el stand de tu propia ficha.')}`);
  }
  if (!res.locals.event.apprentice_voting_open) {
    return res.redirect(`/proyectos?_v=${tok}&${makeFlashParam('warn', 'La votación de aprendices ya no está abierta.')}`);
  }

  const scores = {};
  for (const criterion of APPRENTICE_RUBRIC) {
    const raw = Number(req.body[criterion.key]);
    if (!Number.isInteger(raw) || raw < 1 || raw > 5) {
      return res.render('apprentice/project', {
        title: project.name,
        project,
        rubric: APPRENTICE_RUBRIC,
        existingVote: null,
        voterToken: tok,
        csrfToken: ensureCsrfToken(req),
        votingOpen: true,
        formError: 'Califica los 4 criterios antes de enviar.',
      });
    }
    scores[criterion.key] = raw;
  }

  let flashParam;
  try {
    db.prepare(
      `INSERT INTO apprentice_votes (voter_id, project_id, score_stand, score_clarity, score_innovation, score_mastery)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(voter.id, project.id, scores.score_stand, scores.score_clarity, scores.score_innovation, scores.score_mastery);
    flashParam = makeFlashParam('done', `Voto registrado para ${project.name}. ¡Gracias!`);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      flashParam = makeFlashParam('warn', `Ya habías votado por ${project.name}.`);
    } else {
      throw err;
    }
  }

  res.redirect(`/proyectos?_v=${tok}&${flashParam}`);
});

module.exports = router;
