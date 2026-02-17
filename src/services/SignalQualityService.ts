/**
 * Signal Quality Service
 * Centralized confidence scoring and signal quality assessment
 */

import { HealthReading } from '../ble/types';

export interface SignalQualityAssessment {
    overallQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    confidence: number;
    factors: {
        rawConfidence: number;
        motionArtifact: boolean;
        signalStability: number;
    };
    recommendation: string;
}

class SignalQualityService {
    private recentConfidenceScores: number[] = [];
    private readonly HISTORY_SIZE = 10;

    /**
     * Assess signal quality
     */
    assessQuality(reading: HealthReading): SignalQualityAssessment {
        // Track confidence history
        this.recentConfidenceScores.push(reading.conf);
        if (this.recentConfidenceScores.length > this.HISTORY_SIZE) {
            this.recentConfidenceScores.shift();
        }

        // Calculate signal stability (lower variance = more stable)
        const signalStability = this.calculateStability();

        // Determine overall quality
        const overallQuality = this.determineOverallQuality(
            reading.conf,
            reading.motion === 1,
            signalStability
        );

        // Generate recommendation
        const recommendation = this.generateRecommendation(overallQuality, reading.motion === 1);

        return {
            overallQuality,
            confidence: reading.conf,
            factors: {
                rawConfidence: reading.conf,
                motionArtifact: reading.motion === 1,
                signalStability,
            },
            recommendation,
        };
    }

    /**
     * Calculate signal stability from recent confidence scores
     */
    private calculateStability(): number {
        if (this.recentConfidenceScores.length < 3) {
            return 1.0; // Assume stable if not enough data
        }

        const mean =
            this.recentConfidenceScores.reduce((a, b) => a + b, 0) /
            this.recentConfidenceScores.length;

        const variance =
            this.recentConfidenceScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
            this.recentConfidenceScores.length;

        const stdDev = Math.sqrt(variance);

        // Convert to stability score (0-1, higher is more stable)
        return Math.max(0, 1 - stdDev * 2);
    }

    /**
     * Determine overall quality category
     */
    private determineOverallQuality(
        confidence: number,
        hasMotion: boolean,
        stability: number
    ): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' {
        if (hasMotion || confidence < 0.5) {
            return 'POOR';
        }

        if (confidence >= 0.9 && stability >= 0.8) {
            return 'EXCELLENT';
        }

        if (confidence >= 0.7 && stability >= 0.6) {
            return 'GOOD';
        }

        return 'FAIR';
    }

    /**
     * Generate user-facing recommendation
     */
    private generateRecommendation(
        quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR',
        hasMotion: boolean
    ): string {
        if (hasMotion) {
            return 'Motion detected. Please remain still for accurate readings.';
        }

        switch (quality) {
            case 'EXCELLENT':
                return 'Signal quality is excellent.';
            case 'GOOD':
                return 'Signal quality is good.';
            case 'FAIR':
                return 'Signal quality is fair. Consider adjusting device placement.';
            case 'POOR':
                return 'Signal quality is poor. Please adjust device and ensure proper contact.';
            default:
                return 'Assessing signal quality...';
        }
    }

    /**
     * Check if signal is stable enough for baseline calculation
     */
    isStableForBaseline(reading: HealthReading): boolean {
        const assessment = this.assessQuality(reading);
        return (
            assessment.overallQuality === 'EXCELLENT' ||
            assessment.overallQuality === 'GOOD'
        ) && !assessment.factors.motionArtifact;
    }

    /**
     * Reset service state
     */
    reset(): void {
        this.recentConfidenceScores = [];
    }
}

export default new SignalQualityService();
