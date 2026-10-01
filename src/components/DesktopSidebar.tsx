import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Layers,
  Bookmark,
  Radio,
  Store,
  Wallet,
  User,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Shield,
  Sun,
  Moon,
  HelpCircle,
  Bell,
  Settings,
  TrendingUp,
} from 'lucide-react-native';
import { BlinkBrandMark } from './BrandLogos';
import { PhantomIcon, SolflareIcon, BackpackIcon, CoinbaseIcon } from './WalletIcons';
import { PrivyIcon } from './PrivyIcon';
import { WalletAccount } from '../services/walletProviderService';
import { TabKey } from './FloatingMobileNav';
import { useTheme } from '../theme/ThemeContext';

interface DesktopSidebarProps {
  currentTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  activeAccount: WalletAccount | null;
  network: string;
  onToggleNetwork: () => void;
  onOpenWalletConnect: () => void;
  onOpenAbout?: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  onOpenSettings?: () => void;
  onToggleTheme?: () => void;
  isDark?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  currentTab,
  onSelectTab,
  activeAccount,
  network,
  onToggleNetwork,
  onOpenWalletConnect,
  onOpenAbout,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onOpenSettings,
  onToggleTheme,
  isDark: isDarkProp,
  isCollapsed: externalCollapsed,
  onToggleCollapse: externalToggleCollapse,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const { colors, isDark } = useTheme();

