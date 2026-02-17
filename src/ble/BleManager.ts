/**
 * BLE Manager
 * Handles all Bluetooth Low Energy communication with ESP32-C3 device
 */

import { BleManager, Device, Characteristic, BleError } from 'react-native-ble-plx';
import { HealthReading, ConnectionStatus, DeviceInfo } from './types';
import { validateHealthReading } from '../utils/validation';
import { Buffer } from 'buffer';

const TARGET_SERVICE_UUID = '12345678-1234-1234-1234-1234567890ab';
const DEVICE_NAME_PREFIX = 'PulseNova';

type ConnectionCallback = (status: ConnectionStatus) => void;
type DataCallback = (reading: HealthReading) => void;
type ErrorCallback = (error: Error) => void;

class BLEManager {
    private manager: BleManager;
    private device: Device | null = null;
    private connectionCallback: ConnectionCallback | null = null;
    private dataCallback: DataCallback | null = null;
    private errorCallback: ErrorCallback | null = null;

    // UUIDs detected during connection
    private activeServiceUUID: string | null = null;
    private activeCharacteristicUUID: string | null = null;

    constructor() {
        this.manager = new BleManager();
    }

    /**
     * Initialize BLE manager
     */
    async initialize(): Promise<void> {
        const state = await this.manager.state();
        if (state !== 'PoweredOn') {
            // Depending on OS, might need to wait or trigger enable
            console.log('BLE State:', state);
        }
    }

    /**
     * Set callback for connection status changes
     */
    onConnectionChange(callback: ConnectionCallback): void {
        this.connectionCallback = callback;
    }

    /**
     * Set callback for incoming health data
     */
    onDataReceived(callback: DataCallback): void {
        this.dataCallback = callback;
    }

    /**
     * Set callback for errors
     */
    onError(callback: ErrorCallback): void {
        this.errorCallback = callback;
    }

