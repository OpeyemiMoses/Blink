import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  Bell,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  CheckCheck,
  ExternalLink,
  Filter,
} from 'lucide-react-native';
import { NotificationService, AppNotification } from '../services/notificationService';
import { ReceiptService } from '../services/receiptService';
import { ReceiptModal } from '../components/ReceiptModal';
import { TransactionReceipt } from '../types';
import { useTheme } from '../theme/ThemeContext';

interface NotificationsScreenProps {
  onSelectTab?: (tab: any) => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onSelectTab,
}) => {
  const { colors, isDark } = useTheme();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'payments' | 'blinks'>('all');
  const [selectedReceipt, setSelectedReceipt] = useState<TransactionReceipt | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const reloadNotifications = () => {
    setNotifications(NotificationService.getNotifications());
  };

  useEffect(() => {
    reloadNotifications();
    if (typeof window !== 'undefined') {
      window.addEventListener('tapblink_notifications_updated', reloadNotifications);
      return () => {
        window.removeEventListener('tapblink_notifications_updated', reloadNotifications);
      };
    }
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    reloadNotifications();
    setTimeout(() => setRefreshing(false), 400);
  };

  const handleMarkAllRead = () => {
    NotificationService.markAllAsRead();
    reloadNotifications();
  };

  const handleSelectNotification = (n: AppNotification) => {
    NotificationService.markAsRead(n.id);
    reloadNotifications();

    if (n.signature) {
      const rcpt = ReceiptService.getReceiptBySignature(n.signature);
      if (rcpt) {
        setSelectedReceipt(rcpt);
      }
    }
  };

  const formatTime = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'payments') {
      return n.type === 'payment_received' || n.type === 'payment_sent';
    }
    if (activeFilter === 'blinks') {
      return n.type === 'blink_paid';
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
      }
    >
      {/* Header Banner */}
      <View style={[styles.headerCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.bellIconCircle, { backgroundColor: colors.accentSoft }]}>
              <Bell size={20} color={colors.accent} />
            </View>
            <View>
              <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Notifications</Text>
              <Text style={[styles.screenSub, { color: colors.textSecondary }]}>
                Real-time alerts for SOL, USDC & SKR payments and Blink sales
              </Text>
            </View>
          </View>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            style={[styles.markAllReadBtn, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
            onPress={handleMarkAllRead}
            activeOpacity={0.8}
          >
            <CheckCheck size={14} color={colors.accent} />
            <Text style={[styles.markAllReadText, { color: colors.accent }]}>
              Mark all as read ({unreadCount})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'payments', 'blinks'] as const).map((filter) => {
          const isActive = activeFilter === filter;
          const label = filter === 'all' ? 'All Activity' : filter === 'payments' ? 'Transfers' : 'Blink Sales';
          return (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterPill,
                { backgroundColor: colors.bgCard, borderColor: colors.border },
                isActive && [styles.filterPillActive, { backgroundColor: colors.accent, borderColor: colors.accent }],
              ]}
              onPress={() => setActiveFilter(filter)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterPillText,
                  { color: colors.textSecondary },
                  isActive && { color: '#FFFFFF', fontWeight: '800' },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Notifications Stream */}
      <View style={styles.streamList}>
        {filteredNotifications.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Bell size={42} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No notifications found</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              You will receive automated real-time notifications whenever someone sends you SOL, USDC, SKR, or pays for your created Blinks.
            </Text>
          </View>
        ) : (
          filteredNotifications.map((n) => {
            let IconComponent = Bell;
            let iconBg = 'rgba(91, 103, 246, 0.15)';
            let iconColor = colors.accent;

            if (n.type === 'payment_received') {
              IconComponent = ArrowDownLeft;
              iconBg = 'rgba(16, 185, 129, 0.15)';
              iconColor = '#10B981';
            } else if (n.type === 'payment_sent') {
              IconComponent = ArrowUpRight;
              iconBg = 'rgba(239, 68, 68, 0.15)';
              iconColor = '#EF4444';
            } else if (n.type === 'blink_paid') {
              IconComponent = Sparkles;
              iconBg = 'rgba(168, 85, 247, 0.15)';
              iconColor = '#A855F7';
            }

            return (
              <TouchableOpacity
                key={n.id}
                style={[
                  styles.notificationCard,
                  { backgroundColor: n.read ? colors.bgCard : colors.bgCardAlt, borderColor: n.read ? colors.border : colors.accent },
                ]}
                onPress={() => handleSelectNotification(n)}
                activeOpacity={0.8}
              >
                <View style={[styles.typeIconBox, { backgroundColor: iconBg }]}>
                  <IconComponent size={20} color={iconColor} />
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={[styles.notifTitle, { color: colors.textPrimary }, !n.read && { fontWeight: '800' }]}>
                      {n.title}
                    </Text>
                    <Text style={[styles.notifTime, { color: colors.textMuted }]}>{formatTime(n.timestamp)}</Text>
                  </View>
                  <Text style={[styles.notifMessage, { color: colors.textSecondary }]}>{n.message}</Text>

                  {n.signature && (
                    <View style={styles.viewReceiptRow}>
                      <Text style={[styles.viewReceiptText, { color: colors.accent }]}>View Transaction Receipt</Text>
                      <ExternalLink size={11} color={colors.accent} />
                    </View>
                  )}
                </View>

                {!n.read && <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Receipt Modal when notification is clicked */}
      <ReceiptModal
        visible={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        receipt={selectedReceipt}
      />
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
    gap: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bellIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  markAllReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    width: '100%',
  },
  markAllReadText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterPillActive: {
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  streamList: {
    gap: 10,
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 36,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 400,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  typeIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  notifTime: {
    fontSize: 11,
  },
  notifMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  viewReceiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  viewReceiptText: {
    fontSize: 12,
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
});
