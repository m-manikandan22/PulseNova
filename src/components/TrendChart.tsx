/**
 * Trend Chart Component
 * Optimized chart for displaying 7-day health trends
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { VictoryChart, VictoryLine, VictoryAxis, VictoryTheme } from 'victory-native';
import { Colors } from '../styles/colors';
import { spacing, typography, borderRadius, shadows } from '../styles/theme';
import { StoredReading } from '../ble/types';
import { formatDate } from '../utils/formatter';

interface TrendChartProps {
    data: StoredReading[];
    metric: 'hr' | 'bp_sys' | 'bp_dia' | 'hrv';
    title: string;
    color: string;
    isDark?: boolean;
}

const CHART_WIDTH = Dimensions.get('window').width - spacing.md * 4;
const CHART_HEIGHT = 200;

export const TrendChart: React.FC<TrendChartProps> = React.memo(({
    data,
    metric,
    title,
    color,
    isDark = true,
}) => {
    // Process data for chart
    const chartData = useMemo(() => {
        if (!data || data.length === 0) {
            return [];
        }

        return data
            .filter(reading => reading[metric] !== undefined)
            .map(reading => ({
                x: new Date(reading.timestamp),
                y: reading[metric],
            }))
            .reverse(); // Oldest to newest for chart
    }, [data, metric]);

    if (chartData.length === 0) {
        return (
            <View style={[
                styles.container,
                isDark ? styles.containerDark : styles.containerLight,
                shadows.md,
            ]}>
                <Text style={[
                    styles.title,
                    isDark ? styles.titleDark : styles.titleLight,
                ]}>
                    {title}
                </Text>
                <View style={styles.emptyState}>
                    <Text style={[
                        styles.emptyText,
                        isDark ? styles.emptyTextDark : styles.emptyTextLight,
                    ]}>
                        No data available
                    </Text>
                </View>
            </View>
        );
    }

    const textColor = isDark ? Colors.text.secondary.dark : Colors.text.secondary.light;
    const gridColor = isDark ? Colors.chart.grid.dark : Colors.chart.grid.light;

    return (
        <View style={[
            styles.container,
            isDark ? styles.containerDark : styles.containerLight,
            shadows.md,
        ]}>
            <Text style={[
                styles.title,
                isDark ? styles.titleDark : styles.titleLight,
            ]}>
                {title}
            </Text>

            <VictoryChart
                width={CHART_WIDTH}
                height={CHART_HEIGHT}
                padding={{ top: 20, bottom: 40, left: 50, right: 20 }}
                theme={VictoryTheme.material}
            >
                <VictoryAxis
                    dependentAxis
                    style={{
                        axis: { stroke: gridColor },
                        grid: { stroke: gridColor, strokeDasharray: '4,4' },
                        tickLabels: { fill: textColor, fontSize: 10 },
                    }}
                />
                <VictoryAxis
                    style={{
                        axis: { stroke: gridColor },
                        tickLabels: { fill: textColor, fontSize: 10 },
                    }}
                    tickFormat={(date) => formatDate(date).split(',')[0]}
                />
                <VictoryLine
                    data={chartData}
                    style={{
                        data: {
                            stroke: color,
                            strokeWidth: 2,
                        },
                    }}
                    interpolation="natural"
                />
            </VictoryChart>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        marginHorizontal: spacing.md,
        marginVertical: spacing.sm,
    },
    containerLight: {
        backgroundColor: Colors.surface.light,
    },
    containerDark: {
        backgroundColor: Colors.surface.dark,
    },
    title: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        marginBottom: spacing.sm,
    },
    titleLight: {
        color: Colors.text.primary.light,
    },
    titleDark: {
        color: Colors.text.primary.dark,
    },
    emptyState: {
        height: CHART_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: typography.sizes.sm,
    },
    emptyTextLight: {
        color: Colors.text.tertiary.light,
    },
    emptyTextDark: {
        color: Colors.text.tertiary.dark,
    },
});
