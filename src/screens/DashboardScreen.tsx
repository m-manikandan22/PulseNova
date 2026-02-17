/**
 * Dashboard Screen
 * Main screen displaying current vitals and trends
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, useColorScheme, Text } from 'react-native';
import { Colors } from '../styles/colors';
import { spacing, borderRadius } from '../styles/theme';
import { StoredReading, RiskAssessment, BPCategory } from '../ble/types';
import { VitalCard } from '../components/VitalCard';
import { RiskGauge } from '../components/RiskGauge';
import { TrendChart } from '../components/TrendChart';
import { BatteryIndicator } from '../components/BatteryIndicator';
import { ConfidenceIndicator } from '../components/ConfidenceIndicator';
import { EmergencyBanner } from '../components/EmergencyBanner';
import { CrisisAlertScreen } from './CrisisAlertScreen'; // New Import
import DataSyncService from '../services/DataSyncService';
import AnalysisEngine from '../services/AnalysisEngine'; // Replaced RiskEngine
import { formatHeartRate, formatBloodPressure, formatHRV } from '../utils/formatter';
import { useDevice } from '../contexts/DeviceContext';


export const DashboardScreen: React.FC = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    // Safety: Check if connected
    const { isConnected } = useDevice();

    const [currentReading, setCurrentReading] = useState<StoredReading | null>(null);
    const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
    const [trendData, setTrendData] = useState<StoredReading[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Crisis Alert State
    const [crisisVisible, setCrisisVisible] = useState(false);

    // Load data
    const loadData = useCallback(async () => {
        if (!isConnected) return; // Prevent DB calls if disconnected

        try {
            const latest = await DataSyncService.getLatestReading();
            if (latest) {
                processReading(latest);
            }

            const trend = await DataSyncService.getSevenDayTrend();
            setTrendData(trend);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }, [isConnected]);

    // Process a new reading
    const processReading = (reading: StoredReading) => {
        setCurrentReading(reading);

        // Analyze Risk
        const assessment = AnalysisEngine.assessStrokeRisk(reading);
        setRiskAssessment(assessment);

        // Check for Crisis
        if (assessment.bpClassification?.stage === BPCategory.CRISIS) {
            setCrisisVisible(true);
        }
    };

    // Initial load
    useEffect(() => {
        if (isConnected) {
            loadData();
        }

        // Listen for new data
        DataSyncService.onDataUpdate((reading) => {
            if (!isConnected) return;
            processReading(reading);
        });
    }, [loadData, isConnected]);

    // Pull to refresh
    const onRefresh = useCallback(async () => {
        if (!isConnected) return;
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, [loadData, isConnected]);

    if (!isConnected) {
        return <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]} />;
    }

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
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Emergency Banner (Persistent if High Risk) */}
                <EmergencyBanner isDark={isDark} visible={riskAssessment?.bpClassification?.stage === BPCategory.CRISIS} />

                {/* Status Indicators */}
                {currentReading && (
                    <View style={styles.statusRow}>
                        <BatteryIndicator level={currentReading.bat} isDark={isDark} />
                        <ConfidenceIndicator confidence={currentReading.conf} isDark={isDark} />
                    </View>
                )}

                {/* Heart Rate - Large Display */}
                {currentReading && (
                    <View style={styles.heroCard}>
                        <VitalCard
                            label="Heart Rate"
                            value={formatHeartRate(currentReading.hr)}
                            unit="bpm"
                            icon="❤️"
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
                                icon="🩺"
                                color={riskAssessment?.bpClassification?.color || Colors.chart.bp}
                                isDark={isDark}
                            />
                        </View>
                        <View style={styles.vitalHalf}>
                            <VitalCard
                                label="HRV"
                                value={formatHRV(currentReading.hrv)}
                                unit="ms"
                                icon="📊"
                                color={Colors.chart.hrv}
                                isDark={isDark}
                            />
                        </View>
                    </View>
                )}

                {/* Risk Gauge */}
                {riskAssessment && (
                    <View style={styles.riskSection}>
                        <RiskGauge assessment={riskAssessment} isDark={isDark} />
                        {riskAssessment.bpClassification && (
                            <View style={[styles.classificationBadge, { borderColor: riskAssessment.bpClassification.color }]}>
                                <Text style={{
                                    color: riskAssessment.bpClassification.color,
                                    fontWeight: 'bold',
                                    fontSize: 16,
                                    textAlign: 'center'
                                }}>
                                    {riskAssessment.bpClassification.label}
                                </Text>
                                <Text style={{ color: isDark ? '#ccc' : '#666', fontSize: 12 }}>
                                    (WHO/AHA Guidelines)
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* 7-Day BP Trend */}
                <TrendChart
                    data={trendData}
                    metric="bp_sys"
                    title="7-Day Blood Pressure Trend"
                    color={Colors.chart.bp}
                    isDark={isDark}
                />

                {/* 7-Day HRV Trend */}
                <TrendChart
                    data={trendData}
                    metric="hrv"
                    title="7-Day HRV Trend"
                    color={Colors.chart.hrv}
                    isDark={isDark}
                />

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    flexContainer: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    containerLight: {
        backgroundColor: Colors.background.light,
    },
    containerDark: {
        backgroundColor: Colors.background.dark,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    heroCard: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    vitalsRow: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        gap: spacing.md,
    },
    vitalHalf: {
        flex: 1,
    },
    riskSection: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    classificationBadge: {
        marginTop: spacing.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderRadius: borderRadius.md,
        width: '100%',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    bottomSpacer: {
        height: spacing.xl,
    },
});

