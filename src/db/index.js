'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'showroom.db');

let db = null;

/**
 * Abre (o crea) la base de datos, activa WAL y aplica el esquema.
 * Idempotente: CREATE TABLE/INDEX usan IF NOT EXISTS, así que llamar
 * init() varias veces es seguro.
 */
function init() {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  // Migración: agregar LATE al CHECK de attendance_roster si la BD fue creada
  // con el constraint antiguo (solo PRESENT/ABSENT).
  const rosterDef = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='attendance_roster'")
    .get();
  if (rosterDef && !rosterDef.sql.includes('LATE')) {
    db.exec(`
      CREATE TABLE attendance_roster_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        ficha_code  TEXT NOT NULL,
        date        TEXT NOT NULL,
        doc_number  TEXT NOT NULL,
        full_name   TEXT NOT NULL,
        status      TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE')),
        fetched_at  TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (ficha_code, date, doc_number)
      );
      INSERT INTO attendance_roster_new SELECT * FROM attendance_roster;
      DROP TABLE attendance_roster;
      ALTER TABLE attendance_roster_new RENAME TO attendance_roster;
      CREATE INDEX IF NOT EXISTS idx_attendance_roster_lookup
        ON attendance_roster(ficha_code, date, doc_number);
    `);
  }

  // Garantiza que exista la fila única de configuración del evento.
  const eventRow = db.prepare('SELECT id FROM event WHERE id = 1').get();
  if (!eventRow) {
    db.prepare(
      `INSERT INTO event (id, name, event_date, apprentice_voting_open, jury_voting_open)
       VALUES (1, ?, ?, 0, 0)`
    ).run(
      process.env.EVENT_NAME || 'ShowRoom Proyectos Formativos ADSO',
      process.env.EVENT_DATE || new Date().toISOString().slice(0, 10)
    );
  }

  return db;
}

function getDb() {
  if (!db) return init();
  return db;
}

module.exports = { init, getDb };
