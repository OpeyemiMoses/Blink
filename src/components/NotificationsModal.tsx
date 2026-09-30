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
} from 'lucide-react-native';
import { NotificationService, AppNotification } from '../services/notificationService';
import { ReceiptService } from '../services/receiptService';
import { ReceiptModal } from './ReceiptModal';
import { TransactionReceipt } from '../types';
import { useTheme } from '../theme/ThemeContext';

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
      window.addEventListener('tapblink_notifications_updated', reloadNotifications);
      return () => {
        window.removeEventListener('tapblink_notifications_updated', reloadNotifications);
      };
    }
  }, []);

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

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadBtn} activeOpacity={0.7}>
                    <CheckCheck size={14} color={colors.accent} />
                    <Text style={[styles.markReadText, { color: colors.accent }]}>Mark read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]} activeOpacity={0.7}>
                  <X size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* List */}
            <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
              {notifications.length === 0 ? (
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
                      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                        <IconComponent size={18} color={iconColor} />
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
                        {n.signature && (
                          <View style={styles.receiptHintRow}>
                            <Text style={[styles.receiptHintText, { color: colors.accent }]}>View Receipt</Text>
                            <ExternalLink size={10} color={colors.accent} />
                          </View>
                        )}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  unreadBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  markReadText: {
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollList: {
    maxHeight: 460,
  },
  scrollContent: {
    padding: 16,
    gap: 10,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 13,
    fontWeight: '700',
  },
  itemTime: {
    fontSize: 10,
  },
  itemMessage: {
    fontSize: 12,
    lineHeight: 16,
  },
  receiptHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  receiptHintText: {
    fontSize: 11,
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
});
