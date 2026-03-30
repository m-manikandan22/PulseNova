/**
 * Database Schema Definitions
 */

export const CREATE_READINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    hr INTEGER NOT NULL,
    hrv INTEGER NOT NULL,
    bp_sys INTEGER NOT NULL,
    bp_dia INTEGER NOT NULL,
    confidence REAL NOT NULL,
    motion INTEGER NOT NULL,
    battery INTEGER NOT NULL,
    UNIQUE(user_id, timestamp)
  );
`;

export const CREATE_BASELINE_TABLE = `
  CREATE TABLE IF NOT EXISTS baseline (
    user_id TEXT PRIMARY KEY,
    avg_resting_hr REAL NOT NULL,
    avg_hrv REAL NOT NULL,
    avg_bp_sys REAL NOT NULL,
    avg_bp_dia REAL NOT NULL,
    baseline_start_date INTEGER NOT NULL
  );
`;

export const CREATE_READINGS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_readings_user_time
  ON readings (user_id, timestamp DESC);
`;
