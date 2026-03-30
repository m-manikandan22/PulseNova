
/**
 * Pulse Nova
 * Cardiovascular Trend Monitoring App (Local-Only)
 *
 * Architecture:
 * - DeviceProvider (Global BLE Connection)
 * - RootNavigator (State-Based Navigation)
 */

import React from 'react';
import { StatusBar, Platform, PermissionsAndroid, View, ActivityIndicator, LogBox } from 'react-native';

// Suppress all LogBox popups on the device UI (logs still appear in Metro console)
LogBox.ignoreAllLogs(true);
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DeviceProvider } from './src/contexts/DeviceContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import Database from './src/database/db';

const requestPermissions = async () => {
    if (Platform.OS === 'android') {
        const apiLevel = Platform.Version;
        if (apiLevel >= 31) {
            await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            ]);
        } else {
            await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
            ]);
        }
    }
};

const App: React.FC = () => {
    const [dbReady, setDbReady] = React.useState(false);

    React.useEffect(() => {
        // ── Eager DB init: runs BEFORE any provider mounts ──
        const initDb = async () => {
            console.log('App: Database.initialize() starting...');
            try {
                await Database.initialize();
                console.log('App: Database.initialize() complete');
            } catch (err) {
                console.error('App: Database.initialize() FAILED:', err);
            }
            setDbReady(true); // Always proceed — don't block app on DB failure
        };
        initDb();

        requestPermissions();
    }, []);

    // Block render until SQLite is open — shows a brief spinner on first launch / after data clear
    console.log('App: render - dbReady=' + dbReady);
    if (!dbReady) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A1A' }}>
                <ActivityIndicator size="large" color="#6C63FF" />
            </View>
        );
    }

    return (
        <SafeAreaProvider>
            <DeviceProvider>
                <NavigationContainer>
                    <StatusBar barStyle="light-content" />
                    <RootNavigator />
                </NavigationContainer>
            </DeviceProvider>
        </SafeAreaProvider>
    );
};

export default App;
