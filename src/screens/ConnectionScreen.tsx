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
} from 'react-native';
import { Colors } from '../styles/colors';
import { spacing, typography, borderRadius, shadows } from '../styles/theme';
import BleManager from '../ble/BleManager';
import { ConnectionStatus, DeviceInfo } from '../ble/types';
import { useDevice } from '../contexts/DeviceContext';


export const ConnectionScreen: React.FC = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const {
        connectionStatus,
        connectToDevice,
        scanForDevices,
        error: contextError
    } = useDevice();

    const [devices, setDevices] = useState<DeviceInfo[]>([]);
    const [scanning, setScanning] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    // Combine errors
    const displayError = localError || contextError;

    const handleScan = async () => {
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
});
