/**
 * Mock Data Generator
 * For testing and BLE simulation mode
 */

import { HealthReading, StoredReading } from '../ble/types';

/**
 * Generate a random health reading
 */
export function generateMockReading(
    baseHR: number = 75,
    baseBP: number = 120,
    baseHRV: number = 45
): HealthReading {
    // Add some realistic variation
    const hr = Math.round(baseHR + (Math.random() - 0.5) * 10);
    const hrv = Math.round(baseHRV + (Math.random() - 0.5) * 15);
    const bp_sys = Math.round(baseBP + (Math.random() - 0.5) * 15);
    const bp_dia = Math.round(bp_sys * 0.65 + (Math.random() - 0.5) * 8);

    return {
        hr: Math.max(50, Math.min(120, hr)),
        hrv: Math.max(20, Math.min(80, hrv)),
        bp_sys: Math.max(90, Math.min(160, bp_sys)),
        bp_dia: Math.max(60, Math.min(100, bp_dia)),
        conf: 0.7 + Math.random() * 0.3,
        motion: Math.random() > 0.9 ? 1 : 0,
        bat: 50 + Math.random() * 50,
    };
}

/**
 * Generate mock readings for a time period
 */
export function generateMockReadingsForPeriod(
    days: number,
    readingsPerDay: number = 24
): StoredReading[] {
    const readings: StoredReading[] = [];
    const now = Date.now();
    const msPerReading = (days * 24 * 60 * 60 * 1000) / (days * readingsPerDay);

    for (let i = 0; i < days * readingsPerDay; i++) {
        const timestamp = now - (days * readingsPerDay - i) * msPerReading;
        const reading = generateMockReading();

        readings.push({
            ...reading,
            timestamp,
        });
    }

    return readings;
}

/**
 * Generate mock reading with elevated BP
 */
export function generateElevatedBPReading(): HealthReading {
    return generateMockReading(85, 145, 35);
}

/**
 * Generate mock reading with low HRV
 */
export function generateLowHRVReading(): HealthReading {
    return generateMockReading(80, 125, 25);
}

/**
 * Generate mock reading with high HR
 */
export function generateHighHRReading(): HealthReading {
    return generateMockReading(95, 130, 40);
}

/**
 * Generate mock reading with low signal quality
 */
export function generateLowQualityReading(): HealthReading {
    const reading = generateMockReading();
    return {
        ...reading,
        conf: 0.3 + Math.random() * 0.2,
        motion: 1,
    };
}
