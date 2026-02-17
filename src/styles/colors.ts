/**
 * Color Palette
 * Medical-style colors with dark mode support
 */

export const Colors = {
    // Risk levels
    risk: {
        low: '#10B981',      // Green
        moderate: '#F59E0B', // Amber
        elevated: '#EF4444', // Red
    },

    // Primary colors
    primary: {
        light: '#3B82F6',
        dark: '#60A5FA',
    },

    // Background
    background: {
        light: '#FFFFFF',
        dark: '#0F172A',
    },

    // Surface (cards, etc.)
    surface: {
        light: '#F8FAFC',
        dark: '#1E293B',
    },

    // Text
    text: {
        primary: {
            light: '#0F172A',
            dark: '#F1F5F9',
        },
        secondary: {
            light: '#64748B',
            dark: '#94A3B8',
        },
        tertiary: {
            light: '#94A3B8',
            dark: '#64748B',
        },
    },

    // Border
    border: {
        light: '#E2E8F0',
        dark: '#334155',
    },

    // Status
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // Battery
    battery: {
        high: '#10B981',
        medium: '#F59E0B',
        low: '#EF4444',
    },

    // Signal quality
    signal: {
        good: '#10B981',
        fair: '#F59E0B',
        poor: '#EF4444',
    },

    // Chart colors
    chart: {
        hr: '#EF4444',
        bp: '#3B82F6',
        hrv: '#10B981',
        grid: {
            light: '#E2E8F0',
            dark: '#334155',
        },
    },
};

export type ColorScheme = 'light' | 'dark';

/**
 * Get color based on current theme
 */
export function getThemedColor(
    colorPath: any,
    theme: ColorScheme
): string {
    if (typeof colorPath === 'string') {
        return colorPath;
    }
    return colorPath[theme] || colorPath.light;
}
