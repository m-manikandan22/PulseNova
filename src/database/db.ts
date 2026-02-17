/**
 * SQLite Database Manager
 */

import SQLite, { Transaction, SQLiteDatabase } from 'react-native-sqlite-storage';
import { StoredReading, Baseline, HealthReading } from '../ble/types';
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

    /**
     * Initialize database
     */
    async initialize(): Promise<void> {
        try {
            this.db = await SQLite.openDatabase({
                name: DATABASE_NAME,
                location: 'default',
            });

            await this.createTables();
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }

    /**
     * Create tables if they don't exist
     */
    private async createTables(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        await this.db.executeSql(CREATE_READINGS_TABLE);
        await this.db.executeSql(CREATE_BASELINE_TABLE);
        await this.db.executeSql(CREATE_READINGS_INDEX);
    }

    /**
     * Insert a new reading
     */
    async insertReading(reading: HealthReading): Promise<number> {
        if (!this.db) {
            console.warn('DB not initialized');
            return -1;
        }

        const timestamp = reading.timestamp || Date.now();

        // Prevent exact duplicates (simple check)
        const check = await this.db.executeSql(
            'SELECT id FROM readings WHERE timestamp = ? LIMIT 1',
            [timestamp]
        );
        if (check[0].rows.length > 0) {
            return check[0].rows.item(0).id;
        }

        const result = await this.db.executeSql(
            `INSERT INTO readings (timestamp, hr, hrv, bp_sys, bp_dia, confidence, motion, battery, is_synced)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                timestamp,
                reading.hr,
                reading.hrv,
                reading.bp_sys,
                reading.bp_dia,
                reading.conf || 0,
                reading.motion || 0,
                reading.bat || 0,
                0 // Default: Not synced
            ]
        );

        return result[0].insertId;
    }

    /**
     * Import reading from Cloud (already synced)
     */
    async importReading(reading: StoredReading): Promise<void> {
        if (!this.db) return;

        // Check existence
        const check = await this.db.executeSql(
            'SELECT id FROM readings WHERE timestamp = ? LIMIT 1',
            [reading.timestamp]
        );
        if (check[0].rows.length > 0) return;

        await this.db.executeSql(
            `INSERT INTO readings (timestamp, hr, hrv, bp_sys, bp_dia, confidence, motion, battery, is_synced)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                reading.timestamp,
                reading.hr,
                reading.hrv,
                reading.bp_sys,
                reading.bp_dia,
                reading.conf,
                reading.motion,
                reading.bat,
                1 // IMPORTED = Synced!
            ]
        );
    }

    /**
     * Get readings within a time range
     */
    async getReadings(startTime: number, endTime: number): Promise<StoredReading[]> {
        if (!this.db) throw new Error('Database not initialized');

        const result = await this.db.executeSql(
            `SELECT * FROM readings 
       WHERE timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp DESC`,
            [startTime, endTime]
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
     * Get latest N readings
     */
    async getLatestReadings(limit: number = 100): Promise<StoredReading[]> {
        if (!this.db) throw new Error('Database not initialized');

        const result = await this.db.executeSql(
            `SELECT * FROM readings 
       ORDER BY timestamp DESC 
       LIMIT ?`,
            [limit]
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
     * Insert multiple readings in a transaction (Batch)
     */
    async insertReadings(readings: StoredReading[]): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        await this.db.transaction(async (tx: Transaction) => {
            for (const reading of readings) {
                await tx.executeSql(
                    `INSERT INTO readings (timestamp, hr, hrv, bp_sys, bp_dia, confidence, motion, battery)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
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
    async getBaselineReadings(startDate: number): Promise<StoredReading[]> {
        if (!this.db) throw new Error('Database not initialized');

        const endDate = startDate + 7 * 24 * 60 * 60 * 1000; // 7 days

        const result = await this.db.executeSql(
            `SELECT * FROM readings 
       WHERE timestamp >= ? AND timestamp <= ?
       AND motion = 0
       AND confidence >= 0.6
       ORDER BY timestamp ASC`,
            [startDate, endDate]
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
     * Save baseline
     */
    async saveBaseline(baseline: Baseline): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        await this.db.executeSql(
            `INSERT OR REPLACE INTO baseline (id, avg_resting_hr, avg_hrv, avg_bp_sys, avg_bp_dia, baseline_start_date)
       VALUES (1, ?, ?, ?, ?, ?)`,
            [
                baseline.avg_resting_hr,
                baseline.avg_hrv,
                baseline.avg_bp_sys,
                baseline.avg_bp_dia,
                baseline.baseline_start_date,
            ]
        );
    }

    /**
     * Get baseline
     */
    async getBaseline(): Promise<Baseline | null> {
        if (!this.db) throw new Error('Database not initialized');

        const result = await this.db.executeSql('SELECT * FROM baseline WHERE id = 1');

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
     * Delete baseline
     */
    async deleteBaseline(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        await this.db.executeSql('DELETE FROM baseline WHERE id = 1');
    }

    /**
     * Clean up old readings (older than RETENTION_DAYS)
     */
    async cleanupOldReadings(): Promise<number> {
        if (!this.db) throw new Error('Database not initialized');

        const cutoffTime = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

        const result = await this.db.executeSql(
            'DELETE FROM readings WHERE timestamp < ?',
            [cutoffTime]
        );

        return result[0].rowsAffected;
    }

    /**
     * Get unsynced readings for cloud upload
     */
    async getUnsyncedReadings(limit: number = 50): Promise<StoredReading[]> {
        if (!this.db) throw new Error('Database not initialized');

        const result = await this.db.executeSql(
            `SELECT * FROM readings 
             WHERE is_synced = 0 
             ORDER BY timestamp ASC 
             LIMIT ?`,
            [limit]
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
     * Mark readings as synced after successful upload
     */
    async markReadingsAsSynced(ids: number[]): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');
        if (ids.length === 0) return;

        const placeholders = ids.map(() => '?').join(',');
        await this.db.executeSql(
            `UPDATE readings SET is_synced = 1 WHERE id IN (${placeholders})`,
            ids
        );
    }

    /**
     * Get total reading count
     */
    async getReadingCount(): Promise<number> {
        if (!this.db) throw new Error('Database not initialized');

        const result = await this.db.executeSql('SELECT COUNT(*) as count FROM readings');
        return result[0].rows.item(0).count;
    }

    /**
     * Get database statistics
     */
    async getStats(): Promise<{
        totalReadings: number;
        oldestReading: number | null;
        newestReading: number | null;
    }> {
        if (!this.db) throw new Error('Database not initialized');

        const countResult = await this.db.executeSql('SELECT COUNT(*) as count FROM readings');
        const oldestResult = await this.db.executeSql(
            'SELECT MIN(timestamp) as oldest FROM readings'
        );
        const newestResult = await this.db.executeSql(
            'SELECT MAX(timestamp) as newest FROM readings'
        );

        return {
            totalReadings: countResult[0].rows.item(0).count,
            oldestReading: oldestResult[0].rows.item(0).oldest,
            newestReading: newestResult[0].rows.item(0).newest,
        };
    }

    /**
     * Close database connection
     */
    async close(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }
}

export default new Database();
