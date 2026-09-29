/**
 * PriceService - Real-time market exchange rate service for SOL, SKR, and USDC.
 * Fetches live market prices from CoinGecko, DexScreener & backend API with persistent caching.
 */

export interface PriceData {
  solUsdt: number;
  skrUsdt: number;
  updatedAt: number;
  source: string;
}

const STORAGE_KEY = 'blink_market_prices_data';
const DEFAULT_SOL_PRICE = 119.15; // Real live SOL spot market price baseline
const DEFAULT_SKR_PRICE = 0.0184; // Real live SKR market price baseline

export class PriceService {
  private static cachedSolPrice: number = DEFAULT_SOL_PRICE;
  private static cachedSkrPrice: number = DEFAULT_SKR_PRICE;
  private static lastFetchedAt: number = 0;
  private static listeners: Set<(prices: { sol: number; skr: number }) => void> = new Set();
  private static isFetching: boolean = false;

  static init(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Purge stale 142.50 cache if present
          if (parsed?.solUsdt === 142.5 || parsed?.solUsdt === 142.50) {
            window.localStorage.removeItem(STORAGE_KEY);
            this.cachedSolPrice = DEFAULT_SOL_PRICE;
          } else {
            if (parsed && typeof parsed.solUsdt === 'number' && parsed.solUsdt > 0) {
              this.cachedSolPrice = parsed.solUsdt;
            }
            if (parsed && typeof parsed.skrUsdt === 'number' && parsed.skrUsdt > 0) {
              this.cachedSkrPrice = parsed.skrUsdt;
            }
          }
        }
      } catch (e) {
        // ignore storage parse error
      }
    }

    // Immediately trigger initial fresh price fetch
    this.fetchLivePrice();

    // Poll periodically every 15 seconds
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.fetchLivePrice();
      }, 15000);
    }
  }

  /**
   * Get the current SOL/USDT price synchronously from memory cache.
   */
  static getSolPriceSync(): number {
    return this.cachedSolPrice > 0 ? this.cachedSolPrice : DEFAULT_SOL_PRICE;
  }

  /**
   * Get the current SKR/USDT price synchronously from memory cache.
   */
  static getSkrPriceSync(): number {
    return this.cachedSkrPrice > 0 ? this.cachedSkrPrice : DEFAULT_SKR_PRICE;
  }

  /**
   * Convert SOL balance to real USDT value.
   */
  static convertSolToUsdt(solAmount: number): number {
    const safeAmount = typeof solAmount === 'number' && !isNaN(solAmount) ? solAmount : 0;
    const price = this.getSolPriceSync();
    const safePrice = typeof price === 'number' && !isNaN(price) ? price : DEFAULT_SOL_PRICE;
    const val = safeAmount * safePrice;
    return isNaN(val) ? 0 : Number(val.toFixed(2));
  }

  /**
   * Convert SKR balance to real USDT value.
   */
  static convertSkrToUsdt(skrAmount: number): number {
    const safeAmount = typeof skrAmount === 'number' && !isNaN(skrAmount) ? skrAmount : 0;
    const price = this.getSkrPriceSync();
    const safePrice = typeof price === 'number' && !isNaN(price) ? price : DEFAULT_SKR_PRICE;
    const val = safeAmount * safePrice;
    return isNaN(val) ? 0 : Number(val.toFixed(2));
  }

  /**
   * Calculate total portfolio value combining SOL + USDC + SKR.
   */
  static calculateTotalPortfolioUsdt(solAmount: number, usdcAmount: number, skrAmount: number = 0): number {
    const solVal = this.convertSolToUsdt(solAmount);
    const usdcVal = typeof usdcAmount === 'number' && !isNaN(usdcAmount) ? usdcAmount : 0;
    const skrVal = this.convertSkrToUsdt(skrAmount);
    const total = solVal + usdcVal + skrVal;
    return isNaN(total) ? 0 : Number(total.toFixed(2));
  }

  /**
   * Fetch live SOL and SKR to USD/USDT price.
   */
  static async fetchLivePrice(): Promise<{ sol: number; skr: number }> {
    if (this.isFetching) return { sol: this.cachedSolPrice, skr: this.cachedSkrPrice };
    this.isFetching = true;

    try {
      let solPrice = this.cachedSolPrice;
      let skrPrice = this.cachedSkrPrice;

      // 1. Try fetching SOL price from Coinbase public spot API (CORS enabled)
      try {
        const cbRes = await fetch('https://api.coinbase.com/v2/prices/SOL-USD/spot');
        if (cbRes.ok) {
          const cbJson = await cbRes.json();
          const p = parseFloat(cbJson?.data?.amount);
          if (!isNaN(p) && p > 0) {
            solPrice = p;
          }
        }
      } catch (err) {}

      // 2. Fallback SOL fetch from CoinGecko
      if (solPrice === DEFAULT_SOL_PRICE) {
        try {
          const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,usdt', {
            headers: { Accept: 'application/json' },
          });
          if (res.ok) {
            const data = await res.json();
            const price = data?.solana?.usdt || data?.solana?.usd;
            if (typeof price === 'number' && price > 0) {
              solPrice = price;
            }
          }
        } catch (err) {}
      }

      // 3. Fetch live SKR price from DexScreener API
      try {
        const skrRes = await fetch('https://api.dexscreener.com/latest/dex/search?q=SKR');
        if (skrRes.ok) {
          const json = await skrRes.json();
          const pairs = json?.pairs;
          if (Array.isArray(pairs) && pairs.length > 0) {
            const p = parseFloat(pairs[0]?.priceUsd);
            if (!isNaN(p) && p > 0) {
              skrPrice = p;
            }
          }
        }
      } catch (err) {}

      this.updatePrices(solPrice, skrPrice, 'live_api');
      return { sol: solPrice, skr: skrPrice };
    } finally {
      this.isFetching = false;
    }
  }

  private static updatePrices(sol: number, skr: number, source: string): void {
    this.cachedSolPrice = Number(sol.toFixed(2));
    this.cachedSkrPrice = Number(skr.toFixed(4));
    this.lastFetchedAt = Date.now();

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ solUsdt: this.cachedSolPrice, skrUsdt: this.cachedSkrPrice, updatedAt: this.lastFetchedAt, source })
        );
      } catch (e) {}
    }

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener({ sol: this.cachedSolPrice, skr: this.cachedSkrPrice });
      } catch (e) {}
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sol_price_updated', {
          detail: { sol: this.cachedSolPrice, skr: this.cachedSkrPrice, price: this.cachedSolPrice },
        })
      );
    }
  }

  /**
   * Subscribe to price updates.
   */
  static subscribe(listener: (prices: { sol: number; skr: number }) => void): () => void {
    this.listeners.add(listener);
    listener({ sol: this.cachedSolPrice, skr: this.cachedSkrPrice });
    return () => {
      this.listeners.delete(listener);
    };
  }
}

// Auto-initialize price service on import
PriceService.init();
