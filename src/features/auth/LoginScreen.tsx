/**
 * Login Screen
 * Entry point for Authentication (Email/Phone OTP)
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
import SyncService from '../../services/SyncService';

export const LoginScreen: React.FC = () => {
    const { signInWithPassword } = useAuth();
    const navigation = useNavigation<any>();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        setLoading(true);
        try {
            const { error } = await signInWithPassword(email, password);
            if (error) throw error;

            // Sync Data
            SyncService.pullProfile();
            SyncService.pullHistory();

            // Success handles session update automatically
        } catch (err: any) {
            Alert.alert('Login Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}
        >
            <View style={styles.content}>
                <Text style={[styles.title, isDark ? styles.textDark : styles.textLight]}>
                    Welcome to PulseNova
                </Text>
                <Text style={[styles.subtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                    Secure Cardiovascular Monitoring
                </Text>

                <TextInput
                    style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                    placeholder="Email"
                    placeholderTextColor={isDark ? '#888' : '#666'}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />

                <TextInput
                    style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                    placeholder="Password"
                    placeholderTextColor={isDark ? '#888' : '#666'}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />

                <TouchableOpacity
                    style={{ alignSelf: 'flex-end', marginBottom: 20 }}
                    onPress={() => navigation.navigate('ForgotPassword')}
                >
                    <Text style={styles.linkText}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleLogin}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Login</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => navigation.navigate('Signup')}
                >
                    <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    containerLight: {
        backgroundColor: Colors.background.light,
    },
    containerDark: {
        backgroundColor: Colors.background.dark,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: spacing.xl,
    },
    title: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: typography.sizes.md,
        marginBottom: spacing.xxl,
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
    inputLight: {
        borderColor: '#DDD',
        color: Colors.text.primary.light,
        backgroundColor: '#FFF',
    },
    inputDark: {
        borderColor: '#444',
        color: Colors.text.primary.dark,
        backgroundColor: '#222',
    },
    button: {
        height: 50,
        backgroundColor: Colors.primary.dark,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    buttonDisabled: {
        backgroundColor: '#999',
    },
    buttonText: {
        color: '#FFF',
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
    },
    linkButton: {
        alignItems: 'center',
        padding: spacing.sm,
    },
    linkText: {
        color: Colors.primary.dark,
        fontSize: typography.sizes.sm,
    },
});
