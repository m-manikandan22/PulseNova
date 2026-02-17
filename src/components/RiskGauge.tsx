/**
 * Risk Gauge Component
 * Visual display of risk score with category and explanation
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../styles/colors';
import { spacing, typography, borderRadius, shadows } from '../styles/theme';
import { RiskAssessment } from '../ble/types';
import { formatRiskScore } from '../utils/formatter';

interface RiskGaugeProps {
    assessment: RiskAssessment;
    isDark?: boolean;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({ assessment, isDark = true }) => {
    const getRiskColor = () => {
        switch (assessment.category) {
            case 'LOW':
                return Colors.risk.low;
            case 'MODERATE':
                return Colors.risk.moderate;
            case 'ELEVATED':
                return Colors.risk.elevated;
            default:
                return Colors.text.tertiary[isDark ? 'dark' : 'light'];
        }
    };

    const riskColor = getRiskColor();

    return (
        <View style={[
            styles.container,
            isDark ? styles.containerDark : styles.containerLight,
            shadows.md,
        ]}>
            <Text style={[
                styles.label,
                isDark ? styles.labelDark : styles.labelLight,
            ]}>
                CARDIOVASCULAR TREND
            </Text>

            {/* Gauge Circle */}
            <View style={styles.gaugeContainer}>
                <View style={[styles.gauge, { borderColor: riskColor }]}>
                    <Text style={[styles.score, { color: riskColor }]}>
                        {formatRiskScore(assessment.score)}
                    </Text>
                </View>
            </View>

            {/* Category */}
            <View style={[styles.categoryBadge, { backgroundColor: riskColor + '20' }]}>
                <Text style={[styles.categoryText, { color: riskColor }]}>
                    {assessment.category}
                </Text>
            </View>

            {/* Explanation */}
            <Text style={[
                styles.explanation,
                isDark ? styles.explanationDark : styles.explanationLight,
            ]}>
                {assessment.explanation}
            </Text>

            {/* Suggestion */}
            <Text style={[
                styles.suggestion,
                isDark ? styles.suggestionDark : styles.suggestionLight,
            ]}>
                {assessment.suggestion}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        gap: spacing.md,
    },
    containerLight: {
        backgroundColor: Colors.surface.light,
    },
    containerDark: {
        backgroundColor: Colors.surface.dark,
    },
    label: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.semibold,
        letterSpacing: 1,
    },
    labelLight: {
        color: Colors.text.secondary.light,
    },
    labelDark: {
        color: Colors.text.secondary.dark,
    },
    gaugeContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: spacing.sm,
    },
    gauge: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    score: {
        fontSize: typography.sizes.xxxl,
        fontWeight: typography.weights.bold,
    },
    categoryBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
    },
    categoryText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        letterSpacing: 0.5,
    },
    explanation: {
        fontSize: typography.sizes.md,
        textAlign: 'center',
        lineHeight: 22,
    },
    explanationLight: {
        color: Colors.text.primary.light,
    },
    explanationDark: {
        color: Colors.text.primary.dark,
    },
    suggestion: {
        fontSize: typography.sizes.sm,
        textAlign: 'center',
        lineHeight: 20,
    },
    suggestionLight: {
        color: Colors.text.secondary.light,
    },
    suggestionDark: {
        color: Colors.text.secondary.dark,
    },
});
