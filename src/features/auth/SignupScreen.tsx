
/**
 * Signup Screen
 * Registers new users with full profile
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../styles/colors';
import { spacing, typography, borderRadius } from '../../styles/theme';

export const SignupScreen: React.FC = () => {
    const { signUpWithPassword, verifyOtp } = useAuth();
    const navigation = useNavigation();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [form, setForm] = useState({
        full_name: '',
        age: '',
        gender: '',
        email: '',
        password: '',
        confirm_password: '',
    });
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState<'DETAILS' | 'OTP'>('DETAILS');
    const [loading, setLoading] = useState(false);

    const updateForm = (key: string, value: string) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleSignup = async () => {
        // Validation
        if (!form.full_name || !form.age || !form.gender || !form.email || !form.password) {
            Alert.alert('Error', 'Please fill all fields');
            return;
        }
        if (form.password !== form.confirm_password) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }
        if (form.password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            const { error, user } = await signUpWithPassword(form.email, form.password, {
                full_name: form.full_name,
                age: parseInt(form.age, 10),
                gender: form.gender,
            });

            if (error) throw error;

            // Move to OTP step
            setStep('OTP');
            Alert.alert('Account Created', 'Please check your email for the verification code.');
        } catch (err: any) {
            if (err.message && (err.message.includes('already registered') || err.message.includes('exists'))) {
                Alert.alert(
                    'Account Exists',
                    'An account with this email already exists. Would you like to log in instead?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Login', onPress: () => navigation.navigate('Login' as never) }
                    ]
                );
            } else {
                Alert.alert('Signup Failed', err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        if (!otp) {
            Alert.alert('Error', 'Please enter the verification code');
            return;
        }

        setLoading(true);
        try {
            // 1. Verify OTP
            const { error, session } = await verifyOtp(form.email, otp, 'signup');
            if (error) throw error;

            // 2. Create Profile (Now that we have a verified user)
            if (session?.user) {
                const { updateProfile } = useAuth();
                const { error: profileError } = await updateProfile({
                    full_name: form.full_name,
                    age: parseInt(form.age, 10),
                    gender: form.gender,
                });
                if (profileError) {
                    console.warn('Profile creation warning:', profileError);
                    Alert.alert('Warning', 'Account verified but profile creation had issues. You can update it later in Settings.');
                } else {
                    Alert.alert(
                        'Success',
                        'Your account has been verified and profile created!',
                        [{ text: 'OK', onPress: () => navigation.navigate('Login' as never) }]
                    );
                }
            }
        } catch (err: any) {
            Alert.alert('Verification Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = [styles.input, isDark ? styles.inputDark : styles.inputLight];

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}
        >
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.title, isDark ? styles.textDark : styles.textLight]}>
                    {step === 'DETAILS' ? 'Create Account' : 'Verify Email'}
                </Text>

                {step === 'DETAILS' ? (
                    <>
                        <TextInput
                            style={inputStyle}
                            placeholder="Full Name"
                            placeholderTextColor={isDark ? '#888' : '#666'}
                            value={form.full_name}
                            onChangeText={t => updateForm('full_name', t)}
                        />

                        <View style={styles.row}>
                            <TextInput
                                style={[inputStyle, { flex: 1, marginRight: 10 }]}
                                placeholder="Age"
                                placeholderTextColor={isDark ? '#888' : '#666'}
                                value={form.age}
                                onChangeText={t => updateForm('age', t)}
                                keyboardType="number-pad"
                            />
                            <TextInput
                                style={[inputStyle, { flex: 1 }]}
                                placeholder="Gender (M/F)"
                                placeholderTextColor={isDark ? '#888' : '#666'}
                                value={form.gender}
                                onChangeText={t => updateForm('gender', t)}
                            />
                        </View>

                        <TextInput
                            style={inputStyle}
                            placeholder="Email"
                            placeholderTextColor={isDark ? '#888' : '#666'}
                            value={form.email}
                            onChangeText={t => updateForm('email', t)}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <TextInput
                            style={inputStyle}
                            placeholder="Password"
                            placeholderTextColor={isDark ? '#888' : '#666'}
                            value={form.password}
                            onChangeText={t => updateForm('password', t)}
                            secureTextEntry
                        />

                        <TextInput
                            style={inputStyle}
                            placeholder="Confirm Password"
                            placeholderTextColor={isDark ? '#888' : '#666'}
                            value={form.confirm_password}
                            onChangeText={t => updateForm('confirm_password', t)}
                            secureTextEntry
                        />

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleSignup}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Sign Up</Text>}
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Text style={[styles.subtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                            Enter the code sent to {form.email}
                        </Text>
                        <TextInput
                            style={inputStyle}
                            placeholder="Verification Code"
                            placeholderTextColor={isDark ? '#888' : '#666'}
                            value={otp}
                            onChangeText={setOtp}
                            keyboardType="number-pad"
                        />
                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleVerify}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Verify</Text>}
                        </TouchableOpacity>
                    </>
                )}

                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.linkText}>
                        {step === 'DETAILS' ? 'Already have an account? Login' : 'Cancel'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    containerLight: { backgroundColor: Colors.background.light },
    containerDark: { backgroundColor: Colors.background.dark },
    content: { padding: spacing.xl, justifyContent: 'center', flexGrow: 1 },
    title: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: typography.sizes.md,
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    textSecondaryLight: { color: Colors.text.secondary.light },
    textSecondaryDark: { color: Colors.text.secondary.dark },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    textLight: { color: Colors.text.primary.light },
    textDark: { color: Colors.text.primary.dark },
    input: {
        height: 50,
        borderWidth: 1,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.md,
        fontSize: typography.sizes.md,
    },
    inputLight: { borderColor: '#DDD', color: Colors.text.primary.light, backgroundColor: '#FFF' },
    inputDark: { borderColor: '#444', color: Colors.text.primary.dark, backgroundColor: '#222' },
    button: {
        height: 50,
        backgroundColor: Colors.primary.dark,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: spacing.md,
    },
    buttonText: { color: '#FFF', fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
    linkButton: { alignItems: 'center', padding: spacing.sm },
    linkText: { color: Colors.primary.dark, fontSize: typography.sizes.sm },
});
