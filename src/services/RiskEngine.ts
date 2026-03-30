/**
 * Risk Engine
 * Rule-based cardiovascular risk scoring with explainable output
 */

import { HealthReading, RiskAssessment, Baseline, BPCategory, RiskLevel } from '../ble/types';
import Database from '../database/db';
import { LOCAL_USER_ID } from '../core/constants';

const RISK_THRESHOLDS = {
    LOW: 30,
    MODERATE: 60,
};

class RiskEngine {
    /**
     * Classify Blood Pressure based on ACC/AHA 2017 Guidelines
     */
    private classifyBloodPressure(sys: number, dia: number): {
        stage: BPCategory;
        color: string;
        label: string;
    } {
        if (sys > 180 || dia > 120) {
            return { stage: BPCategory.CRISIS, color: '#FF0000', label: 'Hypertensive Crisis' };
        } else if (sys >= 140 || dia >= 90) {
            return { stage: BPCategory.STAGE_2, color: '#FF4500', label: 'Stage 2 Hypertension' };
        } else if ((sys >= 130 && sys <= 139) || (dia >= 80 && dia <= 89)) {
            return { stage: BPCategory.STAGE_1, color: '#FFA500', label: 'Stage 1 Hypertension' };
        } else if (sys >= 120 && sys <= 129 && dia < 80) {
            return { stage: BPCategory.ELEVATED, color: '#FFD700', label: 'Elevated' };
        } else {
            return { stage: BPCategory.NORMAL, color: '#00FF00', label: 'Normal' };
        }
    }

    /**
     * Calculate risk score based on current reading and baseline
     */
    async calculateRisk(reading: HealthReading): Promise<RiskAssessment> {
        const baseline = await Database.getBaseline(LOCAL_USER_ID);

        // Clinical Classification (Absolute)
        const bpClass = this.classifyBloodPressure(reading.bp_sys, reading.bp_dia);

        if (!baseline) {
            return {
                score: 0,
                category: RiskLevel.LOW,
                explanation: 'Building your personal baseline.',
                suggestion: 'Continue wearing your device.',
                bpClassification: bpClass
            };
        }

        // CRITICAL: Baseline freeze logic during learning period
        const learningEndDate = baseline.baseline_start_date + 7 * 24 * 60 * 60 * 1000;
        const isLearning = Date.now() < learningEndDate;

        if (isLearning) {
            const daysRemaining = Math.ceil((learningEndDate - Date.now()) / (24 * 60 * 60 * 1000));
            return {
                score: 0,
                category: RiskLevel.LOW,
                explanation: `Learning phase active (${daysRemaining} days remaining).`,
                suggestion: 'Continue wearing your device to establish your personal baseline.',
                bpClassification: bpClass
            };
        }

        // Calculate individual deviations
        const bpDeviation = this.calculateBPDeviation(
            reading.bp_sys,
            reading.bp_dia,
            baseline.avg_bp_sys,
            baseline.avg_bp_dia
        );

        const hrvReduction = this.calculateHRVReduction(reading.hrv, baseline.avg_hrv);
        const hrElevation = this.calculateHRElevation(reading.hr, baseline.avg_resting_hr);
        const trendPersistence = await this.calculateTrendPersistence(reading);

        // Calculate weighted risk score (0-100)
        let riskScore =
            0.4 * bpDeviation +
            0.3 * hrvReduction +
            0.2 * hrElevation +
            0.1 * trendPersistence;

        // CRITICAL: Apply confidence weighting
        if (reading.conf < 0.8) {
            riskScore = riskScore * reading.conf;
        }

        // Boost risk score if absolute BP is high, regardless of baseline
        if (bpClass.stage === BPCategory.STAGE_2 || bpClass.stage === BPCategory.CRISIS) {
            riskScore = Math.max(riskScore, 80); // Force high risk for dangerous absolute levels
        } else if (bpClass.stage === BPCategory.STAGE_1) {
            riskScore = Math.max(riskScore, 50); // Force moderate risk
        }

        // Normalize to 0-100
        const normalizedScore = Math.min(100, Math.max(0, riskScore));

        // Categorize risk (Relative)
        const category = this.categorizeRisk(normalizedScore);

        // Generate explanation and suggestion
        const { explanation, suggestion } = this.generateExplanation(
            category,
            normalizedScore,
            bpDeviation,
            hrvReduction,
            hrElevation,
            reading.conf
        );

        return {
            score: normalizedScore,
            category,
            explanation,
            suggestion,
            bpClassification: bpClass
        };
    }

