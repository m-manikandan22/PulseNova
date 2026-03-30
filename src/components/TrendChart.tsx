/**
 * ClinicalChart — Medical-grade trend visualization for PulseNova
 *
 * Three modes:
 *  'hr'  → Single line, colored risk zones (bradycardia / tachycardia)
 *  'bp'  → Dual line (systolic=red, diastolic=blue) with AHA BP zones
 *  'hrv' → Single line, baseline band, "below baseline" highlight
 *
 * Time range: 1H | 24H | 7D  (local state, user toggleable)
 * Performance: capped at 80 points, moving-average smoothing
 */

import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
} from 'react-native';
import {
    VictoryChart,
    VictoryLine,
    VictoryAxis,
    VictoryTheme,
    VictoryArea,
    VictoryScatter,
    VictoryTooltip,
    VictoryVoronoiContainer,
    VictoryLegend,
} from 'victory-native';
import { AggregatedReading } from '../database/db';
import { spacing, borderRadius } from '../styles/theme';

// ─── Config ───────────────────────────────────────────────────────────────────

type ChartMode = 'hr' | 'bp' | 'hrv';
export type TimeRange = '1h' | '24h' | '7d' | '30d' | '1y';

interface ClinicalChartProps {
    /** Pre-aggregated SQLite buckets — never raw StoredReading[] */
    data: AggregatedReading[];
    mode: ChartMode;
    isDark?: boolean;
    /** Called when user changes range so parent can reload the correct buckets */
    onRangeChange?: (range: TimeRange) => void;
    /** Current range (controlled from parent) */
    range?: TimeRange;
}

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - spacing.md * 4;
const CHART_H = 190;

// ─── Risk Zone Definitions ────────────────────────────────────────────────────

const HR_ZONES = [
    { y0: 0, y1: 50, fill: '#3B82F622', label: 'Bradycardia' },
    { y0: 50, y1: 60, fill: '#FCD34D22', label: 'Low Normal' },
    { y0: 60, y1: 100, fill: '#22C55E18', label: 'Normal' },
    { y0: 100, y1: 120, fill: '#FCD34D22', label: 'Elevated' },
    { y0: 120, y1: 220, fill: '#EF444422', label: 'Tachycardia' },
];

const BP_ZONES = [
    { y0: 0, y1: 80, fill: '#3B82F622', label: 'Low' },
    { y0: 80, y1: 120, fill: '#22C55E18', label: 'Normal' },
    { y0: 120, y1: 130, fill: '#FCD34D22', label: 'Elevated' },
    { y0: 130, y1: 140, fill: '#F9730022', label: 'Stage 1' },
    { y0: 140, y1: 180, fill: '#EF444422', label: 'Stage 2' },
    { y0: 180, y1: 250, fill: '#9333EA22', label: 'Crisis' },
];

const HRV_ZONES = [
    { y0: 0, y1: 20, fill: '#EF444428', label: 'Very Low' },
    { y0: 20, y1: 50, fill: '#FCD34D22', label: 'Low' },
    { y0: 50, y1: 100, fill: '#22C55E18', label: 'Good' },
    { y0: 100, y1: 200, fill: '#3B82F618', label: 'Excellent' },
];

