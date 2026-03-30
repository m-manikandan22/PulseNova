/**
 * InsightEngine — PulseNova AI Risk Interpreter
 * Rule-based structured explanation engine
 * Produces human-readable, clinically-grounded interpretations
 */

import { HealthReading, RiskLevel } from '../ble/types';
import { StabilityIndex, StrokeRiskResult } from './AnalysisEngine';

export interface AIInterpretation {
    headline: string;
    detail: string;
    action: string;
    severity: 'safe' | 'info' | 'warning' | 'alert' | 'critical';
    color: string;
    icon: string;
}

class InsightEngine {

    /**
     * Generate a full AI-style interpretation of the current health state
     */
    interpret(
        reading: HealthReading,
        strokeRisk: StrokeRiskResult,
        stability: StabilityIndex,
        riskLevel: RiskLevel,
        baseline: { avg_hrv: number; avg_bp_sys: number; avg_resting_hr: number } | null
    ): AIInterpretation {

        // CRITICAL — hypertensive crisis
        if (strokeRisk.score >= 75 || riskLevel === RiskLevel.CRITICAL) {
            return {
                headline: 'Urgent Health Alert',
                detail: `Your readings show significant concern. ${strokeRisk.factors.slice(0, 2).join('. ')}.`,
                action: 'Seek emergency medical attention immediately. Call emergency services if symptoms worsen.',
                severity: 'critical',
                color: '#FF0000',
                icon: 'ALERT'
            };
        }

        // HIGH risk
        if (strokeRisk.score >= 50 || riskLevel === RiskLevel.HIGH) {
            const factor = strokeRisk.factors[0] || 'elevated cardiovascular markers';
            return {
                headline: 'High Stress Detected',
                detail: `${factor} detected. Your stability is: ${stability.label}.`,
                action: 'Consult a doctor soon. Avoid strenuous activity and monitor every 15 minutes.',
                severity: 'alert',
                color: '#FF4500',
                icon: 'WARN'
            };
        }

        // VOLATILE stability
        if (stability.label === 'Volatile' || stability.label === 'Unstable') {
            return {
                headline: 'Fluctuating Readings',
                detail: `Your readings are changing significantly. ${stability.description}.`,
                action: 'Rest in a calm environment. Avoid caffeine and physical exertion. Re-check in 10 minutes.',
                severity: 'warning',
                color: '#FFA500',
                icon: 'WARN'
            };
        }

        // MODERATE risk
        if (strokeRisk.score >= 25 || riskLevel === RiskLevel.MODERATE) {
            const hrvDrop = baseline
                ? Math.round(((baseline.avg_hrv - reading.hrv) / baseline.avg_hrv) * 100)
                : 0;
            const detail = hrvDrop > 10
                ? `HRV is ${hrvDrop}% below your baseline, indicating elevated stress. ${strokeRisk.factors[0] || ''}.`
                : `Some cardiovascular markers are above your personal baseline. Stroke risk: ${strokeRisk.score}/100.`;
            return {
                headline: 'Slightly Elevated Readings',
                detail,
                action: 'Monitor regularly. Stay hydrated, reduce stress, and maintain healthy habits.',
                severity: 'warning',
                color: '#FFD700',
                icon: 'INFO'
            };
        }

        // ELEVATED stability only
        if (stability.label === 'Elevated') {
            return {
                headline: 'Slightly Above Normal',
                detail: 'Blood pressure has been consistently a bit elevated.',
                action: 'Reduce sodium intake, stay hydrated, and monitor daily.',
                severity: 'info',
                color: '#FFD700',
                icon: 'INFO'
            };
        }

        // ALL GOOD
        return {
            headline: 'Looking Good',
            detail: `All vitals are within your normal range. Stability: ${stability.label}.`,
            action: 'Continue your healthy lifestyle and regular monitoring.',
            severity: 'safe',
            color: '#32CD32',
            icon: 'OK'
        };
    }
}

export default new InsightEngine();
