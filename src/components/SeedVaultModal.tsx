import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Fingerprint, Shield, X, Lock, CheckCircle2 } from 'lucide-react-native';
import { BiometricService } from '../services/biometricService';

interface SeedVaultModalProps {
  visible: boolean;
  actionTitle: string;
  amountLabel: string;
  merchantName?: string;
  onApprove: () => void;
  onCancel: () => void;
}

export const SeedVaultModal: React.FC<SeedVaultModalProps> = ({
  visible,
  actionTitle,
  amountLabel,
  merchantName,
  onApprove,
  onCancel,
}) => {
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [hardwareTypes, setHardwareTypes] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      setAuthenticating(false);
      setAuthError(null);
      setAuthSuccess(false);

      // Check real biometric hardware available on device
      BiometricService.checkAvailability().then(res => {
        setHardwareTypes(res.types);
      });
    }
  }, [visible]);

  const triggerHardwareBiometrics = async () => {
    setAuthenticating(true);
    setAuthError(null);

    // Call real hardware biometric authentication
    const result = await BiometricService.authenticate(
      `Authorize payment: ${amountLabel} for ${actionTitle}`
    );

    setAuthenticating(false);

    if (result.success) {
      setAuthSuccess(true);
      setTimeout(() => {
        onApprove();
      }, 400);
    } else {
      setAuthError(result.error || 'Biometric authentication failed or was cancelled.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header Row */}
          <View style={styles.header}>
            <View style={styles.shieldBadge}>
              <Shield size={14} color="#14F195" />
              <Text style={styles.shieldText}>HARDWARE BIOMETRIC SECURITY</Text>
            </View>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
              <X size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Authorize Payment</Text>
          <Text style={styles.subtitle}>
            Use your phone's real {hardwareTypes[0] || 'biometrics'} (Fingerprint / Face ID / PIN) to sign this transaction.
          </Text>

          {/* Details */}
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Action</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{actionTitle}</Text>
            </View>
            {merchantName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Recipient</Text>
                <Text style={styles.detailValue}>{merchantName}</Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={styles.amountValue}>{amountLabel}</Text>
            </View>
          </View>

          {authError && <Text style={styles.errorText}>{authError}</Text>}

          {/* Hardware Biometric Touch Button */}
          <TouchableOpacity
            style={[styles.sensorArea, authSuccess && styles.sensorAreaSuccess]}
            onPress={triggerHardwareBiometrics}
            activeOpacity={0.8}
            disabled={authenticating || authSuccess}
          >
            <View style={[styles.sensorRing, authSuccess && styles.sensorRingSuccess]}>
              {authSuccess ? (
                <CheckCircle2 size={40} color="#10B981" />
              ) : authenticating ? (
                <ActivityIndicator size="large" color="#5B67F6" />
              ) : (
                <Fingerprint size={40} color="#10B981" />
              )}
            </View>

            <Text style={styles.sensorLabel}>
              {authSuccess
                ? 'Biometrics Verified!'
                : authenticating
                ? 'Waiting for Fingerprint / Face ID...'
                : 'Tap to Scan Fingerprint / Face ID'}
            </Text>

            <View style={styles.securityRow}>
              <Lock size={12} color="#6B7280" />
              <Text style={styles.securityText}>
                Hardware Sensor Protected • Keys Isolated
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.rejectBtn} onPress={onCancel}>
            <Text style={styles.rejectText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F121C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#232A3D',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  shieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 241, 149, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(20, 241, 149, 0.25)',
    gap: 6,
  },
  shieldText: {
    color: '#14F195',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#181E2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  detailsCard: {
    backgroundColor: '#151926',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#232A3D',
    marginBottom: 16,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '65%',
  },
  divider: {
    height: 1,
    backgroundColor: '#1D212E',
  },
  amountValue: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '800',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 8,
    borderRadius: 8,
  },
  sensorArea: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#12141F',
    borderWidth: 1,
    borderColor: '#1D212E',
  },
  sensorAreaSuccess: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  sensorRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(20, 241, 149, 0.08)',
    borderWidth: 2,
    borderColor: '#14F195',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sensorRingSuccess: {
    borderColor: '#14F195',
    backgroundColor: 'rgba(20, 241, 149, 0.15)',
  },
  sensorLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  securityText: {
    color: '#6B7280',
    fontSize: 11,
  },
  rejectBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  rejectText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
});
