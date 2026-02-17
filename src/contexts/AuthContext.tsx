/**
 * Auth Context
 * Manages authentication state via AuthService
 */

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AuthService from '../services/AuthService';
import SyncService from '../services/SyncService';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
    session: Session | null;
    profile: { full_name: string; age: number; gender: string } | null;
    isLoading: boolean;
    signInWithEmail: (email: string) => Promise<{ error: any }>;
    signInWithPhone: (phone: string) => Promise<{ error: any }>;
    verifyOtp: (target: string, token: string, type: 'email' | 'sms' | 'signup' | 'recovery' | 'magiclink') => Promise<{ error: any; session?: Session | null }>;
    signUpWithPassword: (email: string, password: string, data: { full_name: string; age: number; gender: string }) => Promise<{ error: any; user: any }>;
    signInWithPassword: (email: string, password: string) => Promise<{ error: any; user: any }>;
    resetPasswordForEmail: (email: string) => Promise<{ error: any }>;
    updatePassword: (newPassword: string) => Promise<{ error: any }>;
    updateProfile: (updates: { full_name: string; age: number; gender: string }) => Promise<{ error: any }>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<{ full_name: string; age: number; gender: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Initial load
        AuthService.getSession().then((sess) => {
            setSession(sess);
            if (sess) {
                AuthService.getProfile().then(p => setProfile(p.data));
            }
            setIsLoading(false);
        });

        // Listen for changes
        AuthService.onAuthStateChange(async (sess) => {
            setSession(sess);
            if (sess) {
                const { data } = await AuthService.getProfile();
                if (data) setProfile(data);
                // No error logging - getProfile returns null error for new users

                // 🔥 Trigger Data Sync on Login/App Open
                SyncService.syncData();
            } else {
                setProfile(null);
            }
        });
    }, []);

    const signInWithEmail = async (email: string) => {
        return await AuthService.signInWithEmail(email);
    };

    const signInWithPhone = async (phone: string) => {
        return await AuthService.signInWithPhone(phone);
    };

    const verifyOtp = async (target: string, token: string, type: 'email' | 'sms' | 'signup' | 'recovery' | 'magiclink') => {
        const { session: newSession, error } = await AuthService.verifyOtp(target, token, type);

        if (newSession && !error) {
            setSession(newSession);
            // 🔥 Load profile immediately after verification
            const { data } = await AuthService.getProfile();
            if (data) setProfile(data);
            // No error logging - profile may not exist yet for new signups
        }

        return { error, session: newSession };
    };

    const signUpWithPassword = async (email: string, password: string, data: { full_name: string; age: number; gender: string }) => {
        return await AuthService.signUpWithPassword(email, password, data);
    };

    const signInWithPassword = async (email: string, password: string) => {
        const result = await AuthService.signInWithPassword(email, password);
        if (result.user && !result.error) {
            // Fetch profile on login
            const { data } = await AuthService.getProfile();
            setProfile(data);
        }
        return result;
    };

    const resetPasswordForEmail = async (email: string) => {
        return await AuthService.resetPasswordForEmail(email);
    };

    const updatePassword = async (newPassword: string) => {
        return await AuthService.updatePassword(newPassword);
    };

    const signOut = async () => {
        await AuthService.signOut();
        setSession(null);
        setProfile(null);
    };

    const updateProfile = async (updates: { full_name: string; age: number; gender: string }) => {
        return await AuthService.updateProfile(updates);
    };

    const refreshProfile = async () => {
        const { data } = await AuthService.getProfile();
        if (data) setProfile(data);
    };

    return (
        <AuthContext.Provider value={{
            session,
            profile,
            isLoading,
            signInWithEmail,
            signInWithPhone,
            verifyOtp,
            signUpWithPassword,
            signInWithPassword,
            resetPasswordForEmail,
            updatePassword,
            updateProfile,
            signOut,
            refreshProfile,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
