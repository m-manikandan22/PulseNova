/**
 * Connection Screen
 * BLE device scanning and connection
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    useColorScheme,
    Alert,
} from 'react-native';
import { Colors } from '../styles/colors';
import { spacing, typography, borderRadius, shadows } from '../styles/theme';
import { DEV_MODE } from '../core/constants';
import BleManager from '../ble/BleManager';
import DataSyncService from '../services/DataSyncService';
import { ConnectionStatus, DeviceInfo, HealthReading } from '../ble/types';
import { useDevice } from '../contexts/DeviceContext';
import { SignalIcon, BatteryIcon } from '../components/SVGIcons';


export const ConnectionScreen: React.FC = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const {
        connectionStatus,
        connectToDevice,
        scanForDevices,
        connectedDevice,
        error: contextError
    } = useDevice();

    const [devices, setDevices] = useState<DeviceInfo[]>([]);
    const [scanning, setScanning] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);
    const [liveReading, setLiveReading] = useState<HealthReading | null>(null);

    // Combine errors
    const displayError = localError || contextError;

    // Subscribe to live readings for device health panel
    useEffect(() => {
        DataSyncService.onDataUpdate((reading) => {
            setLiveReading(reading);
        });
    }, []);

    const handleScan = async () => {
        // DEV MODE: Skip BLE scanning
        if (DEV_MODE) {
            Alert.alert(
                'Dev Mode Active',
                'BLE scanning is disabled in development mode. To enable scanning, set DEV_MODE = false in src/core/constants.ts',
                [{ text: 'OK' }]
            );
            return;
        }

        setScanning(true);
        setLocalError(null);
        setDevices([]);

        try {
            const foundDevices = await scanForDevices();
            setDevices(foundDevices);

            if (foundDevices.length === 0) {
                setLocalError('No PulseNova devices found');
            }
        } catch (err: any) {
            setLocalError('Scan failed. Please try again.');
        } finally {
            setScanning(false);
        }
    };

    const handleConnect = async (deviceId: string) => {
        setLocalError(null);
        // Connect logic is handled by context. 
        // Navigation will automatically happen when status becomes READY in RootNavigator.
        await connectToDevice(deviceId);
    };

    const renderDevice = ({ item }: { item: DeviceInfo }) => (
        <TouchableOpacity
            style={[
                styles.deviceCard,
                isDark ? styles.deviceCardDark : styles.deviceCardLight,
                shadows.md,
            ]}
            onPress={() => handleConnect(item.id)}
            disabled={connectionStatus === ConnectionStatus.CONNECTING}
        >
            <View style={styles.deviceInfo}>
                <Text style={[
                    styles.deviceName,
                    isDark ? styles.deviceNameDark : styles.deviceNameLight,
                ]}>
                    {item.name || 'Unknown Device'}
                </Text>
                <Text style={[
                    styles.deviceId,
                    isDark ? styles.deviceIdDark : styles.deviceIdLight,
                ]}>
                    Signal: {item.rssi ? `${item.rssi} dBm` : 'Unknown'}
                </Text>
            </View>
            <Text style={styles.connectIcon}>→</Text>
        </TouchableOpacity>
    );

    return (
        <View style={[
            styles.container,
            isDark ? styles.containerDark : styles.containerLight,
        ]}>
            <View style={styles.header}>
                <Text style={[
                    styles.title,
                    isDark ? styles.titleDark : styles.titleLight,
                ]}>
                    Connect to PulseNova
                </Text>
                <Text style={[
                    styles.subtitle,
                    isDark ? styles.subtitleDark : styles.subtitleLight,
                ]}>
                    Make sure your device is powered on and nearby
                </Text>
            </View>

            {displayError && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{displayError}</Text>
                </View>
            )}

            {connectionStatus === ConnectionStatus.CONNECTING && (
                <View style={styles.statusContainer}>
                    <ActivityIndicator size="large" color={Colors.primary.dark} />
                    <Text style={[
                        styles.statusText,
                        isDark ? styles.statusTextDark : styles.statusTextLight,
                    ]}>
                        Connecting...
                    </Text>
                </View>
            )}

            <TouchableOpacity
                style={[
                    styles.scanButton,
                    scanning && styles.scanButtonDisabled,
                ]}
                onPress={handleScan}
                disabled={scanning || connectionStatus === ConnectionStatus.CONNECTING}
            >
                {scanning ? (
                    <ActivityIndicator color="#FFFFFF" />
                ) : (
                    <Text style={styles.scanButtonText}>
                        {devices.length > 0 ? 'Scan Again' : 'Scan for Devices'}
                    </Text>
                )}
            </TouchableOpacity>

            <FlatList
                data={devices}
                renderItem={renderDevice}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.deviceList}
                ListEmptyComponent={
                    !scanning && devices.length === 0 ? (
                        <Text style={[
                            styles.emptyText,
                            isDark ? styles.emptyTextDark : styles.emptyTextLight,
                        ]}>
                            {displayError ? '' : 'Tap "Scan for Devices" to begin'}
                        </Text>
                    ) : null
                }
            />
            {/* Device Health Panel — shown when connected */}
            {connectedDevice && (
                <View style={[styles.healthPanel, isDark ? styles.healthPanelDark : styles.healthPanelLight]}>
                    <View style={styles.healthTitleRow}>
                        <SignalIcon color={isDark ? '#AAA' : '#666'} size={18} />
                        <Text style={[styles.healthTitle, isDark ? styles.titleDark : styles.titleLight]}>
                            Device Health
                        </Text>
                    </View>

                    {/* Signal Strength */}
                    <View style={styles.healthRow}>
                        <Text style={[styles.healthLabel, isDark ? styles.subtitleDark : styles.subtitleLight]}>Signal Strength</Text>
                        <View style={styles.healthRight}>
                            {(() => {
                                const rssi = connectedDevice.rssi ?? -90;
                                const pct = Math.max(0, Math.min(100, ((rssi + 100) / 60) * 100));
                                const color = pct > 70 ? '#32CD32' : pct > 40 ? '#FFA500' : '#FF4444';
                                const label = pct > 70 ? 'Good' : pct > 40 ? 'Fair' : 'Weak';
                                return (
                                    <>
                                        <View style={styles.barBg}>
                                            <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                                        </View>
                                        <Text style={[styles.healthValue, { color }]}>{rssi} dBm  {label}</Text>
                                    </>
                                );
                            })()}
                        </View>
                    </View>

                    {/* Packet Integrity */}
                    <View style={styles.healthRow}>
                        <Text style={[styles.healthLabel, isDark ? styles.subtitleDark : styles.subtitleLight]}>Packet Integrity</Text>
                        <View style={styles.healthRight}>
                            {(() => {
                                const conf = liveReading?.conf ?? 1;
                                const pct = Math.round(conf * 100);
                                const color = pct >= 90 ? '#32CD32' : pct >= 70 ? '#FFA500' : '#FF4444';
                                const label = pct >= 90 ? 'Excellent' : pct >= 70 ? 'Good' : 'Poor';
                                return (
                                    <>
                                        <View style={styles.barBg}>
                                            <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                                        </View>
                                        <Text style={[styles.healthValue, { color }]}>{pct}%  {label}</Text>
                                    </>
                                );
                            })()}
                        </View>
                    </View>

                    {/* Battery */}
                    <View style={styles.healthRow}>
                        <Text style={[styles.healthLabel, isDark ? styles.subtitleDark : styles.subtitleLight]}>Battery</Text>
                        <View style={styles.healthRight}>
                            {(() => {
                                const bat = liveReading?.bat ?? 100;
                                const color = bat > 50 ? '#32CD32' : bat > 20 ? '#FFA500' : '#FF4444';
                                const label = bat > 50 ? 'Normal' : bat > 20 ? 'Low' : 'Critical';
                                return (
                                    <>
                                        <View style={styles.barBg}>
                                            <View style={[styles.barFill, { width: `${bat}%` as any, backgroundColor: color }]} />
                                        </View>
                                        <Text style={[styles.healthValue, { color }]}>{bat}%  {label}</Text>
                                    </>
                                );
                            })()}
                        </View>
                    </View>

                    {/* Sensor Quality */}
                    <View style={styles.healthRow}>
                        <Text style={[styles.healthLabel, isDark ? styles.subtitleDark : styles.subtitleLight]}>Sensor Quality</Text>
                        <View style={styles.healthRight}>
                            {(() => {
                                const motion = liveReading?.motion ?? 0;
                                const conf = liveReading?.conf ?? 1;
                                const quality = motion === 1 ? 'Motion Noise' : conf >= 0.8 ? 'Excellent' : conf >= 0.6 ? 'Good' : 'Poor';
                                const color = motion === 1 ? '#FFA500' : conf >= 0.8 ? '#32CD32' : conf >= 0.6 ? '#FFD700' : '#FF4444';
                                const pct = motion === 1 ? 50 : Math.round(conf * 100);
                                return (
                                    <>
                                        <View style={styles.barBg}>
                                            <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                                        </View>
                                        <Text style={[styles.healthValue, { color }]}>{quality}</Text>
                                    </>
                                );
                            })()}
                        </View>
                    </View>
                </View>
            )}

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: spacing.lg,
    },
    containerLight: {
        backgroundColor: Colors.background.light,
    },
    containerDark: {
        backgroundColor: Colors.background.dark,
    },
    header: {
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        marginBottom: spacing.xs,
    },
    titleLight: {
        color: Colors.text.primary.light,
    },
    titleDark: {
        color: Colors.text.primary.dark,
    },
    subtitle: {
        fontSize: typography.sizes.md,
    },
    subtitleLight: {
        color: Colors.text.secondary.light,
    },
    subtitleDark: {
        color: Colors.text.secondary.dark,
    },
    errorContainer: {
        backgroundColor: Colors.error + '20',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
    },
    errorText: {
        color: Colors.error,
        fontSize: typography.sizes.sm,
    },
    statusContainer: {
        alignItems: 'center',
        padding: spacing.xl,
    },
    statusText: {
        marginTop: spacing.md,
        fontSize: typography.sizes.md,
    },
    statusTextLight: {
        color: Colors.text.secondary.light,
    },
    statusTextDark: {
        color: Colors.text.secondary.dark,
    },
    scanButton: {
        backgroundColor: Colors.primary.dark,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    scanButtonDisabled: {
        opacity: 0.5,
    },
    scanButtonText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
    },
    deviceList: {
        gap: spacing.md,
    },
    deviceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
    },
    deviceCardLight: {
        backgroundColor: Colors.surface.light,
    },
    deviceCardDark: {
        backgroundColor: Colors.surface.dark,
    },
    deviceInfo: {
        flex: 1,
    },
    deviceName: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        marginBottom: spacing.xs,
    },
    deviceNameLight: {
        color: Colors.text.primary.light,
    },
    deviceNameDark: {
        color: Colors.text.primary.dark,
    },
    deviceId: {
        fontSize: typography.sizes.sm,
    },
    deviceIdLight: {
        color: Colors.text.secondary.light,
    },
    deviceIdDark: {
        color: Colors.text.secondary.dark,
    },
    connectIcon: {
        fontSize: typography.sizes.xl,
        color: Colors.primary.dark,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: typography.sizes.md,
        marginTop: spacing.xl,
    },
    emptyTextLight: {
        color: Colors.text.tertiary.light,
    },
    emptyTextDark: {
        color: Colors.text.tertiary.dark,
    },

    // Device Health Panel
    healthPanel: {
        marginTop: spacing.lg,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        gap: spacing.md,
    },
    healthPanelLight: {
        backgroundColor: Colors.surface.light,
    },
    healthPanelDark: {
        backgroundColor: Colors.surface.dark,
    },
    healthTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        marginBottom: spacing.xs,
    },
    healthTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    healthRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    healthLabel: {
        fontSize: typography.sizes.sm,
        width: 110,
    },
    healthRight: {
        flex: 1,
        gap: 4,
    },
    barBg: {
        height: 6,
        backgroundColor: '#E0E0E0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    barFill: {
        height: 6,
        borderRadius: 3,
    },
    healthValue: {
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.medium,
    },
});
