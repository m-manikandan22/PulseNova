/**
 * Dashboard Screen
 * Main screen displaying current vitals, clinical intelligence, and AI insights
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, useColorScheme, Text, AppState, AppStateStatus } from 'react-native';
import { Colors } from '../styles/colors';
import { spacing, borderRadius } from '../styles/theme';
import { StoredReading, RiskAssessment, BPCategory, RiskLevel } from '../ble/types';
import { AggregatedReading } from '../database/db';
import { TimeRange } from '../components/TrendChart';
import { VitalCard } from '../components/VitalCard';
import { RiskGauge } from '../components/RiskGauge';
import { TrendChart } from '../components/TrendChart';
import { BatteryIndicator } from '../components/BatteryIndicator';
import { ConfidenceIndicator } from '../components/ConfidenceIndicator';
import { EmergencyBanner } from '../components/EmergencyBanner';
import { CrisisAlertScreen } from './CrisisAlertScreen';
import DataSyncService from '../services/DataSyncService';
import AnalysisEngine, { StabilityIndex, StrokeRiskResult, SmartInsight } from '../services/AnalysisEngine';
import InsightEngine, { AIInterpretation } from '../services/InsightEngine';
import { formatHeartRate, formatBloodPressure, formatHRV } from '../utils/formatter';
import { useDevice } from '../contexts/DeviceContext';
import {
    AlertTriangleIcon,
    BrainIcon,
    TrendUpIcon,
    TrendDownIcon,
    CheckCircleIcon,
    InfoIcon,
    ShieldIcon,
    HeartPulseIcon,
    ActivityIcon,
} from '../components/SVGIcons';

export const DashboardScreen: React.FC = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { isConnected } = useDevice();

    const [currentReading, setCurrentReading] = useState<StoredReading | null>(null);
    const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
    // Chart data — separate per mode so range toggles only reload that chart
    const [hrData, setHrData] = useState<AggregatedReading[]>([]);
    const [bpData, setBpData] = useState<AggregatedReading[]>([]);
    const [hrvData, setHrvData] = useState<AggregatedReading[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [crisisVisible, setCrisisVisible] = useState(false);

    // New clinical state
    const [strokeRisk, setStrokeRisk] = useState<StrokeRiskResult | null>(null);
    const [stability, setStability] = useState<StabilityIndex | null>(null);
    const [insights, setInsights] = useState<SmartInsight[]>([]);
    const [aiInterpretation, setAiInterpretation] = useState<AIInterpretation | null>(null);
    const [persistentHypertension, setPersistentHypertension] = useState<{ detected: boolean; stage: string | null; readingCount: number; durationMinutes: number } | null>(null);

    // ── Load aggregated chart data for a specific range ─────────────────────
    const loadChartData = useCallback(async (range: TimeRange) => {
        const [hr, bp, hrv] = await Promise.all([
            DataSyncService.getChartData(range),
            DataSyncService.getChartData(range),
            DataSyncService.getChartData(range),
        ]);
        setHrData(hr);
        setBpData(bp);
        setHrvData(hrv);
    }, []);

    const loadData = useCallback(async () => {
        try {
            // Latest reading for vitals + risk engine (raw row, not aggregated)
            const latest = await DataSyncService.getLatestReading();
            if (latest) processReading(latest);

            // Chart data — start with 7D view
            await loadChartData('7d');

            // Stability also uses raw readings (risk engine layer)
            const trend = await DataSyncService.getSevenDayTrend();
            if (trend.length >= 3) {
                const stabilityResult = AnalysisEngine.getStabilityIndex(trend);
                setStability(stabilityResult);

                const hypertensionResult = AnalysisEngine.detectPersistentHypertension(
                    trend.map(r => ({ reading: r, timestamp: r.timestamp }))
                );
                setPersistentHypertension(hypertensionResult);
            }
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }, [loadChartData]);

    const processReading = (reading: StoredReading) => {
        setCurrentReading(reading);

        // Stroke risk — default age used for local-only mode
        const age = 40;
        const strokeResult = AnalysisEngine.assessStrokeRisk(reading, age);
        setStrokeRisk(strokeResult);

        // Legacy risk assessment for RiskGauge compatibility
        const assessment: RiskAssessment = {
            score: strokeResult.score,
            category: strokeResult.score >= 75 ? RiskLevel.CRITICAL
                : strokeResult.score >= 50 ? RiskLevel.HIGH
                    : strokeResult.score >= 25 ? RiskLevel.MODERATE
                        : RiskLevel.LOW,
            explanation: strokeResult.factors[0] || 'Vitals within normal range',
            suggestion: '',
            bpClassification: {
                stage: strokeResult.bpCategory,
                label: AnalysisEngine.getBPLabel(strokeResult.bpCategory),
                color: AnalysisEngine.getBPColor(strokeResult.bpCategory),
            }
        };
        setRiskAssessment(assessment);

        if (strokeResult.bpCategory === BPCategory.CRISIS) {
            setCrisisVisible(true);
        }
    };

    // Recompute AI interpretation when all data available
    useEffect(() => {
        if (currentReading && strokeRisk && stability) {
            const baseline = null; // Will be enhanced when BaselineService is wired
            const smartInsights = AnalysisEngine.generateSmartInsights(currentReading, baseline, stability);
            setInsights(smartInsights);

            const ai = InsightEngine.interpret(
                currentReading,
                strokeRisk,
                stability,
                riskAssessment?.category ?? RiskLevel.LOW,
                baseline
            );
            setAiInterpretation(ai);
        }
    }, [currentReading, strokeRisk, stability]);

    useEffect(() => {
        // Always load — BLE connection updates live readings on top of history
        loadData();
        DataSyncService.onDataUpdate((reading) => {
            processReading(reading);
        });

        // Reload data when app is foregrounded
        const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
            if (nextState === 'active') {
                console.log('Dashboard: App foregrounded - reloading data');
                loadData();
            }
        });

        return () => sub.remove();
    }, [loadData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, [loadData]);

    // No early return — always show the dashboard.
    // BLE status is shown as a banner, not a blank screen.

    const cardBg = isDark ? styles.cardDark : styles.cardLight;
    const textPrimary = { color: isDark ? '#FFFFFF' : '#1A1A2E' };
    const textSecondary = { color: isDark ? '#AAAAAA' : '#666666' };

    return (
        <View style={styles.flexContainer}>
            <CrisisAlertScreen
                visible={crisisVisible}
                onClose={() => setCrisisVisible(false)}
                sys={currentReading?.bp_sys || 0}
                dia={currentReading?.bp_dia || 0}
            />

            <ScrollView
                style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* ── BLE Status Banner (offline = history mode) ── */}
                {!isConnected && (
                    <View style={[styles.offlineBanner, { backgroundColor: isDark ? '#1A1A2E' : '#F0F4FF' }]}>
                        <ActivityIcon color="#6B7280" size={14} />
                        <Text style={[styles.offlineBannerText, { color: isDark ? '#8890A4' : '#6B7280' }]}>
                            No device connected - showing historical data
                        </Text>
                    </View>
                )}

                {/* Emergency Banner */}
                <EmergencyBanner isDark={isDark} visible={riskAssessment?.bpClassification?.stage === BPCategory.CRISIS} />

                {/* ── Persistent Hypertension Banner ── */}
                {persistentHypertension?.detected && (
                    <View style={[styles.persistentBanner, { borderColor: persistentHypertension.stage === 'Stage 2' ? '#FF4500' : '#FFA500' }]}>
                        <AlertTriangleIcon color={persistentHypertension.stage === 'Stage 2' ? '#FF4500' : '#FFA500'} size={16} />
                        <Text style={[styles.persistentBannerText, { color: persistentHypertension.stage === 'Stage 2' ? '#FF4500' : '#FFA500' }]}>
                            Sustained {persistentHypertension.stage} Hypertension - {persistentHypertension.readingCount} readings in {persistentHypertension.durationMinutes} min
                        </Text>
                    </View>
                )}

                {/* Status Indicators */}
                {currentReading && (
                    <View style={styles.statusRow}>
                        <BatteryIndicator level={currentReading.bat} isDark={isDark} />
                        <ConfidenceIndicator confidence={currentReading.conf} isDark={isDark} />
                    </View>
                )}

                {/* Heart Rate */}
                {currentReading && (
                    <View style={styles.heroCard}>
                        <VitalCard
                            label="Heart Rate"
                            value={formatHeartRate(currentReading.hr)}
                            unit="bpm"
                            icon="HR"
                            color={Colors.chart.hr}
                            isDark={isDark}
                            size="large"
                        />
                    </View>
                )}

                {/* BP and HRV Row */}
                {currentReading && (
                    <View style={styles.vitalsRow}>
                        <View style={styles.vitalHalf}>
                            <VitalCard
                                label="Blood Pressure"
                                value={formatBloodPressure(currentReading.bp_sys, currentReading.bp_dia)}
                                unit="mmHg"
                                icon="BP"
                                color={riskAssessment?.bpClassification?.color || Colors.chart.bp}
                                isDark={isDark}
                            />
                        </View>
                        <View style={styles.vitalHalf}>
                            <VitalCard
                                label="HRV"
                                value={formatHRV(currentReading.hrv)}
                                unit="ms"
                                icon="HRV"
                                color={Colors.chart.hrv}
                                isDark={isDark}
                            />
                        </View>
                    </View>
                )}

                {/* Health Overview */}
                {strokeRisk && (
                    <View style={[styles.card, cardBg, { marginHorizontal: spacing.md, marginTop: spacing.md }]}>
                        <View style={styles.cardTitleRow}>
                            <BrainIcon color={strokeRisk.color} size={16} />
                            <Text style={[styles.cardTitle, textPrimary]}>Health Overview</Text>
                        </View>
                        <View style={styles.scoreRow}>
                            <View style={[styles.stabilityBadge, { backgroundColor: strokeRisk.color + '22', borderColor: strokeRisk.color }]}>
                                <Text style={[styles.stabilityLabel, { color: strokeRisk.color }]}>{strokeRisk.label}</Text>
                            </View>
                        </View>
                        {strokeRisk.factors.length > 0 && (
                            <View style={{ marginTop: spacing.sm }}>
                                {strokeRisk.factors.map((f, i) => (
                                    <Text key={i} style={[styles.factorText, textSecondary]}>{f}</Text>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* Stability */}
                {stability && (
                    <View style={[styles.card, cardBg, { marginHorizontal: spacing.md, marginTop: spacing.md }]}>
                        <View style={styles.cardTitleRow}>
                            <TrendUpIcon color={stability.color} size={16} />
                            <Text style={[styles.cardTitle, textPrimary]}>Stability</Text>
                        </View>
                        <View style={styles.stabilityRow}>
                            <View style={[styles.stabilityBadge, { backgroundColor: stability.color + '22', borderColor: stability.color }]}>
                                <Text style={[styles.stabilityLabel, { color: stability.color }]}>{stability.label}</Text>
                            </View>
                        </View>
                        <Text style={[styles.stabilityDesc, textSecondary]}>{stability.description}</Text>
                    </View>
                )}

                {/* Health Summary */}
                {aiInterpretation && (
                    <View style={[styles.card, cardBg, { marginHorizontal: spacing.md, marginTop: spacing.md, borderLeftWidth: 4, borderLeftColor: aiInterpretation.color }]}>
                        <View style={styles.cardTitleRow}>
                            <ShieldIcon color={aiInterpretation.color} size={16} />
                            <Text style={[styles.cardTitle, textPrimary]}>Health Summary</Text>
                        </View>
                        <Text style={[styles.aiHeadline, { color: aiInterpretation.color }]}>
                            {aiInterpretation.headline}
                        </Text>
                        <Text style={[styles.aiDetail, textSecondary]}>{aiInterpretation.detail}</Text>
                        <View style={[styles.aiActionBox, { backgroundColor: aiInterpretation.color + '15' }]}>
                            <Text style={[styles.aiAction, { color: aiInterpretation.color }]}>
                                {aiInterpretation.action}
                            </Text>
                        </View>
                    </View>
                )}

                {/* ── Smart Insights ── */}
                {insights.length > 0 && (
                    <View style={[styles.card, cardBg, { marginHorizontal: spacing.md, marginTop: spacing.md }]}>
                        <View style={styles.cardTitleRow}>
                            <InfoIcon color={isDark ? '#AAA' : '#666'} size={16} />
                            <Text style={[styles.cardTitle, textPrimary]}>Insights</Text>
                        </View>
                        {insights.map((insight, i) => {
                            const InsightIcon = insight.type === 'alert' ? AlertTriangleIcon
                                : insight.type === 'warning' ? TrendDownIcon
                                    : CheckCircleIcon;
                            const insightColor = insight.type === 'alert' ? '#FF4444'
                                : insight.type === 'warning' ? '#FFA500'
                                    : '#32CD32';
                            return (
                                <View key={i} style={[styles.insightRow, {
                                    backgroundColor: insight.type === 'alert' ? '#FF000015'
                                        : insight.type === 'warning' ? '#FFA50015'
                                            : '#00FF0010'
                                }]}>
                                    <InsightIcon color={insightColor} size={16} />
                                    <Text style={[styles.insightText, textSecondary]}>{insight.message}</Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Risk Gauge */}
                {riskAssessment && (
                    <View style={styles.riskSection}>
                        <RiskGauge assessment={riskAssessment} isDark={isDark} />
                        {riskAssessment.bpClassification && (
                            <View style={[styles.classificationBadge, { borderColor: riskAssessment.bpClassification.color }]}>
                                <Text style={{ color: riskAssessment.bpClassification.color, fontWeight: 'bold', fontSize: 16, textAlign: 'center' }}>
                                    {riskAssessment.bpClassification.label}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Trend Charts */}
                {/* Each chart reloads its own data when the user changes range */}
                <TrendChart
                    data={hrData}
                    mode="hr"
                    isDark={isDark}
                    onRangeChange={(r) => DataSyncService.getChartData(r).then(setHrData)}
                />
                <TrendChart
                    data={bpData}
                    mode="bp"
                    isDark={isDark}
                    onRangeChange={(r) => DataSyncService.getChartData(r).then(setBpData)}
                />
                <TrendChart
                    data={hrvData}
                    mode="hrv"
                    isDark={isDark}
                    onRangeChange={(r) => DataSyncService.getChartData(r).then(setHrvData)}
                />

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    flexContainer: { flex: 1 },
    container: { flex: 1 },
    containerLight: { backgroundColor: Colors.background.light },
    containerDark: { backgroundColor: Colors.background.dark },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    heroCard: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    vitalsRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.md },
    vitalHalf: { flex: 1 },
    riskSection: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'center' },
    classificationBadge: {
        marginTop: spacing.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderRadius: borderRadius.md,
        width: '100%',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    bottomSpacer: { height: spacing.xl },

    // Offline banner
    offlineBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
    },
    offlineBannerText: {
        fontSize: 12,
        fontWeight: '500',
    },

    // Persistent hypertension banner
    persistentBanner: {
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        padding: spacing.sm,
        borderWidth: 1.5,
        borderRadius: borderRadius.md,
        backgroundColor: '#FFA50015',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    persistentBannerText: {
        fontWeight: '600',
        fontSize: 13,
        flex: 1,
    },

    // Generic card
    card: {
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    cardLight: { backgroundColor: '#FFFFFF' },
    cardDark: { backgroundColor: '#1E1E2E' },
    cardTitle: { fontSize: 14, fontWeight: '600', marginBottom: spacing.sm, opacity: 0.7 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },

    // Stroke risk
    scoreRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.sm },
    scoreNumber: { fontSize: 42, fontWeight: '800' },
    scoreLabel: { fontSize: 16, fontWeight: '600', marginLeft: spacing.xs },
    progressBg: { height: 10, backgroundColor: '#E0E0E0', borderRadius: 5, overflow: 'hidden' },
    progressFill: { height: 10, borderRadius: 5 },
    factorText: { fontSize: 12, marginTop: 3 },

    // Stability
    stabilityRow: { flexDirection: 'row', marginBottom: spacing.xs },
    stabilityBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full ?? 999,
        borderWidth: 1.5,
    },
    stabilityLabel: { fontSize: 16, fontWeight: '700' },
    stabilityDesc: { fontSize: 13, marginTop: spacing.xs },

    // AI
    aiHeadline: { fontSize: 17, fontWeight: '700', marginBottom: spacing.xs },
    aiDetail: { fontSize: 13, lineHeight: 20, marginBottom: spacing.sm },
    aiActionBox: { padding: spacing.sm, borderRadius: borderRadius.md },
    aiAction: { fontSize: 13, fontWeight: '600', lineHeight: 20 },

    // Insights
    insightRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        marginBottom: spacing.xs,
        gap: spacing.xs,
    },
    insightText: { fontSize: 13, flex: 1, lineHeight: 19 },
});
