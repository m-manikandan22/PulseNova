/**
 * Crisis Alert Screen
 * Critical modal for Hypertensive Crisis / High Stroke Risk
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Dimensions, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../styles/colors';
import { spacing, typography, borderRadius } from '../styles/theme';
import { BPCategory, RiskLevel } from '../ble/types';
import { AlertTriangleIcon, PhoneIcon, SirenIcon } from '../components/SVGIcons';

interface CrisisAlertProps {
    visible: boolean;
    onClose: () => void;
    sys: number;
    dia: number;
}

const { width } = Dimensions.get('window');

export const CrisisAlertScreen: React.FC<CrisisAlertProps> = ({ visible, onClose, sys, dia }) => {

    const [emergencyContact, setEmergencyContact] = useState<{ name: string; phone: string } | null>(null);

    useEffect(() => {
        if (visible) {
            AsyncStorage.getItem('emergency_contact').then(stored => {
                if (stored) setEmergencyContact(JSON.parse(stored));
            }).catch(() => { });
        }
    }, [visible]);

    const handleEmergencyCall = () => {
        Linking.openURL('tel:112').catch(() =>
            Alert.alert('Error', 'Unable to make call from this device')
        );
    };

    const handleContactCall = () => {
        if (!emergencyContact?.phone) return;
        Linking.openURL(`tel:${emergencyContact.phone}`).catch(() =>
            Alert.alert('Error', 'Unable to make call from this device')
        );
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>

                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.warningIconWrap}>
                            <AlertTriangleIcon color="#FFFFFF" size={40} />
                        </View>
                        <Text style={styles.modalTitle}>HYPERTENSIVE CRISIS</Text>
                        <Text style={styles.reading}>{sys} / {dia}</Text>
                        <Text style={styles.subtitle}>Seek Medical Care Immediately</Text>
                    </View>

                    <ScrollView style={styles.body}>
                        <Text style={styles.sectionTitle}>Check for STROKE signs (F.A.S.T.)</Text>

                        <View style={styles.fastItem}>
                            <Text style={styles.fastLetter}>F</Text>
                            <View>
                                <Text style={styles.fastTitle}>Face Drooping</Text>
                                <Text style={styles.fastDesc}>Does one side of the face droop or is it numb?</Text>
                            </View>
                        </View>

                        <View style={styles.fastItem}>
                            <Text style={styles.fastLetter}>A</Text>
                            <View>
                                <Text style={styles.fastTitle}>Arm Weakness</Text>
                                <Text style={styles.fastDesc}>Is one arm weak or numb? Ask to raise both arms.</Text>
                            </View>
                        </View>

                        <View style={styles.fastItem}>
                            <Text style={styles.fastLetter}>S</Text>
                            <View>
                                <Text style={styles.fastTitle}>Speech Difficulty</Text>
                                <Text style={styles.fastDesc}>Is speech slurred? Is the person unable to speak?</Text>
                            </View>
                        </View>

                        <View style={styles.fastItem}>
                            <Text style={styles.fastLetter}>T</Text>
                            <View>
                                <Text style={styles.fastTitle}>Time to Call</Text>
                                <Text style={styles.fastDesc}>If IF ANY of these signs are visible, call Emergency immediately.</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <Text style={styles.advice}>
                            Wait 5 minutes and test again. If readings remain above 180/120, contact emergency services.
                        </Text>
                    </ScrollView>

                    {/* Footer Actions */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.emergencyButton} onPress={handleEmergencyCall}>
                            <SirenIcon color="#FFF" size={18} />
                            <Text style={styles.emergencyText}>CALL EMERGENCY (112)</Text>
                        </TouchableOpacity>

                        {emergencyContact && (
                            <TouchableOpacity style={[styles.emergencyButton, { backgroundColor: '#1565C0', marginTop: 8 }]} onPress={handleContactCall}>
                                <PhoneIcon color="#FFF" size={18} />
                                <Text style={styles.emergencyText}>Call {emergencyContact.name}</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.dismissButton} onPress={onClose}>
                            <Text style={styles.dismissText}>I Understand</Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)', // Dark overlay
    },
    modalView: {
        width: width * 0.9,
        maxHeight: '90%',
        backgroundColor: '#FFF',
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    header: {
        backgroundColor: '#D32F2F', // Strong Red
        padding: spacing.lg,
        alignItems: 'center',
    },
    warningIconWrap: {
        marginBottom: spacing.xs,
    },
    modalTitle: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: '#FFF',
        marginBottom: spacing.xs,
        letterSpacing: 1,
    },
    reading: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: '#FFF',
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: typography.sizes.md,
        color: '#FFEBEE',
        fontWeight: typography.weights.semibold,
    },
    body: {
        padding: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: '#D32F2F',
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    fastItem: {
        flexDirection: 'row',
        marginBottom: spacing.md,
        alignItems: 'center',
    },
    fastLetter: {
        fontSize: 32,
        fontWeight: typography.weights.bold,
        color: '#D32F2F',
        width: 40,
        marginRight: spacing.sm,
        textAlign: 'center',
    },
    fastTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: '#333',
    },
    fastDesc: {
        fontSize: typography.sizes.sm,
        color: '#666',
        maxWidth: '90%',
    },
    divider: {
        height: 1,
        backgroundColor: '#EEE',
        marginVertical: spacing.md,
    },
    advice: {
        fontSize: typography.sizes.sm,
        color: '#444',
        fontStyle: 'italic',
        textAlign: 'center',
        paddingHorizontal: spacing.sm,
        marginBottom: spacing.lg, // Extra space at bottom of scroll
    },
    footer: {
        padding: spacing.md,
        backgroundColor: '#FAFAFA',
        borderTopWidth: 1,
        borderTopColor: '#EEE',
    },
    emergencyButton: {
        backgroundColor: '#D32F2F',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        marginBottom: spacing.md,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    emergencyText: {
        color: '#FFF',
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
    },
    dismissButton: {
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    dismissText: {
        color: '#666',
        fontSize: typography.sizes.sm,
        textDecorationLine: 'underline',
    },
});
