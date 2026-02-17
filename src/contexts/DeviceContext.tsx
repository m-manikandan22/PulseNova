/**
 * Device Context
 * Manages global connection state, BLE lifecycle, and database coordination.
 */

import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import BleManager from '../ble/BleManager';
import Database from '../database/db';
import { ConnectionStatus, DeviceInfo } from '../ble/types';
import DataSyncService from '../services/DataSyncService';

interface DeviceContextType {
    isConnected: boolean;
    connectionStatus: ConnectionStatus;
    connectedDevice: DeviceInfo | null;
    connectToDevice: (deviceId: string) => Promise<void>;
    disconnectDevice: () => Promise<void>;
    scanForDevices: () => Promise<DeviceInfo[]>;
    error: string | null;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
    const [connectedDevice, setConnectedDevice] = useState<DeviceInfo | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Derived state
    const isConnected = connectionStatus === ConnectionStatus.READY;

    // Monitor BLE Manager updates
    useEffect(() => {
        BleManager.onConnectionChange((status) => {
            console.log('Context: Connection Status change:', status);
            setConnectionStatus(status);

            if (status === ConnectionStatus.DISCONNECTED) {
                setConnectedDevice(null);
                handleDisconnectCleanup();
            } else if (status === ConnectionStatus.READY) {
                setConnectedDevice(BleManager.getDeviceInfo());
            }
        });

        BleManager.onError((err) => {
            console.error('Context: BLE Error:', err);
            setError(err.message);
        });

        // Initial setup
        const init = async () => {
            await Database.initialize(); // Init DB on app launch safely
            await DataSyncService.initialize(); // Init Data Sync
            // Only BleManager initialization here
            // await BleManager.initialize(); // Already called in App or should be called here?
            // Let's call it here to be safe and self-contained
            try {
                await BleManager.initialize();
            } catch (e: any) {
                setError(e.message);
            }
        };
        init();

    }, []);

    // Cleanup logic when device disconnects
    const handleDisconnectCleanup = async () => {
        console.log('Cleaning up after disconnect...');
        // Close DB interactions if necessary, or just ensure no pending writes hang
        // Database.close() might be too aggressive if we want to view history while disconnected
        // For now, we just ensure no active polling happens (handled by Screens via isConnected)
    };

    const connectToDevice = async (deviceId: string) => {
        setError(null);
        try {
            await BleManager.connect(deviceId);
            // Database initialization for session could happen here if strict
        } catch (err: any) {
            setError(err.message || 'Connection Failed');
            // Ensure state reflects disconnect
            setConnectionStatus(ConnectionStatus.DISCONNECTED);
        }
    };

    const disconnectDevice = async () => {
        try {
            await BleManager.disconnect();
            // setConnectionStatus(ConnectionStatus.DISCONNECTED); // Handled by callback
        } catch (err: any) {
            setError(err.message);
        }
    };

    const scanForDevices = async () => {
        return await BleManager.scanForDevices();
    };

    return (
        <DeviceContext.Provider value={{
            isConnected,
            connectionStatus,
            connectedDevice,
            connectToDevice,
            disconnectDevice,
            scanForDevices,
            error
        }}>
            {children}
        </DeviceContext.Provider>
    );
};

export const useDevice = (): DeviceContextType => {
    const context = useContext(DeviceContext);
    if (context === undefined) {
        throw new Error('useDevice must be used within a DeviceProvider');
    }
    return context;
};
