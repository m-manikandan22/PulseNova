/**
 * SQLite Database Manager
 */

import SQLite, { Transaction, SQLiteDatabase } from 'react-native-sqlite-storage';
import { StoredReading, Baseline, HealthReading } from '../ble/types';

// ─── Aggregated type (chart layer) ───────────────────────────────────────────
export interface AggregatedReading {
    bucket: number;       // bucket start timestamp (ms)
    avg_hr: number;
    avg_hrv: number;
    avg_bp_sys: number;
    avg_bp_dia: number;
    min_hr: number;
    max_hr: number;
    min_bp_sys: number;
    max_bp_sys: number;
    min_bp_dia: number;
    max_bp_dia: number;
    min_hrv: number;
    max_hrv: number;
    count: number;        // raw readings aggregated in this bucket
}
import {
    CREATE_READINGS_TABLE,
    CREATE_BASELINE_TABLE,
    CREATE_READINGS_INDEX,
} from './schema';

SQLite.enablePromise(true);

const DATABASE_NAME = 'pulse_nova.db';
const RETENTION_DAYS = 30;

class Database {
    private db: SQLiteDatabase | null = null;
    // Promise lock — all concurrent callers await the same open()
    private initializationPromise: Promise<void> | null = null;

    /**
     * Initialize database.
     * Safe to call multiple times and from multiple callers simultaneously.
     * Concurrent calls all wait on the same in-flight promise.
     */
    async initialize(): Promise<void> {
        // Already open — done
        if (this.db) return;

        // In-progress — join the existing promise instead of opening again
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        // First caller — start the open and store the promise
        this.initializationPromise = (async () => {
            try {
                this.db = await SQLite.openDatabase({
                    name: DATABASE_NAME,
                    location: 'default',
                });
                await this.createTables();
                console.log('Database initialized successfully');
            } catch (error) {
                // Reset so initialize() can be retried after a failure
                this.initializationPromise = null;
                console.error('Database initialization failed:', error);
                throw error;
            }
        })();

        return this.initializationPromise;
    }

    /**
     * Returns true if the database connection is open
     */
    isInitialized(): boolean {
        return this.db !== null;
    }

    /**
     * Ensure DB is initialized before any operation — never warns in production.
     * Calling this is a no-op if already open.
     */
    async ensureInitialized(): Promise<void> {
        if (!this.db) {
            // Only log in dev if we're starting a fresh init (no lock yet)
            if (__DEV__ && !this.initializationPromise) {
                console.warn('DB not initialized — auto-initializing now');
            }
            await this.initialize();
        }
    }

    /**
     * Create tables if they don't exist
     */
    private async createTables(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        // Migration: if old table has is_synced column, drop and recreate
        try {
            const pragma = await this.db.executeSql('PRAGMA table_info(readings)');
            const columns = [];
            for (let i = 0; i < pragma[0].rows.length; i++) {
                columns.push(pragma[0].rows.item(i).name);
            }
            if (columns.includes('is_synced')) {
                console.log('Migrating: dropping old readings table with is_synced column');
                await this.db.executeSql('DROP TABLE IF EXISTS readings');
            }
        } catch (e) {
            // Table doesn't exist yet — fine
        }

        await this.db.executeSql(CREATE_READINGS_TABLE);
        await this.db.executeSql(CREATE_BASELINE_TABLE);
        await this.db.executeSql(CREATE_READINGS_INDEX);
    }

