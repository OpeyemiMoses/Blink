import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Wallet, Sparkles, Shield, Sun, Moon, User, HelpCircle } from 'lucide-react-native';
import { WalletAccount } from '../services/walletProviderService';
import { PhantomIcon, SolflareIcon, BackpackIcon, CoinbaseIcon } from './WalletIcons';
import { BlinkBrandMark } from './BrandLogos';
import { PrivyIcon } from './PrivyIcon';
import { useTheme } from '../theme/ThemeContext';

interface HeaderProps {
  network: string;
  activeAccount: WalletAccount | null;
  onToggleNetwork?: () => void;
  onOpenWalletConnect?: () => void;
  onOpenAbout?: () => void;
  onToggleTheme?: () => void;
  onOpenProfile?: () => void;
  avatarUrl?: string;
  isDark?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  network,
  activeAccount,
  onToggleNetwork,
  onOpenWalletConnect,
  onOpenAbout,
  onToggleTheme,
  onOpenProfile,
  avatarUrl,
  isDark,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
      <View style={styles.inner}>
        {/* Brand Group */}
        <View style={styles.brandGroup}>
          <BlinkBrandMark size={34} />
          <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>Blink</Text>
        </View>

        {/* Right Controls: Only Theme Toggle and Profile Picture */}
        <View style={styles.rightControls}>
          {/* Theme Toggle */}
          {onToggleTheme && (
            <TouchableOpacity
              style={[styles.themeToggle, { backgroundColor: colors.bgPill, borderColor: colors.border }]}
              onPress={onToggleTheme}
              activeOpacity={0.7}
              accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark
                ? <Sun size={14} color={colors.textSecondary} />
                : <Moon size={14} color={colors.textSecondary} />
              }
            </TouchableOpacity>
          )}

          {/* Top Profile Avatar Button */}
          {onOpenProfile && (
            <TouchableOpacity
              style={[styles.profileAvatarBtn, { borderColor: colors.border }]}
              onPress={onOpenProfile}
              activeOpacity={0.8}
              accessibilityLabel="Open Profile and Identity"
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: colors.accentSoft }]}>
                  <User size={16} color={colors.accent} />
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    width: '100%',
  },
  inner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: 960,
    width: '100%',
    marginHorizontal: 'auto',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  aboutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
    marginLeft: 4,
  },
  aboutPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  networkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  networkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  themeToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  walletBtnConnected: {
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  addressTextConnected: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  profileAvatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
