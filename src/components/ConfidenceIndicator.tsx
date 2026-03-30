/**
 * Confidence Indicator Component
 * Shows signal quality as colored dots (like Wi-Fi bars)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../styles/colors';
import { spacing, typography } from '../styles/theme';
import { formatConfidence } from '../utils/formatter';
import { hasGoodSignalQuality } from '../utils/validation';

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

    const color = getSignalColor();
    const bars = confidence >= 0.8 ? 3 : confidence >= 0.6 ? 2 : 1;
    const isGoodQuality = hasGoodSignalQuality(confidence);

    return (
        <View style={styles.container}>
            <View style={styles.indicator}>
                <Text style={[styles.label, { color: isDark ? '#AAA' : '#666' }]}>SIG</Text>
                <View style={styles.barsRow}>
                    {[1, 2, 3].map(i => (
                        <View
                            key={i}
                            style={[
                                styles.bar,
                                { height: 4 + i * 4 },
                                i <= bars ? { backgroundColor: color } : { backgroundColor: isDark ? '#333' : '#DDD' },
                            ]}
                        />
                    ))}
                </View>
                <Text style={[styles.text, { color }]}>
                    {formatConfidence(confidence)}
                </Text>
            </View>

            {!isGoodQuality && (
                <View style={[styles.warning, isDark && styles.warningDark]}>
                    <Text style={[styles.warningText, isDark && styles.warningTextDark]}>
                        Low signal - readings may be less accurate
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
        gap: 6,
    },
    label: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    barsRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 2,
    },
    bar: {
        width: 4,
        borderRadius: 1,
    },
    text: {
        fontSize: typography.sizes.sm,
        fontWeight: '600',
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
