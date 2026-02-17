/**
 * Database Schema Definitions
 */

export const CREATE_READINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    hr INTEGER NOT NULL,
    hrv INTEGER NOT NULL,
    bp_sys INTEGER NOT NULL,
    bp_dia INTEGER NOT NULL,
    confidence REAL NOT NULL,
    motion INTEGER NOT NULL,
    battery INTEGER NOT NULL,
    is_synced INTEGER DEFAULT 0
  );
`;

export const CREATE_BASELINE_TABLE = `
  CREATE TABLE IF NOT EXISTS baseline (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    avg_resting_hr REAL NOT NULL,
    avg_hrv REAL NOT NULL,
    avg_bp_sys REAL NOT NULL,
    avg_bp_dia REAL NOT NULL,
    baseline_start_date INTEGER NOT NULL
  );
`;

export const CREATE_READINGS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings(timestamp);
`;
