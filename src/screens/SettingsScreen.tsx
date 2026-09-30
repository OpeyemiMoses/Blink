import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
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
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { usePrivy } from '@privy-io/react-auth';
import { useExportWallet } from '@privy-io/react-auth/solana';
import { UserProfileService } from '../services/userProfileService';
import { ToastService } from '../services/toastService';
import { WalletAccount } from '../services/walletProviderService';

interface SettingsScreenProps {
  activeAccount: WalletAccount | null;
  onOpenWalletConnect?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  activeAccount,
  onOpenWalletConnect,
}) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { logout, authenticated } = usePrivy();
  const { exportWallet } = useExportWallet();
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      ToastService.success('Account deleted and local session cleared.');
    } catch (err) {
      ToastService.error('Failed to delete account data.');
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

      {/* Appearance & Theme Section */}
      <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>APPEARANCE & THEME</Text>
        <Text style={[styles.sectionExplainer, { color: colors.textMuted }]}>
          Choose your preferred theme. Changes update instantly across all screens.
        </Text>

        <View style={styles.themeToggleRow}>
          <TouchableOpacity
            style={[
              styles.themeOptionCard,
              { backgroundColor: colors.bgCardAlt, borderColor: colors.border },
              !isDark && [styles.themeOptionActive, { borderColor: colors.accent, backgroundColor: colors.accentSoft }],
            ]}
            onPress={() => {
              if (isDark) toggleTheme();
            }}
            activeOpacity={0.8}
          >
            <Sun size={24} color={!isDark ? colors.accent : colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.themeOptionTitle, { color: !isDark ? colors.accent : colors.textPrimary }]}>
                Light Mode
              </Text>
              <Text style={[styles.themeOptionSub, { color: colors.textSecondary }]}>Clean bright layout</Text>
            </View>
            {!isDark && <Check size={18} color={colors.accent} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.themeOptionCard,
              { backgroundColor: colors.bgCardAlt, borderColor: colors.border },
              isDark && [styles.themeOptionActive, { borderColor: colors.accent, backgroundColor: colors.accentSoft }],
            ]}
            onPress={() => {
              if (!isDark) toggleTheme();
            }}
            activeOpacity={0.8}
          >
            <Moon size={24} color={isDark ? colors.accent : colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.themeOptionTitle, { color: isDark ? colors.accent : colors.textPrimary }]}>
                Dark Mode
              </Text>
              <Text style={[styles.themeOptionSub, { color: colors.textSecondary }]}>Modern sleek dark layout</Text>
            </View>
            {isDark && <Check size={18} color={colors.accent} />}
          </TouchableOpacity>
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
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981' }}>Connected</Text>
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
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#F59E0B' }}>
              {isExporting ? 'Exporting...' : 'Export'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Account Danger Zone (Delete Account at the bottom) */}
      <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: '#EF4444' }]}>ACCOUNT DANGER ZONE</Text>

        {showDeleteConfirm ? (
          <View style={styles.deleteConfirmCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <AlertTriangle size={20} color="#EF4444" />
              <Text style={styles.deleteConfirmTitle}>Delete Account & Local Data?</Text>
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
            <Trash2 size={20} color="#EF4444" />
            <Text style={styles.deleteCardBtnText}>Delete Account</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 6,
    paddingTop: 12,
    paddingBottom: 100,
    maxWidth: 800,
    marginHorizontal: 'auto',
    width: '100%',
    gap: 16,
  },
  headerCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  screenSub: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sectionExplainer: {
    fontSize: 12,
    lineHeight: 16,
  },
  themeToggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  themeOptionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
  },
  themeOptionActive: {
    borderWidth: 1.5,
  },
  themeOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  themeOptionSub: {
    fontSize: 10,
    marginTop: 2,
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  networkTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  networkSub: {
    fontSize: 11,
    marginTop: 2,
  },
  activeDotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
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
    borderRadius: 14,
    padding: 16,
  },
  exportTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  exportSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  deleteCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
  },
  deleteCardBtnText: {
    color: '#EF4444',
    fontSize: 14,
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
    fontSize: 15,
    fontWeight: '800',
  },
  deleteConfirmSub: {
    color: '#EF4444',
    fontSize: 12,
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
    fontSize: 13,
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
    fontSize: 13,
    fontWeight: '700',
  },
});
