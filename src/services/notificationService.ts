import { TransactionReceipt } from '../types';
import { ToastService } from './toastService';

export interface AppNotification {
  id: string;
  type: 'payment_received' | 'payment_sent' | 'blink_paid' | 'system';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  amount?: number;
  token?: 'SOL' | 'USDC' | 'SKR';
  signature?: string;
  blinkId?: string;
}

const STORAGE_KEY = 'tapblink_notifications_v1';
const CLEARED_KEY = 'tapblink_cleared_notifications_v1';
const CLEARED_TIME_KEY = 'tapblink_cleared_timestamp_v1';

class NotificationServiceManager {
  private notifications: AppNotification[] = [];
  private clearedSignatures: Set<string> = new Set();
  private clearedAtTimestamp: number = 0;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const rawCleared = localStorage.getItem(CLEARED_KEY);
      if (rawCleared) {
        this.clearedSignatures = new Set(JSON.parse(rawCleared));
      }
      const rawClearedTime = localStorage.getItem(CLEARED_TIME_KEY);
      if (rawClearedTime) {
        this.clearedAtTimestamp = parseInt(rawClearedTime, 10) || 0;
      }
    } catch {}

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Normalize and deduplicate stored notifications
          const seenSignatures = new Set<string>();
          const deduped: AppNotification[] = [];

          for (const item of parsed) {
            let n = item as AppNotification;
            if (!n || !n.id || !n.title) continue;

            if (
              n.type === 'blink_paid' &&
              (n.title.includes('Transfer') || n.title.startsWith('SOL Transfer') || n.title.startsWith('USDC Transfer') || n.title.startsWith('SKR Transfer'))
            ) {
              const shortPayer = n.message ? n.message.split(' ')[0] : 'Solana Wallet';
              const formattedAmt = n.amount
                ? (n.token === 'SOL' ? `${n.amount.toFixed(4)} SOL` : (n.token === 'SKR' ? `${n.amount.toFixed(2)} SKR` : `$${n.amount.toFixed(2)} USDC`))
                : '';
              n = {
                ...n,
                type: 'payment_received',
                title: `Payment Received ${formattedAmt ? `(+${formattedAmt})` : ''}`.trim(),
                message: `You received ${formattedAmt} from ${shortPayer} on Solana Devnet.`.trim(),
              };
            }

            if (n.signature) {
              if (seenSignatures.has(n.signature)) {
                // Duplicate signature found in storage — keep the richer one (e.g. blink_paid)
                const existingIdx = deduped.findIndex(x => x.signature === n.signature);
                if (existingIdx !== -1 && n.type === 'blink_paid' && deduped[existingIdx].type !== 'blink_paid') {
                  deduped[existingIdx] = n;
                }
                continue;
              }
              seenSignatures.add(n.signature);
            }

            // Also prevent duplicate identical messages within 60s
            const isNearDuplicate = deduped.some(x =>
              x.type === n.type &&
              x.amount === n.amount &&
              x.token === n.token &&
              Math.abs(x.timestamp - n.timestamp) < 60000
            );
            if (isNearDuplicate) continue;

            deduped.push(n);
          }

          this.notifications = deduped;
          this.saveToStorage();
        } else {
          this.notifications = [];
        }
      } else {
        this.notifications = [];
        this.saveToStorage();
      }
    } catch {
      this.notifications = [];
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifications));
      window.dispatchEvent(new CustomEvent('blink_notifications_updated'));
      window.dispatchEvent(new CustomEvent('tapblink_notifications_updated'));
    } catch {}
  }

  private saveClearedToStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CLEARED_KEY, JSON.stringify(Array.from(this.clearedSignatures)));
      localStorage.setItem(CLEARED_TIME_KEY, this.clearedAtTimestamp.toString());
    } catch {}
  }

  public getNotifications(): AppNotification[] {
    const seenSigs = new Set<string>();
    const result: AppNotification[] = [];

    const sorted = [...this.notifications]
      .filter((n) => n.id && n.title)
      .sort((a, b) => b.timestamp - a.timestamp);

    for (const n of sorted) {
      if (n.signature) {
        if (seenSigs.has(n.signature)) continue;
        seenSigs.add(n.signature);
      }
      result.push(n);
    }

    return result;
  }

  public getUnreadCount(): number {
    return this.getNotifications().filter(n => !n.read).length;
  }

  public markAllAsRead(): void {
    let changed = false;
    this.notifications.forEach(n => {
      if (!n.read) {
        n.read = true;
        changed = true;
      }
    });
    if (changed) {
      this.saveToStorage();
    }
  }

  public markAsRead(id: string): void {
    const item = this.notifications.find(n => n.id === id);
    if (item && !item.read) {
      item.read = true;
      this.saveToStorage();
    }
  }

  public deleteNotification(id: string): void {
    const item = this.notifications.find(n => n.id === id);
    if (item) {
      if (item.signature) {
        this.clearedSignatures.add(item.signature);
        this.clearedSignatures.add(`${item.signature}_${item.type}`);
      }
      this.clearedSignatures.add(item.id);
      this.saveClearedToStorage();
    }
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.saveToStorage();
  }

  public clearAll(): void {
    this.clearedAtTimestamp = Date.now();
    for (const n of this.notifications) {
      if (n.signature) {
        this.clearedSignatures.add(n.signature);
        this.clearedSignatures.add(`${n.signature}_${n.type}`);
      }
      if (n.id) {
        this.clearedSignatures.add(n.id);
      }
    }
    this.saveClearedToStorage();
    this.notifications = [];
    this.saveToStorage();
  }

  public addNotification(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'> & { timestamp?: number }): AppNotification {
    // Ignore invalid 0-amount or empty notifications
    if (
      (notification.type === 'payment_received' || notification.type === 'payment_sent' || notification.type === 'blink_paid') &&
      (notification.amount === undefined || notification.amount <= 0 || isNaN(notification.amount))
    ) {
      return { id: '', type: notification.type, title: '', message: '', timestamp: Date.now(), read: true };
    }

    // Ignore cleared/dismissed signatures or IDs
    if (notification.signature) {
      if (
        this.clearedSignatures.has(notification.signature) ||
        this.clearedSignatures.has(`${notification.signature}_${notification.type}`)
      ) {
        return { id: '', type: notification.type, title: '', message: '', timestamp: Date.now(), read: true };
      }
    }

    // Never re-add notifications if timestamp is older than clearedAtTimestamp
    if (notification.timestamp && this.clearedAtTimestamp > 0 && notification.timestamp <= this.clearedAtTimestamp) {
      return { id: '', type: notification.type, title: '', message: '', timestamp: Date.now(), read: true };
    }

    // Deduplicate by signature if present — any existing notification for this tx signature prevents duplication!
    if (notification.signature) {
      const existingIdx = this.notifications.findIndex(n => n.signature === notification.signature);
      if (existingIdx !== -1) {
        const existing = this.notifications[existingIdx];
        // If the new one is an explicit blink_paid and the existing was generic payment_received, upgrade it
        if (notification.type === 'blink_paid' && existing.type !== 'blink_paid') {
          this.notifications[existingIdx] = {
            ...existing,
            ...notification,
            id: existing.id,
            timestamp: existing.timestamp,
            read: existing.read,
          };
          this.saveToStorage();
          return this.notifications[existingIdx];
        }
        return existing;
      }
    }

    // Near-duplicate check: prevent identical amount + token + type within 45 seconds
    const now = Date.now();
    const nearDuplicate = this.notifications.find(n =>
      n.type === notification.type &&
      n.amount === notification.amount &&
      n.token === notification.token &&
      Math.abs(now - n.timestamp) < 45000
    );
    if (nearDuplicate) {
      return nearDuplicate;
    }

    const newNotif: AppNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      read: false,
    };

    this.notifications.unshift(newNotif);
    // Keep max 50 notifications
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50);
    }
    this.saveToStorage();

    if (newNotif.title && typeof window !== 'undefined') {
      try {
        // Guard: Only show live on-screen toast for fresh events (created within last 60 seconds)
        const isFresh = Math.abs(Date.now() - newNotif.timestamp) < 60000;
        if (isFresh) {
          if (newNotif.type === 'blink_paid') {
            ToastService.success(`${newNotif.title} (+${newNotif.amount ? (newNotif.token === 'SOL' ? `${newNotif.amount.toFixed(4)} SOL` : (newNotif.token === 'SKR' ? `${newNotif.amount.toFixed(2)} SKR` : `$${newNotif.amount.toFixed(2)} USDC`)) : ''})`);
          } else if (newNotif.type === 'payment_received') {
            ToastService.success(newNotif.title);
          }
        }
      } catch {}
    }

    return newNotif;
  }

  public notifyPaymentReceived(amount: number, token: 'SOL' | 'USDC' | 'SKR', sender: string, signature?: string): AppNotification {
    const shortSender = `${sender.slice(0, 4)}...${sender.slice(-4)}`;
    const formattedAmt = token === 'SOL' ? `${amount.toFixed(4)} SOL` : (token === 'SKR' ? `${amount.toFixed(2)} SKR` : `$${amount.toFixed(2)} USDC`);
    return this.addNotification({
      type: 'payment_received',
      title: `Payment Received (+${formattedAmt})`,
      message: `You received ${formattedAmt} from ${shortSender} on Solana Devnet.`,
      amount,
      token,
      signature,
    });
  }

  public notifyPaymentSent(amount: number, token: 'SOL' | 'USDC' | 'SKR', recipient: string, signature?: string): AppNotification {
    const shortRecipient = `${recipient.slice(0, 4)}...${recipient.slice(-4)}`;
    const formattedAmt = token === 'SOL' ? `${amount.toFixed(4)} SOL` : (token === 'SKR' ? `${amount.toFixed(2)} SKR` : `$${amount.toFixed(2)} USDC`);
    return this.addNotification({
      type: 'payment_sent',
      title: `Payment Sent (-${formattedAmt})`,
      message: `You sent ${formattedAmt} to ${shortRecipient} on Solana Devnet.`,
      amount,
      token,
      signature,
    });
  }

  public notifyBlinkPaid(blinkTitle: string, amount: number, token: 'SOL' | 'USDC' | 'SKR', payer: string, signature?: string, blinkId?: string): AppNotification {
    const shortPayer = `${payer.slice(0, 4)}...${payer.slice(-4)}`;
    const formattedAmt = token === 'SOL' ? `${amount.toFixed(4)} SOL` : (token === 'SKR' ? `${amount.toFixed(2)} SKR` : `$${amount.toFixed(2)} USDC`);
    return this.addNotification({
      type: 'blink_paid',
      title: `Blink Sale: ${blinkTitle}`,
      message: `${shortPayer} paid ${formattedAmt} for "${blinkTitle}".`,
      amount,
      token,
      signature,
      blinkId,
    });
  }
}

export const NotificationService = new NotificationServiceManager();

