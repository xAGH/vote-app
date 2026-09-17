'use strict';

const { getDb } = require('../db');
const { JURY_CRITERIA_KEYS, JURY_CRITERIA_COUNT, juryLevel } = require('./rubric');

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Resultados del voto de aprendices por proyecto: promedio de los 4
 * criterios, cantidad de votos y desglose por criterio.
 * Orden: promedio desc, desempate por cantidad de votos desc.
 */
function apprenticeResults() {
  const db = getDb();
  const projects = db
    .prepare('SELECT id, stand_number, name, ficha_code, program_name FROM projects WHERE is_active = 1')
    .all();

  const rows = db
    .prepare(
      `SELECT project_id,
              COUNT(*) AS vote_count,
              AVG(score_stand) AS avg_stand,
              AVG(score_clarity) AS avg_clarity,
              AVG(score_innovation) AS avg_innovation,
              AVG(score_mastery) AS avg_mastery
       FROM apprentice_votes
       GROUP BY project_id`
    )
    .all();
  const byProject = new Map(rows.map((r) => [r.project_id, r]));

  const results = projects.map((p) => {
    const r = byProject.get(p.id);
    const voteCount = r ? r.vote_count : 0;
    const overall = r
      ? (r.avg_stand + r.avg_clarity + r.avg_innovation + r.avg_mastery) / 4
      : null;
    return {
      project: p,
      voteCount,
      average: overall == null ? null : round1(overall),
      breakdown: r
        ? {
            stand: round1(r.avg_stand),
            clarity: round1(r.avg_clarity),
            innovation: round1(r.avg_innovation),
            mastery: round1(r.avg_mastery),
          }
        : null,
    };
  });

  results.sort((a, b) => {
    if (a.average == null && b.average == null) return 0;
    if (a.average == null) return 1;
    if (b.average == null) return -1;
    if (b.average !== a.average) return b.average - a.average;
    return b.voteCount - a.voteCount;
  });

  return results;
}

/**
 * Nota de jurados por proyecto: promedio de los 19 criterios por cada
 * jurado que envió su evaluación, y luego promedio entre esos jurados.
 */
function juryResults() {
  const db = getDb();
  const projects = db
    .prepare('SELECT id, stand_number, name, ficha_code, program_name FROM projects WHERE is_active = 1')
    .all();
  const judges = db.prepare('SELECT id, name FROM judges WHERE is_active = 1 ORDER BY name').all();

  const evaluations = db
    .prepare(
      `SELECT e.id, e.judge_id, e.project_id, e.observations, e.submitted_at,
              j.name AS judge_name
       FROM jury_evaluations e
       JOIN judges j ON j.id = e.judge_id
       WHERE e.submitted_at IS NOT NULL`
    )
    .all();

  const scoreRows = db
    .prepare(
      `SELECT s.evaluation_id, s.criterion_key, s.score
       FROM jury_scores s
       JOIN jury_evaluations e ON e.id = s.evaluation_id
       WHERE e.submitted_at IS NOT NULL`
    )
    .all();

  const scoresByEval = new Map();
  for (const row of scoreRows) {
    if (!scoresByEval.has(row.evaluation_id)) scoresByEval.set(row.evaluation_id, new Map());
    scoresByEval.get(row.evaluation_id).set(row.criterion_key, row.score);
  }

  const evalsByProject = new Map();
  for (const ev of evaluations) {
    if (!evalsByProject.has(ev.project_id)) evalsByProject.set(ev.project_id, []);
    evalsByProject.get(ev.project_id).push(ev);
  }

  const results = projects.map((p) => {
    const evs = evalsByProject.get(p.id) || [];
    const judgeAverages = evs.map((ev) => {
      const scores = scoresByEval.get(ev.id) || new Map();
      const values = JURY_CRITERIA_KEYS.map((k) => scores.get(k)).filter((v) => typeof v === 'number');
      const complete = values.length === JURY_CRITERIA_COUNT;
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      return {
        judgeId: ev.judge_id,
        judgeName: ev.judge_name,
        observations: ev.observations,
        submittedAt: ev.submitted_at,
        average: avg == null ? null : round1(avg),
        complete,
      };
    });

    const validAverages = judgeAverages.filter((j) => j.average != null).map((j) => j.average);
    const finalAverage = validAverages.length
      ? round1(validAverages.reduce((a, b) => a + b, 0) / validAverages.length)
      : null;

    return {
      project: p,
      judgeAverages,
      judgesSubmitted: judgeAverages.length,
      judgesTotal: judges.length,
      finalAverage,
      level: juryLevel(finalAverage),
    };
  });

  results.sort((a, b) => {
    if (a.finalAverage == null && b.finalAverage == null) return 0;
    if (a.finalAverage == null) return 1;
    if (b.finalAverage == null) return -1;
    return b.finalAverage - a.finalAverage;
  });

  return { results, judges };
}

module.exports = { apprenticeResults, juryResults, round1 };
