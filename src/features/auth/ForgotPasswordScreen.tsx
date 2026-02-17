
/**
 * Forgot Password Screen
 * Initiates password reset flow
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
    KeyboardAvoidingView,
    Platform,
    useColorScheme,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../styles/colors';
import { spacing, typography, borderRadius } from '../../styles/theme';

export const ForgotPasswordScreen: React.FC = () => {
    const { resetPasswordForEmail, verifyOtp, updatePassword } = useAuth();
    const navigation = useNavigation();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [step, setStep] = useState<'EMAIL' | 'OTP_NEW_PASSWORD'>('EMAIL');
    const [loading, setLoading] = useState(false);

    const handleResetRequest = async () => {
        if (!email) {
            Alert.alert('Error', 'Please enter your email');
            return;
        }

        setLoading(true);
        try {
            const { error } = await resetPasswordForEmail(email);
            if (error) throw error;

            Alert.alert(
                'Code Sent',
                'Please check your email for the password reset code.',
                [{ text: 'OK', onPress: () => setStep('OTP_NEW_PASSWORD') }]
            );
        } catch (err: any) {
            Alert.alert('Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmReset = async () => {
        if (!otp || !newPassword) {
            Alert.alert('Error', 'Please enter code and new password');
            return;
        }

        setLoading(true);
        try {
            // 1. Verify OTP (type: recovery)
            const { error: verifyError } = await verifyOtp(email, otp, 'recovery');
            if (verifyError) throw verifyError;

            // 2. Update Password
            const { error: updateError } = await updatePassword(newPassword);
            if (updateError) throw updateError;

            Alert.alert(
                'Success',
                'Your password has been updated. You can now login.',
                [{ text: 'Go to Login', onPress: () => navigation.goBack() }]
            );
        } catch (err: any) {
            Alert.alert('Reset Failed', err.message);
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
            <View style={styles.content}>
                <Text style={[styles.title, isDark ? styles.textDark : styles.textLight]}>
                    {step === 'EMAIL' ? 'Reset Password' : 'New Password'}
                </Text>
                <Text style={[styles.subtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                    {step === 'EMAIL'
                        ? 'Enter your email to receive a reset code.'
                        : 'Enter the code and your new password.'}
                </Text>

                {step === 'EMAIL' ? (
                    <>
                        <TextInput
                            style={inputStyle}
                            placeholder="Enter your email"
                            placeholderTextColor={isDark ? '#888' : '#666'}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleResetRequest}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Send Code</Text>}
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <TextInput
                            style={inputStyle}
                            placeholder="Verification Code"
                            placeholderTextColor={isDark ? '#888' : '#666'}
                            value={otp}
                            onChangeText={setOtp}
                            keyboardType="number-pad"
                        />
                        <TextInput
                            style={inputStyle}
                            placeholder="New Password"
                            placeholderTextColor={isDark ? '#888' : '#666'}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry
                        />
                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleConfirmReset}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Update Password</Text>}
                        </TouchableOpacity>
                    </>
                )}

                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.linkText}>
                        {step === 'EMAIL' ? 'Back to Login' : 'Cancel'}
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    containerLight: { backgroundColor: Colors.background.light },
    containerDark: { backgroundColor: Colors.background.dark },
    content: { flex: 1, justifyContent: 'center', padding: spacing.xl },
    title: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: typography.sizes.md,
        marginBottom: spacing.lg,
        textAlign: 'center',
    },
    textLight: { color: Colors.text.primary.light },
    textDark: { color: Colors.text.primary.dark },
    textSecondaryLight: { color: Colors.text.secondary.light },
    textSecondaryDark: { color: Colors.text.secondary.dark },
    input: {
        height: 50,
        borderWidth: 1,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.lg,
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
        marginBottom: spacing.md,
    },
    buttonText: { color: '#FFF', fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
    linkButton: { alignItems: 'center', padding: spacing.sm },
    linkText: { color: Colors.primary.dark, fontSize: typography.sizes.sm },
});
