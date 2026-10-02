import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  X,
  Bell,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  Trash2,
  Filter,
  ChevronDown,
} from 'lucide-react-native';
import { NotificationService, AppNotification } from '../services/notificationService';
import { ReceiptService } from '../services/receiptService';
import { ReceiptModal } from './ReceiptModal';
import { TransactionReceipt } from '../types';
import { useTheme } from '../theme/ThemeContext';
import { BlinkBrandMark } from './BrandLogos';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'payments' | 'blinks'>('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<TransactionReceipt | null>(null);

  const reloadNotifications = () => {
    setNotifications(NotificationService.getNotifications());
  };

  useEffect(() => {
    if (visible) {
      reloadNotifications();
    }
  }, [visible]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('blink_notifications_updated', reloadNotifications);
      window.addEventListener('tapblink_notifications_updated', reloadNotifications);
      return () => {
        window.removeEventListener('blink_notifications_updated', reloadNotifications);
        window.removeEventListener('tapblink_notifications_updated', reloadNotifications);
      };
    }
  }, []);

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

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View style={styles.headerTitleRow}>
                <Bell size={18} color={colors.accent} />
                <Text style={[styles.title, { color: colors.textPrimary }]}>Notifications</Text>
                {unreadCount > 0 && (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={handleMarkAllRead} style={[styles.closeBtn, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]} activeOpacity={0.7}>
                    <CheckCheck size={16} color={colors.accent} />
                  </TouchableOpacity>
                )}
                {notifications.length > 0 && (
                  <TouchableOpacity onPress={handleClearAll} style={[styles.closeBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.35)' }]} activeOpacity={0.7}>
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]} activeOpacity={0.7}>
                  <X size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Filter Dropdown Menu */}
            <View style={{ paddingHorizontal: 12, paddingTop: 6, zIndex: 10 }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: colors.bgCardAlt,
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
                  <Filter size={14} color={colors.accent} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textPrimary }}>
                    Filter: {activeFilter === 'all' ? 'All Activity' : activeFilter === 'payments' ? 'Transfers' : 'Blink Sales'}
                  </Text>
                </View>
                <ChevronDown size={14} color={colors.textSecondary} />
              </TouchableOpacity>

              {isDropdownOpen && (
                <View
                  style={{
                    marginTop: 4,
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingVertical: 4,
                    elevation: 4,
                  }}
                >
                  {[
                    { id: 'all', label: 'All Activity' },
                    { id: 'payments', label: 'Transfers' },
                    { id: 'blinks', label: 'Blink Sales' },
                  ].map((item) => {
                    const selected = activeFilter === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
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
                        <Text style={{ fontSize: 10, fontWeight: selected ? '800' : '600', color: selected ? colors.accent : colors.textPrimary }}>
                          {item.label}
                        </Text>
                        {selected && <CheckCheck size={12} color={colors.accent} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* List */}
            <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
              {filteredNotifications.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Bell size={36} color={colors.textMuted} />
                  <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No notifications yet</Text>
                  <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                    When you receive SOL, USDC, SKR, or someone pays to your Blink, notifications will appear here.
                  </Text>
                </View>
              ) : (
                notifications.map((n) => {
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
                        styles.itemCard,
                        { backgroundColor: n.read ? colors.bgCard : colors.bgCardAlt, borderColor: n.read ? colors.border : colors.accent },
                      ]}
                      onPress={() => handleSelectNotification(n)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.iconWrap,
                        { backgroundColor: iconBg },
                        n.type === 'blink_paid' && { backgroundColor: 'rgba(99, 102, 241, 0.22)', borderColor: '#6366F1', borderWidth: 1 }
                      ]}>
                        {n.type === 'blink_paid' ? (
                          <BlinkBrandMark size={20} />
                        ) : (
                          <IconComponent size={18} color={iconColor} />
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={styles.itemTopRow}>
                          <Text style={[styles.itemTitle, { color: colors.textPrimary }, !n.read && { fontWeight: '800' }]}>
                            {n.title}
                          </Text>
                          <Text style={[styles.itemTime, { color: colors.textMuted }]}>
                            {formatTime(n.timestamp)}
                          </Text>
                        </View>
                        <Text style={[styles.itemMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                          {n.message}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                          {n.type === 'blink_paid' ? (
                            <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.4)', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: '800', color: colors.accent, letterSpacing: 0.5 }}>BLINK SALE</Text>
                            </View>
                          ) : (
                            <View />
                          )}
                          {n.signature && (
                            <View style={styles.receiptHintRow}>
                              <Text style={[styles.receiptHintText, { color: colors.accent }]}>View Receipt</Text>
                              <ExternalLink size={10} color={colors.accent} />
                            </View>
                          )}
                        </View>
                      </View>

                      {!n.read && <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Receipt Modal when notification is clicked */}
      <ReceiptModal
        visible={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        receipt={selectedReceipt}
      />
    </>
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
    maxHeight: '82%',
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
  unreadBadge: {
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markReadText: {
    fontSize: 9.5,
    fontWeight: '700',
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
    maxHeight: 460,
  },
  scrollContent: {
    padding: 10,
    gap: 5,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 16,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemTime: {
    fontSize: 10,
  },
  itemMessage: {
    fontSize: 10,
    lineHeight: 16,
  },
  receiptHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  receiptHintText: {
    fontSize: 10,
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
});
