/**
 * Analysis Engine
 * Clinical Intelligence Layer for PulseNova
 * Implements WHO/AHA Guidelines for Hypertension & Stroke Risk
 */

import { BPCategory, RiskLevel, HealthReading, RiskAssessment } from '../ble/types';
import { Colors } from '../styles/colors';

class AnalysisEngine {

    /**
     * Classify Blood Pressure based on AHA/ACC 2017 Guidelines
     */
    classifyBloodPressure(sys: number, dia: number): BPCategory {
        if (sys >= 180 || dia >= 120) {
            return BPCategory.CRISIS;
        }
        if (sys >= 140 || dia >= 90) {
            return BPCategory.STAGE_2;
        }
        if ((sys >= 130 && sys <= 139) || (dia >= 80 && dia <= 89)) {
            return BPCategory.STAGE_1;
        }
        if (sys >= 120 && sys <= 129 && dia < 80) {
            return BPCategory.ELEVATED;
        }
        return BPCategory.NORMAL;
    }

    /**
     * Calculate Stroke Risk Score
     * Weighted analysis of BP, HRV, and stability
     */
    assessStrokeRisk(reading: HealthReading, history: HealthReading[] = []): RiskAssessment {
        const bpCategory = this.classifyBloodPressure(reading.bp_sys, reading.bp_dia);

        let riskScore = 0; // 0-100
        let explanation = "Vitals are within normal range.";
        let suggestion = "Continue monitoring.";

        // 1. BP Factor (Weight: 60%)
        switch (bpCategory) {
            case BPCategory.CRISIS:
                riskScore += 90; // Immediate danger
                explanation = "CRITICAL: Hypertensive Crisis detected.";
                suggestion = "Seek emergency medical attention immediately.";
                break;
            case BPCategory.STAGE_2:
                riskScore += 60;
                explanation = "Stage 2 Hypertension significantly increases stroke risk.";
                suggestion = "Consult a cardiologist soon.";
                break;
            case BPCategory.STAGE_1:
                riskScore += 30;
                explanation = "Stage 1 Hypertension detected.";
                suggestion = "Monitor daily and reduce sodium intake.";
                break;
            case BPCategory.ELEVATED:
                riskScore += 10;
                explanation = "Blood pressure is slightly elevated.";
                suggestion = "Maintain a healthy lifestyle.";
                break;
            case BPCategory.NORMAL:
                riskScore += 0;
                break;
        }

        // 2. HRV Factor (Weight: 20%) - Low HRV indicates stress/autonomic dysfunction
        if (reading.hrv < 20) {
            riskScore += 20;
            explanation += " Extremely low HRV detected.";
        } else if (reading.hrv < 40) {
            riskScore += 10;
        }

        // 3. Heart Rate Stability (Weight: 20%)
        // If HR > 100 at rest (Tachycardia)
        if (reading.hr > 100 && reading.motion === 0) {
            riskScore += 20;
            explanation += " Resting heart rate is high.";
        }

        // Determine Final Risk Level
        let riskLevel = RiskLevel.LOW;
        if (riskScore >= 80) riskLevel = RiskLevel.CRITICAL;
        else if (riskScore >= 50) riskLevel = RiskLevel.HIGH;
        else if (riskScore >= 20) riskLevel = RiskLevel.MODERATE;

        return {
            score: riskScore,
            category: riskLevel,
            explanation,
            suggestion,
            bpClassification: {
                stage: bpCategory,
                label: this.getBPLabel(bpCategory),
                color: this.getBPColor(bpCategory)
            }
        };
    }

    /**
     * Helper: Get formatted label for BP Stage
     */
    private getBPLabel(category: BPCategory): string {
        switch (category) {
            case BPCategory.CRISIS: return "HYPERTENSIVE CRISIS";
            case BPCategory.STAGE_2: return "High BP (Stage 2)";
            case BPCategory.STAGE_1: return "High BP (Stage 1)";
            case BPCategory.ELEVATED: return "Elevated";
            case BPCategory.NORMAL: return "Normal";
            default: return "Unknown";
        }
    }

    /**
     * Helper: Get color for BP Stage
     * (Using hex codes as per clinical standards)
     */
    private getBPColor(category: BPCategory): string {
        switch (category) {
            case BPCategory.CRISIS: return '#FF0000'; // Red
            case BPCategory.STAGE_2: return '#FF4500'; // OrangeRed
            case BPCategory.STAGE_1: return '#FFA500'; // Orange
            case BPCategory.ELEVATED: return '#FFD700'; // Gold
            case BPCategory.NORMAL: return '#32CD32'; // LimeGreen
            default: return '#808080';
        }
    }
}

export default new AnalysisEngine();
