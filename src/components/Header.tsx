import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Bell, Settings, User } from 'lucide-react-native';
import { WalletAccount } from '../services/walletProviderService';
import { BlinkBrandMark } from './BrandLogos';
import { useTheme } from '../theme/ThemeContext';

interface HeaderProps {
  network: string;
  activeAccount: WalletAccount | null;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  onOpenSettings?: () => void;
  onOpenProfile?: () => void;
  avatarUrl?: string;
  isDark?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  network,
  activeAccount,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onOpenSettings,
  onOpenProfile,
  avatarUrl,
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

        {/* Right Controls: Notifications, Settings, Profile Avatar */}
        <View style={styles.rightControls}>
          {/* Notifications Bell */}
          {onOpenNotifications && (
            <TouchableOpacity
              style={[styles.iconHeaderBtn, { backgroundColor: colors.bgPill, borderColor: colors.border }]}
              onPress={onOpenNotifications}
              activeOpacity={0.7}
              accessibilityLabel="Open Notifications"
            >
              <Bell size={15} color={colors.textSecondary} />
              {unreadNotificationsCount > 0 && (
                <View style={[styles.badgeDot, { backgroundColor: colors.accent }]} />
              )}
            </TouchableOpacity>
          )}

          {/* Settings Gear */}
          {onOpenSettings && (
            <TouchableOpacity
              style={[styles.iconHeaderBtn, { backgroundColor: colors.bgPill, borderColor: colors.border }]}
              onPress={onOpenSettings}
              activeOpacity={0.7}
              accessibilityLabel="Open App Settings"
            >
              <Settings size={15} color={colors.textSecondary} />
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
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconHeaderBtn: {
    position: 'relative',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  profileAvatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
