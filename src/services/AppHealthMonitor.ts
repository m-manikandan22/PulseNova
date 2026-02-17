/**
 * App Health Monitor
 * Tracks app health metrics for debugging and safety
 */

interface HealthMetrics {
    bleDisconnects: number;
    dbWriteFailures: number;
    riskEngineErrors: number;
    invalidPackets: number;
    lowConfidenceReadings: number;
    lastBleDisconnect: number | null;
    lastDbError: number | null;
    lastRiskError: number | null;
}

class AppHealthMonitor {
    private metrics: HealthMetrics = {
        bleDisconnects: 0,
        dbWriteFailures: 0,
        riskEngineErrors: 0,
        invalidPackets: 0,
        lowConfidenceReadings: 0,
        lastBleDisconnect: null,
        lastDbError: null,
        lastRiskError: null,
    };

    private readonly DISCONNECT_THRESHOLD = 5; // Max disconnects per hour
    private readonly ERROR_THRESHOLD = 10; // Max errors per hour

    /**
     * Record BLE disconnect
     */
    recordBleDisconnect(): void {
        this.metrics.bleDisconnects++;
        this.metrics.lastBleDisconnect = Date.now();
        this.checkHealth();
    }

    /**
     * Record database write failure
     */
    recordDbWriteFailure(error: Error): void {
        this.metrics.dbWriteFailures++;
        this.metrics.lastDbError = Date.now();
        console.error('DB write failure:', error);
        this.checkHealth();
    }

    /**
     * Record risk engine error
     */
    recordRiskEngineError(error: Error): void {
        this.metrics.riskEngineErrors++;
        this.metrics.lastRiskError = Date.now();
        console.error('Risk engine error:', error);
        this.checkHealth();
    }

    /**
     * Record invalid packet
     */
    recordInvalidPacket(reason: string): void {
        this.metrics.invalidPackets++;
        console.warn('Invalid packet:', reason);
    }

    /**
     * Record low confidence reading
     */
    recordLowConfidence(confidence: number): void {
        this.metrics.lowConfidenceReadings++;
    }

    /**
     * Check overall app health
     */
    private checkHealth(): void {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        // Check if too many disconnects recently
        if (
            this.metrics.lastBleDisconnect &&
            this.metrics.lastBleDisconnect > oneHourAgo &&
            this.metrics.bleDisconnects > this.DISCONNECT_THRESHOLD
        ) {
            console.warn('High BLE disconnect rate detected');
        }

        // Check if too many errors recently
        const totalErrors =
            this.metrics.dbWriteFailures + this.metrics.riskEngineErrors;
        if (totalErrors > this.ERROR_THRESHOLD) {
            console.error('High error rate detected');
        }
    }

    /**
     * Get current metrics
     */
    getMetrics(): HealthMetrics {
        return { ...this.metrics };
    }

    /**
     * Check if app is in safe mode
     */
    shouldEnterSafeMode(): boolean {
        const recentInvalidPackets = this.metrics.invalidPackets > 20;
        const recentLowConfidence = this.metrics.lowConfidenceReadings > 10;
        const recentDisconnects = this.metrics.bleDisconnects > this.DISCONNECT_THRESHOLD;

        return recentInvalidPackets || recentLowConfidence || recentDisconnects;
    }

    /**
     * Reset metrics
     */
    reset(): void {
        this.metrics = {
            bleDisconnects: 0,
            dbWriteFailures: 0,
            riskEngineErrors: 0,
            invalidPackets: 0,
            lowConfidenceReadings: 0,
            lastBleDisconnect: null,
            lastDbError: null,
            lastRiskError: null,
        };
    }

    /**
     * Get health summary for debugging
     */
    getHealthSummary(): string {
        return `
App Health Summary:
- BLE Disconnects: ${this.metrics.bleDisconnects}
- DB Write Failures: ${this.metrics.dbWriteFailures}
- Risk Engine Errors: ${this.metrics.riskEngineErrors}
- Invalid Packets: ${this.metrics.invalidPackets}
- Low Confidence Readings: ${this.metrics.lowConfidenceReadings}
    `.trim();
    }
}

export default new AppHealthMonitor();
