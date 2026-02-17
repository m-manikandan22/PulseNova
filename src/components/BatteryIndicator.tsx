/**
 * Battery Indicator Component
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../styles/colors';
import { spacing, typography } from '../styles/theme';
import { formatBattery } from '../utils/formatter';

interface BatteryIndicatorProps {
    level: number;
    isDark?: boolean;
}

export const BatteryIndicator: React.FC<BatteryIndicatorProps> = ({ level, isDark = true }) => {
    const getBatteryColor = () => {
        if (level > 50) return Colors.battery.high;
        if (level > 20) return Colors.battery.medium;
        return Colors.battery.low;
    };

    const getBatteryIcon = () => {
        if (level > 75) return '🔋';
        if (level > 50) return '🔋';
        if (level > 20) return '🔋';
        return '🪫';
    };

    return (
        <View style={styles.container}>
            <Text style={styles.icon}>{getBatteryIcon()}</Text>
            <Text style={[styles.text, { color: getBatteryColor() }]}>
                {formatBattery(level)}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
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
});
