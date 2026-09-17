'use strict';

const { getDb } = require('../db');

const PULSE_API_URL = process.env.PULSE_API_URL || '';
const PULSE_API_KEY = process.env.PULSE_API_KEY || '';
const PULSE_MOCK = String(process.env.PULSE_MOCK || 'false').toLowerCase() === 'true';
const FETCH_TIMEOUT_MS = 8000;

/**
 * Roster de ejemplo para desarrollo sin Pulse levantado (PULSE_MOCK=true).
 * Cualquier ficha_code devuelve el mismo roster de demo.
 */
function mockRoster(fichaCode, date) {
  return {
    ficha: { id: 'demo', code: fichaCode, programName: 'Programa de demostración' },
    date,
    hasSessions: true,
    sessions: [{ id: 'demo-session', instructorId: 'demo', totalBlockHours: 4 }],
    roster: [
      { docType: 'CC', docNumber: '1000000001', fullName: 'Ana Torres (demo)', status: 'PRESENT', absentHours: 0, justification: null },
      { docType: 'CC', docNumber: '1000000002', fullName: 'Luis Ramírez (demo)', status: 'PRESENT', absentHours: 0, justification: null },
      { docType: 'CC', docNumber: '1000000003', fullName: 'Camila Ríos (demo)', status: 'ABSENT', absentHours: 4, justification: null },
      { docType: 'CC', docNumber: '1000000004', fullName: 'Jorge Pérez (demo)', status: 'PRESENT', absentHours: 0, justification: null },
    ],
    summary: { total: 4, present: 3, absent: 1 },
  };
}

class PulseError extends Error {
  constructor(message, { code = 'PULSE_ERROR', statusCode = 502 } = {}) {
    super(message);
    this.name = 'PulseError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Consulta en vivo el endpoint M2M de Pulse:
 * GET /integrations/attendance?ficha=<code>&date=<YYYY-MM-DD>
 * Ver ~/code/pulse/docs/09-m2m-integrations.md — la respuesta viene envuelta
 * en {success, statusCode, data, ...}; los errores en {success:false, code, message}.
 */
async function fetchAttendanceLive(fichaCode, date) {
  if (PULSE_MOCK) return mockRoster(fichaCode, date);

  if (!PULSE_API_URL || !PULSE_API_KEY) {
    throw new PulseError('Pulse no está configurado (falta PULSE_API_URL o PULSE_API_KEY)', {
      code: 'NOT_CONFIGURED',
      statusCode: 500,
    });
  }

  const url = new URL('/integrations/attendance', PULSE_API_URL);
  url.searchParams.set('ficha', fichaCode);
  url.searchParams.set('date', date);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      headers: { 'x-api-key': PULSE_API_KEY },
      signal: controller.signal,
    });
  } catch (err) {
    throw new PulseError(`No se pudo contactar a Pulse: ${err.message}`, {
      code: 'NETWORK_ERROR',
      statusCode: 502,
    });
  } finally {
    clearTimeout(timeout);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new PulseError('Pulse respondió con un formato inesperado', {
      code: 'BAD_RESPONSE',
      statusCode: 502,
    });
  }

  if (!response.ok || body.success === false) {
    throw new PulseError(body.message || `Pulse respondió ${response.status}`, {
      code: body.code || 'PULSE_HTTP_ERROR',
      statusCode: response.status,
    });
  }

  return body.data;
}

/**
 * Sincroniza la asistencia de una ficha/fecha desde Pulse hacia la caché
 * local (attendance_roster + attendance_sync). Se puede reintentar cuantas
 * veces haga falta antes de abrir la votación.
 */
async function syncAttendance(fichaCode, date) {
  const db = getDb();
  try {
    const data = await fetchAttendanceLive(fichaCode, date);

    const del = db.prepare('DELETE FROM attendance_roster WHERE ficha_code = ? AND date = ?');
    const ins = db.prepare(
      `INSERT INTO attendance_roster (ficha_code, date, doc_number, full_name, status)
       VALUES (?, ?, ?, ?, ?)`
    );
    const tx = db.transaction((roster) => {
      del.run(fichaCode, date);
      for (const r of roster) {
        ins.run(fichaCode, date, r.docNumber, r.fullName, r.status);
      }
    });
    tx(data.roster || []);

    db.prepare(
      `INSERT INTO attendance_sync (ficha_code, date, has_sessions, roster_count, error)
       VALUES (?, ?, ?, ?, NULL)
       ON CONFLICT(ficha_code, date) DO UPDATE SET
         has_sessions = excluded.has_sessions,
         roster_count = excluded.roster_count,
         synced_at = datetime('now'),
         error = NULL`
    ).run(fichaCode, date, data.hasSessions ? 1 : 0, (data.roster || []).length);

    return {
      ok: true,
      hasSessions: !!data.hasSessions,
      rosterCount: (data.roster || []).length,
      summary: data.summary,
    };
  } catch (err) {
    const message = err instanceof PulseError ? err.message : String(err.message || err);
    db.prepare(
      `INSERT INTO attendance_sync (ficha_code, date, has_sessions, roster_count, error)
       VALUES (?, ?, 0, 0, ?)
       ON CONFLICT(ficha_code, date) DO UPDATE SET
         synced_at = datetime('now'),
         error = excluded.error`
    ).run(fichaCode, date, message);
    return { ok: false, error: message };
  }
}

/** Estado de sincronización guardado para una ficha/fecha. */
function getSyncStatus(fichaCode, date) {
  const db = getDb();
  return db
    .prepare('SELECT * FROM attendance_sync WHERE ficha_code = ? AND date = ?')
    .get(fichaCode, date);
}

/**
 * Verifica un documento contra la caché local de asistencia.
 * Devuelve { ok: true, fullName } o { ok: false, reason }.
 * reason: 'NOT_SYNCED' | 'NO_SESSION' | 'NOT_FOUND' | 'ABSENT'
 */
function verifyAttendance(fichaCode, date, docNumber) {
  const db = getDb();
  const sync = getSyncStatus(fichaCode, date);

  if (!sync || sync.error) {
    return { ok: false, reason: 'NOT_SYNCED' };
  }
  if (!sync.has_sessions) {
    return { ok: false, reason: 'NO_SESSION' };
  }

  const row = db
    .prepare(
      'SELECT full_name, status FROM attendance_roster WHERE ficha_code = ? AND date = ? AND doc_number = ?'
    )
    .get(fichaCode, date, docNumber.trim());

  if (!row) return { ok: false, reason: 'NOT_FOUND' };
  if (row.status !== 'PRESENT') return { ok: false, reason: 'ABSENT' };

  return { ok: true, fullName: row.full_name };
}

module.exports = { syncAttendance, getSyncStatus, verifyAttendance, PulseError };
