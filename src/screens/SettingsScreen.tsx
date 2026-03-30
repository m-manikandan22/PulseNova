/**
 * Settings Screen
 * App configuration and device management
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    TextInput,
    useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../styles/colors';
import { spacing, typography, borderRadius, shadows } from '../styles/theme';
import BleManager from '../ble/BleManager';
import BaselineService from '../services/BaselineService';
import Database from '../database/db';
import { UserIcon, EditIcon, SaveIcon, SettingsIcon, DisconnectIcon, TrashIcon, DeviceIcon, ActivityIcon } from '../components/SVGIcons';

export const SettingsScreen: React.FC = () => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [isConnected, setIsConnected] = useState(false);
    const [deviceInfo, setDeviceInfo] = useState<any>(null);
    const [hasBaseline, setHasBaseline] = useState(false);
    const [learningDaysRemaining, setLearningDaysRemaining] = useState(0);

    // Profile State
    const [profile, setProfile] = useState<{ full_name: string; age: string; gender: string }>({
        full_name: '',
        age: '',
        gender: '',
    });
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    // Emergency Contact
    const [emergencyContact, setEmergencyContact] = useState({ name: '', phone: '' });
    const [editingContact, setEditingContact] = useState(false);

    useEffect(() => {
        loadSettings();
        loadProfile();
        loadEmergencyContact();
    }, []);

    const loadEmergencyContact = async () => {
        try {
            const stored = await AsyncStorage.getItem('emergency_contact');
            if (stored) setEmergencyContact(JSON.parse(stored));
        } catch (e) { }
    };

    const saveEmergencyContact = async () => {
        if (!emergencyContact.name || !emergencyContact.phone) {
            Alert.alert('Required', 'Please enter both name and phone number');
            return;
        }
        try {
            await AsyncStorage.setItem('emergency_contact', JSON.stringify(emergencyContact));
            setEditingContact(false);
            Alert.alert('Saved', 'Emergency contact saved successfully');
        } catch (e) {
            Alert.alert('Error', 'Failed to save emergency contact');
        }
    };

    const loadSettings = async () => {
        setIsConnected(BleManager.isConnected());
        setDeviceInfo(BleManager.getDeviceInfo());
        setHasBaseline(await BaselineService.hasBaseline());
        setLearningDaysRemaining(await BaselineService.getLearningPeriodDaysRemaining());
    };

    const loadProfile = async () => {
        try {
            const stored = await AsyncStorage.getItem('user_profile');
            if (stored) {
                const data = JSON.parse(stored);
                setProfile({
                    full_name: data.full_name || '',
                    age: data.age?.toString() || '',
                    gender: data.gender || '',
                });
            }
        } catch (e) {
            console.error('Failed to load profile:', e);
        }
    };

    const handleSaveProfile = async () => {
        if (!profile.full_name || !profile.age || !profile.gender) {
            Alert.alert('Validation', 'Please fill all fields');
            return;
        }

        setLoading(true);
        try {
            await AsyncStorage.setItem('user_profile', JSON.stringify({
                full_name: profile.full_name,
                age: parseInt(profile.age, 10),
                gender: profile.gender,
            }));
            Alert.alert('Success', 'Profile updated successfully');
            setIsEditing(false);
        } catch (e) {
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async () => {
        Alert.alert(
            'Disconnect Device',
            'Are you sure you want to disconnect?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: async () => {
                        await BleManager.disconnect();
                        setIsConnected(false);
                        setDeviceInfo(null);
                    },
                },
            ]
        );
    };

    const handleRecalibrateBaseline = async () => {
        Alert.alert(
            'Recalibrate Baseline',
            'This will reset your personal baseline and start a new 7-day learning period. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Recalibrate',
                    style: 'destructive',
                    onPress: async () => {
                        await BaselineService.recalibrate();
                        Alert.alert('Success', 'Baseline reset. New learning period started.');
                        loadSettings();
                    },
                },
            ]
        );
    };

    const handleClearData = async () => {
        Alert.alert(
            'Clear All Data',
            'This will permanently delete all your health readings. This cannot be undone. Are you sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await Database.close();
                        Alert.alert('Success', 'All data cleared.');
                    },
                },
            ]
        );
    };



    return (
        <ScrollView style={[
            styles.container,
            isDark ? styles.containerDark : styles.containerLight,
        ]}>
            {/* Profile Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={[
                        styles.sectionTitle,
                        isDark ? styles.sectionTitleDark : styles.sectionTitleLight,
                    ]}>
                        My Profile
                    </Text>
                    {!isEditing ? (
                        <TouchableOpacity onPress={() => setIsEditing(true)}>
                            <EditIcon color={Colors.primary.light} size={20} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={handleSaveProfile} disabled={loading}>
                            {loading ? <Text>...</Text> : <SaveIcon color={Colors.success} size={20} />}
                        </TouchableOpacity>
                    )}
                </View>

                <View style={[
                    styles.card,
                    isDark ? styles.cardDark : styles.cardLight,
                    shadows.sm,
                ]}>
                    <View style={styles.profileHeader}>
                        <View style={styles.avatar}>
                            <UserIcon color="#FFF" size={32} />
                        </View>
                        <View>
                            <Text style={[styles.profileName, isDark ? styles.textDark : styles.textLight]}>
                                {profile.full_name || 'User'}
                            </Text>
                            <Text style={[styles.profileEmail, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                                Local Profile
                            </Text>
                        </View>
                    </View>

                    {isEditing ? (
                        <View style={styles.form}>
                            <Text style={[styles.label, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>Full Name</Text>
                            <TextInput
                                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                                value={profile.full_name}
                                onChangeText={t => setProfile({ ...profile, full_name: t })}
                            />

                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 8 }}>
                                    <Text style={[styles.label, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>Age</Text>
                                    <TextInput
                                        style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                                        value={profile.age}
                                        keyboardType="numeric"
                                        onChangeText={t => setProfile({ ...profile, age: t })}
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={[styles.label, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>Gender</Text>
                                    <TextInput
                                        style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                                        value={profile.gender}
                                        onChangeText={t => setProfile({ ...profile, gender: t })}
                                    />
                                </View>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, isDark ? styles.textDark : styles.textLight]}>{profile.age}</Text>
                                <Text style={[styles.statLabel, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>Age</Text>
                            </View>
                            <View style={[styles.statDivider, { backgroundColor: isDark ? Colors.border.dark : Colors.border.light }]} />
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, isDark ? styles.textDark : styles.textLight]}>{profile.gender}</Text>
                                <Text style={[styles.statLabel, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>Gender</Text>
                            </View>
                        </View>
                    )}
                </View>
            </View>

            {/* Device Section */}
            <View style={styles.section}>
                <Text style={[
                    styles.sectionTitle,
                    isDark ? styles.sectionTitleDark : styles.sectionTitleLight,
                ]}>
                    Device
                </Text>

                {isConnected && deviceInfo ? (
                    <View style={[
                        styles.card,
                        isDark ? styles.cardDark : styles.cardLight,
                        shadows.sm,
                    ]}>
                        <View style={styles.cardRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <DeviceIcon color={Colors.primary.light} size={20} />
                                <Text style={[
                                    styles.cardValue,
                                    isDark ? styles.cardValueDark : styles.cardValueLight,
                                ]}>
                                    {deviceInfo.name}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={handleDisconnect}>
                                <DisconnectIcon color={Colors.error} size={20} />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={[
                        styles.card,
                        isDark ? styles.cardDark : styles.cardLight,
                        shadows.sm,
                    ]}>
                        <Text style={[
                            styles.cardLabel,
                            isDark ? styles.cardLabelDark : styles.cardLabelLight,
                        ]}>
                            No device connected
                        </Text>
                    </View>
                )}
            </View>

            {/* Baseline Section */}
            <View style={styles.section}>
                <Text style={[
                    styles.sectionTitle,
                    isDark ? styles.sectionTitleDark : styles.sectionTitleLight,
                ]}>
                    Baseline
                </Text>

                <View style={[
                    styles.card,
                    isDark ? styles.cardDark : styles.cardLight,
                    shadows.sm,
                ]}>
                    <View style={styles.cardRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <ActivityIcon color={Colors.warning} size={20} />
                            <Text style={[
                                styles.cardValue,
                                isDark ? styles.cardValueDark : styles.cardValueLight,
                            ]}>
                                {hasBaseline
                                    ? learningDaysRemaining > 0
                                        ? `Learning (${learningDaysRemaining} days left)`
                                        : 'Established'
                                    : 'Not established'}
                            </Text>
                        </View>
                    </View>

                    {hasBaseline && (
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={handleRecalibrateBaseline}
                        >
                            <Text style={styles.secondaryButtonText}>Recalibrate Baseline</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Emergency Contact Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight]}>
                        Emergency Contact
                    </Text>
                    {!editingContact ? (
                        <TouchableOpacity onPress={() => setEditingContact(true)}>
                            <Text style={{ color: Colors.primary.light, fontSize: 14 }}>Edit</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={saveEmergencyContact}>
                            <Text style={{ color: Colors.success, fontSize: 14, fontWeight: '600' }}>Save</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight, shadows.sm]}>
                    {editingContact ? (
                        <View style={styles.form}>
                            <Text style={[styles.label, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>Contact Name</Text>
                            <TextInput
                                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                                value={emergencyContact.name}
                                placeholder="e.g. John Doe"
                                placeholderTextColor="#999"
                                onChangeText={t => setEmergencyContact({ ...emergencyContact, name: t })}
                            />
                            <Text style={[styles.label, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>Phone Number</Text>
                            <TextInput
                                style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                                value={emergencyContact.phone}
                                placeholder="e.g. +91 9876543210"
                                placeholderTextColor="#999"
                                keyboardType="phone-pad"
                                onChangeText={t => setEmergencyContact({ ...emergencyContact, phone: t })}
                            />
                        </View>
                    ) : emergencyContact.name ? (
                        <View>
                            <Text style={[styles.cardValue, isDark ? styles.cardValueDark : styles.cardValueLight]}>
                                Name: {emergencyContact.name}
                            </Text>
                            <Text style={[styles.cardLabel, isDark ? styles.cardLabelDark : styles.cardLabelLight, { marginTop: 4 }]}>
                                Phone: {emergencyContact.phone}
                            </Text>
                        </View>
                    ) : (
                        <Text style={[styles.cardLabel, isDark ? styles.cardLabelDark : styles.cardLabelLight]}>
                            No emergency contact set. Tap Edit to add one.
                        </Text>
                    )}
                </View>
            </View>

            {/* Medical Disclaimer */}
            <View style={styles.section}>
                <View style={[
                    styles.disclaimerCard,
                    isDark ? styles.disclaimerCardDark : styles.disclaimerCardLight,
                ]}>
                    <Text style={[
                        styles.disclaimerTitle,
                        isDark ? styles.disclaimerTitleDark : styles.disclaimerTitleLight,
                    ]}>
                        Medical Disclaimer
                    </Text>
                    <Text style={[
                        styles.disclaimerText,
                        isDark ? styles.disclaimerTextDark : styles.disclaimerTextLight,
                    ]}>
                        PulseNova is a wellness monitoring tool, NOT a medical device. It provides trend-based
                        health insights and should not be used to diagnose, treat, or prevent any medical
                        condition.
                    </Text>
                </View>
            </View>

            {/* Data Management */}
            <View style={styles.section}>
                <TouchableOpacity
                    style={[
                        styles.card,
                        isDark ? styles.cardDark : styles.cardLight,
                        shadows.sm,
                        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }
                    ]}
                    onPress={handleClearData}
                >
                    <TrashIcon color={Colors.error} size={20} />
                    <Text style={styles.dangerText}>Clear All Data</Text>
                </TouchableOpacity>

            </View>

            {/* About */}
            <View style={styles.section}>
                <Text style={[
                    styles.aboutText,
                    isDark ? styles.aboutTextDark : styles.aboutTextLight,
                ]}>
                    PulseNova v1.0.0{'\n'}
                    Cardiovascular Trend Monitoring
                </Text>
            </View>

            <View style={styles.bottomSpacer} />
        </ScrollView>
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
    section: {
        marginTop: spacing.lg,
        paddingHorizontal: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        marginBottom: spacing.md,
    },
    sectionTitleLight: {
        color: Colors.text.primary.light,
    },
    sectionTitleDark: {
        color: Colors.text.primary.dark,
    },
    card: {
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        gap: spacing.md,
    },
    cardLight: {
        backgroundColor: Colors.surface.light,
    },
    cardDark: {
        backgroundColor: Colors.surface.dark,
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardLabel: {
        fontSize: typography.sizes.md,
    },
    cardLabelLight: {
        color: Colors.text.secondary.light,
    },
    cardLabelDark: {
        color: Colors.text.secondary.dark,
    },
    cardValue: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.medium,
    },
    cardValueLight: {
        color: Colors.text.primary.light,
    },
    cardValueDark: {
        color: Colors.text.primary.dark,
    },
    dangerButton: {
        backgroundColor: Colors.error,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    dangerButtonText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
    },
    secondaryButton: {
        backgroundColor: Colors.primary.dark,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#FFFFFF',
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
    },
    disclaimerCard: {
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderLeftWidth: 4,
        borderLeftColor: Colors.warning,
    },
    disclaimerCardLight: {
        backgroundColor: Colors.warning + '10',
    },
    disclaimerCardDark: {
        backgroundColor: Colors.warning + '08',
    },
    disclaimerTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        marginBottom: spacing.sm,
    },
    disclaimerTitleLight: {
        color: Colors.text.primary.light,
    },
    disclaimerTitleDark: {
        color: Colors.text.primary.dark,
    },
    disclaimerText: {
        fontSize: typography.sizes.sm,
        lineHeight: 20,
    },
    disclaimerTextLight: {
        color: Colors.text.secondary.light,
    },
    disclaimerTextDark: {
        color: Colors.text.secondary.dark,
    },
    dangerText: {
        color: Colors.error,
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
    },
    aboutText: {
        fontSize: typography.sizes.sm,
        textAlign: 'center',
        lineHeight: 20,
    },
    aboutTextLight: {
        color: Colors.text.tertiary.light,
    },
    aboutTextDark: {
        color: Colors.text.tertiary.dark,
    },
    bottomSpacer: {
        height: spacing.xxl,
    },
    // New Styles
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.primary.light,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    profileName: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
    },
    profileEmail: {
        fontSize: typography.sizes.sm,
        marginTop: 4,
    },
    textDark: { color: Colors.text.primary.dark },
    textLight: { color: Colors.text.primary.light },
    textSecondaryDark: { color: Colors.text.secondary.dark },
    textSecondaryLight: { color: Colors.text.secondary.light },

    // Form
    form: {
        gap: spacing.md,
    },
    label: {
        fontSize: typography.sizes.sm,
        marginBottom: 4,
        fontWeight: typography.weights.medium,
    },
    input: {
        borderWidth: 1,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        fontSize: typography.sizes.md,
    },
    inputLight: {
        borderColor: Colors.border.light,
        color: Colors.text.primary.light,
    },
    inputDark: {
        borderColor: Colors.border.dark,
        color: Colors.text.primary.dark,
    },
    row: {
        flexDirection: 'row',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: '#EEE', // We should use theme color here really
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
    },
    statLabel: {
        fontSize: typography.sizes.xs,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statDivider: {
        width: 1,
        height: '100%',
    },
});
