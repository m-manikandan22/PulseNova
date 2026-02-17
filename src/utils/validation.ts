/**
 * Data Validation Utilities
 */

import { HealthReading } from '../ble/types';

/**
 * Validate heart rate is within acceptable range
 */
export function isValidHeartRate(hr: number): boolean {
    return hr >= 30 && hr <= 220;
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
 * Validate HRV is within acceptable range
 */
export function isValidHRV(hrv: number): boolean {
    return hrv >= 0 && hrv <= 200;
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
        console.warn(`Invalid heart rate: ${hr}`);
        return false;
    }

    if (!isValidHRV(hrv)) {
        console.warn(`Invalid HRV: ${hrv}`);
        return false;
    }

    if (!isValidBloodPressure(bp_sys, bp_dia)) {
        console.warn(`Invalid blood pressure: ${bp_sys}/${bp_dia}`);
        return false;
    }

    if (!isValidConfidence(conf)) {
        console.warn(`Invalid confidence: ${conf}`);
        return false;
    }

    if (!isValidBattery(bat)) {
        console.warn(`Invalid battery: ${bat}`);
        return false;
    }

    return true;
}

/**
 * Check if motion artifact is present
 */
export function hasMotionArtifact(motion: number): boolean {
    return motion === 1;
}
