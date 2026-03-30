/**
 * Data Validation Utilities
 */

import { HealthReading } from '../ble/types';

/**
 * Validate heart rate is within acceptable range
 * MAX30105 can report low values during warm-up, so we accept 20+
 */
export function isValidHeartRate(hr: number): boolean {
    return hr >= 20 && hr <= 250;
}

/**
 * Validate blood pressure values are realistic
 */
export function isValidBloodPressure(sys: number, dia: number): boolean {
    // Basic sanity checks
    if (sys < 60 || sys > 250) return false;
    if (dia < 40 || dia > 150) return false;
    if (dia >= sys) return false; // Diastolic should be less than systolic

    return true;
}

/**
 * Validate HRV / R-R interval is within acceptable range
 * ESP32 sends raw inter-beat interval (IBI) in ms, not calculated RMSSD.
 * Normal IBI: 300ms (200bpm) to 2000ms (30bpm)
 */
export function isValidHRV(hrv: number): boolean {
    return hrv >= 0 && hrv <= 2000;
}

/**
 * Validate confidence score
 */
export function isValidConfidence(conf: number): boolean {
    return conf >= 0 && conf <= 1;
}

/**
 * Validate battery percentage
 */
export function isValidBattery(bat: number): boolean {
    return bat >= 0 && bat <= 100;
}

/**
 * Check if confidence is above minimum threshold
 */
export function hasGoodSignalQuality(conf: number): boolean {
    return conf >= 0.6;
}

/**
 * Validate complete health reading
 */
export function validateHealthReading(reading: any): reading is HealthReading {
    if (!reading || typeof reading !== 'object') {
        return false;
    }

    const { hr, hrv, bp_sys, bp_dia, conf, motion, bat } = reading;

    // Check all required fields exist and are numbers
    if (
        typeof hr !== 'number' ||
        typeof hrv !== 'number' ||
        typeof bp_sys !== 'number' ||
        typeof bp_dia !== 'number' ||
        typeof conf !== 'number' ||
        typeof motion !== 'number' ||
        typeof bat !== 'number'
    ) {
        return false;
    }

    // Validate ranges
    if (!isValidHeartRate(hr)) {
        return false;
    }

    if (!isValidHRV(hrv)) {
        return false;
    }

    if (!isValidBloodPressure(bp_sys, bp_dia)) {
        return false;
    }

    if (!isValidConfidence(conf)) {
        return false;
    }

    if (!isValidBattery(bat)) {
        return false;
    }

    return true;
}

/**
 * Check if motion artifact is present
 * ESP32 sends raw accelerometer magnitude in m/s².
 * At rest (gravity only) ≈ 9.8, significant movement ≈ 12+.
 * Threshold 12.0 = movement that degrades PPG signal.
 */
export function hasMotionArtifact(motion: number): boolean {
    return motion >= 12.0;
}
