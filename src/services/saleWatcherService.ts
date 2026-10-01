import { NotificationService } from './notificationService';
import { ReceiptService } from './receiptService';
import { TransactionReceipt } from '../types';
import { PushNotificationService } from './pushNotificationService';
import { getApiUrl } from './apiConfig';

const NOTIFIED_STORAGE_KEY = 'tapblink_notified_sales_v1';

class SaleWatcherManager {
  private activeAddress: string | null = null;
  private activeUsername: string | null = null;
  private eventSource: EventSource | null = null;
  private pollTimer: any = null;
  private notifiedSignatures: Set<string> = new Set();
  private isStarted: boolean = false;
  private lastPollTimestamp: number = 0;

  constructor() {
    this.loadNotifiedFromStorage();
  }

  private loadNotifiedFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(NOTIFIED_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.notifiedSignatures = new Set(arr);
        }
      }
    } catch {}
  }

  private saveNotifiedToStorage() {
    if (typeof window === 'undefined') return;
    try {
      // Keep up to 200 most recent signatures
      const list = Array.from(this.notifiedSignatures).slice(-200);
      localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }

  public start(address: string | undefined | null, username?: string | null): void {
    const cleanAddr = (address || '').trim().toLowerCase();
    const cleanUser = (username || '').trim().toLowerCase().replace(/^@+/, '');

    if (!cleanAddr) {
      this.stop();
      return;
    }

    if (this.isStarted && this.activeAddress === cleanAddr && this.activeUsername === cleanUser) {
      return;
    }

    this.stop();
    this.activeAddress = cleanAddr;
    this.activeUsername = cleanUser;
    this.isStarted = true;

    // 1. Initial quick catch-up check of recent receipts
    this.checkRecentReceipts();

    // 2. Connect to real-time Server-Sent Events (SSE)
    this.connectSse();

    // 3. Fallback fast poll every 2 seconds in case SSE drops or reconnects
    this.pollTimer = setInterval(() => {
      this.checkRecentReceipts();
    }, 2000);
  }

  public stop(): void {
    this.isStarted = false;
    this.activeAddress = null;
    this.activeUsername = null;

    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private connectSse(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined' || !this.activeAddress) return;

    try {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }

      const params = new URLSearchParams({
        address: this.activeAddress,
        username: this.activeUsername || '',
      });

      const es = new EventSource(getApiUrl(`/api/events?${params.toString()}`));
      this.eventSource = es;

      es.addEventListener('blink_sale', (evt: MessageEvent) => {
        try {
          const data = JSON.parse(evt.data);
          if (data && data.receipt) {
            this.handleIncomingSaleReceipt(data.receipt);
          }
        } catch (err) {
          console.warn('[SaleWatcher] Error parsing blink_sale event:', err);
        }
      });

      es.onerror = () => {
        // SSE error or disconnect; EventSource auto-reconnects natively.
      };
    } catch (sseErr) {
      console.warn('[SaleWatcher] SSE init failed, relying on fast polling:', sseErr);
    }
  }

  private async checkRecentReceipts(): Promise<void> {
    if (!this.activeAddress) return;

    try {
      const url = `/api/receipts?address=${encodeURIComponent(this.activeAddress)}${this.activeUsername ? `&username=${encodeURIComponent(this.activeUsername)}` : ''}`;
      const res = await fetch(getApiUrl(url));
      if (!res.ok) return;

      const data = await res.json();
      if (data && data.success && Array.isArray(data.receipts)) {
        for (const rcpt of data.receipts) {
          // Only process actual Blink Sale receipts (must have a blinkId).
          // Regular P2P transfers do NOT have a blinkId and must be skipped.
          if (!rcpt.blinkId) continue;
          this.handleIncomingSaleReceipt(rcpt);
        }
      }
    } catch {}
  }

  private handleIncomingSaleReceipt(rcpt: TransactionReceipt): void {
    if (!rcpt || !rcpt.signature || !this.activeAddress) return;

    // Hard guard: only receipts linked to an actual Blink (must have blinkId).
    // Plain P2P transfers have no blinkId and must never trigger a sale notification.
    if (!rcpt.blinkId) return;

    const sig = rcpt.signature;
    const recipClean = (rcpt.recipientAddress || '').toLowerCase().trim();
    const recipCleanNoAt = recipClean.replace(/^@+/, '');
    const payerClean = (rcpt.payerAddress || '').toLowerCase().trim().replace(/^@+/, '');
    const myAddr = (this.activeAddress || '').toLowerCase().trim();
    const myUser = (this.activeUsername || '').toLowerCase().trim().replace(/^@+/, '');

    // Check if the active user is the recipient of this payment/sale
    const isRecipient =
      recipClean === myAddr ||
      recipCleanNoAt === myAddr ||
      (myUser && (recipClean === myUser || recipCleanNoAt === myUser || recipClean === `@${myUser}`));

    // If active user is NOT the recipient, ignore
    if (!isRecipient) return;

    // Self-transfers don't generate sale notifications
    if (payerClean === myAddr || (myUser && payerClean === myUser)) return;

    // Check if already notified
    if (this.notifiedSignatures.has(sig)) return;

    // Check existing notifications in NotificationService to guarantee no duplicates
    const existing = NotificationService.getNotifications();
    if (existing.some(n => n.signature === sig && n.type === 'blink_paid')) {
      this.notifiedSignatures.add(sig);
      this.saveNotifiedToStorage();
      return;
    }

    // Save receipt to local cache
    ReceiptService.saveReceipt(rcpt);

    // Mark signature as notified
    this.notifiedSignatures.add(sig);
    this.saveNotifiedToStorage();

    // Trigger instant Blink Sale notification!
    const title = rcpt.blinkTitle || 'Blink Sale';
    const amount = rcpt.amount || 0;
    const token = (rcpt.token as 'SOL' | 'USDC' | 'SKR') || 'SOL';
    const payer = rcpt.payerAddress || 'Solana Wallet';

    NotificationService.notifyBlinkPaid(
      title,
      amount,
      token,
      payer,
      sig,
      rcpt.blinkId
    );

    // Also fire a native push notification (works on Android/iOS builds)
    PushNotificationService.notifyBlinkSale({
      blinkName: title,
      amount,
      token,
      buyerLabel: payer.length > 8 ? `${payer.slice(0, 6)}…${payer.slice(-4)}` : payer,
    }).catch(() => {});

    // Dispatch global events to refresh all screen views & balances immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('blink_tx_updated', { detail: { signature: sig, receipt: rcpt } }));
      window.dispatchEvent(new CustomEvent('blink_balance_refresh'));
    }
  }
}

export const SaleWatcherService = new SaleWatcherManager();