    /**
     * Insert a new reading
     */
    async insertReading(reading: HealthReading, userId: string): Promise<number> {
        await this.ensureInitialized();
        if (!this.db) return -1;

        const timestamp = Date.now();

        // Prevent exact duplicates (simple check)
        const check = await this.db.executeSql(
            'SELECT id FROM readings WHERE user_id = ? AND timestamp = ? LIMIT 1',
            [userId, timestamp]
        );
        if (check[0].rows.length > 0) {
            return check[0].rows.item(0).id;
        }

        const result = await this.db.executeSql(
            `INSERT INTO readings (user_id, timestamp, hr, hrv, bp_sys, bp_dia, confidence, motion, battery)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                timestamp,
                reading.hr,
                reading.hrv,
                reading.bp_sys,
                reading.bp_dia,
                reading.conf || 0,
                reading.motion || 0,
                reading.bat || 0,
            ]
        );

        return result[0].insertId;
    }

    /**
     * Import a reading with an explicit timestamp (e.g. from device history)
     */
    async importReading(reading: StoredReading, userId: string): Promise<void> {
        await this.ensureInitialized();
        if (!this.db) return;

        // Check existence based on user_id and timestamp
        const check = await this.db.executeSql(
            'SELECT id FROM readings WHERE user_id = ? AND timestamp = ? LIMIT 1',
            [userId, reading.timestamp]
        );
        if (check[0].rows.length > 0) return;

        await this.db.executeSql(
            `INSERT INTO readings (user_id, timestamp, hr, hrv, bp_sys, bp_dia, confidence, motion, battery)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                reading.timestamp,
                reading.hr,
                reading.hrv,
                reading.bp_sys,
                reading.bp_dia,
                reading.conf,
                reading.motion,
                reading.bat,
            ]
        );
    }

    /**
     * Get readings within a time range for a specific user
     */
    async getReadings(userId: string, startTime: number, endTime: number): Promise<StoredReading[]> {
        await this.ensureInitialized();

        const result = await this.db!.executeSql(
            `SELECT * FROM readings 
       WHERE user_id = ? AND timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp DESC`,
            [userId, startTime, endTime]
        );

        const readings: StoredReading[] = [];
        for (let i = 0; i < result[0].rows.length; i++) {
            const row = result[0].rows.item(i);
            readings.push({
                id: row.id,
                timestamp: row.timestamp,
                hr: row.hr,
                hrv: row.hrv,
                bp_sys: row.bp_sys,
                bp_dia: row.bp_dia,
                conf: row.confidence,
                motion: row.motion,
                bat: row.battery,
            });
        }

        return readings;
    }

    /**
     * Get latest N readings for a specific user
     */
    async getLatestReadings(userId: string, limit: number = 100): Promise<StoredReading[]> {
        await this.ensureInitialized();

        const result = await this.db!.executeSql(
            `SELECT * FROM readings 
       WHERE user_id = ?
       ORDER BY timestamp DESC 
       LIMIT ?`,
            [userId, limit]
        );

        const readings: StoredReading[] = [];
        for (let i = 0; i < result[0].rows.length; i++) {
            const row = result[0].rows.item(i);
            readings.push({
                id: row.id,
                timestamp: row.timestamp,
                hr: row.hr,
                hrv: row.hrv,
                bp_sys: row.bp_sys,
                bp_dia: row.bp_dia,
                conf: row.confidence,
                motion: row.motion,
                bat: row.battery,
            });
        }

        return readings;
    }

    /**
     * Get aggregated chart data using SQLite GROUP BY time buckets.
     *
     * @param userId   current user
     * @param startMs  window start (JS milliseconds)
     * @param endMs    window end   (JS milliseconds)
     * @param bucketMs bucket size  (e.g. 300_000 = 5 min, 3_600_000 = 1 hr)
     *
     * Returns one row per bucket — dramatically fewer points than raw rows.
     * Resolution examples:
     *   1H  → bucketMs=60_000   → max  60 points
     *   24H → bucketMs=300_000  → max 288 points
     *   7D  → bucketMs=3_600_000 → max 168 points
     */
    async getChartData(
        userId: string,
        startMs: number,
        endMs: number,
        bucketMs: number,
    ): Promise<AggregatedReading[]> {
        await this.ensureInitialized();
        if (!this.db) return [];

        const result = await this.db.executeSql(
            `SELECT
               (timestamp / ?) * ? AS bucket,
               ROUND(AVG(hr),  1)     AS avg_hr,
               ROUND(AVG(hrv), 1)     AS avg_hrv,
               ROUND(AVG(bp_sys), 1)  AS avg_bp_sys,
               ROUND(AVG(bp_dia), 1)  AS avg_bp_dia,
               MIN(hr)                AS min_hr,
               MAX(hr)                AS max_hr,
               MIN(bp_sys)            AS min_bp_sys,
               MAX(bp_sys)            AS max_bp_sys,
               MIN(bp_dia)            AS min_bp_dia,
               MAX(bp_dia)            AS max_bp_dia,
               MIN(hrv)               AS min_hrv,
               MAX(hrv)               AS max_hrv,
               COUNT(*)               AS count
             FROM readings
             WHERE user_id = ?
               AND timestamp >= ?
               AND timestamp <= ?
             GROUP BY bucket
             ORDER BY bucket ASC`,
            [bucketMs, bucketMs, userId, startMs, endMs],
        );

        const rows = result[0].rows;
        const out: AggregatedReading[] = [];
        for (let i = 0; i < rows.length; i++) {
            const r = rows.item(i);
            out.push({
                bucket: r.bucket,
                avg_hr: r.avg_hr,
                avg_hrv: r.avg_hrv,
                avg_bp_sys: r.avg_bp_sys,
                avg_bp_dia: r.avg_bp_dia,
                min_hr: r.min_hr,
                max_hr: r.max_hr,
                min_bp_sys: r.min_bp_sys,
                max_bp_sys: r.max_bp_sys,
                min_bp_dia: r.min_bp_dia,
                max_bp_dia: r.max_bp_dia,
                min_hrv: r.min_hrv,
                max_hrv: r.max_hrv,
                count: r.count,
            });
        }

        console.log(`DB.getChartData: ${out.length} buckets (${startMs}-${endMs}, bucket=${bucketMs}ms)`);
        return out;
    }

    /**
     * Insert multiple readings in a transaction (Batch)
     */
    async insertReadings(readings: StoredReading[], userId: string): Promise<void> {
        await this.ensureInitialized();
        if (!this.db) throw new Error('Database not initialized');

        await this.db!.transaction(async (tx: Transaction) => {
            for (const reading of readings) {
                await tx.executeSql(
                    `INSERT OR IGNORE INTO readings (user_id, timestamp, hr, hrv, bp_sys, bp_dia, confidence, motion, battery)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userId,
                        reading.timestamp,
                        reading.hr,
                        reading.hrv,
                        reading.bp_sys,
                        reading.bp_dia,
                        reading.conf,
                        reading.motion,
                        reading.bat,
                    ]
                );
            }
        });
    }

    /**
     * Get readings for baseline calculation (first 7 days, excluding motion artifacts)
     */
    async getBaselineReadings(userId: string, startDate: number): Promise<StoredReading[]> {
        await this.ensureInitialized();
        if (!this.db) throw new Error('Database not initialized');

        const endDate = startDate + 7 * 24 * 60 * 60 * 1000; // 7 days

        const result = await this.db.executeSql(
            `SELECT * FROM readings 
       WHERE user_id = ? AND timestamp >= ? AND timestamp <= ?
       AND motion < 12.0
       AND confidence >= 0.6
       ORDER BY timestamp ASC`,
            [userId, startDate, endDate]
        );

        const readings: StoredReading[] = [];
        for (let i = 0; i < result[0].rows.length; i++) {
            const row = result[0].rows.item(i);
            readings.push({
                id: row.id,
                timestamp: row.timestamp,
                hr: row.hr,
                hrv: row.hrv,
                bp_sys: row.bp_sys,
                bp_dia: row.bp_dia,
                conf: row.confidence,
                motion: row.motion,
                bat: row.battery,
            });
        }

        return readings;
    }

    /**
     * Save baseline for a specific user
     */
    async saveBaseline(userId: string, baseline: Baseline): Promise<void> {
        await this.ensureInitialized();
        if (!this.db) throw new Error('Database not initialized');

        await this.db.executeSql(
            `INSERT OR REPLACE INTO baseline (user_id, avg_resting_hr, avg_hrv, avg_bp_sys, avg_bp_dia, baseline_start_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [
                userId,
                baseline.avg_resting_hr,
                baseline.avg_hrv,
                baseline.avg_bp_sys,
                baseline.avg_bp_dia,
                baseline.baseline_start_date,
            ]
        );
    }

    /**
     * Get baseline for a specific user
     */
    async getBaseline(userId: string): Promise<Baseline | null> {
        await this.ensureInitialized();
        if (!this.db) throw new Error('Database not initialized');

        const result = await this.db.executeSql('SELECT * FROM baseline WHERE user_id = ?', [userId]);

        if (result[0].rows.length === 0) {
            return null;
        }

        const row = result[0].rows.item(0);
        return {
            avg_resting_hr: row.avg_resting_hr,
            avg_hrv: row.avg_hrv,
            avg_bp_sys: row.avg_bp_sys,
            avg_bp_dia: row.avg_bp_dia,
            baseline_start_date: row.baseline_start_date,
        };
    }

    /**
     * Delete baseline for a specific user
     */
    async deleteBaseline(userId: string): Promise<void> {
        await this.ensureInitialized();
        if (!this.db) throw new Error('Database not initialized');
        await this.db.executeSql('DELETE FROM baseline WHERE user_id = ?', [userId]);
    }

    /**
     * Clean up old readings for a specific user (older than RETENTION_DAYS)
     */
    async cleanupOldReadings(userId: string): Promise<number> {
        await this.ensureInitialized();
        if (!this.db) throw new Error('Database not initialized');

        const cutoffTime = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

        const result = await this.db.executeSql(
            'DELETE FROM readings WHERE user_id = ? AND timestamp < ?',
            [userId, cutoffTime]
        );

        return result[0].rowsAffected;
    }



    /**
     * Get total reading count for a specific user
     */
    async getReadingCount(userId: string): Promise<number> {
        await this.ensureInitialized();
        if (!this.db) throw new Error('Database not initialized');

        const result = await this.db.executeSql('SELECT COUNT(*) as count FROM readings WHERE user_id = ?', [userId]);
        return result[0].rows.item(0).count;
    }

    /**
     * Get database statistics for a specific user
     */
    async getStats(userId: string): Promise<{
        totalReadings: number;
        oldestReading: number | null;
        newestReading: number | null;
    }> {
        await this.ensureInitialized();
        if (!this.db) throw new Error('Database not initialized');

        const countResult = await this.db.executeSql('SELECT COUNT(*) as count FROM readings WHERE user_id = ?', [userId]);
        const oldestResult = await this.db.executeSql(
            'SELECT MIN(timestamp) as oldest FROM readings WHERE user_id = ?',
            [userId]
        );
        const newestResult = await this.db.executeSql(
            'SELECT MAX(timestamp) as newest FROM readings WHERE user_id = ?',
            [userId]
        );

        return {
            totalReadings: countResult[0].rows.item(0).count,
            oldestReading: oldestResult[0].rows.item(0).oldest,
            newestReading: newestResult[0].rows.item(0).newest,
        };
    }

    /**
     * Close database connection (resets the singleton so initialize() can re-open it)
     */
    async close(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
            this.initializationPromise = null; // Allow re-init after close
            console.log('Database closed');
        }
    }
}

export default new Database();
