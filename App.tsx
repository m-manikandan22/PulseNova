
/**
 * Pulse Nova
 * Cardiovascular Trend Monitoring App
 * 
 * Architecture:
 * - AuthProvider (Global Authentication)
 * - DeviceProvider (Global BLE Connection)
 * - RootNavigator (State-Based Navigation)
 */

import React from 'react';
import { StatusBar, Platform, PermissionsAndroid } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { DeviceProvider } from './src/contexts/DeviceContext';
import { RootNavigator } from './src/navigation/RootNavigator';

const App: React.FC = () => {

    // Permissions logic wrapped in effect usually, or handled inside DeviceContext init.
    // Keeping it here for now or moving to DeviceContext?
    // User asked for "Complete code for Updated App.tsx".
    // Best practice is to request permissions early.

    React.useEffect(() => {
        requestPermissions();

        // Deep Linking Listener for Magic Link
        const handleDeepLink = ({ url }: { url: string }) => {
            if (url) {
                // Import Dynamically or move AuthService to global if needed
                // But App.tsx imports AuthService via AuthProvider... 
                // Wait, AuthProvider uses AuthService, but we can't access it here easily unless we import it directly.
                // We'll import AuthService directly.
                require('./src/services/AuthService').default.handleDeepLink(url);
            }
        };

        const linkingSubscription = require('react-native').Linking.addEventListener('url', handleDeepLink);

        // Check initial URL
        require('react-native').Linking.getInitialURL().then((url: string | null) => {
            if (url) handleDeepLink({ url });
        });

        return () => {
            linkingSubscription.remove();
        };
    }, []);

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

    return (
        <SafeAreaProvider>
            <AuthProvider>
                <DeviceProvider>
                    <NavigationContainer>
                        <StatusBar barStyle="light-content" />
                        <RootNavigator />
                    </NavigationContainer>
                </DeviceProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
};

export default App;
