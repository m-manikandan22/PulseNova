/**
 * Data Sync Service
 * Coordinates BLE data reception and database storage
 */

import BleManager from '../ble/BleManager';
import Database from '../database/db';
import BaselineService from './BaselineService';
import PacketIntegrityChecker from './PacketIntegrityChecker';
import SignalQualityService from './SignalQualityService';
import AppHealthMonitor from './AppHealthMonitor';
import { HealthReading, StoredReading } from '../ble/types';

type DataCallback = (reading: StoredReading) => void;

class DataSyncService {
    private dataCallback: DataCallback | null = null;
    private lastUpdateTime: number = 0;
    private readonly UPDATE_THROTTLE_MS = 1000; // Max 1 update per second

    // Buffer for incoming readings to reduce DB I/O
    private readingBuffer: StoredReading[] = [];
    private readonly BUFFER_SIZE = 10; // Flush after 10 readings
    private readonly FLUSH_INTERVAL_MS = 30000; // or every 30 seconds
    private flushTimer: NodeJS.Timeout | null = null;

    /**
     * Initialize service
     */
    async initialize(): Promise<void> {
        // Set up BLE data listener
        BleManager.onDataReceived(async (reading: HealthReading) => {
            await this.handleIncomingData(reading);
        });

        // Start periodic flush timer
        this.flushTimer = setInterval(() => {
            this.flushBuffer();
        }, this.FLUSH_INTERVAL_MS);
    }

    /**
     * Set callback for UI updates
     */
    onDataUpdate(callback: DataCallback): void {
        this.dataCallback = callback;
    }

    /**
     * Handle incoming health data
     */
    private async handleIncomingData(reading: HealthReading): Promise<void> {
        try {
            const timestamp = Date.now();

            // CRITICAL: Validate packet integrity
            const integrityCheck = PacketIntegrityChecker.validatePacket(reading, timestamp);
            if (!integrityCheck.valid) {
                console.warn('Packet integrity check failed:', integrityCheck.reason);
                AppHealthMonitor.recordInvalidPacket(integrityCheck.reason || 'Unknown');
                return;
            }

            // Assess signal quality
            const signalQuality = SignalQualityService.assessQuality(reading);
            if (signalQuality.overallQuality === 'POOR') {
                AppHealthMonitor.recordLowConfidence(reading.conf);
            }

            const storedReading: StoredReading = {
                ...reading,
                timestamp,
            };

            // Add to buffer instead of immediate write for performance
            this.readingBuffer.push(storedReading);

            // Real-time UI update (bypass buffer for UX)
            // Throttle UI updates
            const now = Date.now();
            if (now - this.lastUpdateTime >= this.UPDATE_THROTTLE_MS) {
                this.dataCallback?.(storedReading);
                this.lastUpdateTime = now;
            }

            // Flush if buffer full
            if (this.readingBuffer.length >= this.BUFFER_SIZE) {
                await this.flushBuffer();
            }
        } catch (error) {
            console.error('Error handling incoming data:', error);
        }
    }

    /**
     * Flush buffer to database
     */
    private async flushBuffer(): Promise<void> {
        if (this.readingBuffer.length === 0) return;

        const readingsToSave = [...this.readingBuffer];
        this.readingBuffer = []; // Clear immediate buffer

        console.log(`Flushing ${readingsToSave.length} readings to DB...`);

        try {
            // Batch insert for performance
            await Database.insertReadings(readingsToSave);

            // Check baseline after batch save
            await BaselineService.updateBaselineIfReady();

        } catch (error) {
            console.error('Failed to flush buffer:', error);
            AppHealthMonitor.recordDbWriteFailure(error as Error);
        }
    }

    /**
     * Get latest reading
     */
    async getLatestReading(): Promise<StoredReading | null> {
        const readings = await Database.getLatestReadings(1);
        return readings.length > 0 ? readings[0] : null;
    }

    /**
     * Get readings for time range
     */
    async getReadingsForRange(startTime: number, endTime: number): Promise<StoredReading[]> {
        return await Database.getReadings(startTime, endTime);
    }

    /**
     * Get 7-day trend data
     */
    async getSevenDayTrend(): Promise<StoredReading[]> {
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        return await Database.getReadings(sevenDaysAgo, now);
    }
}

export default new DataSyncService();
