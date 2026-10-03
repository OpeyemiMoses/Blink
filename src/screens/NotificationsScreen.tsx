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
  Trash2,
  ChevronDown,
} from 'lucide-react-native';
import { NotificationService, AppNotification } from '../services/notificationService';
import { ReceiptService } from '../services/receiptService';
import { ReceiptModal } from '../components/ReceiptModal';
import { TransactionReceipt } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { BlinkBrandMark } from '../components/BrandLogos';

interface NotificationsScreenProps {
  onSelectTab?: (tab: any) => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onSelectTab,
}) => {
  const { colors, isDark } = useTheme();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'payments' | 'blinks'>('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<TransactionReceipt | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const reloadNotifications = () => {
    setNotifications(NotificationService.getNotifications());
  };

  useEffect(() => {
    reloadNotifications();
    if (typeof window !== 'undefined') {
      window.addEventListener('blink_notifications_updated', reloadNotifications);
      window.addEventListener('tapblink_notifications_updated', reloadNotifications);
      return () => {
        window.removeEventListener('blink_notifications_updated', reloadNotifications);
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

  const handleClearAll = () => {
    NotificationService.clearAll();
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
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {unreadCount > 0 && (
              <TouchableOpacity
                style={[
                  styles.iconOnlyActionBtn,
                  { backgroundColor: colors.accentSoft, borderColor: colors.accent },
                ]}
                onPress={handleMarkAllRead}
                activeOpacity={0.8}
              >
                <CheckCheck size={18} color={colors.accent} />
              </TouchableOpacity>
            )}

            {notifications.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.iconOnlyActionBtn,
                  {
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    borderColor: 'rgba(239, 68, 68, 0.35)',
                  },
                ]}
                onPress={handleClearAll}
                activeOpacity={0.8}
              >
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Filter Dropdown Menu */}
      <View style={{ marginBottom: 0, zIndex: 10 }}>
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.bgCard,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
          onPress={() => setIsDropdownOpen(!isDropdownOpen)}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Filter size={13} color={colors.accent} />
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textPrimary }}>
              Filter: {activeFilter === 'all' ? 'All Activity' : activeFilter === 'payments' ? 'Transfers' : 'Blink Sales'}
            </Text>
          </View>
          <ChevronDown size={13} color={colors.textSecondary} />
        </TouchableOpacity>

        {isDropdownOpen && (
          <View
            style={{
              marginTop: 4,
              backgroundColor: colors.bgCard,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              paddingVertical: 4,
              elevation: 4,
            }}
          >
            {[
              { id: 'all', label: 'All Activity', desc: 'Show all notifications' },
              { id: 'payments', label: 'Transfers', desc: 'Received & sent SOL / USDC / SKR' },
              { id: 'blinks', label: 'Blink Sales', desc: 'Purchases on your Blinks' },
            ].map((item) => {
              const selected = activeFilter === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: selected ? colors.accentSoft : 'transparent',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onPress={() => {
                    setActiveFilter(item.id as any);
                    setIsDropdownOpen(false);
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: selected ? '800' : '600', color: selected ? colors.accent : colors.textPrimary }}>
                      {item.label}
                    </Text>
                    <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 1 }}>{item.desc}</Text>
                  </View>
                  {selected && <CheckCheck size={14} color={colors.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
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
                <View style={[
                  styles.typeIconBox,
                  { backgroundColor: iconBg },
                  n.type === 'blink_paid' && { backgroundColor: 'rgba(99, 102, 241, 0.22)', borderColor: '#6366F1', borderWidth: 1 }
                ]}>
                  {n.type === 'blink_paid' ? (
                    <BlinkBrandMark size={22} />
                  ) : (
                    <IconComponent size={20} color={iconColor} />
                  )}
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={[styles.notifTitle, { color: colors.textPrimary }, !n.read && { fontWeight: '800' }]}>
                      {n.title}
                    </Text>
                    <Text style={[styles.notifTime, { color: colors.textMuted }]}>{formatTime(n.timestamp)}</Text>
                  </View>
                  <Text style={[styles.notifMessage, { color: colors.textSecondary }]}>{n.message}</Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    {n.type === 'blink_paid' ? (
                      <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.4)', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: colors.accent, letterSpacing: 0.5 }}>BLINK SALE</Text>
                      </View>
                    ) : (
                      <View />
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      {n.signature && (
                        <View style={styles.viewReceiptRow}>
                          <Text style={[styles.viewReceiptText, { color: colors.accent }]}>View Receipt</Text>
                          <ExternalLink size={11} color={colors.accent} />
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={(e) => {
                          (e as any)?.stopPropagation?.();
                          NotificationService.deleteNotification(n.id);
                          reloadNotifications();
                        }}
                        style={{ padding: 4 }}
                        activeOpacity={0.6}
                      >
                        <Trash2 size={13} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
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
    gap: 0,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bellIconCircle: {
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
  markAllReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    width: '100%',
  },
  iconOnlyActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllReadText: {
    fontSize: 11,
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
    fontSize: 10,
    fontWeight: '600',
  },
  streamList: {
    gap: 5,
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 400,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  notifTime: {
    fontSize: 10,
  },
  notifMessage: {
    fontSize: 11,
    lineHeight: 18,
  },
  viewReceiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  viewReceiptText: {
    fontSize: 10,
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
});
