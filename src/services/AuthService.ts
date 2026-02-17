/**
 * Auth Service
 * Wrapper for Supabase Authentication
 */

import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../core/constants';
import 'react-native-url-polyfill/auto'; // Supabase requires this in RN

// Initialize Supabase if keys are present, otherwise acts as mock
let supabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            storage: {
                getItem: (key) => Promise.resolve(null), // TODO: Implement AsyncStorage
                setItem: (key, value) => Promise.resolve(),
                removeItem: (key) => Promise.resolve(),
            },
            persistSession: true,
            detectSessionInUrl: false,
        },
    });
} else {
    console.log('Supabase keys missing or placeholders. Running in Mock Mode.');
}

class AuthService {
    /**
     * Expose Raw Client for other services (Sync, etc.)
     */
    getClient(): SupabaseClient | null {
        return supabase;
    }

    /**
     * Sign in with Email (Magic Link or OTP)
     */
    async signInWithEmail(email: string): Promise<{ error: any }> {
        if (!supabase) return this.mockSignIn();

        const { error } = await supabase.auth.signInWithOtp({
            email,
        });
        return { error };
    }

    /**
     * Sign in with Phone (OTP)
     */
    async signInWithPhone(phone: string): Promise<{ error: any }> {
        if (!supabase) return this.mockSignIn();

        const { error } = await supabase.auth.signInWithOtp({
            phone,
        });
        return { error };
    }

    /**
     * Verify OTP
     */
    async verifyOtp(emailOrPhone: string, token: string, type: 'email' | 'sms' | 'signup' | 'recovery' | 'magiclink'): Promise<{ session: Session | null; error: any }> {
        if (!supabase) return this.mockVerify();

        let params: any = {
            token,
            type: type as any,
        };

        if (type === 'sms' || /^\+?\d+$/.test(emailOrPhone)) {
            params.phone = emailOrPhone;
        } else {
            params.email = emailOrPhone;
        }

        const { data, error } = await supabase.auth.verifyOtp(params);

        return { session: data.session, error };
    }

    /**
     * Sign Out
     */
    async signOut(): Promise<{ error: any }> {
        if (!supabase) return { error: null };
        const { error } = await supabase.auth.signOut();
        return { error };
    }

    /**
     * Get Session
     */
    async getSession(): Promise<Session | null> {
        if (!supabase) return null;
        const { data } = await supabase.auth.getSession();
        return data.session;
    }


    /**
     * Sign Up with Email & Password
     */
    async signUpWithPassword(email: string, password: string, data: { full_name: string; age: number; gender: string }): Promise<{ error: any; user: any }> {
        if (!supabase) return { error: null, user: { id: 'mock', email } };

        const { data: authData, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data, // Meta data: full_name, age, gender
            },
        });

        // Improved existing user detection
        // Supabase returns success with empty identities array for existing users
        if (authData.user && authData.user.identities && authData.user.identities.length === 0) {
            return {
                error: { message: 'An account with this email already exists. Please try logging in instead.' },
                user: null
            };
        }

        return { error, user: authData.user };
    }

    /**
     * Sign In with Email & Password
     */
    async signInWithPassword(email: string, password: string): Promise<{ error: any; user: any }> {
        if (!supabase) return { error: null, user: { id: 'mock', email } };

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { error, user: data.user };
    }

    /**
     * Send Password Reset Email
     */
    async resetPasswordForEmail(email: string): Promise<{ error: any }> {
        if (!supabase) return { error: null };

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'pulsenova://auth/update-password', // Deep link to app
        });
        return { error };
    }

    /**
     * Update Password (after reset or logged in)
     */
    async updatePassword(newPassword: string): Promise<{ error: any }> {
        if (!supabase) return { error: null };

        const { error } = await supabase.auth.updateUser({
            password: newPassword,
        });
        return { error };
    }

    /**
     * Handle Deep Link (Magic Link or Password Reset)
     */
    async handleDeepLink(url: string): Promise<void> {
        if (!supabase || !url) return;

        try {
            // Extract query/hash params
            const urlObj = new URL(url);
            const params = new URLSearchParams(urlObj.hash.replace(/^#/, ''));

            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const type = params.get('type'); // recovery, signup, etc.

            if (accessToken && refreshToken) {
                await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                console.log('Session set via Deep Link. Type:', type);
            }
        } catch (error) {
            console.log('Error parsing deep link:', error);
        }
    }

    /**
     * Get User Profile
     * Fetches from public.user_profiles or falls back to metadata
     */
    async getProfile(): Promise<{ data: any; error: any }> {
        if (!supabase) return { data: null, error: null };

        // 1. Try to get from public.user_profiles
        const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('*')
            .single();

        // PGRST116 = "The result contains 0 rows" - This is expected for new users
        // Only log if it's a different error
        if (error && error.code !== 'PGRST116') {
            console.warn('Error fetching profile table:', error);
        }

        if (profile) return { data: profile, error: null };

        // 2. Fallback to Auth Metadata (if table is empty)
        const session = await this.getSession();
        if (session?.user?.user_metadata) {
            return {
                data: {
                    id: session.user.id,
                    full_name: session.user.user_metadata.full_name,
                    age: session.user.user_metadata.age,
                    gender: session.user.user_metadata.gender,
                },
                error: null
            };
        }

        // Return null without error for new users (PGRST116 case)
        return { data: null, error: null };
    }

    /**
     * Update User Profile
     * Updates both Auth Metadata AND public.user_profiles
     */
    async updateProfile(updates: { full_name: string; age: number; gender: string }): Promise<{ error: any }> {
        if (!supabase) return { error: null };

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { error: { message: 'No user logged in' } };

            // 1. Update Auth Metadata
            const { error: authError } = await supabase.auth.updateUser({
                data: updates
            });
            if (authError) throw authError;

            // 2. Update/Insert public.user_profiles
            const { error: dbError } = await supabase
                .from('user_profiles')
                .upsert({
                    id: user.id,
                    ...updates
                });

            if (dbError) throw dbError;

            return { error: null };
        } catch (error) {
            console.error('Update profile failed:', error);
            return { error };
        }
    }

    /**
     * Listen to Auth Changes
     */
    onAuthStateChange(callback: (session: Session | null) => void): void {
        if (!supabase) return;
        supabase.auth.onAuthStateChange((_event, session) => {
            callback(session);
        });
    }

    // --- Mocks for Development without Keys ---
    private async mockSignIn() {
        console.log('Mock: Sending OTP...');
        await new Promise(r => setTimeout(r, 1000));
        return { error: null };
    }

    private async mockVerify() {
        console.log('Mock: Verifying OTP...');
        await new Promise(r => setTimeout(r, 1000));
        return {
            session: {
                access_token: 'mock-token',
                refresh_token: 'mock-refresh',
                expires_in: 3600,
                token_type: 'bearer',
                user: { id: 'mock-user-id', email: 'test@pulsenova.com' }
            } as any,
            error: null
        };
    }
}

export default new AuthService();
