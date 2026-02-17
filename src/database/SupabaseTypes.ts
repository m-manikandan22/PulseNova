/**
 * Supabase Database Definitions
 * Aligns with the SQL Schema provided.
 */

export interface CloudReading {
    id?: number;              // BIGSERIAL
    user_id: string;          // UUID
    timestamp: number;        // BIGINT
    hr: number;               // INTEGER
    hrv: number;              // INTEGER
    bp_sys: number;           // INTEGER
    bp_dia: number;           // INTEGER
    confidence: number;       // DOUBLE PRECISION
    motion: number;           // INTEGER
    battery: number;          // INTEGER
    created_at?: string;      // TIMESTAMPTZ
}

export interface CloudUserProfile {
    id: string;               // UUID
    full_name: string;        // TEXT
    age: number;              // INTEGER
    gender: string;           // TEXT
    created_at?: string;      // TIMESTAMPTZ
}

export type DatabaseTypes = {
    public: {
        Tables: {
            readings: {
                Row: CloudReading;
                Insert: Omit<CloudReading, 'id' | 'created_at'>;
                Update: Partial<Omit<CloudReading, 'id' | 'created_at'>>;
            };
            user_profiles: {
                Row: CloudUserProfile;
                Insert: CloudUserProfile;
                Update: Partial<CloudUserProfile>;
            };
        };
    };
};
