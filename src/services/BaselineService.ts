/**
 * Baseline Service
 * Manages baseline calculation and learning period (local-only)
 */

import Database from '../database/db';
import { LOCAL_USER_ID } from '../core/constants';
import { Baseline, StoredReading } from '../ble/types';

const LEARNING_PERIOD_DAYS = 7;

class BaselineService {
    /**
     * Check if baseline exists
     */
    async hasBaseline(): Promise<boolean> {
        const baseline = await Database.getBaseline(LOCAL_USER_ID);
        return baseline !== null;
    }

    /**
     * Get current baseline
     */
    async getBaseline(): Promise<Baseline | null> {
        return await Database.getBaseline(LOCAL_USER_ID);
    }

    /**
     * Check if still in learning period
     */
    async isInLearningPeriod(): Promise<boolean> {
        const baseline = await Database.getBaseline(LOCAL_USER_ID);
        if (!baseline) return true;

        const learningEndDate = baseline.baseline_start_date + LEARNING_PERIOD_DAYS * 24 * 60 * 60 * 1000;
        return Date.now() < learningEndDate;
    }

    /**
     * Get days remaining in learning period
     */
    async getLearningPeriodDaysRemaining(): Promise<number> {
        const baseline = await Database.getBaseline(LOCAL_USER_ID);
        if (!baseline) return LEARNING_PERIOD_DAYS;

        const learningEndDate = baseline.baseline_start_date + LEARNING_PERIOD_DAYS * 24 * 60 * 60 * 1000;
        const msRemaining = learningEndDate - Date.now();
        const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

        return Math.max(0, daysRemaining);
    }

    /**
     * Calculate baseline from readings
     */
    async calculateBaseline(startDate?: number): Promise<Baseline | null> {
        const baselineStartDate = startDate || Date.now();

        // Get readings for baseline period (7 days, excluding motion artifacts and low confidence)
        const readings = await Database.getBaselineReadings(LOCAL_USER_ID, baselineStartDate);

        if (readings.length < 10) {
            console.log('Not enough readings for baseline calculation');
            return null;
        }

        // Calculate averages
        const sum = readings.reduce(
            (acc, reading) => ({
                hr: acc.hr + reading.hr,
                hrv: acc.hrv + reading.hrv,
                bp_sys: acc.bp_sys + reading.bp_sys,
                bp_dia: acc.bp_dia + reading.bp_dia,
            }),
            { hr: 0, hrv: 0, bp_sys: 0, bp_dia: 0 }
        );

        const count = readings.length;

        const baseline: Baseline = {
            avg_resting_hr: sum.hr / count,
            avg_hrv: sum.hrv / count,
            avg_bp_sys: sum.bp_sys / count,
            avg_bp_dia: sum.bp_dia / count,
            baseline_start_date: baselineStartDate,
        };

        // Save baseline
        await Database.saveBaseline(LOCAL_USER_ID, baseline);

        console.log('Baseline calculated:', baseline);
        return baseline;
    }

    /**
     * Recalibrate baseline (start new learning period)
     */
    async recalibrate(): Promise<void> {
        await Database.deleteBaseline(LOCAL_USER_ID);
        console.log('Baseline deleted - starting new learning period');
    }

    /**
     * Update baseline if learning period is complete
     */
    async updateBaselineIfReady(): Promise<boolean> {
        const hasBaseline = await this.hasBaseline();

        if (!hasBaseline) {
            // First time - create baseline with current date
            const baseline = await this.calculateBaseline();
            return baseline !== null;
        }

        const isLearning = await this.isInLearningPeriod();

        if (isLearning) {
            // Still in learning period - try to update baseline
            const currentBaseline = await Database.getBaseline(LOCAL_USER_ID);
            if (currentBaseline) {
                const updatedBaseline = await this.calculateBaseline(currentBaseline.baseline_start_date);
                return updatedBaseline !== null;
            }
        }

        return false;
    }
}

export default new BaselineService();
