/**
 * History Screen
 * View historical health readings
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    useColorScheme,
} from 'react-native';
import { Colors } from '../styles/colors';
import { spacing, typography, borderRadius, shadows } from '../styles/theme';
import { StoredReading } from '../ble/types';
import Database from '../database/db';
import {
    formatDateTime,
    formatHeartRate,
    formatBloodPressure,
    formatHRV,
    formatConfidence,
} from '../utils/formatter';

export const HistoryScreen: React.FC = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [readings, setReadings] = useState<StoredReading[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const data = await Database.getLatestReadings(100);
            setReadings(data);
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderReading = ({ item }: { item: StoredReading }) => (
        <View style={[
            styles.readingCard,
            isDark ? styles.readingCardDark : styles.readingCardLight,
            shadows.sm,
        ]}>
            <View style={styles.readingHeader}>
                <Text style={[
                    styles.timestamp,
                    isDark ? styles.timestampDark : styles.timestampLight,
                ]}>
                    {formatDateTime(item.timestamp)}
                </Text>
                <Text style={[
                    styles.confidence,
                    { color: item.conf >= 0.8 ? Colors.signal.good : Colors.signal.fair },
                ]}>
                    {formatConfidence(item.conf)}
                </Text>
            </View>

            <View style={styles.vitalsGrid}>
                <View style={styles.vitalItem}>
                    <Text style={[
                        styles.vitalLabel,
                        isDark ? styles.vitalLabelDark : styles.vitalLabelLight,
                    ]}>
                        HR
                    </Text>
                    <Text style={[
                        styles.vitalValue,
                        isDark ? styles.vitalValueDark : styles.vitalValueLight,
                    ]}>
                        {formatHeartRate(item.hr)} bpm
                    </Text>
                </View>

                <View style={styles.vitalItem}>
                    <Text style={[
                        styles.vitalLabel,
                        isDark ? styles.vitalLabelDark : styles.vitalLabelLight,
                    ]}>
                        BP
                    </Text>
                    <Text style={[
                        styles.vitalValue,
                        isDark ? styles.vitalValueDark : styles.vitalValueLight,
                    ]}>
                        {formatBloodPressure(item.bp_sys, item.bp_dia)}
                    </Text>
                </View>

                <View style={styles.vitalItem}>
                    <Text style={[
                        styles.vitalLabel,
                        isDark ? styles.vitalLabelDark : styles.vitalLabelLight,
                    ]}>
                        HRV
                    </Text>
                    <Text style={[
                        styles.vitalValue,
                        isDark ? styles.vitalValueDark : styles.vitalValueLight,
                    ]}>
                        {formatHRV(item.hrv)} ms
                    </Text>
                </View>
            </View>

            {item.motion === 1 && (
                <View style={styles.motionBadge}>
                    <Text style={styles.motionText}>Motion Detected</Text>
                </View>
            )}
        </View>
    );

    return (
        <View style={[
            styles.container,
            isDark ? styles.containerDark : styles.containerLight,
        ]}>
            <FlatList
                data={readings}
                renderItem={renderReading}
                keyExtractor={(item) => item.id?.toString() || item.timestamp.toString()}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyState}>
                            <Text style={[
                                styles.emptyText,
                                isDark ? styles.emptyTextDark : styles.emptyTextLight,
                            ]}>
                                No readings yet
                            </Text>
                        </View>
                    ) : null
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    containerLight: {
        backgroundColor: Colors.background.light,
    },
    containerDark: {
        backgroundColor: Colors.background.dark,
    },
    list: {
        padding: spacing.md,
        gap: spacing.md,
    },
    readingCard: {
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        gap: spacing.sm,
    },
    readingCardLight: {
        backgroundColor: Colors.surface.light,
    },
    readingCardDark: {
        backgroundColor: Colors.surface.dark,
    },
    readingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    timestamp: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
    },
    timestampLight: {
        color: Colors.text.primary.light,
    },
    timestampDark: {
        color: Colors.text.primary.dark,
    },
    confidence: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
    },
    vitalsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    vitalItem: {
        flex: 1,
        alignItems: 'center',
    },
    vitalLabel: {
        fontSize: typography.sizes.xs,
        marginBottom: spacing.xs,
    },
    vitalLabelLight: {
        color: Colors.text.secondary.light,
    },
    vitalLabelDark: {
        color: Colors.text.secondary.dark,
    },
    vitalValue: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
    },
    vitalValueLight: {
        color: Colors.text.primary.light,
    },
    vitalValueDark: {
        color: Colors.text.primary.dark,
    },
    motionBadge: {
        backgroundColor: Colors.warning + '20',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
        alignSelf: 'flex-start',
    },
    motionText: {
        color: Colors.warning,
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xxl,
    },
    emptyText: {
        fontSize: typography.sizes.md,
    },
    emptyTextLight: {
        color: Colors.text.tertiary.light,
    },
    emptyTextDark: {
        color: Colors.text.tertiary.dark,
    },
});