const TIME_RANGES: { key: TimeRange; label: string; ms: number }[] = [
    { key: '1h', label: '1H', ms: 1 * 60 * 60 * 1000 },
    { key: '24h', label: '24H', ms: 24 * 60 * 60 * 1000 },
    { key: '7d', label: '7D', ms: 7 * 24 * 60 * 60 * 1000 },
    { key: '30d', label: '30D', ms: 30 * 24 * 60 * 60 * 1000 },
    { key: '1y', label: '1Y', ms: 365 * 24 * 60 * 60 * 1000 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// numeric x, numeric y
function ma(pts: { x: number; y: number }[], w = 3) {
    return pts.map((p, i) => {
        const s = pts.slice(Math.max(0, i - w + 1), i + 1);
        return { x: p.x, y: parseFloat((s.reduce((a, d) => a + d.y, 0) / s.length).toFixed(1)) };
    });
}

function fmtTick(ms: number, range: TimeRange): string {
    const d = new Date(ms);
    if (range === '1h') return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (range === '24h') return `${d.getHours()}:00`;
    if (range === '1y') return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear().toString().substr(2)}`;
    return `${d.getDate()}/${d.getMonth() + 1}`;
}

const MODE_META: Record<ChartMode, {
    title: string;
    unit: string;
    fallbackDomain: [number, number]; // Used only when no data
    color: string;
    zones: typeof HR_ZONES;
}> = {
    hr: {
        title: 'Heart Rate',
        unit: 'bpm',
        fallbackDomain: [40, 160],
        color: '#FF6B8A',
        zones: HR_ZONES,
    },
    bp: {
        title: 'Blood Pressure',
        unit: 'mmHg',
        fallbackDomain: [50, 200],
        color: '#60A5FA',
        zones: BP_ZONES,
    },
    hrv: {
        title: 'Heart Rate Variability',
        unit: 'ms',
        fallbackDomain: [0, 150],
        color: '#A78BFA',
        zones: HRV_ZONES,
    },
};

function stats(pts: { y: number }[]) {
    if (!pts.length) return { min: 0, avg: 0, max: 0 };
    const vals = pts.map(p => p.y);
    return {
        min: parseFloat(Math.min(...vals).toFixed(1)),
        avg: parseFloat((vals.reduce((a, v) => a + v, 0) / vals.length).toFixed(1)),
        max: parseFloat(Math.max(...vals).toFixed(1)),
    };
}

/** Compute true min/max across all raw readings inside all buckets */
function trueStats(data: AggregatedReading[], mode: 'hr' | 'bp' | 'hrv') {
    if (!data.length) return { min: 0, avg: 0, max: 0 };
    if (mode === 'hr') {
        const mins = data.map(d => d.min_hr);
        const maxs = data.map(d => d.max_hr);
        const avgs = data.map(d => d.avg_hr);
        return {
            min: parseFloat(Math.min(...mins).toFixed(1)),
            avg: parseFloat((avgs.reduce((a, v) => a + v, 0) / avgs.length).toFixed(1)),
            max: parseFloat(Math.max(...maxs).toFixed(1)),
        };
    }
    if (mode === 'bp') {
        return {
            sysMin: parseFloat(Math.min(...data.map(d => d.min_bp_sys)).toFixed(1)),
            sysAvg: parseFloat((data.reduce((a, d) => a + d.avg_bp_sys, 0) / data.length).toFixed(1)),
            sysMax: parseFloat(Math.max(...data.map(d => d.max_bp_sys)).toFixed(1)),
            diaMin: parseFloat(Math.min(...data.map(d => d.min_bp_dia)).toFixed(1)),
            diaAvg: parseFloat((data.reduce((a, d) => a + d.avg_bp_dia, 0) / data.length).toFixed(1)),
            diaMax: parseFloat(Math.max(...data.map(d => d.max_bp_dia)).toFixed(1)),
        };
    }
    // hrv
    return {
        min: parseFloat(Math.min(...data.map(d => d.min_hrv)).toFixed(1)),
        avg: parseFloat((data.reduce((a, d) => a + d.avg_hrv, 0) / data.length).toFixed(1)),
        max: parseFloat(Math.max(...data.map(d => d.max_hrv)).toFixed(1)),
    };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TrendChart: React.FC<ClinicalChartProps> = React.memo((
    { data, mode, isDark = true, onRangeChange, range: controlledRange },
) => {
    const [localRange, setLocalRange] = useState<TimeRange>('7d');
    const timeRange = controlledRange ?? localRange;

    const meta = MODE_META[mode];
    const cardBg = isDark ? '#1E1E2E' : '#FFFFFF';
    const textPrimary = isDark ? '#EAEAEA' : '#1A1A2E';
    const textMuted = isDark ? '#888898' : '#6B7280';
    const gridColor = isDark ? '#2A2A3A' : '#E5E7EB';

    // ── Build chart series from aggregated data ──────────────────────────────
    // Data is already the correct window from SQLite GROUP BY — no filtering needed.
    const hrSeries = useMemo(() => data.map(r => ({ x: r.bucket, y: r.avg_hr })), [data]);
    const sysSeries = useMemo(() => data.map(r => ({ x: r.bucket, y: r.avg_bp_sys })), [data]);
    const diaSeries = useMemo(() => data.map(r => ({ x: r.bucket, y: r.avg_bp_dia })), [data]);
    const hrvSeries = useMemo(() => data.map(r => ({ x: r.bucket, y: r.avg_hrv })), [data]);

    const primary = mode === 'hr' ? hrSeries : mode === 'bp' ? sysSeries : hrvSeries;
    const secondary = mode === 'bp' ? diaSeries : [];

    const smoothed = useMemo(() => ma(primary), [primary]);
    const smoothedDia = useMemo(() => mode === 'bp' ? ma(diaSeries) : [], [diaSeries, mode]);

    // Dynamic Y domain — fits data with 10% padding, never clips
    const dynamicDomain = useMemo((): [number, number] => {
        const allY = [...primary.map(p => p.y), ...secondary.map(p => p.y)];
        if (allY.length === 0) return meta.fallbackDomain;
        const dataMin = Math.min(...allY);
        const dataMax = Math.max(...allY);
        const padding = Math.max((dataMax - dataMin) * 0.15, 10);
        return [
            Math.floor(Math.max(0, dataMin - padding)),
            Math.ceil(dataMax + padding),
        ];
    }, [primary, secondary, meta.fallbackDomain]);

    // Use true min/max from raw readings inside SQL buckets
    const trueStatsResult = useMemo(() => trueStats(data, mode), [data, mode]);

    // For chart line stats (used by non-BP modes)
    const { min, avg, max } = mode !== 'bp' ? trueStatsResult as { min: number; avg: number; max: number } : { min: 0, avg: 0, max: 0 };
    // For BP mode
    const bpStats = mode === 'bp' ? trueStatsResult as { sysMin: number; sysAvg: number; sysMax: number; diaMin: number; diaAvg: number; diaMax: number } : null;

    // ── Range toggle — notifies parent to reload data ────────────────────────
    const handleRangeChange = (r: TimeRange) => {
        setLocalRange(r);
        onRangeChange?.(r);
    };

    // ── Empty / insufficient ─────────────────────────────────────────────────
    const isEmpty = primary.length === 0;

    return (
        <View style={[styles.card, { backgroundColor: cardBg }]}>

            {/* ── Title ── */}
            <View style={styles.titleRow}>
                <View style={[styles.accent, { backgroundColor: meta.color }]} />
                <Text style={[styles.title, { color: textPrimary }]}>{meta.title}</Text>
            </View>

            {/* ── Time Range Buttons ── */}
            <View style={[styles.rangeRow, { backgroundColor: isDark ? '#12121E' : '#F3F4F6' }]}>
                {TIME_RANGES.map(tr => {
                    const active = tr.key === timeRange;
                    return (
                        <TouchableOpacity
                            key={tr.key}
                            style={[
                                styles.rangeBtn,
                                active && { backgroundColor: meta.color + '28', borderColor: meta.color, borderWidth: 1 },
                            ]}
                            onPress={() => handleRangeChange(tr.key)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.rangeTxt, { color: active ? meta.color : textMuted }]}>
                                {tr.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── Stats ── */}
            <View style={[styles.statsRow, { backgroundColor: isDark ? '#12121E' : '#F9FAFB' }]}>
                {mode === 'bp' ? (
                    <>
                        {/* Systolic stats */}
                        <View style={styles.statGroup}>
                            <Text style={[styles.statGroupLabel, { color: '#FF6B6B' }]}>SYS</Text>
                            <View style={styles.statCells}>
                                <View style={styles.statCell}>
                                    <Text style={[styles.statVal, { color: '#22C55E' }]}>{bpStats?.sysMin}</Text>
                                    <Text style={[styles.statLbl, { color: textMuted }]}>Min</Text>
                                </View>
                                <View style={styles.statCell}>
                                    <Text style={[styles.statVal, { color: '#FF6B6B' }]}>{bpStats?.sysAvg}</Text>
                                    <Text style={[styles.statLbl, { color: textMuted }]}>Avg</Text>
                                </View>
                                <View style={styles.statCell}>
                                    <Text style={[styles.statVal, { color: '#EF4444' }]}>{bpStats?.sysMax}</Text>
                                    <Text style={[styles.statLbl, { color: textMuted }]}>Max</Text>
                                </View>
                            </View>
                        </View>
                        <View style={[styles.divider, { backgroundColor: gridColor }]} />
                        {/* Diastolic stats */}
                        <View style={styles.statGroup}>
                            <Text style={[styles.statGroupLabel, { color: '#60A5FA' }]}>DIA</Text>
                            <View style={styles.statCells}>
                                <View style={styles.statCell}>
                                    <Text style={[styles.statVal, { color: '#22C55E' }]}>{bpStats?.diaMin}</Text>
                                    <Text style={[styles.statLbl, { color: textMuted }]}>Min</Text>
                                </View>
                                <View style={styles.statCell}>
                                    <Text style={[styles.statVal, { color: '#60A5FA' }]}>{bpStats?.diaAvg}</Text>
                                    <Text style={[styles.statLbl, { color: textMuted }]}>Avg</Text>
                                </View>
                                <View style={styles.statCell}>
                                    <Text style={[styles.statVal, { color: '#EF4444' }]}>{bpStats?.diaMax}</Text>
                                    <Text style={[styles.statLbl, { color: textMuted }]}>Max</Text>
                                </View>
                            </View>
                        </View>
                    </>
                ) : (
                    <>
                        <View style={styles.statCell}>
                            <Text style={[styles.statVal, { color: '#22C55E' }]}>{min}</Text>
                            <Text style={[styles.statLbl, { color: textMuted }]}>Min</Text>
                        </View>
                        <View style={[styles.statCell, styles.statCellCenter]}>
                            <Text style={[styles.statVal, { color: meta.color }]}>{avg}</Text>
                            <Text style={[styles.statLbl, { color: textMuted }]}>Avg</Text>
                        </View>
                        <View style={styles.statCell}>
                            <Text style={[styles.statVal, { color: '#EF4444' }]}>{max}</Text>
                            <Text style={[styles.statLbl, { color: textMuted }]}>Max</Text>
                        </View>
                        <View style={[styles.statCell, styles.statCellPts]}>
                            <Text style={[styles.statVal, { color: textPrimary }]}>{primary.length}</Text>
                            <Text style={[styles.statLbl, { color: textMuted }]}>Pts</Text>
                        </View>
                    </>
                )}
            </View>

            {/* ── Chart or Empty ── */}
            {isEmpty ? (
                <View style={styles.empty}>
                    <Text style={[styles.emptyTxt, { color: textMuted }]}>
                        {data.length === 0
                            ? 'No readings yet - connect your device'
                            : 'No data in this time window'}
                    </Text>
                </View>
            ) : (
                <>
                    <VictoryChart
                        width={CHART_W}
                        height={CHART_H}
                        padding={{ top: 12, bottom: 38, left: 46, right: 12 }}
                        theme={VictoryTheme.material}
                        domain={{ y: dynamicDomain }}
                        containerComponent={
                            <VictoryVoronoiContainer
                                labels={({ datum }) =>
                                    mode === 'bp'
                                        ? `${datum.y} mmHg`
                                        : `${datum.y} ${meta.unit}`
                                }
                                labelComponent={
                                    <VictoryTooltip
                                        style={{ fontSize: 9, fill: textPrimary }}
                                        flyoutStyle={{ fill: cardBg, stroke: meta.color, strokeWidth: 1 }}
                                        flyoutPadding={5}
                                    />
                                }
                            />
                        }
                    >
                        {/* Risk zone background bands */}
                        {primary.length >= 2 && meta.zones.map((z, i) => (
                            <VictoryArea
                                key={i}
                                data={[
                                    { x: primary[0].x, y: z.y1, y0: z.y0 },
                                    { x: primary[primary.length - 1].x, y: z.y1, y0: z.y0 },
                                ]}
                                style={{ data: { fill: z.fill, strokeWidth: 0 } }}
                                interpolation="linear"
                            />
                        ))}

                        {/* Y axis */}
                        <VictoryAxis
                            dependentAxis
                            style={{
                                axis: { stroke: gridColor },
                                grid: { stroke: gridColor, strokeDasharray: '3,3' },
                                tickLabels: { fill: textMuted, fontSize: 9 },
                            }}
                        />
                        {/* X axis */}
                        <VictoryAxis
                            scale="linear"
                            style={{
                                axis: { stroke: gridColor },
                                tickLabels: { fill: textMuted, fontSize: 9, angle: -30 },
                            }}
                            tickFormat={(ms: number) => fmtTick(ms, timeRange)}
                            tickCount={Math.min(6, primary.length)}
                        />

                        {/* Lines only when 2+ points (VictoryLine crashes on 1 point with natural interp) */}
                        {primary.length >= 2 && (
                            <>
                                {/* Systolic raw (BP mode) */}
                                {mode === 'bp' && (
                                    <VictoryLine
                                        data={sysSeries}
                                        style={{ data: { stroke: '#FF6B6B55', strokeWidth: 1.5, strokeDasharray: '4,2' } }}
                                        interpolation="monotoneX"
                                    />
                                )}

                                {/* Diastolic raw + smooth (BP mode) */}
                                {mode === 'bp' && diaSeries.length >= 2 && (
                                    <>
                                        <VictoryLine
                                            data={diaSeries}
                                            style={{ data: { stroke: '#60A5FA55', strokeWidth: 1.5, strokeDasharray: '4,2' } }}
                                            interpolation="monotoneX"
                                        />
                                        <VictoryLine
                                            data={smoothedDia}
                                            style={{ data: { stroke: '#60A5FA', strokeWidth: 2.5 } }}
                                            interpolation="monotoneX"
                                        />
                                    </>
                                )}

                                {/* Primary raw line (faint dashed) */}
                                <VictoryLine
                                    data={primary}
                                    style={{ data: { stroke: meta.color + '55', strokeWidth: 1.5, strokeDasharray: '4,2' } }}
                                    interpolation="monotoneX"
                                />

                                {/* Primary smoothed line (bold) */}
                                <VictoryLine
                                    data={smoothed}
                                    style={{ data: { stroke: meta.color, strokeWidth: 2.8 } }}
                                    interpolation="monotoneX"
                                />
                            </>
                        )}

                        {/* Dots on data points (always render, even single point) */}
                        <VictoryScatter
                            data={primary}
                            size={primary.length === 1 ? 5 : 2.5}
                            style={{ data: { fill: meta.color, stroke: cardBg, strokeWidth: 1.5 } }}
                        />
                        {mode === 'bp' && (
                            <VictoryScatter
                                data={diaSeries}
                                size={diaSeries.length === 1 ? 5 : 2.5}
                                style={{ data: { fill: '#60A5FA', stroke: cardBg, strokeWidth: 1.5 } }}
                            />
                        )}
                    </VictoryChart>

                    {/* BP Legend */}
                    {mode === 'bp' && (
                        <View style={styles.bpLegend}>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#FF6B6B' }]} />
                                <Text style={[styles.legendTxt, { color: textMuted }]}>Systolic</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: '#60A5FA' }]} />
                                <Text style={[styles.legendTxt, { color: textMuted }]}>Diastolic</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendLine, { backgroundColor: textMuted }]} />
                                <Text style={[styles.legendTxt, { color: textMuted }]}>3-pt Avg</Text>
                            </View>
                        </View>
                    )}
                </>
            )}
        </View>
    );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    card: {
        borderRadius: borderRadius.lg,
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        shadowColor: '#000',
        shadowOpacity: 0.10,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },

    // Title
    titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    accent: { width: 4, height: 16, borderRadius: 2, marginRight: 8 },
    title: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },

    // Time range
    rangeRow: {
        flexDirection: 'row',
        borderRadius: borderRadius.md,
        padding: 3,
        marginBottom: spacing.sm,
        alignSelf: 'flex-start',
    },
    rangeBtn: {
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 5,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    rangeTxt: { fontSize: 12, fontWeight: '700' },

    // Stats
    statsRow: {
        flexDirection: 'row',
        borderRadius: borderRadius.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        marginBottom: spacing.xs,
        alignItems: 'center',
    },
    statGroup: { flex: 1 },
    statGroupLabel: { fontSize: 10, fontWeight: '800', marginBottom: 4 },
    statCells: { flexDirection: 'row' },
    statCell: { flex: 1, alignItems: 'center' },
    statCellCenter: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#33333344' },
    statCellPts: { borderLeftWidth: 1, borderColor: '#33333344' },
    statVal: { fontSize: 16, fontWeight: '800' },
    statLbl: { fontSize: 9, marginTop: 1 },
    divider: { width: 1, alignSelf: 'stretch', marginHorizontal: spacing.xs },

    // Empty
    empty: { height: 80, alignItems: 'center', justifyContent: 'center' },
    emptyTxt: { fontSize: 13, textAlign: 'center', opacity: 0.7 },

    // BP Legend
    bpLegend: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.md,
        marginTop: 2,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendLine: { width: 14, height: 2, borderRadius: 1, opacity: 0.6 },
    legendTxt: { fontSize: 10 },
});
