import { TransactionReceipt } from '../types';
import { EnrichedTransactionInfo, SolanaService } from './solanaService';
import { getApiUrl } from './apiConfig';

const STORAGE_KEY = 'blink_transaction_receipts_v1';

export interface BlinkPayerInfo {
  address: string;
  totalPaid: number;
  token: 'SOL' | 'USDC' | 'SKR';
  paymentCount: number;
  lastTimestamp: number;
  lastSignature: string;
  lastMethod?: string;
  receipts: TransactionReceipt[];
}

export class ReceiptService {
  private static cachedReceipts: Map<string, TransactionReceipt> = new Map();
  private static initialized: boolean = false;

  private static init() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const list: TransactionReceipt[] = JSON.parse(raw);
          for (const item of list) {
            if (item.signature) {
              this.cachedReceipts.set(item.signature, item);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load receipts from localStorage:', e);
    }
  }

  private static persist() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const list = Array.from(this.cachedReceipts.values());
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }
    } catch (e) {
      console.warn('Failed to persist receipts to localStorage:', e);
    }
  }

  /**
   * Save receipt locally and broadcast to cloud server so receiver immediately has full receipt.
   */
  static saveReceipt(receipt: TransactionReceipt) {
    this.init();
    if (!receipt.signature) return;
    this.cachedReceipts.set(receipt.signature, receipt);
    this.persist();

    // Asynchronously synchronize to cloud database so receiver device can load full metadata
    if (typeof fetch !== 'undefined') {
      fetch(getApiUrl('/api/receipts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receipt),
      }).catch((err) => {
        console.warn('Cloud receipt sync deferred:', err);
      });
    }
  }

  static getReceiptBySignature(signature: string): TransactionReceipt | null {
    this.init();
    return this.cachedReceipts.get(signature) || null;
  }

  static getAllReceipts(): TransactionReceipt[] {
    this.init();
    return Array.from(this.cachedReceipts.values()).sort(
      (a, b) => b.timestamp - a.timestamp
    );
  }

  /**
   * Fetch cloud receipts for a wallet address to populate receiver history with full metadata.
   */
  static async fetchCloudReceiptsForAddress(address: string): Promise<TransactionReceipt[]> {
    this.init();
    if (!address) return [];
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch(getApiUrl(`/api/receipts?address=${encodeURIComponent(address)}`));
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.receipts)) {
            for (const item of data.receipts) {
              if (item.signature) {
                this.cachedReceipts.set(item.signature, item);
              }
            }
            this.persist();
            return data.receipts;
          }
        }
      }
    } catch (err) {
      console.warn('Error fetching cloud receipts for address:', err);
    }
    return [];
  }

  /**
   * Get all receipts associated with a specific Blink ID or recipient address.
   */
  static getReceiptsForBlink(blinkId: string, recipientAddress?: string): TransactionReceipt[] {
    this.init();
    const cleanBlinkId = (blinkId || '').trim().toLowerCase();
    const cleanRecipient = (recipientAddress || '').trim().toLowerCase();

    return Array.from(this.cachedReceipts.values())
      .filter((r) => {
        if (!r.payerAddress) return false;
        if (cleanBlinkId) {
          const matchesId = Boolean(r.blinkId && r.blinkId.trim().toLowerCase() === cleanBlinkId);
          const matchesLegacyId = Boolean(r.id && r.id.trim().toLowerCase() === cleanBlinkId);
          return matchesId || matchesLegacyId;
        }
        if (cleanRecipient) {
          return Boolean(r.recipientAddress && r.recipientAddress.trim().toLowerCase() === cleanRecipient);
        }
        return false;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Group receipts by unique payer address for a Blink.
   * Useful for creators distributing NFTs, rewards, or whitelisting supporters.
   */
  static getPayersForBlink(blinkId: string, recipientAddress?: string): BlinkPayerInfo[] {
    const receipts = this.getReceiptsForBlink(blinkId, recipientAddress);
    const map = new Map<string, BlinkPayerInfo>();

    for (const r of receipts) {
      if (!r.payerAddress) continue;
      const addr = r.payerAddress;
      const existing = map.get(addr);
      if (existing) {
        existing.totalPaid = Number((existing.totalPaid + r.amount).toFixed(4));
        existing.paymentCount += 1;
        if (r.timestamp > existing.lastTimestamp) {
          existing.lastTimestamp = r.timestamp;
          existing.lastSignature = r.signature;
          existing.lastMethod = r.method;
        }
        existing.receipts.push(r);
      } else {
        map.set(addr, {
          address: addr,
          totalPaid: r.amount,
          token: r.token,
          paymentCount: 1,
          lastTimestamp: r.timestamp,
          lastSignature: r.signature,
          lastMethod: r.method,
          receipts: [r],
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }

  /**
   * Fetch cloud receipts for a specific Blink from the backend API.
   */
  static async fetchCloudReceiptsForBlink(blinkId: string, recipientAddress?: string): Promise<TransactionReceipt[]> {
    this.init();
    const cleanId = (blinkId || '').trim();
    const cleanAddr = (recipientAddress || '').trim();
    if (!cleanId && !cleanAddr) return [];
    try {
      const url = cleanId
        ? `/api/receipts?blinkId=${encodeURIComponent(cleanId)}`
        : `/api/receipts?address=${encodeURIComponent(cleanAddr)}`;

      const res = await fetch(getApiUrl(url)).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.receipts)) {
          for (const item of data.receipts) {
            if (item.signature) {
              this.cachedReceipts.set(item.signature, item);
            }
          }
          this.persist();
        }
      }
      return this.getReceiptsForBlink(blinkId, recipientAddress);
    } catch (err) {
      console.warn('Error fetching cloud receipts for blink:', err);
    }
    return this.getReceiptsForBlink(blinkId, recipientAddress);
  }

  /**
   * Fetch single receipt from cloud server by transaction signature.
   */
  static async fetchReceiptFromCloud(signature: string): Promise<TransactionReceipt | null> {
    this.init();
    if (!signature) return null;
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch(getApiUrl(`/api/receipts?signature=${encodeURIComponent(signature)}`));
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.receipt) {
            this.cachedReceipts.set(signature, data.receipt);
            this.persist();
            return data.receipt;
          }
        }
      }
    } catch (err) {
      // quiet fallback
    }
    return null;
  }

  /**
   * Synthesizes or retrieves a complete TransactionReceipt for any transaction
   * (e.g. from the on-chain ledger).
   */
  static getOrCreateReceiptForTx(
    tx: EnrichedTransactionInfo,
    activeWalletAddress: string
  ): TransactionReceipt {
    this.init();
    const existing = this.cachedReceipts.get(tx.signature);
    if (existing) {
      // If existing receipt has complete data, reuse it but ensure direction reflects active viewer
      if (existing.amount > 0 && existing.payerAddress && existing.recipientAddress) {
        const isRecipient = activeWalletAddress && existing.recipientAddress.toLowerCase() === activeWalletAddress.toLowerCase();
        const isPayer = activeWalletAddress && existing.payerAddress.toLowerCase() === activeWalletAddress.toLowerCase();
        if (isRecipient && !isPayer) {
          return {
            ...existing,
            method: 'receive',
            blinkTitle: (existing.blinkTitle || '').replace(/outgoing/i, 'Incoming'),
          };
        } else if (isPayer && !isRecipient) {
          return {
            ...existing,
            method: 'send',
            blinkTitle: (existing.blinkTitle || '').replace(/incoming/i, 'Outgoing'),
          };
        }
        return existing;
      }
    }

    const isSend = tx.direction === 'send';
    const isReceive = tx.direction === 'receive';
    const isSkr = tx.token === 'SKR' || (tx.amountSkr !== null && tx.amountSkr !== undefined && tx.amountSkr > 0);
    const isUsdc = !isSkr && (tx.token === 'USDC' || (tx.amountUsdc !== null && tx.amountUsdc !== undefined && tx.amountUsdc > 0));

    const sender = isSend
      ? activeWalletAddress
      : (tx.counterparty || 'External Solana Address');

    const recipient = isReceive
      ? activeWalletAddress
      : (tx.counterparty || 'External Solana Address');

    const amount = isSkr
      ? (tx.amountSkr || 0)
      : isUsdc
      ? (tx.amountUsdc || tx.amountSol || 0)
      : (tx.amountSol || 0);

    const tokenName: 'SOL' | 'USDC' | 'SKR' = isSkr ? 'SKR' : isUsdc ? 'USDC' : 'SOL';
    const title = isSend
      ? `Outgoing ${tokenName} Transfer`
      : isReceive
      ? `Incoming ${tokenName} Transfer`
      : `${tokenName} Transaction`;

    const synthesized: TransactionReceipt = {
      id: `rcpt_${tx.signature.slice(0, 12)}`,
      signature: tx.signature,
      blinkTitle: title,
      amount,
      token: tokenName,
      payerAddress: sender,
      recipientAddress: recipient,
      timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
      status: tx.err ? 'failed' : 'confirmed',
      method: isSend ? 'send' : isReceive ? 'receive' : 'pocket_direct',
    };

    this.saveReceipt(synthesized);
    return synthesized;
  }

  /**
   * Comprehensive asynchronous receipt resolver:
   * 1. Checks memory & localStorage
   * 2. Checks Cloud Receipts database (/api/receipts)
   * 3. Queries Solana on-chain parsed transaction details
   */
  static async getReceiptAsync(
    signature: string,
    activeWalletAddress?: string | null
  ): Promise<TransactionReceipt | null> {
    this.init();
    if (!signature) return null;

    // 1. Check local cache first
    const cached = this.cachedReceipts.get(signature);
    const hasGoodLocalData =
      cached &&
      cached.amount > 0 &&
      cached.payerAddress &&
      !cached.payerAddress.includes('External') &&
      cached.recipientAddress &&
      !cached.recipientAddress.includes('External');

    if (hasGoodLocalData) {
      const isRecipient = activeWalletAddress && cached.recipientAddress && cached.recipientAddress.toLowerCase() === activeWalletAddress.toLowerCase();
      const isPayer = activeWalletAddress && cached.payerAddress && cached.payerAddress.toLowerCase() === activeWalletAddress.toLowerCase();
      if (isRecipient && !isPayer) {
        return {
          ...cached,
          method: 'receive',
          blinkTitle: (cached.blinkTitle || '').replace(/outgoing/i, 'Incoming'),
        };
      } else if (isPayer && !isRecipient) {
        return {
          ...cached,
          method: 'send',
          blinkTitle: (cached.blinkTitle || '').replace(/incoming/i, 'Outgoing'),
        };
      }
      return cached;
    }

    // 2. Query Cloud Server Receipts (instant cross-device match between sender and receiver)
    const cloudReceipt = await this.fetchReceiptFromCloud(signature);
    if (cloudReceipt && cloudReceipt.amount > 0) {
      this.cachedReceipts.set(signature, cloudReceipt);
      this.persist();
      const isRecipient = activeWalletAddress && cloudReceipt.recipientAddress && cloudReceipt.recipientAddress.toLowerCase() === activeWalletAddress.toLowerCase();
      const isPayer = activeWalletAddress && cloudReceipt.payerAddress && cloudReceipt.payerAddress.toLowerCase() === activeWalletAddress.toLowerCase();
      if (isRecipient && !isPayer) {
        return {
          ...cloudReceipt,
          method: 'receive',
          blinkTitle: (cloudReceipt.blinkTitle || '').replace(/outgoing/i, 'Incoming'),
        };
      } else if (isPayer && !isRecipient) {
        return {
          ...cloudReceipt,
          method: 'send',
          blinkTitle: (cloudReceipt.blinkTitle || '').replace(/incoming/i, 'Outgoing'),
        };
      }
      return cloudReceipt;
    }

    // 3. Fallback: Parse directly on-chain via Solana RPC
    try {
      const onChain = await SolanaService.fetchFullTransactionDetails(signature, activeWalletAddress || null);
      if (onChain) {
        const isSend = onChain.direction === 'send';
        const isReceive = onChain.direction === 'receive';
        const isSkr = onChain.token === 'SKR' || (onChain.amountSkr !== null && onChain.amountSkr !== undefined && onChain.amountSkr > 0);
        const isUsdc = !isSkr && onChain.token === 'USDC';

        const sender = isSend
          ? (activeWalletAddress || onChain.sender || 'Unknown Sender')
          : (onChain.sender || onChain.counterparty || 'Sender Wallet');

        const recipient = isReceive
          ? (activeWalletAddress || onChain.recipient || 'Connected Wallet')
          : (onChain.recipient || onChain.counterparty || 'Recipient Wallet');

        const amount = isSkr
          ? (onChain.amountSkr || 0)
          : isUsdc
          ? (onChain.amountUsdc || onChain.amountSol || 0)
          : (onChain.amountSol || 0);

        const token: 'SOL' | 'USDC' | 'SKR' = isSkr ? 'SKR' : isUsdc ? 'USDC' : 'SOL';
        const title = isSend
          ? `Outgoing ${token} Transfer`
          : isReceive
          ? `Incoming ${token} Transfer`
          : `${token} Transfer`;

        const resolved: TransactionReceipt = {
          id: `rcpt_${signature.slice(0, 12)}`,
          signature,
          blinkTitle: cached?.blinkTitle || title,
          amount,
          token,
          payerAddress: sender,
          recipientAddress: recipient,
          timestamp: onChain.blockTime ? onChain.blockTime * 1000 : (cached?.timestamp || Date.now()),
          status: onChain.err ? 'failed' : 'confirmed',
          method: isSend ? 'send' : isReceive ? 'receive' : 'pocket_direct',
        };

        this.cachedReceipts.set(signature, resolved);
        this.persist();
        return resolved;
      }
    } catch (e) {
      console.warn('getReceiptAsync on-chain fallback error:', e);
    }

    return cached || null;
  }
}
