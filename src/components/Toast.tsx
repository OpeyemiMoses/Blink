import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react-native';
import { ToastService, ToastMessage } from '../services/toastService';
import { useTheme } from '../theme/ThemeContext';

export const Toast: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    const unsubscribe = ToastService.subscribeList((currentList) => {
      setToasts(currentList);
    });
    return unsubscribe;
  }, []);

  if (!toasts || toasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        const iconColor = isSuccess ? '#10B981' : isError ? '#EF4444' : colors.accent;
        const borderColor = isSuccess
          ? 'rgba(16, 185, 129, 0.4)'
          : isError
          ? 'rgba(239, 68, 68, 0.4)'
          : colors.accentBorder;

        const IconComponent = isSuccess ? CheckCircle2 : isError ? AlertCircle : Info;

        return (
          <View
            key={toast.id}
            style={[
              styles.toastCard,
              {
                backgroundColor: isDark ? 'rgba(20, 23, 36, 0.96)' : 'rgba(255, 255, 255, 0.98)',
                borderColor,
              },
            ]}
          >
            <View style={styles.iconBox}>
              <IconComponent size={18} color={iconColor} />
            </View>

            <Text style={[styles.message, { color: colors.textPrimary }]} numberOfLines={3}>
              {toast.message}
            </Text>

            <TouchableOpacity
              onPress={() => ToastService.dismiss(toast.id)}
              style={styles.closeBtn}
              activeOpacity={0.7}
              accessibilityLabel="Dismiss notification"
            >
              <X size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
    paddingHorizontal: 16,
    gap: 8,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    maxWidth: 520,
    width: '100%',
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  iconBox: {
    flexShrink: 0,
  },
  message: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
    flexShrink: 0,
  },
});
