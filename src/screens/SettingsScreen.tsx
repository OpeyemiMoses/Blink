import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import {
  Settings,
  Sun,
  Moon,
  ShieldAlert,
  Trash2,
  Key,
  Globe,
  Check,
  AlertTriangle,
  LogOut,
  Fingerprint,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { usePrivy, useExportWallet } from '../auth/privyAdapter';
import { UserProfileService } from '../services/userProfileService';
import { ToastService } from '../services/toastService';
import { WalletAccount } from '../services/walletProviderService';
import { BiometricService } from '../services/biometricService';

interface SettingsScreenProps {
  activeAccount: WalletAccount | null;
  onOpenWalletConnect?: () => void;
  onReturnToAuth?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  activeAccount,
  onOpenWalletConnect,
  onReturnToAuth,
}) => {
  const { colors, isDark, toggleTheme, setTheme } = useTheme();
  const { logout, authenticated, deleteAccount } = usePrivy();
  const { exportWallet } = useExportWallet();
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      if (typeof deleteAccount === 'function') {
        await deleteAccount();
      } else {
        await UserProfileService.deleteAccountGlobally(activeAccount?.publicKey);
        await logout();
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem('tapblink_user_profile_v1');
        localStorage.removeItem('justblink_user_profile_v2');
      }
      setShowDeleteConfirm(false);
      ToastService.success('Account deleted.');
    } catch (err) {
      ToastService.error('Failed to delete account.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Settings Header Banner */}
      <View style={[styles.headerCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.headerTopRow}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
            <Settings size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Settings</Text>
            <Text style={[styles.screenSub, { color: colors.textSecondary }]}>
              Customize appearance, manage security, and manage your account
            </Text>
          </View>
        </View>
      </View>

        {/* Appearance & Preferences Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>APPEARANCE & THEME</Text>
          
          <View style={[styles.networkRow, { backgroundColor: colors.bgCardAlt, borderColor: colors.border, justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              {isDark ? <Moon size={22} color={colors.accent} /> : <Sun size={22} color={colors.accent} />}
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
        <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>BIOMETRIC SECURITY</Text>

          <View style={[styles.networkRow, { backgroundColor: colors.bgCardAlt, borderColor: colors.border, justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <Fingerprint size={22} color={bioEnabled ? colors.accent : colors.textMuted} />
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

      {/* Network Environment Section */}
      <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>SOLANA NETWORK ENVIRONMENT</Text>
        <View style={[styles.networkRow, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Globe size={20} color="#14F195" />
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
        <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>SECURITY & KEYS</Text>
          <TouchableOpacity
            style={[styles.exportCard, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}
            onPress={handleExportKey}
            disabled={isExporting}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <Key size={22} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.exportTitle, { color: colors.textPrimary }]}>Export Private Key</Text>
                <Text style={[styles.exportSub, { color: colors.textSecondary }]}>
                  Backup non-custodial Solana seed key for Phantom, Solflare, or Backpack
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#F59E0B' }}>
              {isExporting ? 'Exporting...' : 'Export'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* If unauthenticated / guest, show clean Guest Session card with option to sign in. NO delete button! */}
      {!authenticated ? (
        <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.accent }]}>GUEST SESSION</Text>
          <View style={[styles.guestCard, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
            <Text style={[styles.guestTitle, { color: colors.textPrimary }]}>Exploring as Guest</Text>
            <Text style={[styles.guestSub, { color: colors.textSecondary }]}>
              You are currently browsing Blink without an account. Sign in to link external wallets, save blinks, and access your profile.
            </Text>
            <TouchableOpacity
              style={[styles.guestSignInBtn, { backgroundColor: colors.accent }]}
              onPress={onReturnToAuth}
              activeOpacity={0.8}
            >
              <Text style={styles.guestSignInBtnText}>Exit Guest Mode & Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Account Danger Zone (Delete Account at the bottom for authenticated users only) */
        <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: '#EF4444' }]}>ACCOUNT DANGER ZONE</Text>

          {showDeleteConfirm ? (
            <View style={styles.deleteConfirmCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={20} color="#EF4444" />
                <Text style={styles.deleteConfirmTitle}>Delete Account?</Text>
              </View>
              <Text style={styles.deleteConfirmSub}>
                This will permanently delete your account from the database and sign you out of this device.
              </Text>
              <View style={styles.deleteActionRow}>
                <TouchableOpacity
                  style={styles.cancelDeleteBtn}
                  onPress={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelDeleteText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmDeleteBtn}
                  onPress={handleDeleteAccount}
                  disabled={isDeleting}
                  activeOpacity={0.8}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Trash2 size={14} color="#FFFFFF" />
                      <Text style={styles.confirmDeleteText}>Yes, Delete Account</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.deleteCardBtn}
              onPress={() => setShowDeleteConfirm(true)}
              activeOpacity={0.8}
            >
              <Trash2 size={20} color="#EF4444" />
              <Text style={styles.deleteCardBtnText}>Delete Account</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 100,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
    gap: 6,
  },
  headerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  screenSub: {
    fontSize: 9.5,
    marginTop: 1,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  sectionLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sectionExplainer: {
    fontSize: 9.5,
    lineHeight: 14,
  },
  themeToggleRow: {
    flexDirection: 'row',
    gap: 6,
  },
  themeOptionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 8,
  },
  themeOptionActive: {
    borderWidth: 1.5,
  },
  themeOptionTitle: {
    fontSize: 11,
    fontWeight: '800',
  },
  themeOptionSub: {
    fontSize: 9.5,
    marginTop: 1,
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
  },
  networkTitle: {
    fontSize: 11,
    fontWeight: '800',
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
    fontWeight: '800',
  },
  exportSub: {
    fontSize: 9.5,
    marginTop: 1,
    lineHeight: 14,
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
    fontWeight: '800',
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
    lineHeight: 17,
    marginBottom: 16,
    opacity: 0.9,
  },
  deleteActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelDeleteBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
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
    borderRadius: 12,
    paddingVertical: 12,
  },
  confirmDeleteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  guestCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  guestTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  guestSub: {
    fontSize: 12,
    lineHeight: 18,
  },
  guestSignInBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestSignInBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
