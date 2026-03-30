/**
 * Analysis Engine
 * Clinical Intelligence Layer for PulseNova
 * Implements WHO/AHA Guidelines for Hypertension & Stroke Risk
 */

import { BPCategory, RiskLevel, HealthReading, RiskAssessment } from '../ble/types';

export type StabilityLabel = 'Stable' | 'Elevated' | 'Volatile' | 'Unstable';

export interface StabilityIndex {
    label: StabilityLabel;
    color: string;
    description: string;
    score: number; // 0-100
}

export interface StrokeRiskResult {
    score: number;           // 0-100
    label: string;           // "Low" | "Moderate" | "High" | "Critical"
    color: string;
    factors: string[];       // Explainable factors
    bpCategory: BPCategory;
}

export interface SmartInsight {
    message: string;
    type: 'info' | 'warning' | 'alert';
    icon: string;
}

export interface PersistentHypertensionResult {
    detected: boolean;
    stage: 'Stage 1' | 'Stage 2' | null;
    readingCount: number;
    durationMinutes: number;
}

class AnalysisEngine {

    /**
     * Classify Blood Pressure based on AHA/ACC 2017 Guidelines
     */
    classifyBloodPressure(sys: number, dia: number): BPCategory {
        if (sys >= 180 || dia >= 120) return BPCategory.CRISIS;
        if (sys >= 140 || dia >= 90) return BPCategory.STAGE_2;
        if ((sys >= 130 && sys <= 139) || (dia >= 80 && dia <= 89)) return BPCategory.STAGE_1;
        if (sys >= 120 && sys <= 129 && dia < 80) return BPCategory.ELEVATED;
        return BPCategory.NORMAL;
    }

    /**
     * Calculate Stroke Risk Score (0–100)
     * Weighted heuristic: BP (50%) + HRV (25%) + HR stability (15%) + Age (10%)
     */
    assessStrokeRisk(reading: HealthReading, age: number = 40): StrokeRiskResult {
        const bpCategory = this.classifyBloodPressure(reading.bp_sys, reading.bp_dia);
        const factors: string[] = [];
        let score = 0;

        // 1. BP Factor (50%)
        switch (bpCategory) {
            case BPCategory.CRISIS:
                score += 50;
                factors.push('Hypertensive crisis detected');
                break;
            case BPCategory.STAGE_2:
                score += 35;
                factors.push('Stage 2 hypertension');
                break;
            case BPCategory.STAGE_1:
                score += 20;
                factors.push('Stage 1 hypertension');
                break;
            case BPCategory.ELEVATED:
                score += 8;
                factors.push('Elevated blood pressure');
                break;
        }

        // 2. HRV Factor (25%) — low HRV = autonomic dysfunction
        if (reading.hrv < 20) {
            score += 25;
            factors.push('Critically low HRV (autonomic stress)');
        } else if (reading.hrv < 35) {
            score += 15;
            factors.push('Suppressed HRV');
        } else if (reading.hrv < 50) {
            score += 5;
        }

        // 3. HR Stability Factor (15%) — resting tachycardia
        if (reading.hr > 100 && reading.motion === 0) {
            score += 15;
            factors.push('Resting tachycardia');
        } else if (reading.hr > 90 && reading.motion === 0) {
            score += 7;
            factors.push('Elevated resting heart rate');
        }

        // 4. Age Factor (10%)
        if (age >= 70) {
            score += 10;
            factors.push('Age-related risk factor (70+)');
        } else if (age >= 60) {
            score += 7;
            factors.push('Age-related risk factor (60+)');
        } else if (age >= 50) {
            score += 4;
        }

        // Clamp to 0-100
        score = Math.min(100, Math.max(0, score));

        // Label
        let label: string;
        let color: string;
        if (score >= 75) { label = 'Critical'; color = '#FF0000'; }
        else if (score >= 50) { label = 'High'; color = '#FF4500'; }
        else if (score >= 25) { label = 'Moderate'; color = '#FFA500'; }
        else { label = 'Low'; color = '#32CD32'; }

        return { score, label, color, factors, bpCategory };
    }

    /**
     * Cardiovascular Stability Index
     * Based on variance of BP + HRV over recent readings
     */
    getStabilityIndex(recentReadings: HealthReading[]): StabilityIndex {
        if (recentReadings.length < 3) {
            return {
                label: 'Stable',
                color: '#32CD32',
                description: 'Not enough data yet. Keep wearing the device.',
                score: 0
            };
        }

        const last = recentReadings.slice(-10);

        // Calculate std deviation of systolic BP
        const bpValues = last.map(r => r.bp_sys);
        const bpMean = bpValues.reduce((a, b) => a + b, 0) / bpValues.length;
        const bpStd = Math.sqrt(bpValues.map(v => Math.pow(v - bpMean, 2)).reduce((a, b) => a + b, 0) / bpValues.length);

        // Calculate std deviation of HRV
        const hrvValues = last.map(r => r.hrv);
        const hrvMean = hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length;
        const hrvStd = Math.sqrt(hrvValues.map(v => Math.pow(v - hrvMean, 2)).reduce((a, b) => a + b, 0) / hrvValues.length);

        // Check if sustained elevation
        const elevatedCount = last.filter(r =>
            this.classifyBloodPressure(r.bp_sys, r.bp_dia) >= BPCategory.STAGE_1
        ).length;
        const isElevated = elevatedCount >= last.length * 0.6;

        // High variance = volatile
        const isVolatile = bpStd > 12 || hrvStd > 20;

        let label: StabilityLabel;
        let color: string;
        let description: string;
        const score = Math.min(100, Math.round(bpStd * 3 + (isElevated ? 30 : 0)));

        if (isVolatile && isElevated) {
            label = 'Unstable'; color = '#FF0000';
            description = 'High variability with sustained elevation. Consider seeking medical attention.';
        } else if (isVolatile) {
            label = 'Volatile'; color = '#FFA500';
            description = 'Readings fluctuating significantly. Try to rest and avoid exertion.';
        } else if (isElevated) {
            label = 'Elevated'; color = '#FFD700';
            description = 'Consistently above normal range. Keep monitoring.';
        } else {
            label = 'Stable'; color = '#32CD32';
            description = 'Cardiovascular readings are consistent and normal';
        }

        return { label, color, description, score };
    }

