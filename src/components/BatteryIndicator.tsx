/**
 * Battery Indicator Component
 * Shows watch battery level as a colored bar + percentage
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

    const color = getBatteryColor();
    const fillWidth = Math.min(Math.max(level, 0), 100);

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: isDark ? '#AAA' : '#666' }]}>BAT</Text>
            <View style={styles.batteryShell}>
                <View style={[styles.batteryFill, { width: `${fillWidth}%` as any, backgroundColor: color }]} />
            </View>
            <Text style={[styles.text, { color }]}>
                {formatBattery(level)}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    label: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    batteryShell: {
        width: 28,
        height: 12,
        borderRadius: 3,
        borderWidth: 1.5,
        borderColor: '#555',
        overflow: 'hidden',
        justifyContent: 'center',
    },
    batteryFill: {
        height: '100%',
        borderRadius: 1.5,
    },
    text: {
        fontSize: typography.sizes.sm,
        fontWeight: '600',
    },
});