    /**
     * Calculate BP deviation score (0-100)
     */
    private calculateBPDeviation(
        currentSys: number,
        currentDia: number,
        baselineSys: number,
        baselineDia: number
    ): number {
        const sysDeviation = ((currentSys - baselineSys) / baselineSys) * 100;
        const diaDeviation = ((currentDia - baselineDia) / baselineDia) * 100;

        // Average deviation
        const avgDeviation = (sysDeviation + diaDeviation) / 2;

        // Convert to 0-100 scale (assume 20% deviation = 100 score)
        return Math.min(100, Math.max(0, (avgDeviation / 20) * 100));
    }

    /**
     * Calculate HRV reduction score (0-100)
     */
    private calculateHRVReduction(currentHRV: number, baselineHRV: number): number {
        const reduction = ((baselineHRV - currentHRV) / baselineHRV) * 100;

        // Convert to 0-100 scale (assume 40% reduction = 100 score)
        return Math.min(100, Math.max(0, (reduction / 40) * 100));
    }

    /**
     * Calculate resting HR elevation score (0-100)
     */
    private calculateHRElevation(currentHR: number, baselineHR: number): number {
        const elevation = ((currentHR - baselineHR) / baselineHR) * 100;

        // Convert to 0-100 scale (assume 30% elevation = 100 score)
        return Math.min(100, Math.max(0, (elevation / 30) * 100));
    }

    /**
     * Calculate trend persistence (0-100)
     */
    private async calculateTrendPersistence(currentReading: HealthReading): Promise<number> {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const recentReadings = await Database.getReadings(LOCAL_USER_ID, oneDayAgo, Date.now());

        if (recentReadings.length < 10) {
            return 0; // Not enough data
        }

        const baseline = await Database.getBaseline(LOCAL_USER_ID);
        if (!baseline) return 0;

        // Count how many recent readings show elevation
        let elevatedCount = 0;
        for (const reading of recentReadings) {
            const bpElevated = reading.bp_sys > baseline.avg_bp_sys * 1.1;
            const hrElevated = reading.hr > baseline.avg_resting_hr * 1.1;
            const hrvReduced = reading.hrv < baseline.avg_hrv * 0.9;

            if (bpElevated || hrElevated || hrvReduced) {
                elevatedCount++;
            }
        }

        const persistenceRatio = elevatedCount / recentReadings.length;

        // Convert to 0-100 scale
        return persistenceRatio * 100;
    }

    /**
     * Categorize risk score
     */
    private categorizeRisk(score: number): RiskLevel {
        if (score < RISK_THRESHOLDS.LOW) {
            return RiskLevel.LOW;
        } else if (score < RISK_THRESHOLDS.MODERATE) {
            return RiskLevel.MODERATE;
        } else {
            return RiskLevel.HIGH;
        }
    }

    /**
     * Generate human-readable explanation and suggestion
     */
    private generateExplanation(
        category: RiskLevel,
        score: number,
        bpDeviation: number,
        hrvReduction: number,
        hrElevation: number,
        confidence: number
    ): { explanation: string; suggestion: string } {
        const factors: string[] = [];

        if (bpDeviation > 30) factors.push('estimated cardiovascular pressure trends');
        if (hrvReduction > 30) factors.push('heart rate variability');
        if (hrElevation > 30) factors.push('resting heart rate');

        // Add confidence note if low
        const confidenceNote = confidence < 0.7
            ? ' (Note: Signal quality affects this assessment)'
            : '';

        switch (category) {
            case RiskLevel.LOW:
                return {
                    explanation: `Your cardiovascular trends are stable.${confidenceNote}`,
                    suggestion: 'Continue your healthy lifestyle and regular monitoring.',
                };

            case RiskLevel.MODERATE:
                if (factors.length > 0) {
                    return {
                        explanation: `Recent readings show changes in ${factors.join(' and ')}.${confidenceNote}`,
                        suggestion:
                            'Consider monitoring regularly and maintaining a healthy lifestyle. If patterns persist, consult a healthcare professional.',
                    };
                }
                return {
                    explanation: `Your readings show some variation from your baseline.${confidenceNote}`,
                    suggestion: 'Continue monitoring and maintain healthy habits.',
                };

            case RiskLevel.HIGH:
            case RiskLevel.CRITICAL:
                if (factors.length > 0) {
                    return {
                        explanation: `Your readings show persistent changes in ${factors.join(' and ')}.${confidenceNote}`,
                        suggestion:
                            'Consider consulting a healthcare professional for a comprehensive evaluation.',
                    };
                }
                return {
                    explanation: `Your readings have remained elevated compared to your baseline.${confidenceNote}`,
                    suggestion:
                        'We recommend consulting a healthcare professional for personalized advice.',
                };

            default:
                return {
                    explanation: 'Unable to assess risk.',
                    suggestion: 'Continue monitoring.',
                };
        }
    }
}

export default new RiskEngine();
