/**
 * Data Formatting Utilities
 */

import { format, formatDistanceToNow } from 'date-fns';

/**
 * Format timestamp to readable date
 */
export function formatDate(timestamp: number): string {
    return format(new Date(timestamp), 'MMM dd, yyyy');
}

/**
 * Format timestamp to readable date and time
 */
export function formatDateTime(timestamp: number): string {
    return format(new Date(timestamp), 'MMM dd, yyyy HH:mm');
}

/**
 * Format timestamp to time only
 */
export function formatTime(timestamp: number): string {
    return format(new Date(timestamp), 'HH:mm');
}

/**
 * Format timestamp to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number): string {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

/**
 * Format heart rate for display
 */
export function formatHeartRate(hr: number): string {
    return `${Math.round(hr)}`;
}

/**
 * Format blood pressure for display
 */
export function formatBloodPressure(sys: number, dia: number): string {
    return `${Math.round(sys)}/${Math.round(dia)}`;
}

/**
 * Format HRV for display
 */
export function formatHRV(hrv: number): string {
    return `${Math.round(hrv)}`;
}

/**
 * Format confidence as percentage
 */
export function formatConfidence(conf: number): string {
    return `${Math.round(conf * 100)}%`;
}

/**
 * Format battery percentage
 */
export function formatBattery(bat: number): string {
    return `${Math.round(bat)}%`;
}

/**
 * Format risk score
 */
export function formatRiskScore(score: number): string {
    return Math.round(score).toString();
}