    /**
     * Scan for PulseNova devices
     */
    async scanForDevices(timeout: number = 10000): Promise<DeviceInfo[]> {
        const devices: Map<string, DeviceInfo> = new Map();

        // Ensure state is clean before scan
        if (this.device) {
            console.warn('Scan called while device connected. Ignoring.');
            return [];
        }

        this.connectionCallback?.(ConnectionStatus.SCANNING);

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.manager.stopDeviceScan();
                resolve(Array.from(devices.values()));
            }, timeout);

            this.manager.startDeviceScan(null, null, (error, device) => {
                if (error) {
                    clearTimeout(timeoutId);
                    this.manager.stopDeviceScan();
                    this.errorCallback?.(error);
                    reject(error);
                    return;
                }

                if (device && device.name?.startsWith(DEVICE_NAME_PREFIX)) {
                    devices.set(device.id, {
                        id: device.id,
                        name: device.name,
                        rssi: device.rssi,
                    });
                }
            });
        });
    }

    /**
     * Connect to a specific device by ID
     */
    async connect(deviceId: string): Promise<void> {
        try {
            console.log(`Connecting to device: ${deviceId}`);
            this.connectionCallback?.(ConnectionStatus.CONNECTING);

            // Connect to device with higher MTU for stability
            this.device = await this.manager.connectToDevice(deviceId, {
                autoConnect: false,
                requestMTU: 512,
            });

            // Register disconnection listener IMMEDIATELY
            this.device.onDisconnected((error, device) => {
                this.handleDisconnection(error);
            });

            // Discover all services/characteristics
            await this.device.discoverAllServicesAndCharacteristics();

            // Validate and select the Correct Service
            await this.validateAndSelectService();

            this.connectionCallback?.(ConnectionStatus.CONNECTED);

            // Sync time to device
            await this.syncTime();

            // Subscribe to notifications
            await this.subscribeToNotifications();

            // Everything successful
            this.connectionCallback?.(ConnectionStatus.READY);

        } catch (error) {
            console.error('Connection failed:', error);
            this.errorCallback?.(error as Error);
            // Ensure we clean up if connection flow failed partway
            await this.disconnect();
            throw error;
        }
    }

    /**
     * Enforce finding the specific custom service.
     * Rejects generic services like 00001801.
     */
    private async validateAndSelectService(): Promise<void> {
        if (!this.device) throw new Error('No device connected');

        const services = await this.device.services();
        console.log('Discovered Services:', services.map(s => s.uuid));

        // Find the specific target service
        const targetService = services.find(s =>
            s.uuid.toLowerCase() === TARGET_SERVICE_UUID.toLowerCase()
        );

        if (!targetService) {
            throw new Error(`Device does not implement required service: ${TARGET_SERVICE_UUID}`);
        }

        console.log(`Found Target Service: ${targetService.uuid}`);

        // Find a usable characteristic in this service
        const characteristics = await targetService.characteristics();
        const validChar = characteristics.find(c => c.isNotifiable || c.isWritableWithoutResponse || c.isWritableWithResponse);

        if (!validChar) {
            throw new Error(`Service ${targetService.uuid} has no valid characteristics for data/control.`);
        }

        this.activeServiceUUID = targetService.uuid;
        this.activeCharacteristicUUID = validChar.uuid;
        console.log(`Selected Characteristic: ${this.activeCharacteristicUUID}`);
    }

    /**
     * Active Disconnect (User initiated or Cleanup)
     */
    async disconnect(): Promise<void> {
        if (this.device) {
            try {
                console.log('Disconnecting from device...');
                await this.manager.cancelDeviceConnection(this.device.id);
            } catch (error) {
                console.warn('Error during disconnect cancel:', error);
            }
        }
        // Force cleanup state
        this.cleanUpState();
    }

    /**
     * Internal state cleanup
     */
    private cleanUpState(): void {
        this.device = null;
        this.activeServiceUUID = null;
        this.activeCharacteristicUUID = null;
        this.connectionCallback?.(ConnectionStatus.DISCONNECTED);
    }

    /**
     * Handle involuntary disconnection
     */
    private handleDisconnection(error: BleError | null): void {
        console.log('Device Disconnected Event received');
        if (error) {
            console.warn('Disconnection error:', error);
        }

        // If we were connected, notify listener
        this.cleanUpState();
    }

    /**
     * Subscribe to notifications
     */
    private async subscribeToNotifications(): Promise<void> {
        if (!this.device || !this.activeServiceUUID || !this.activeCharacteristicUUID) {
            throw new Error('Cannot subscribe: Device state invalid');
        }

        this.device.monitorCharacteristicForService(
            this.activeServiceUUID,
            this.activeCharacteristicUUID,
            (error, characteristic) => {
                if (error) {
                    // Start of disconnection flow or actual error
                    console.warn('Monitor error:', error.message);
                    return;
                }

                if (characteristic?.value) {
                    this.handleIncomingData(characteristic);
                }
            }
        );
    }

    /**
     * Handle incoming BLE data
     */
    private handleIncomingData(characteristic: Characteristic): void {
        try {
            const jsonString = Buffer.from(characteristic.value!, 'base64').toString('utf-8');
            const data = JSON.parse(jsonString) as HealthReading;

            if (!validateHealthReading(data)) {
                console.warn('Dropping invalid reading');
                return;
            }

            this.dataCallback?.(data);

        } catch (error) {
            // Squelch parsing errors to avoid log spam on partial packets
            // console.debug('Parse error', error); 
        }
    }

    /**
     * Sync time
     */
    private async syncTime(): Promise<void> {
        if (!this.device || !this.activeServiceUUID || !this.activeCharacteristicUUID) return;

        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const payload = JSON.stringify({ time: timestamp });
            const base64 = Buffer.from(payload).toString('base64');

            await this.device.writeCharacteristicWithResponseForService(
                this.activeServiceUUID,
                this.activeCharacteristicUUID,
                base64
            );
            console.log('Time synced successfully');
        } catch (error) {
            console.warn('Time sync failed - continuing execution', error);
        }
    }

    /**
     * Get current connection status
     */
    isConnected(): boolean {
        return this.device !== null;
    }

    /**
     * Get connected device info
     */
    getDeviceInfo(): DeviceInfo | null {
        if (!this.device) return null;
        return {
            id: this.device.id,
            name: this.device.name,
            rssi: this.device.rssi
        };
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.manager.destroy();
    }
}

export default new BLEManager();
