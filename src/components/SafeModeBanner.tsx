/**
 * Safe Mode Banner Component
 * Displays when signal is unstable
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../styles/colors';
import { spacing, typography, borderRadius } from '../styles/theme';

interface SafeModeBannerProps {
    onReset: () => void;
}

const SafeModeBanner: React.FC<SafeModeBannerProps> = ({ onReset }) => {
    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.icon}>⚠️</Text>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>Signal Unstable</Text>
                    <Text style={styles.message}>
                        We're experiencing difficulty getting reliable readings from your device.
                    </Text>
                    <Text style={styles.suggestion}>
                        • Ensure device is properly positioned
                        {'\n'}• Check device contact with skin
                        {'\n'}• Remain still during measurement
                        {'\n'}• Check device battery level
                    </Text>
                </View>
            </View>
            <TouchableOpacity style={styles.resetButton} onPress={onReset}>
                <Text style={styles.resetButtonText}>Reset & Retry</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.warning.light,
        borderLeftWidth: 4,
        borderLeftColor: Colors.warning.main,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderRadius: borderRadius.md,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    icon: {
        fontSize: 24,
        marginRight: spacing.sm,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold as any,
        color: Colors.warning.dark,
        marginBottom: spacing.xs,
    },
    message: {
        fontSize: typography.sizes.sm,
        color: Colors.warning.dark,
        marginBottom: spacing.sm,
    },
    suggestion: {
        fontSize: typography.sizes.xs,
        color: Colors.warning.main,
        lineHeight: 18,
    },
    resetButton: {
        backgroundColor: Colors.warning.main,
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
        marginTop: spacing.sm,
        alignItems: 'center',
    },
    resetButtonText: {
        color: Colors.text.inverse,
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold as any,
    },
});

export default SafeModeBanner;
