/**
 * Vital Card Component
 * Displays a single vital sign with value and label
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../styles/colors';
import { spacing, typography, borderRadius, shadows } from '../styles/theme';

interface VitalCardProps {
    label: string;
    value: string;
    unit: string;
    icon?: string;
    color?: string;
    isDark?: boolean;
    size?: 'small' | 'large';
}

export const VitalCard: React.FC<VitalCardProps> = ({
    label,
    value,
    unit,
    icon,
    color,
    isDark = true,
    size = 'small',
}) => {
    const isLarge = size === 'large';

    return (
        <View style={[
            styles.container,
            isDark ? styles.containerDark : styles.containerLight,
            isLarge && styles.containerLarge,
            shadows.md,
        ]}>
            {icon && <Text style={[styles.icon, isLarge && styles.iconLarge]}>{icon}</Text>}

            <Text style={[
                styles.label,
                isDark ? styles.labelDark : styles.labelLight,
                isLarge && styles.labelLarge,
            ]}>
                {label}
            </Text>

            <View style={styles.valueContainer}>
                <Text style={[
                    styles.value,
                    isDark ? styles.valueDark : styles.valueLight,
                    isLarge && styles.valueLarge,
                    color && { color },
                ]}>
                    {value}
                </Text>
                <Text style={[
                    styles.unit,
                    isDark ? styles.unitDark : styles.unitLight,
                    isLarge && styles.unitLarge,
                ]}>
                    {unit}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        gap: spacing.xs,
    },
    containerLight: {
        backgroundColor: Colors.surface.light,
    },
    containerDark: {
        backgroundColor: Colors.surface.dark,
    },
    containerLarge: {
        padding: spacing.lg,
        gap: spacing.sm,
    },
    icon: {
        fontSize: typography.sizes.xl,
    },
    iconLarge: {
        fontSize: typography.sizes.xxxl,
    },
    label: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    labelLight: {
        color: Colors.text.secondary.light,
    },
    labelDark: {
        color: Colors.text.secondary.dark,
    },
    labelLarge: {
        fontSize: typography.sizes.md,
    },
    valueContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: spacing.xs,
    },
    value: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
    },
    valueLight: {
        color: Colors.text.primary.light,
    },
    valueDark: {
        color: Colors.text.primary.dark,
    },
    valueLarge: {
        fontSize: typography.sizes.xxxl,
    },
    unit: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.medium,
    },
    unitLight: {
        color: Colors.text.tertiary.light,
    },
    unitDark: {
        color: Colors.text.tertiary.dark,
    },
    unitLarge: {
        fontSize: typography.sizes.lg,
    },
});
