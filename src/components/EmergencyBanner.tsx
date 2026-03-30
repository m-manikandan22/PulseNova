/**
 * Emergency Banner Component
 * Displays persistent safety warning
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../styles/colors';
import { spacing, typography } from '../styles/theme';

interface EmergencyBannerProps {
    isDark?: boolean;
    visible?: boolean;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({ isDark = true, visible = true }) => {
    if (!visible) {
        return null;
    }

    return (
        <View style={[styles.container, isDark && styles.containerDark]}>
            <Text style={[styles.icon, isDark && styles.iconDark]}>⚠️</Text>
            <Text style={[styles.text, isDark && styles.textDark]}>
                If you experience chest pain, dizziness, weakness, or severe symptoms, seek immediate
                medical care.
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.warning + '20',
        borderLeftWidth: 4,
        borderLeftColor: Colors.warning,
        padding: spacing.md,
        marginHorizontal: spacing.md,
        marginVertical: spacing.sm,
        borderRadius: 8,
    },
    containerDark: {
        backgroundColor: Colors.warning + '15',
    },
    icon: {
        fontSize: typography.sizes.lg,
        marginRight: spacing.sm,
    },
    iconDark: {},
    text: {
        flex: 1,
        fontSize: typography.sizes.sm,
        color: Colors.text.secondary.light,
        lineHeight: 20,
    },
    textDark: {
        color: Colors.text.secondary.dark,
    },
});
