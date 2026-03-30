/**
 * DataSyncService
 *
 * Architecture (2-layer, local-only):
 *   Layer 1 — Raw data (30s):   SQLite readings table
 *   Layer 2 — Chart data:       SQLite GROUP BY buckets via getChartData()
 *
 * All data is stored locally. No cloud sync.
 */

import BleManager from '../ble/BleManager';
import Database, { AggregatedReading } from '../database/db';
import BaselineService from './BaselineService';
import PacketIntegrityChecker from './PacketIntegrityChecker';
import SignalQualityService from './SignalQualityService';
import AppHealthMonitor from './AppHealthMonitor';
import { LOCAL_USER_ID } from '../core/constants';
import { HealthReading, StoredReading } from '../ble/types';

type DataCallback = (reading: StoredReading) => void;

class DataSyncService {
    private dataCallback: DataCallback | null = null;
    private lastUpdateTime: number = 0;
    private readonly UPDATE_THROTTLE_MS = 1000;

    // Buffer for incoming BLE readings
    private readingBuffer: StoredReading[] = [];
    private readonly BUFFER_SIZE = 3;           // 3 x 5s = 15 seconds of data
    private readonly FLUSH_INTERVAL_MS = 15000; // Timer fallback: flush every 15s
    private flushTimer: NodeJS.Timeout | null = null;

    /** Initialize service — sets up BLE listener and periodic buffer flush */
    async initialize(): Promise<void> {
        BleManager.onDataReceived(async (reading: HealthReading) => {
            await this.handleIncomingData(reading);
        });

        this.flushTimer = setInterval(() => {
            this.flushBuffer();
        }, this.FLUSH_INTERVAL_MS);
    }

    /** Set callback for live UI updates from BLE */
    onDataUpdate(callback: DataCallback): void {
        this.dataCallback = callback;
    }

    /** Handle incoming BLE reading */
    private async handleIncomingData(reading: HealthReading): Promise<void> {
        try {
            const timestamp = Date.now();

            const integrityCheck = PacketIntegrityChecker.validatePacket(reading, timestamp);
            if (!integrityCheck.valid) {
                console.warn('Packet integrity check failed:', integrityCheck.reason);
                AppHealthMonitor.recordInvalidPacket(integrityCheck.reason || 'Unknown');
                return;
            }

            const signalQuality = SignalQualityService.assessQuality(reading);
            if (signalQuality.overallQuality === 'POOR') {
                AppHealthMonitor.recordLowConfidence(reading.conf);
            }

            const storedReading: StoredReading = { ...reading, timestamp };

            this.readingBuffer.push(storedReading);

            const now = Date.now();
            if (now - this.lastUpdateTime >= this.UPDATE_THROTTLE_MS) {
                this.dataCallback?.(storedReading);
                this.lastUpdateTime = now;
            }

            if (this.readingBuffer.length >= this.BUFFER_SIZE) {
                await this.flushBuffer();
            }
        } catch (error) {
            console.error('Error handling incoming data:', error);
        }
    }

    /** Flush BLE buffer to local SQLite */
    private async flushBuffer(): Promise<void> {
        if (this.readingBuffer.length === 0) return;

        const readingsToSave = [...this.readingBuffer];
        this.readingBuffer = [];

        try {
            await Database.insertReadings(readingsToSave, LOCAL_USER_ID);
            await BaselineService.updateBaselineIfReady();
        } catch (error) {
            console.error('Failed to flush buffer:', error);
            AppHealthMonitor.recordDbWriteFailure(error as Error);
        }
    }

    /**
     * Get the single latest reading from local DB.
     */
    async getLatestReading(): Promise<StoredReading | null> {
        try {
            const local = await Database.getLatestReadings(LOCAL_USER_ID, 1);
            if (local.length > 0) return local[0];
            return null;
        } catch (e) {
            console.error('getLatestReading error:', e);
            return null;
        }
    }

    /**
     * Get readings for a specific time range from local DB.
     */
    async getReadingsForRange(startTime: number, endTime: number): Promise<StoredReading[]> {
        try {
            return await Database.getReadings(LOCAL_USER_ID, startTime, endTime);
        } catch (e) {
            console.error('getReadingsForRange error:', e);
            return [];
        }
    }

    /**
     * ── CHART DATA (Layer 2 — Aggregation) ───────────────────────────────
     *
     * Returns SQLite GROUP BY buckets — never raw rows.
     *
     * Range → Bucket → Max output points:
     *   '1h'  →  1 min  →  60 pts
     *   '24h' →  5 min  → 288 pts
     *   '7d'  →  1 hr   → 168 pts
     *   '30d' →  6 hr   → 120 pts
     *   '1y'  →  1 day  → 365 pts
     */
    async getChartData(range: '1h' | '24h' | '7d' | '30d' | '1y'): Promise<AggregatedReading[]> {
        const now = Date.now();
        const BUCKET: Record<string, number> = {
            '1h': 60_000,        //  1-minute buckets
            '24h': 300_000,       //  5-minute buckets
            '7d': 3_600_000,     //  1-hour   buckets
            '30d': 21_600_000,    //  6-hour   buckets
            '1y': 86_400_000,    //  1-day    buckets
        };
        const WINDOW: Record<string, number> = {
            '1h': 1 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000,
            '1y': 365 * 24 * 60 * 60 * 1000,
        };

        const startMs = now - WINDOW[range];
        const bucketMs = BUCKET[range];

        return Database.getChartData(LOCAL_USER_ID, startMs, now, bucketMs);
    }

    /** @deprecated Use getChartData() for charts. Kept for risk engine only. */
    async getSevenDayTrend(): Promise<StoredReading[]> {
        const now = Date.now();
        return this.getReadingsForRange(now - 7 * 24 * 60 * 60 * 1000, now);
    }
}

export default new DataSyncService();