  const toggleCollapse = () => {
    if (externalToggleCollapse) {
      externalToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  const navItems = [
    { key: 'markets' as const, label: 'My Blinks', icon: Layers },
    { key: 'studio' as const, label: 'Blink Studio', icon: TrendingUp },
    { key: 'tap' as const, label: 'NFC Tap & Scan', icon: Radio },
    { key: 'wallet' as const, label: 'Pocket & Ledger', icon: Wallet },
    ...(activeAccount ? [{ key: 'profile' as const, label: 'Profile & Socials', icon: User }] : []),
  ];

  return (
    <View style={[
      styles.sidebar,
      { backgroundColor: colors.bg, borderRightColor: colors.border },
      isCollapsed && styles.sidebarCollapsed,
    ]}>
      {/* Brand Header */}
      <View style={[styles.brandRow, isCollapsed && styles.brandRowCollapsed]}>
        {!isCollapsed ? (
          <View style={styles.brandLeft}>
            <BlinkBrandMark size={32} />
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>Blink</Text>
            </View>
          </View>
        ) : (
          <View style={styles.collapsedBrandBtn}>
            <BlinkBrandMark size={32} />
          </View>
        )}
      </View>

      {/* Navigation List */}
      <View style={[styles.navSection, isCollapsed && styles.navSectionCollapsed]}>
        {navItems.map((item) => {
          const isActive = currentTab === item.key;
          const Icon = item.icon;

          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.navBtn,
                isCollapsed && styles.navBtnCollapsed,
                isActive && [styles.navBtnActive, { backgroundColor: colors.bgCard, borderColor: colors.borderStrong }],
              ]}
              onPress={() => onSelectTab(item.key)}
              activeOpacity={0.7}
              accessibilityLabel={item.label}
            >
              <Icon
                size={18}
                color={isActive ? colors.accent : colors.textMuted}
                strokeWidth={isActive ? 2.4 : 2}
              />
              {!isCollapsed && (
                <Text style={[
                  styles.navBtnText,
                  { color: colors.textMuted },
                  isActive && { color: colors.textPrimary, fontWeight: '700' },
                ]}>
                  {item.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bottom Footer */}
      <View style={[
        styles.footerSection,
        { borderTopColor: colors.border },
        isCollapsed && styles.footerSectionCollapsed,
      ]}>
        {/* Network Indicator */}
        <View
          style={[
            styles.networkPill,
            isCollapsed && styles.networkPillCollapsed,
            { backgroundColor: colors.bgPill, borderColor: colors.border },
          ]}
          accessibilityLabel="Network: Solana Devnet"
        >
          <View style={[styles.netDot, { backgroundColor: colors.success }]} />
          {!isCollapsed && <Text style={[styles.networkText, { color: colors.textSecondary }]}>Solana Devnet</Text>}
        </View>

        {/* Notifications Button */}
        {onOpenNotifications && (
          <TouchableOpacity
            style={[
              styles.themeToggleRow,
              isCollapsed && styles.themeToggleRowCollapsed,
              { backgroundColor: colors.bgPill, borderColor: colors.border },
            ]}
            onPress={onOpenNotifications}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
          >
            <View style={{ position: 'relative' }}>
              <Bell size={14} color={colors.textSecondary} />
              {unreadNotificationsCount > 0 && (
                <View style={{ position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
              )}
            </View>
            {!isCollapsed && (
              <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[styles.themeToggleText, { color: colors.textSecondary }]}>Notifications</Text>
                {unreadNotificationsCount > 0 && (
                  <View style={{ backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '800' }}>{unreadNotificationsCount}</Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Settings Button */}
        {onOpenSettings && (
          <TouchableOpacity
            style={[
              styles.themeToggleRow,
              isCollapsed && styles.themeToggleRowCollapsed,
              { backgroundColor: colors.bgPill, borderColor: colors.border },
            ]}
            onPress={onOpenSettings}
            activeOpacity={0.7}
            accessibilityLabel="App Settings"
          >
            <Settings size={14} color={colors.textSecondary} />
            {!isCollapsed && (
              <Text style={[styles.themeToggleText, { color: colors.textSecondary }]}>Settings</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Wallet Button */}
        <TouchableOpacity
          style={[
            styles.walletBtn,
            isCollapsed && styles.walletBtnCollapsed,
            { backgroundColor: colors.accent },
            activeAccount && [styles.walletBtnActive, { backgroundColor: colors.bgCard, borderColor: colors.border }],
          ]}
          onPress={onOpenWalletConnect}
          activeOpacity={0.8}
          accessibilityLabel="Connect Wallet"
        >
          {activeAccount ? (
            <View style={[styles.walletInfo, isCollapsed && styles.walletInfoCollapsed]}>
              {activeAccount.name === 'Phantom' && <PhantomIcon size={18} />}
              {activeAccount.name === 'Solflare' && <SolflareIcon size={18} />}
              {activeAccount.name === 'Backpack' && <BackpackIcon size={18} />}
              {activeAccount.name === 'Coinbase Wallet' && <CoinbaseIcon size={18} />}
              {!['Phantom', 'Solflare', 'Backpack', 'Coinbase Wallet'].includes(activeAccount.name) && (
                <Wallet size={18} color={colors.accent} />
              )}
              {!isCollapsed && (
                <Text style={[styles.walletAddress, { color: colors.textPrimary }]}>
                  {activeAccount?.publicKey && typeof activeAccount.publicKey === 'string'
                    ? `${activeAccount.publicKey.slice(0, 4)}...${activeAccount.publicKey.slice(-4)}`
                    : 'Connected'}
                </Text>
              )}
            </View>
          ) : (
            <View style={[styles.walletInfo, isCollapsed && styles.walletInfoCollapsed]}>
              <PrivyIcon size={16} />
              {!isCollapsed && <Text style={styles.connectWalletText}>Sign In with Privy</Text>}
            </View>
          )}
        </TouchableOpacity>

        {/* Footer Collapse Toggle */}
        <TouchableOpacity
          style={styles.bottomCollapseRow}
          onPress={toggleCollapse}
          activeOpacity={0.7}
        >
          {isCollapsed ? (
            <ChevronRight size={14} color={colors.textMuted} />
          ) : (
            <>
              <ChevronLeft size={14} color={colors.textMuted} />
              <Text style={[styles.bottomCollapseText, { color: colors.textMuted }]}>Collapse sidebar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    borderRightWidth: 1,
    padding: 16,
    justifyContent: 'space-between',
    height: '100%',
    transitionProperty: 'width, padding',
    transitionDuration: '200ms',
  } as any,
  sidebarCollapsed: {
    width: 76,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 4,
  },
  brandRowCollapsed: {
    justifyContent: 'center',
    marginBottom: 20,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '600',
  },
  collapseToggleBtn: {
    padding: 6,
    borderWidth: 1,
    borderRadius: 8,
  },
  collapsedBrandBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  expandMiniBadge: {
    marginTop: 6,
    padding: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  navSection: {
    gap: 6,
    flex: 1,
  },
  navSectionCollapsed: {
    alignItems: 'center',
    width: '100%',
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  navBtnCollapsed: {
    width: 48,
    height: 48,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBtnActive: {
    borderWidth: 1,
  },
  navBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  explainerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  explainerBtnCollapsed: {
    width: 48,
    height: 44,
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  explainerText: {
    fontSize: 10,
    fontWeight: '700',
  },
  footerSection: {
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 14,
  },
  footerSectionCollapsed: {
    alignItems: 'center',
    width: '100%',
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  networkPillCollapsed: {
    width: 36,
    height: 36,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: 'center',
    borderRadius: 18,
  },
  netDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  networkText: {
    fontSize: 10,
    fontWeight: '600',
  },
  themeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  themeToggleRowCollapsed: {
    width: 36,
    height: 36,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: 'center',
    borderRadius: 10,
  },
  themeToggleText: {
    fontSize: 10,
    fontWeight: '600',
  },
  walletBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletBtnCollapsed: {
    width: 48,
    height: 44,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  walletBtnActive: {
    borderWidth: 1,
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walletInfoCollapsed: {
    justifyContent: 'center',
    gap: 0,
  },
  walletAddress: {
    fontSize: 10,
    fontWeight: '700',
  },
  connectWalletText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  bottomCollapseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    marginTop: 4,
  },
  bottomCollapseText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
