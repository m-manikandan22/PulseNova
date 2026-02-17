/**
 * Packet Integrity Validation
 * Validates BLE packet integrity before storage
 */

import { HealthReading } from '../ble/types';

interface PacketMetadata {
    timestamp: number;
    sequenceNumber?: number;
}

class PacketIntegrityChecker {
    private lastPacketTime: number = 0;
    private lastSequenceNumber: number = -1;
    private duplicatePacketHashes: Set<string> = new Set();
    private readonly MAX_TIME_GAP_MS = 5000; // 5 seconds
    private readonly MIN_TIME_GAP_MS = 500; // 0.5 seconds

    /**
     * Validate packet integrity
     */
    validatePacket(reading: HealthReading, timestamp: number): {
        valid: boolean;
        reason?: string;
    } {
        // 1. Check for duplicate packets
        const packetHash = this.generatePacketHash(reading, timestamp);
        if (this.duplicatePacketHashes.has(packetHash)) {
            return { valid: false, reason: 'Duplicate packet detected' };
        }

        // 2. Validate timestamp gap
        if (this.lastPacketTime > 0) {
            const timeSinceLastPacket = timestamp - this.lastPacketTime;

            if (timeSinceLastPacket < this.MIN_TIME_GAP_MS) {
                return { valid: false, reason: 'Packets arriving too quickly' };
            }

            if (timeSinceLastPacket > this.MAX_TIME_GAP_MS) {
                console.warn(`Large time gap detected: ${timeSinceLastPacket}ms`);
                // Don't reject, but log for monitoring
            }
        }

        // 3. Validate timestamp is not in future
        const now = Date.now();
        if (timestamp > now + 1000) {
            return { valid: false, reason: 'Timestamp in future' };
        }

        // 4. Validate timestamp is not too old
        const oneHourAgo = now - 60 * 60 * 1000;
        if (timestamp < oneHourAgo) {
            return { valid: false, reason: 'Timestamp too old' };
        }

        // All checks passed
        this.lastPacketTime = timestamp;
        this.duplicatePacketHashes.add(packetHash);

        // Clean up old hashes (keep last 100)
        if (this.duplicatePacketHashes.size > 100) {
            const firstHash = this.duplicatePacketHashes.values().next().value;
            this.duplicatePacketHashes.delete(firstHash);
        }

        return { valid: true };
    }

    /**
     * Generate hash for duplicate detection
     */
    private generatePacketHash(reading: HealthReading, timestamp: number): string {
        return `${timestamp}-${reading.hr}-${reading.hrv}-${reading.bp_sys}-${reading.bp_dia}`;
    }

    /**
     * Reset checker state
     */
    reset(): void {
        this.lastPacketTime = 0;
        this.lastSequenceNumber = -1;
        this.duplicatePacketHashes.clear();
    }
}

export default new PacketIntegrityChecker();
