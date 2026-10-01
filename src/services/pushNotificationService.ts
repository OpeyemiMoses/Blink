/**
 * PushNotificationService
 * Handles expo-notifications registration, permission requests, and local push delivery.
 * Used for real-time sale alerts and payment received notifications.
 */
import { Platform } from 'react-native';

// Conditional imports — expo-notifications only available in native builds (not web)
let Notifications: any = null;
let Device: any = null;

try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
} catch {
  // Running in web environment — push notifications not available
}

export class PushNotificationService {
  private static _expoPushToken: string | null = null;
  private static _permissionGranted = false;

  /**
   * Configure notification behaviour (sound, badge, alert) and request permissions.
   * Call once at app startup (e.g. in App.tsx useEffect).
   */
  static async initialize(): Promise<void> {
    if (!Notifications || !Device) return; // Web/dev — skip
    if (Platform.OS === 'web') return;

    // Set default handler behaviour
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Request permissions
    if (Device.isDevice) {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      this._permissionGranted = finalStatus === 'granted';
    } else {
      // Emulator — still configure, just won't receive remote pushes
      this._permissionGranted = true;
    }

    // Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('blink-sales', {
        name: 'Blink Sales',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 100, 250],
        lightColor: '#5B67F6',
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync('blink-payments', {
        name: 'Payments',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200],
        lightColor: '#10B981',
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync('clock-in-reminder', {
        name: 'Clock In Streaks',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 100, 250],
        lightColor: '#10B981',
        sound: 'default',
      });
    }
  }

  /** Returns true if push permission was granted */
  static isPermissionGranted(): boolean {
    return this._permissionGranted;
  }

  /**
   * Schedule a local push notification immediately.
   * Works on native (Android/iOS). On web, falls back silently.
   */
  static async scheduleLocal(opts: {
    title: string;
    body: string;
    data?: Record<string, any>;
    channelId?: string;
    badgeCount?: number;
  }): Promise<void> {
    if (!Notifications || Platform.OS === 'web') return;
    if (!this._permissionGranted) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: opts.title,
          body: opts.body,
          data: opts.data || {},
          sound: 'default',
          badge: opts.badgeCount,
        },
        trigger: null, // Immediate
        ...(Platform.OS === 'android' && opts.channelId
          ? { channelId: opts.channelId }
          : {}),
      });
    } catch (err) {
      console.warn('[PushNotificationService] scheduleLocal failed:', err);
    }
  }

  /** Convenience: fire a "Blink Sale" notification */
  static async notifyBlinkSale(opts: {
    blinkName: string;
    amount: number;
    token: string;
    buyerLabel?: string;
  }): Promise<void> {
    const { blinkName, amount, token, buyerLabel } = opts;
    const amountStr = token === 'USDC' ? `$${amount.toFixed(2)} USDC` : `${amount.toFixed(4)} ${token}`;
    await this.scheduleLocal({
      title: `Blink Sale — ${blinkName}`,
      body: buyerLabel
        ? `${buyerLabel} paid ${amountStr}`
        : `You received ${amountStr}`,
      data: { type: 'blink_sale', blinkName, amount, token },
      channelId: 'blink-sales',
    });
  }

  /** Convenience: fire a "Payment Received" notification */
  static async notifyPaymentReceived(opts: {
    amount: number;
    token: string;
    fromLabel?: string;
  }): Promise<void> {
    const { amount, token, fromLabel } = opts;
    const amountStr = token === 'USDC' ? `$${amount.toFixed(2)} USDC` : `${amount.toFixed(4)} ${token}`;
    await this.scheduleLocal({
      title: `Payment Received`,
      body: fromLabel
        ? `${fromLabel} sent you ${amountStr}`
        : `You received ${amountStr}`,
      data: { type: 'payment_received', amount, token },
      channelId: 'blink-payments',
    });
  }

  /**
   * Schedule a "Clock In" reminder notification based on when the user clocked in.
   * Defaults to 24 hours (86400 seconds) later.
   */
  static async scheduleClockInReminder(
    secondsFromNow: number = 86400,
    currentStreak: number = 0
  ): Promise<void> {
    if (!Notifications || Platform.OS === 'web') {
      // In web browser, check if Notification API is available
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const ms = secondsFromNow * 1000;
        const streakText = currentStreak > 0 ? `Protect your Day ${currentStreak} streak!` : 'Start your Clock In streak!';
        setTimeout(() => {
          try {
            new Notification('Time to Clock In!', {
              body: `${streakText} Clock in today to keep your SKR discount bonus active.`,
              icon: '/favicon.ico',
            });
          } catch {}
        }, ms);
      }
      return;
    }

    try {
      // Cancel previous clock-in notifications if possible
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const item of scheduled) {
        if (item.content.data?.type === 'clock_in_reminder') {
          await Notifications.cancelScheduledNotificationAsync(item.identifier);
        }
      }

      const streakText = currentStreak > 0
        ? `Protect your Day ${currentStreak} streak!`
        : `Start building your Clock In streak!`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time to Clock In!',
          body: `${streakText} Clock in today to keep your SKR bonus discount active.`,
          data: { type: 'clock_in_reminder', currentStreak },
          sound: 'default',
        },
        trigger: {
          seconds: Math.max(60, secondsFromNow),
        },
        ...(Platform.OS === 'android' ? { channelId: 'clock-in-reminder' } : {}),
      });
    } catch (err) {
      console.warn('[PushNotificationService] Failed to schedule clock-in reminder:', err);
    }
  }

  /** Add a notification response listener (user tapped the notification) */
  static addResponseListener(
    callback: (response: any) => void
  ): (() => void) | null {
    if (!Notifications) return null;
    const subscription = Notifications.addNotificationResponseReceivedListener(callback);
    return () => subscription.remove();
  }
}
