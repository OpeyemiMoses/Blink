/**
 * PriceService - Real-time market exchange rate service for SOL / USDT.
 * Fetches live market prices from CoinGecko & backend API, with persistent caching and fallbacks.
 */

export interface PriceData {
  solUsdt: number;
  updatedAt: number;
  source: string;
}

const STORAGE_KEY = 'tapblink_sol_price_data';
const DEFAULT_FALLBACK_PRICE = 118.84; // Real live market price baseline

export class PriceService {
  private static cachedPrice: number = DEFAULT_FALLBACK_PRICE;
  private static lastFetchedAt: number = 0;
  private static listeners: Set<(price: number) => void> = new Set();
  private static isFetching: boolean = false;

  static init(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed.solUsdt === 'number' && parsed.solUsdt > 0) {
            this.cachedPrice = parsed.solUsdt;
            this.lastFetchedAt = parsed.updatedAt || 0;
          }
        }
      } catch (e) {
        // ignore storage parse error
      }
    }

    // Immediately trigger initial fresh price fetch
    this.fetchLivePrice();

    // Poll periodically every 60 seconds
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.fetchLivePrice();
      }, 60000);
    }
  }

  /**
   * Get the current SOL/USDT price synchronously from memory cache.
   */
  static getSolPriceSync(): number {
    return this.cachedPrice > 0 ? this.cachedPrice : DEFAULT_FALLBACK_PRICE;
  }

  /**
   * Convert SOL balance to real USDT value.
   */
  static convertSolToUsdt(solAmount: number): number {
    const price = this.getSolPriceSync();
    return Number((solAmount * price).toFixed(2));
  }

  /**
   * Calculate total portfolio value combining SOL (converted at real USDT rate) + USDC.
   */
  static calculateTotalPortfolioUsdt(solAmount: number, usdcAmount: number): number {
    const solVal = this.convertSolToUsdt(solAmount);
    return Number((solVal + (usdcAmount || 0)).toFixed(2));
  }

  /**
   * Fetch live SOL to USD/USDT price.
   */
  static async fetchLivePrice(): Promise<number> {
    if (this.isFetching) return this.cachedPrice;
    this.isFetching = true;

    try {
      // 1. Try internal backend proxy /api/price first
      try {
        const res = await fetch('/api/price', { cache: 'no-cache' });
        if (res.ok) {
          const json = await res.json();
          if (json && typeof json.solUsdt === 'number' && json.solUsdt > 0) {
            this.updatePrice(json.solUsdt, 'server');
            return json.solUsdt;
          }
        }
      } catch (err) {
        // backend proxy not reachable, try direct CoinGecko
      }

      // 2. Direct CoinGecko public API
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,usdt', {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          const price = data?.solana?.usdt || data?.solana?.usd;
          if (typeof price === 'number' && price > 0) {
            this.updatePrice(price, 'coingecko');
            return price;
          }
        }
      } catch (err) {
        // quiet fallback
      }

      return this.cachedPrice;
    } finally {
      this.isFetching = false;
    }
  }

  private static updatePrice(newPrice: number, source: string): void {
    this.cachedPrice = Number(newPrice.toFixed(2));
    this.lastFetchedAt = Date.now();

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ solUsdt: this.cachedPrice, updatedAt: this.lastFetchedAt, source })
        );
      } catch (e) {}
    }

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener(this.cachedPrice);
      } catch (e) {}
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sol_price_updated', {
          detail: { price: this.cachedPrice },
        })
      );
    }
  }

  /**
   * Subscribe to price updates.
   */
  static subscribe(listener: (price: number) => void): () => void {
    this.listeners.add(listener);
    // Call immediately with current price
    listener(this.cachedPrice);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

// Auto-initialize price service on import
PriceService.init();
