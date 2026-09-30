import { TransactionReceipt } from '../types';

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

class NotificationServiceManager {
  private notifications: AppNotification[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.notifications = JSON.parse(raw);
      } else {
        // Initial welcome notification
        this.notifications = [
          {
            id: 'notif_welcome',
            type: 'system',
            title: 'Welcome to Blink!',
            message: 'Your programmable physical layer for Solana is ready. Tap, scan, and execute Actions instantly.',
            timestamp: Date.now(),
            read: false,
          },
        ];
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
      window.dispatchEvent(new CustomEvent('tapblink_notifications_updated'));
    } catch {}
  }

  public getNotifications(): AppNotification[] {
    return [...this.notifications].sort((a, b) => b.timestamp - a.timestamp);
  }

  public getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
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

  public addNotification(notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): AppNotification {
    const newNotif: AppNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      read: false,
    };

    // Deduplicate by signature if present
    if (newNotif.signature) {
      const exists = this.notifications.find(n => n.signature === newNotif.signature && n.type === newNotif.type);
      if (exists) return exists;
    }

    this.notifications.unshift(newNotif);
    // Keep max 50 notifications
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50);
    }
    this.saveToStorage();
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
