/**
 * Root Navigator
 * Orchestrates navigation based on Device connection state
 * No auth required — app is fully local
 */

import React from 'react';
import { useDevice } from '../contexts/DeviceContext';
import { ConnectionScreen } from '../screens/ConnectionScreen';
import { AppNavigator } from './AppNavigator';
import { DEV_MODE } from '../core/constants';

export const RootNavigator: React.FC = () => {
    const { isConnected } = useDevice();

    // DEVICE CONNECTION CHECK (Skip in DEV_MODE)
    if (!DEV_MODE && !isConnected) {
        return <ConnectionScreen />;
    }

    // MAIN APP
    return <AppNavigator />;
};
