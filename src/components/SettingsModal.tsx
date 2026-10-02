import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Switch,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  Settings,
  Sun,
  Moon,
  ShieldAlert,
  Trash2,
  Key,
  Globe,
  Check,
  LogOut,
  AlertTriangle,
  Fingerprint,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { usePrivy, useExportWallet } from '../auth/privyAdapter';
import { UserProfileService } from '../services/userProfileService';
import { ToastService } from '../services/toastService';
import { WalletAccount } from '../services/walletProviderService';
import { BiometricService } from '../services/biometricService';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  activeAccount: WalletAccount | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  activeAccount,
}) => {
  const { colors, isDark, toggleTheme, theme, setTheme } = useTheme();
  const { logout, user } = usePrivy();
  const { exportWallet } = useExportWallet();
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bioEnabled, setBioEnabled] = useState<boolean>(() => BiometricService.isBiometricsEnabled());
  const [isAuthenticatingBio, setIsAuthenticatingBio] = useState<boolean>(false);

  const handleToggleBiometrics = async (targetState: boolean) => {
    if (bioEnabled === targetState || isAuthenticatingBio) return;
    setIsAuthenticatingBio(true);
    try {
      const res = await BiometricService.toggleBiometricsWithAuth(targetState);
      if (res.success) {
        setBioEnabled(targetState);
        ToastService.success(targetState ? 'Biometric security enabled (ON)' : 'Biometric security disabled (OFF)');
      } else {
        ToastService.error(res.error || 'Biometric authentication failed or cancelled.');
      }
    } catch (err: any) {
      ToastService.error(err?.message || 'Biometric verification failed.');
    } finally {
      setIsAuthenticatingBio(false);
    }
  };

  const handleExportKey = async () => {
    if (!activeAccount?.publicKey) {
      ToastService.error('No connected Solana wallet.');
      return;
    }
    setIsExporting(true);
    try {
      await exportWallet({ address: activeAccount.publicKey });
    } catch (err: any) {
      console.warn('Privy wallet export:', err);
      if (err?.message && !err.message.toLowerCase().includes('closed')) {
        ToastService.error(err.message || 'Could not export wallet');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = () => {
    try {
      // 1. Clear local user profile and cached credentials
      UserProfileService.resetProfile();

      // 2. Clear localStorage items
      if (typeof window !== 'undefined') {
        localStorage.removeItem('tapblink_user_profile_v1');
        localStorage.removeItem('justblink_user_profile_v2');
      }

      // 3. Log out via Privy
      logout();

      setShowDeleteConfirm(false);
      onClose();
      ToastService.success('Account deleted and local session cleared.');
    } catch (err) {
      ToastService.error('Failed to delete account data.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleRow}>
              <Settings size={18} color={colors.accent} />
              <Text style={[styles.title, { color: colors.textPrimary }]}>Settings</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
            {/* Appearance & Theme Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APPEARANCE & THEME</Text>
              <View style={[styles.networkCard, { backgroundColor: colors.bgCardAlt, borderColor: colors.border, justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  {isDark ? <Moon size={20} color={colors.accent} /> : <Sun size={20} color={colors.accent} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.networkTitle, { color: colors.textPrimary }]}>Dark Mode</Text>
                    <Text style={[styles.networkSub, { color: colors.textSecondary }]}>
                      {isDark ? 'Dark theme active' : 'Light theme active'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={(val) => setTheme(val ? 'dark' : 'light')}
                  trackColor={{ false: '#334155', true: colors.accent }}
                  thumbColor={isDark ? '#FFFFFF' : '#F4F3F4'}
                />
              </View>
            </View>

            {/* Biometric Security Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>BIOMETRIC SECURITY</Text>
              <View style={[styles.networkCard, { backgroundColor: colors.bgCardAlt, borderColor: colors.border, justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Fingerprint size={20} color={bioEnabled ? colors.accent : colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.networkTitle, { color: colors.textPrimary }]}>Turn on Biometrics</Text>
                      {isAuthenticatingBio && <ActivityIndicator size="small" color={colors.accent} />}
                    </View>
                    <Text style={[styles.networkSub, { color: colors.textSecondary }]}>
                      {bioEnabled ? 'ON' : 'OFF'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={bioEnabled}
                  onValueChange={(val) => handleToggleBiometrics(val)}
                  disabled={isAuthenticatingBio}
                  trackColor={{ false: '#334155', true: colors.accent }}
                  thumbColor={bioEnabled ? '#FFFFFF' : '#F4F3F4'}
                />
              </View>
            </View>

            {/* Network Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SOLANA NETWORK ENVIRONMENT</Text>
              <View style={[styles.networkCard, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Globe size={18} color="#14F195" />
                  <View>
                    <Text style={[styles.networkTitle, { color: colors.textPrimary }]}>Solana Devnet</Text>
                    <Text style={[styles.networkSub, { color: colors.textSecondary }]}>Active on-chain RPC cluster</Text>
                  </View>
                </View>
                <View style={styles.activeDotBadge}>
                  <View style={styles.greenDot} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#10B981' }}>Connected</Text>
                </View>
              </View>
            </View>

            {/* Wallet Key Backup Section */}
            {activeAccount && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SECURITY & PRIVATE KEYS</Text>
                <TouchableOpacity
                  style={[styles.exportCard, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}
                  onPress={handleExportKey}
                  disabled={isExporting}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <Key size={20} color="#F59E0B" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.exportTitle, { color: colors.textPrimary }]}>Export Private Key</Text>
                      <Text style={[styles.exportSub, { color: colors.textSecondary }]}>
                        Backup non-custodial Solana seed key for Phantom or Solflare
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#F59E0B' }}>
                    {isExporting ? '...' : 'Export'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Account Danger Zone (Delete Account at Bottom) */}
            <View style={[styles.section, { marginTop: 10 }]}>
              <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>DANGER ZONE</Text>

              {showDeleteConfirm ? (
                <View style={styles.deleteConfirmCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <AlertTriangle size={18} color="#EF4444" />
                    <Text style={styles.deleteConfirmTitle}>Confirm Account Deletion?</Text>
                  </View>
                  <Text style={styles.deleteConfirmSub}>
                    This will permanently clear your profile handle, local storage database, saved preferences, and sign out of this device.
                  </Text>
                  <View style={styles.deleteActionRow}>
                    <TouchableOpacity
                      style={styles.cancelDeleteBtn}
                      onPress={() => setShowDeleteConfirm(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.cancelDeleteText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmDeleteBtn}
                      onPress={handleDeleteAccount}
                      activeOpacity={0.8}
                    >
                      <Trash2 size={14} color="#FFFFFF" />
                      <Text style={styles.confirmDeleteText}>Yes, Delete Account</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.deleteCardBtn}
                  onPress={() => setShowDeleteConfirm(true)}
                  activeOpacity={0.8}
                >
                  <Trash2 size={18} color="#EF4444" />
                  <Text style={styles.deleteCardBtnText}>Delete Account</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: '84%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollList: {
    maxHeight: 500,
  },
  scrollContent: {
    padding: 10,
    gap: 6,
  },
  section: {
    gap: 5,
  },
  sectionTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  themeToggleRow: {
    flexDirection: 'row',
    gap: 6,
  },
  themeOptionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 8,
  },
  themeOptionActive: {
    borderWidth: 1.5,
  },
  themeOptionTitle: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  networkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
  },
  networkTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  networkSub: {
    fontSize: 9.5,
    marginTop: 1,
  },
  activeDotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  exportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
  },
  exportTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  exportSub: {
    fontSize: 9.5,
    marginTop: 1,
  },
  deleteCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
  },
  deleteCardBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteConfirmCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  deleteConfirmTitle: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteConfirmSub: {
    color: '#EF4444',
    fontSize: 10,
    lineHeight: 16,
    marginBottom: 14,
    opacity: 0.9,
  },
  deleteActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelDeleteBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cancelDeleteText: {
    fontSize: 11,
    fontWeight: '600',
  },
  confirmDeleteBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 10,
  },
  confirmDeleteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
