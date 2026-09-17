-- ShowRoom Vote — esquema SQLite
-- La unicidad de votos se hace cumplir aquí (UNIQUE), no solo en las rutas.

PRAGMA foreign_keys = ON;

-- Fila única con la configuración del evento en curso.
CREATE TABLE IF NOT EXISTS event (
  id                      INTEGER PRIMARY KEY CHECK (id = 1),
  name                    TEXT NOT NULL DEFAULT 'ShowRoom Proyectos Formativos',
  event_date              TEXT NOT NULL,               -- YYYY-MM-DD
  apprentice_voting_open  INTEGER NOT NULL DEFAULT 0,   -- 0/1
  jury_voting_open        INTEGER NOT NULL DEFAULT 0,   -- 0/1
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Stands / equipos expositores.
CREATE TABLE IF NOT EXISTS projects (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  stand_number  INTEGER NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  ficha_code    TEXT NOT NULL,              -- ficha expositora (se bloquea el autovoto)
  program_name  TEXT,
  team_members  TEXT,                       -- nombres separados por línea, texto libre
  summary       TEXT,
  image_path    TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fichas cuyos aprendices pueden votar (nunca incluye fichas expositoras).
CREATE TABLE IF NOT EXISTS visiting_fichas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ficha_code  TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,                -- ej. "2557890 · ADSI"
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Jurados.
CREATE TABLE IF NOT EXISTS judges (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  pin_hash    TEXT NOT NULL,                -- scrypt "salt:hash"
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Caché local del roster de asistencia consultado a Pulse.
-- Deliberadamente puede quedar vacía para una ficha sin sesión ese día.
CREATE TABLE IF NOT EXISTS attendance_roster (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ficha_code  TEXT NOT NULL,
  date        TEXT NOT NULL,                -- YYYY-MM-DD
  doc_number  TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE')),
  fetched_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (ficha_code, date, doc_number)
);

-- Marca si una ficha/fecha tuvo sincronización (para distinguir "sin datos"
-- de "hasSessions:false"), independiente de si el roster quedó vacío.
CREATE TABLE IF NOT EXISTS attendance_sync (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ficha_code    TEXT NOT NULL,
  date          TEXT NOT NULL,
  has_sessions  INTEGER NOT NULL DEFAULT 0,
  roster_count  INTEGER NOT NULL DEFAULT 0,
  synced_at     TEXT NOT NULL DEFAULT (datetime('now')),
  error         TEXT,
  UNIQUE (ficha_code, date)
);

-- Aprendiz visitante ya verificado contra la caché de asistencia.
CREATE TABLE IF NOT EXISTS voters (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ficha_code    TEXT NOT NULL,
  doc_number    TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  verified_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (ficha_code, doc_number)
);

-- Voto de aprendiz: 4 criterios cortos. Un voto por proyecto, forzado aquí.
CREATE TABLE IF NOT EXISTS apprentice_votes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  voter_id          INTEGER NOT NULL REFERENCES voters(id),
  project_id        INTEGER NOT NULL REFERENCES projects(id),
  score_stand       INTEGER NOT NULL CHECK (score_stand BETWEEN 1 AND 5),
  score_clarity     INTEGER NOT NULL CHECK (score_clarity BETWEEN 1 AND 5),
  score_innovation  INTEGER NOT NULL CHECK (score_innovation BETWEEN 1 AND 5),
  score_mastery     INTEGER NOT NULL CHECK (score_mastery BETWEEN 1 AND 5),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (voter_id, project_id)
);

-- Evaluación de un jurado sobre un proyecto (contenedor; los puntajes van en jury_scores).
CREATE TABLE IF NOT EXISTS jury_evaluations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  judge_id      INTEGER NOT NULL REFERENCES judges(id),
  project_id    INTEGER NOT NULL REFERENCES projects(id),
  observations  TEXT,
  submitted_at  TEXT,                       -- NULL = borrador
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (judge_id, project_id)
);

-- Puntaje por criterio (19 filas por evaluación completa), autoguardado.
CREATE TABLE IF NOT EXISTS jury_scores (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id  INTEGER NOT NULL REFERENCES jury_evaluations(id) ON DELETE CASCADE,
  criterion_key  TEXT NOT NULL,
  score          INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  UNIQUE (evaluation_id, criterion_key)
);

CREATE INDEX IF NOT EXISTS idx_apprentice_votes_project ON apprentice_votes(project_id);
CREATE INDEX IF NOT EXISTS idx_jury_evaluations_project ON jury_evaluations(project_id);
CREATE INDEX IF NOT EXISTS idx_attendance_roster_lookup ON attendance_roster(ficha_code, date, doc_number);
