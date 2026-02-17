/**
 * Root Navigator
 * Orchestrates navigation based on Global State (Auth + Device)
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../contexts/DeviceContext';
import { ConnectionScreen } from '../screens/ConnectionScreen';
import { AppNavigator } from './AppNavigator';

import { AuthNavigator } from './AuthNavigator';

// Placeholder for AuthStack removed
// const AuthStack = ...

export const RootNavigator: React.FC = () => {
    const { session, isLoading: authLoading } = useAuth();
    const { isConnected } = useDevice();

    if (authLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // AUTH CHECK: Gatekeeper
    if (!session) {
        return <AuthNavigator />;
    }

    // DEVICE CONNECTION CHECK
    if (!isConnected) {
        return <ConnectionScreen />;
    }

    // MAIN APP
    return <AppNavigator />;
};

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