    /**
     * Detect Persistent Hypertension
     * 3+ high readings within 30 minutes = persistent hypertension
     */
    detectPersistentHypertension(recentReadings: { reading: HealthReading; timestamp: number }[]): PersistentHypertensionResult {
        const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
        const window = recentReadings.filter(r => r.timestamp >= thirtyMinAgo);

        const stage2Readings = window.filter(r =>
            r.reading.bp_sys >= 140 || r.reading.bp_dia >= 90
        );
        const stage1Readings = window.filter(r =>
            (r.reading.bp_sys >= 130 || r.reading.bp_dia >= 80) &&
            r.reading.bp_sys < 140 && r.reading.bp_dia < 90
        );

        if (stage2Readings.length >= 3) {
            const timestamps = stage2Readings.map(r => r.timestamp);
            const duration = Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / 60000);
            return { detected: true, stage: 'Stage 2', readingCount: stage2Readings.length, durationMinutes: duration };
        }

        if (stage1Readings.length >= 3) {
            const timestamps = stage1Readings.map(r => r.timestamp);
            const duration = Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / 60000);
            return { detected: true, stage: 'Stage 1', readingCount: stage1Readings.length, durationMinutes: duration };
        }

        return { detected: false, stage: null, readingCount: 0, durationMinutes: 0 };
    }

    /**
     * Generate Smart Insights
     * Rule-based contextual messages for the dashboard
     */
    generateSmartInsights(
        reading: HealthReading,
        baseline: { avg_hrv: number; avg_bp_sys: number; avg_resting_hr: number } | null,
        stability: StabilityIndex
    ): SmartInsight[] {
        const insights: SmartInsight[] = [];

        if (!baseline) {
            insights.push({
                message: 'Building your personal baseline. Keep wearing the device.',
                type: 'info',
                icon: 'CHART'
            });
            return insights;
        }

        // HRV insight
        const hrvDrop = ((baseline.avg_hrv - reading.hrv) / baseline.avg_hrv) * 100;
        if (hrvDrop >= 25) {
            insights.push({
                message: `HRV is ${Math.round(hrvDrop)}% below your baseline. High cardiovascular stress detected. Rest recommended.`,
                type: 'alert',
                icon: 'WARN'
            });
        } else if (hrvDrop >= 15) {
            insights.push({
                message: `HRV is ${Math.round(hrvDrop)}% below your baseline. Consider reducing stress and resting.`,
                type: 'warning',
                icon: 'INFO'
            });
        }

        // BP insight
        const bpRise = ((reading.bp_sys - baseline.avg_bp_sys) / baseline.avg_bp_sys) * 100;
        if (bpRise >= 15) {
            insights.push({
                message: `Blood pressure is ${Math.round(bpRise)}% above your personal baseline. Monitor closely.`,
                type: 'warning',
                icon: 'BP'
            });
        }

        // HR insight
        const hrRise = ((reading.hr - baseline.avg_resting_hr) / baseline.avg_resting_hr) * 100;
        if (hrRise >= 20 && reading.motion === 0) {
            insights.push({
                message: `Resting heart rate is elevated (${reading.hr} bpm vs your baseline of ${Math.round(baseline.avg_resting_hr)} bpm).`,
                type: 'warning',
                icon: 'HR'
            });
        }

        // Stability insight
        if (stability.label === 'Volatile' || stability.label === 'Unstable') {
            insights.push({
                message: stability.description,
                type: stability.label === 'Unstable' ? 'alert' : 'warning',
                icon: stability.label === 'Unstable' ? 'ALERT' : 'TREND'
            });
        }

        // All good
        if (insights.length === 0) {
            insights.push({
                message: 'All vitals are within your normal range. Keep it up!',
                type: 'info',
                icon: 'OK'
            });
        }

        return insights;
    }

    // ─── Helpers ────────────────────────────────────────────────

    getBPLabel(category: BPCategory): string {
        switch (category) {
            case BPCategory.CRISIS: return 'HYPERTENSIVE CRISIS';
            case BPCategory.STAGE_2: return 'High BP (Stage 2)';
            case BPCategory.STAGE_1: return 'High BP (Stage 1)';
            case BPCategory.ELEVATED: return 'Elevated';
            case BPCategory.NORMAL: return 'Normal';
            default: return 'Unknown';
        }
    }

    getBPColor(category: BPCategory): string {
        switch (category) {
            case BPCategory.CRISIS: return '#FF0000';
            case BPCategory.STAGE_2: return '#FF4500';
            case BPCategory.STAGE_1: return '#FFA500';
            case BPCategory.ELEVATED: return '#FFD700';
            case BPCategory.NORMAL: return '#32CD32';
            default: return '#808080';
        }
    }
}

export default new AnalysisEngine();
