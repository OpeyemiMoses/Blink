/**
 * PriceService - Real-time market exchange rate service for SOL, SKR, and USDC.
 * Fetches live market prices from CoinGecko, DexScreener & backend API with persistent caching.
 */

import { getApiUrl } from './apiConfig';

export interface PriceData {
  solUsdt: number;
  skrUsdt: number;
  updatedAt: number;
  source: string;
}

const STORAGE_KEY = 'blink_market_prices_data';
const DEFAULT_SOL_PRICE = 117.50; // Real live SOL spot market price baseline
const DEFAULT_SKR_PRICE = 0.01730; // Real live SKR market price baseline

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
          // Purge stale 142.50 cache or older than 5 minutes cache
          if (parsed?.solUsdt === 142.5 || parsed?.solUsdt === 142.50 || (Date.now() - (parsed.updatedAt || 0) > 300000)) {
            window.localStorage.removeItem(STORAGE_KEY);
            this.cachedSolPrice = DEFAULT_SOL_PRICE;
            this.cachedSkrPrice = DEFAULT_SKR_PRICE;
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

    // Poll periodically every 5 seconds for live real-time market updates
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.fetchLivePrice();
      }, 5000);
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
   * Convert base USDC price to SKR token amount with a 10% base cashback discount
   * plus any earned Clock In streak bonus (+1% per 10-day streak).
   */
  static getSkrPaymentDetails(baseUsdcAmount: number, streakBonusPercent: number = 0): {
    baseUsdc: number;
    discountedUsdc: number;
    discountUsdc: number;
    discountPercent: number;
    cashbackPercent: number;
    cashbackUsdc: number;
    cashbackSkrAmount: number;
    streakBonusPercent: number;
    skrAmount: number;
    fullSkrAmount: number;
    skrPrice: number;
  } {
    const safeBase = typeof baseUsdcAmount === 'number' && !isNaN(baseUsdcAmount) && baseUsdcAmount > 0 ? baseUsdcAmount : 0;
    const bonus = typeof streakBonusPercent === 'number' && !isNaN(streakBonusPercent) && streakBonusPercent > 0 ? streakBonusPercent : 0;
    const totalBenefitPercent = 10 + bonus;
    const discountMultiplier = Math.max(0, (100 - totalBenefitPercent) / 100);
    const discountedUsdc = Number((safeBase * discountMultiplier).toFixed(2));
    const discountUsdc = Number((safeBase * (totalBenefitPercent / 100)).toFixed(2));
    const skrPrice = this.getSkrPriceSync();
    const safePrice = skrPrice > 0 ? skrPrice : DEFAULT_SKR_PRICE;
    const skrAmount = Number((discountedUsdc / safePrice).toFixed(2));
    const fullSkrAmount = Number((safeBase / safePrice).toFixed(2));
    const cashbackSkrAmount = Number((discountUsdc / safePrice).toFixed(2));
    return {
      baseUsdc: safeBase,
      discountedUsdc,
      discountUsdc,
      discountPercent: totalBenefitPercent,
      cashbackPercent: totalBenefitPercent,
      cashbackUsdc: discountUsdc,
      cashbackSkrAmount,
      streakBonusPercent: bonus,
      skrAmount,
      fullSkrAmount,
      skrPrice: safePrice,
    };
  }

  /**
   * Derive the live checkout details for any Blink dynamically based on its pegged baseUsdcAmount
   * and the current live SKR market rate.
   * Ensures that SKR blinks always calculate their discounted amount from live market prices.
   */
  static getLiveBlinkDetails(
    blink: { amount: number; token?: string; baseUsdcAmount?: number } | null | undefined,
    streakBonusPercent: number = 0
  ): {
    displayAmount: number;
    displayString: string;
    fullAmount: number;
    fullString: string;
    baseUsdc: number;
    discountPercent: number;
    skrPrice: number;
  } {
    if (!blink) {
      return {
        displayAmount: 0,
        displayString: '0',
        fullAmount: 0,
        fullString: '0',
        baseUsdc: 0,
        discountPercent: 0,
        skrPrice: 0,
      };
    }

    if (blink.token === 'SKR') {
      const liveSkrPrice = this.getSkrPriceSync();
      let baseUsdc = 0;
      if (typeof blink.baseUsdcAmount === 'number' && blink.baseUsdcAmount > 0) {
        baseUsdc = blink.baseUsdcAmount;
      } else if ((blink as any).id === 'tip-jar') {
        baseUsdc = 4.0;
      } else if (blink.amount > 0 && liveSkrPrice > 0) {
        // Back-calculate the original USDC peg from the stored SKR amount.
        // Stored SKR = discountedUsdc / skrPrice, discountedUsdc = originalUsdc * 0.9
        // Therefore: originalUsdc = storedSKR * skrPrice / 0.9
        // Round to nearest $0.50 for a clean display value.
        const reversedUsdc = (blink.amount * liveSkrPrice) / 0.9;
        baseUsdc = Math.max(0.5, Math.round(reversedUsdc * 2) / 2);
      } else {
        baseUsdc = 4.0;
      }

      const details = this.getSkrPaymentDetails(baseUsdc, streakBonusPercent);
      return {
        displayAmount: details.skrAmount,
        displayString: `${details.skrAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SKR`,
        fullAmount: details.fullSkrAmount,
        fullString: `${details.fullSkrAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SKR`,
        baseUsdc: details.baseUsdc,
        discountPercent: details.discountPercent,
        skrPrice: details.skrPrice,
      };
    }

    if (blink.token === 'SOL') {
      const solPrice = this.getSolPriceSync();
      let solAmt = typeof blink.amount === 'number' && !isNaN(blink.amount) ? blink.amount : 0;
      let baseUsdc = typeof blink.baseUsdcAmount === 'number' && blink.baseUsdcAmount > 0
        ? blink.baseUsdcAmount
        : Number((solAmt * solPrice).toFixed(2));

      // Guard against existing blinks where amount was mistakenly stored as the USD value (e.g. 5 SOL instead of $5 worth of SOL)
      if (blink.baseUsdcAmount && blink.amount === blink.baseUsdcAmount && blink.amount >= 1) {
        solAmt = Number((blink.baseUsdcAmount / solPrice).toFixed(4));
      }

      return {
        displayAmount: solAmt,
        displayString: `${solAmt} SOL (≈ $${baseUsdc.toFixed(2)})`,
        fullAmount: solAmt,
        fullString: `${solAmt} SOL`,
        baseUsdc,
        discountPercent: 0,
        skrPrice: 0,
      };
    }

    // Default USDC
    const usdcAmt = typeof blink.amount === 'number' && !isNaN(blink.amount) ? blink.amount : 0;
    return {
      displayAmount: usdcAmt,
      displayString: `$${usdcAmt.toFixed(2)} USDC`,
      fullAmount: usdcAmt,
      fullString: `$${usdcAmt.toFixed(2)}`,
      baseUsdc: usdcAmt,
      discountPercent: 0,
      skrPrice: 0,
    };
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
  /**
   * Fetch live SOL and SKR to USD/USDT price.
   */
  static async fetchLivePrice(): Promise<{ sol: number; skr: number }> {
    if (this.isFetching) return { sol: this.cachedSolPrice, skr: this.cachedSkrPrice };
    this.isFetching = true;

    try {
      let solPrice = this.cachedSolPrice;
      let skrPrice = this.cachedSkrPrice;

      // 1. Try our direct high-speed backend /api/prices endpoint
      try {
        const apiRes = await fetch(getApiUrl('/api/prices'), {
          headers: { Accept: 'application/json' },
        });
        if (apiRes.ok) {
          const apiJson = await apiRes.json();
          if (apiJson.success && apiJson.prices) {
            if (typeof apiJson.prices.sol === 'number' && apiJson.prices.sol > 0) {
              solPrice = apiJson.prices.sol;
            }
            if (typeof apiJson.prices.skr === 'number' && apiJson.prices.skr > 0) {
              skrPrice = apiJson.prices.skr;
            }
            this.updatePrices(solPrice, skrPrice, 'backend_api');
            return { sol: solPrice, skr: skrPrice };
          }
        }
      } catch (err) {}

      // 2. Direct client fallback: CoinGecko for live SOL
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          const p = data?.solana?.usd;
          if (typeof p === 'number' && p > 0) {
            solPrice = p;
          }
        }
      } catch (err) {}

      // 3. Direct client fallback: Coinbase for live SOL
      if (solPrice === DEFAULT_SOL_PRICE) {
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
      }

      // 4. Direct client fallback: DexScreener for live SKR by exact Solana mint
      try {
        const skrRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3');
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

      this.updatePrices(solPrice, skrPrice, 'live_client_api');
      return { sol: solPrice, skr: skrPrice };
    } finally {
      this.isFetching = false;
    }
  }

  private static updatePrices(sol: number, skr: number, source: string): void {
    const prevSol = this.cachedSolPrice;
    const prevSkr = this.cachedSkrPrice;

    this.cachedSolPrice = Number(sol.toFixed(2));
    // Keep 6 decimal places of precision so micro-movements on DexScreener are preserved
    this.cachedSkrPrice = Number(Number(skr).toFixed(6));
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
      window.dispatchEvent(
        new CustomEvent('market_price_updated', {
          detail: { sol: this.cachedSolPrice, skr: this.cachedSkrPrice },
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
