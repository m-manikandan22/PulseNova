/**
 * History Screen — Health Timeline
 * Grouped by day, color-coded by risk level, crisis events marked
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SectionList,
    useColorScheme,
    RefreshControl,
} from 'react-native';
import { Colors } from '../styles/colors';
import { spacing, typography, borderRadius, shadows } from '../styles/theme';
import { StoredReading, BPCategory } from '../ble/types';
import { AggregatedReading } from '../database/db';
import { LOCAL_USER_ID } from '../core/constants';
import DataSyncService from '../services/DataSyncService';
import Database from '../database/db';
import AnalysisEngine from '../services/AnalysisEngine';
import {
    AlertTriangleIcon,
    ActivityIcon,
    ClockIcon,
    HeartPulseIcon,
    CheckCircleIcon,
} from '../components/SVGIcons';
import { TrendChart } from '../components/TrendChart';
import {
    formatDateTime,
    formatHeartRate,
    formatBloodPressure,
    formatHRV,
    formatConfidence,
} from '../utils/formatter';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getRiskColor(reading: StoredReading): string {
    const cat = AnalysisEngine.classifyBloodPressure(reading.bp_sys, reading.bp_dia);
    switch (cat) {
        case BPCategory.CRISIS: return '#FF0000';
        case BPCategory.STAGE_2: return '#FF4500';
        case BPCategory.STAGE_1: return '#FFA500';
        case BPCategory.ELEVATED: return '#FFD700';
        default: return '#32CD32';
    }
}

function isCrisis(reading: StoredReading): boolean {
    return reading.bp_sys >= 180 || reading.bp_dia >= 120;
}

function formatDayHeader(timestamp: number): string {
    const d = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupByDay(readings: StoredReading[]): { title: string; data: StoredReading[] }[] {
    const groups: Record<string, StoredReading[]> = {};
    for (const r of readings) {
        const key = new Date(r.timestamp).toDateString();
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
    }
    return Object.entries(groups).map(([key, data]) => ({
        title: formatDayHeader(data[0].timestamp),
        data,
    }));
}

// ─── Component ──────────────────────────────────────────────────────────────

export const HistoryScreen: React.FC = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [readings, setReadings] = useState<StoredReading[]>([]);
    const [chartData, setChartData] = useState<AggregatedReading[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => { loadHistory(); }, []);

    // Auto-refresh every 10 seconds so new readings appear
    useEffect(() => {
        const interval = setInterval(() => {
            loadHistory();
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    const loadHistory = async () => {
        try {
            // ── List: raw readings for timeline (newest first) ─────────────────
            const rawList = await Database.getLatestReadings(LOCAL_USER_ID, 500);
            setReadings(rawList); // already DESC from db

            // ── Header chart: aggregated 7D BP buckets ────────────────────
            const chart = await DataSyncService.getChartData('7d');
            setChartData(chart);
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const sections = useMemo(() => groupByDay(readings), [readings]);

    const textPrimary = isDark ? styles.textDark : styles.textLight;
    const textSecondary = isDark ? styles.textSecondaryDark : styles.textSecondaryLight;
    const cardStyle = isDark ? styles.cardDark : styles.cardLight;

    const renderReading = ({ item }: { item: StoredReading }) => {
        const riskColor = getRiskColor(item);
        const crisis = isCrisis(item);

        return (
            <View style={styles.timelineRow}>
                {/* Timeline dot + line */}
                <View style={styles.timelineLeft}>
                    <View style={[styles.dot, { backgroundColor: riskColor }]}>
                        {crisis && <Text style={styles.dotIcon}>!</Text>}
                    </View>
                    <View style={[styles.line, { backgroundColor: isDark ? '#333' : '#DDD' }]} />
                </View>

                {/* Reading card */}
                <View style={[styles.card, cardStyle, shadows.sm, crisis && { borderLeftWidth: 3, borderLeftColor: riskColor }]}>
                    {/* Header */}
                    <View style={styles.cardHeader}>
                        <View style={styles.timeRow}>
                            <ClockIcon color={isDark ? '#AAA' : '#888'} size={12} />
                            <Text style={[styles.time, textSecondary]}>
                                {new Date(item.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                        <View style={styles.badges}>
                            {crisis && (
                                <View style={[styles.badge, { backgroundColor: '#FF000020', borderColor: '#FF0000' }]}>
                                    <AlertTriangleIcon color="#FF0000" size={10} />
                                    <Text style={[styles.badgeText, { color: '#FF0000' }]}>CRISIS</Text>
                                </View>
                            )}
                            <View style={[styles.badge, { backgroundColor: riskColor + '20', borderColor: riskColor }]}>
                                <Text style={[styles.badgeText, { color: riskColor }]}>
                                    {AnalysisEngine.getBPLabel(AnalysisEngine.classifyBloodPressure(item.bp_sys, item.bp_dia))}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Vitals */}
                    <View style={styles.vitalsRow}>
                        <View style={styles.vitalItem}>
                            <Text style={[styles.vitalLabel, textSecondary]}>HR</Text>
                            <Text style={[styles.vitalValue, textPrimary]}>{formatHeartRate(item.hr)}</Text>
                            <Text style={[styles.vitalUnit, textSecondary]}>bpm</Text>
                        </View>
                        <View style={[styles.divider, { backgroundColor: isDark ? '#333' : '#EEE' }]} />
                        <View style={styles.vitalItem}>
                            <Text style={[styles.vitalLabel, textSecondary]}>BP</Text>
                            <Text style={[styles.vitalValue, { color: riskColor }]}>{formatBloodPressure(item.bp_sys, item.bp_dia)}</Text>
                            <Text style={[styles.vitalUnit, textSecondary]}>mmHg</Text>
                        </View>
                        <View style={[styles.divider, { backgroundColor: isDark ? '#333' : '#EEE' }]} />
                        <View style={styles.vitalItem}>
                            <Text style={[styles.vitalLabel, textSecondary]}>HRV</Text>
                            <Text style={[styles.vitalValue, textPrimary]}>{formatHRV(item.hrv)}</Text>
                            <Text style={[styles.vitalUnit, textSecondary]}>ms</Text>
                        </View>
                        <View style={[styles.divider, { backgroundColor: isDark ? '#333' : '#EEE' }]} />
                        <View style={styles.vitalItem}>
                            <Text style={[styles.vitalLabel, textSecondary]}>Conf</Text>
                            <Text style={[styles.vitalValue, { color: item.conf >= 0.8 ? '#32CD32' : '#FFA500' }]}>
                                {Math.round(item.conf * 100)}%
                            </Text>
                        </View>
                    </View>

                    {item.motion === 1 && (
                        <View style={styles.motionTagRow}>
                            <ActivityIcon color="#FFA500" size={12} />
                            <Text style={styles.motionTag}>Motion detected</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    const renderSectionHeader = ({ section }: { section: { title: string; data: StoredReading[] } }) => {
        const crisisCount = section.data.filter(isCrisis).length;
        return (
            <View style={[styles.sectionHeader, { backgroundColor: isDark ? Colors.background.dark : Colors.background.light }]}>
                <View style={styles.sectionTitleRow}>
                    <ClockIcon color={isDark ? '#AAA' : '#666'} size={14} />
                    <Text style={[styles.sectionTitle, textPrimary]}>{section.title}</Text>
                </View>
                <View style={styles.sectionMeta}>
                    <Text style={[styles.sectionCount, textSecondary]}>{section.data.length} readings</Text>
                    {crisisCount > 0 && (
                        <View style={styles.crisisBadge}>
                            <AlertTriangleIcon color="#FF4444" size={11} />
                            <Text style={styles.crisisBadgeText}>{crisisCount} crisis</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
            <SectionList
                sections={sections}
                renderItem={renderReading}
                renderSectionHeader={renderSectionHeader}
                keyExtractor={(item) => item.id?.toString() || item.timestamp.toString()}
                contentContainerStyle={styles.list}
                stickySectionHeadersEnabled
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); loadHistory(); }}
                        tintColor={isDark ? '#AAAAAA' : '#666666'}
                    />
                }
                ListHeaderComponent={
                    chartData.length > 0 ? (
                        <TrendChart
                            data={chartData}
                            mode="bp"
                            isDark={isDark}
                            onRangeChange={(r) => DataSyncService.getChartData(r).then(setChartData)}
                        />
                    ) : null
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyState}>
                            <HeartPulseIcon color={isDark ? '#555' : '#CCC'} size={48} />
                            <Text style={[styles.emptyText, textSecondary]}>No readings yet</Text>
                            <Text style={[styles.emptySubtext, textSecondary]}>Connect your device to start monitoring</Text>
                        </View>
                    ) : null
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    containerLight: { backgroundColor: Colors.background.light },
    containerDark: { backgroundColor: Colors.background.dark },
    list: { paddingBottom: 32 },

    // Section header
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E020',
    },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionTitle: { fontSize: 15, fontWeight: '700' },
    sectionMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionCount: { fontSize: 12 },
    crisisBadge: {
        backgroundColor: '#FF000015',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    crisisBadgeText: { color: '#FF4444', fontSize: 11, fontWeight: '600' },

    // Timeline
    timelineRow: {
        flexDirection: 'row',
        paddingLeft: spacing.md,
        paddingRight: spacing.md,
        paddingTop: spacing.sm,
    },
    timelineLeft: {
        width: 24,
        alignItems: 'center',
        marginRight: spacing.sm,
        marginTop: 4,
    },
    dot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    dotIcon: { color: '#FFF', fontSize: 9, fontWeight: '900' },
    line: {
        width: 2,
        flex: 1,
        marginTop: 2,
        minHeight: 20,
    },

    // Card
    card: {
        flex: 1,
        borderRadius: borderRadius.lg,
        padding: spacing.sm,
        marginBottom: spacing.sm,
    },
    cardLight: { backgroundColor: '#FFFFFF' },
    cardDark: { backgroundColor: '#1E1E2E' },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    time: { fontSize: 12 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    badges: { flexDirection: 'row', gap: 4 },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    badgeText: { fontSize: 10, fontWeight: '700' },

    // Vitals
    vitalsRow: { flexDirection: 'row', alignItems: 'center' },
    vitalItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
    vitalLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    vitalValue: { fontSize: 15, fontWeight: '700' },
    vitalUnit: { fontSize: 9, marginTop: 1 },
    divider: { width: 1, height: 32 },
    motionTagRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    motionTag: { fontSize: 11, color: '#FFA500' },

    // Text
    textDark: { color: '#FFFFFF' },
    textLight: { color: '#1A1A2E' },
    textSecondaryDark: { color: '#AAAAAA' },
    textSecondaryLight: { color: '#666666' },

    // Empty
    emptyState: { alignItems: 'center', paddingVertical: 80 },
    emptyText: { fontSize: 16, fontWeight: '600', marginBottom: 6, marginTop: 16 },
    emptySubtext: { fontSize: 13 },
});
