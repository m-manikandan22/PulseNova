/**
 * BLE Data Types
 */

export enum BPCategory {
    NORMAL = 'NORMAL',
    ELEVATED = 'ELEVATED',
    STAGE_1 = 'STAGE_1',
    STAGE_2 = 'STAGE_2',
    CRISIS = 'CRISIS'
}

export enum RiskLevel {
    LOW = 'LOW',
    MODERATE = 'MODERATE',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL'
}

export interface HealthReading {
    hr: number;           // Heart rate (bpm)
    hrv: number;          // Heart rate variability (ms)
    bp_sys: number;       // Systolic BP trend
    bp_dia: number;       // Diastolic BP trend
    conf: number;         // Confidence score (0-1)
    motion: number;       // Motion artifact flag (0 or 1)
    bat: number;          // Battery percentage (0-100)

    // Derived/Clinical Metrics
    bp_category?: BPCategory;
    risk_level?: RiskLevel;
    irregular_beat?: boolean;
}

export interface StoredReading extends HealthReading {
    id?: number;
    timestamp: number;    // Unix timestamp
}

export interface Baseline {
    avg_resting_hr: number;
    avg_hrv: number;
    avg_bp_sys: number;
    avg_bp_dia: number;
    baseline_start_date: number;
}

export interface RiskAssessment {
    score: number;        // 0-100
    category: RiskLevel;
    explanation: string;
    suggestion: string;
    bpClassification?: {
        stage: BPCategory;
        label: string;
        color: string;
    };
}

export enum ConnectionStatus {
    DISCONNECTED = 'DISCONNECTED',
    SCANNING = 'SCANNING',
    CONNECTING = 'CONNECTING',
    CONNECTED = 'CONNECTED',
    READY = 'READY',
}

export interface DeviceInfo {
    id: string;
    name: string | null;
    rssi: number | null;
}

