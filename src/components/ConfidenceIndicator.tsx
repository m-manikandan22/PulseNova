/**
 * Confidence Indicator Component
 * Shows signal quality with warnings for low confidence
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../styles/colors';
import { spacing, typography } from '../styles/theme';
import { formatConfidence, hasGoodSignalQuality } from '../utils/validation';

interface ConfidenceIndicatorProps {
    confidence: number;
    isDark?: boolean;
}

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
    confidence,
    isDark = true,
}) => {
    const getSignalColor = () => {
        if (confidence >= 0.8) return Colors.signal.good;
        if (confidence >= 0.6) return Colors.signal.fair;
        return Colors.signal.poor;
    };

    const getSignalIcon = () => {
        if (confidence >= 0.8) return '📶';
        if (confidence >= 0.6) return '📶';
        return '📵';
    };

    const isGoodQuality = hasGoodSignalQuality(confidence);

    return (
        <View style={styles.container}>
            <View style={styles.indicator}>
                <Text style={styles.icon}>{getSignalIcon()}</Text>
                <Text style={[styles.text, { color: getSignalColor() }]}>
                    {formatConfidence(confidence)}
                </Text>
            </View>

            {!isGoodQuality && (
                <View style={[styles.warning, isDark && styles.warningDark]}>
                    <Text style={[styles.warningText, isDark && styles.warningTextDark]}>
                        Low Signal Quality — Measurement may be unreliable
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: spacing.xs,
    },
    indicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    icon: {
        fontSize: typography.sizes.md,
    },
    text: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    warning: {
        backgroundColor: Colors.warning + '20',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 4,
    },
    warningDark: {
        backgroundColor: Colors.warning + '15',
    },
    warningText: {
        fontSize: typography.sizes.xs,
        color: Colors.text.secondary.light,
    },
    warningTextDark: {
        color: Colors.text.secondary.dark,
    },
});
