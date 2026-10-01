import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Layers, Radio, Wallet, User, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

export type TabKey = 'markets' | 'saved' | 'tap' | 'studio' | 'wallet' | 'profile' | 'notifications' | 'settings';

interface FloatingMobileNavProps {
  currentTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  isAuthenticated?: boolean;
}

export const FloatingMobileNav: React.FC<FloatingMobileNavProps> = ({
  currentTab,
  onSelectTab,
  isAuthenticated = false,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const { colors, isDark } = useTheme();

  const tabs = [
    { key: 'markets' as const, label: 'Blinks', icon: Layers },
    { key: 'studio' as const, label: 'Studio', icon: TrendingUp },
    { key: 'tap' as const, label: 'Tap & Scan', icon: Radio },
    { key: 'wallet' as const, label: 'Pocket', icon: Wallet },
    ...(isAuthenticated ? [{ key: 'profile' as const, label: 'Profile', icon: User }] : []),
  ];

  const currentActiveTabObj = tabs.find((t) => t.key === currentTab) || tabs[0];
  const ActiveIcon = currentActiveTabObj.icon;

  const navBg = isDark ? 'rgba(15, 17, 26, 0.96)' : 'rgba(255,255,255,0.97)';
  const borderColor = colors.border;

  return (
    <View style={styles.dockWrapper} pointerEvents="box-none">
      {collapsed ? (
        <TouchableOpacity
          style={[styles.collapsedCapsule, { backgroundColor: navBg, borderColor }]}
          onPress={() => setCollapsed(false)}
          activeOpacity={0.8}
          accessibilityLabel="Expand navigation"
        >
          <View style={[styles.collapsedIconWrap, { backgroundColor: colors.navActiveBg }]}>
            <ActiveIcon size={16} color={colors.navActiveIcon} strokeWidth={2.4} />
          </View>
          <Text style={[styles.collapsedLabel, { color: colors.textPrimary }]}>{currentActiveTabObj.label}</Text>
          <ChevronUp size={14} color={colors.textMuted} />
        </TouchableOpacity>
      ) : (
        <View style={[styles.dockCapsule, { backgroundColor: navBg, borderColor }]}>
          {tabs.map((tab) => {
            const isActive = currentTab === tab.key;
            const Icon = tab.icon;

            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabItem,
                  isActive && [styles.tabItemActive, { backgroundColor: colors.navActiveBg }],
                ]}
                onPress={() => onSelectTab(tab.key)}
                activeOpacity={0.8}
                accessibilityLabel={tab.label}
              >
                <Icon
                  size={16}
                  color={isActive ? colors.navActiveIcon : colors.navInactiveIcon}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                <Text style={[
                  styles.tabLabel,
                  { color: colors.navInactiveIcon },
                  isActive && [styles.tabLabelActive, { color: colors.navActiveIcon }],
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.minimizeBtn, { backgroundColor: isDark ? '#161924' : colors.bgCardAlt }]}
            onPress={() => setCollapsed(true)}
            activeOpacity={0.7}
            accessibilityLabel="Collapse navigation bar"
          >
            <ChevronDown size={14} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  dockWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 14,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  dockCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 36,
    paddingVertical: 5,
    paddingLeft: 6,
    paddingRight: 8,
    gap: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
    maxWidth: 400,
    width: '92%',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 28,
    gap: 3,
  },
  tabItemActive: {
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  tabLabelActive: {
    fontWeight: '800',
  },
  minimizeBtn: {
    padding: 7,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  collapsedCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 26,
    paddingVertical: 7,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 6,
  },
  collapsedIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
});
