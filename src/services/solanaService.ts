import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { ExternalWalletService } from './externalWalletService';
import { getApiUrl } from './apiConfig';

export const DEVNET_RPC = 'https://api.devnet.solana.com';
export const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

// Official Solana Devnet USDC & SKR SPL Mint & Program IDs
export const USDC_DEVNET_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
export const SKR_DEVNET_MINT = new PublicKey('SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3');
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

const STORAGE_KEY = 'seeker_solana_private_key';
const STORAGE_NETWORK_KEY = 'solana_active_network_mode';

export interface OnChainTransactionInfo {
  signature: string;
  slot: number;
  err: any;
  memo: string | null;
  blockTime: number | null;
}

export interface EnrichedTransactionInfo extends OnChainTransactionInfo {
  direction: 'send' | 'receive' | 'unknown';
  amountSol: number | null;
  amountUsdc?: number | null;
  amountSkr?: number | null;
  token?: 'SOL' | 'USDC' | 'SKR';
  counterparty: string | null;
}

export class SolanaService {
  private static activeNetwork: 'devnet' | 'mainnet-beta' = 'devnet';
  private static connection: Connection | null = null;
  private static currentKeypair: Keypair | null = null;

  static getRpcUrl(network?: string): string {
    const net = (network || this.getNetwork()) === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
    if (net === 'mainnet-beta') return MAINNET_RPC;
    if (process.env.EXPO_PUBLIC_SOLANA_RPC_URL) {
      return process.env.EXPO_PUBLIC_SOLANA_RPC_URL;
    }
    return DEVNET_RPC;
  }

  static setNetwork(network?: string) {
    const net = (network === 'mainnet' || network === 'mainnet-beta') ? 'mainnet-beta' : 'devnet';
    this.activeNetwork = net;
    const rpc = this.getRpcUrl(net);
    const wsEndpoint = net === 'mainnet-beta'
      ? 'wss://api.mainnet-beta.solana.com/'
      : 'wss://api.devnet.solana.com/';
    this.connection = new Connection(rpc, {
      commitment: 'confirmed',
      disableRetryOnRateLimit: true,
      wsEndpoint,
    });
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_NETWORK_KEY, net);
      } catch {}
    }
  }

  static getNetwork(): 'devnet' | 'mainnet-beta' {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_NETWORK_KEY);
        if (saved === 'mainnet-beta' || saved === 'mainnet') {
          return 'mainnet-beta';
        }
      } catch {}
    }
    return this.activeNetwork;
  }

  static getConnection(): Connection {
    const rpcUrl = this.getRpcUrl();
    if (!this.connection || (this.connection as any)._rpcEndpoint !== rpcUrl) {
      // Always use the public Devnet WebSocket for subscriptions/confirmations.
      // The HTTP proxy (localhost:3000/api/solana-rpc) cannot be upgraded to WS,
      // so we always point wsEndpoint directly at Devnet to avoid "WebSocket failed" errors.
      this.connection = new Connection(rpcUrl, {
        commitment: 'confirmed',
        disableRetryOnRateLimit: true,
        wsEndpoint: 'wss://api.devnet.solana.com/',
      });
    }
    return this.connection;
  }

  /**
   * Send a serialized signed transaction via the HTTP proxy and poll for confirmation.
   * Avoids WebSocket dependency entirely.
   */
  static async sendRawTransactionAndConfirm(signedTx: Uint8Array): Promise<string> {
    const encoded = Buffer.from(signedTx).toString('base64');
    // Send via HTTP proxy
    const sendRes = await fetch(getApiUrl('/api/solana-rpc'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'sendTransaction',
        params: [encoded, { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed' }],
      }),
    });
    const sendJson = await sendRes.json();
    if (sendJson.error) throw new Error(`sendTransaction RPC error: ${JSON.stringify(sendJson.error)}`);
    const signature: string = sendJson.result;

    // Poll for confirmation via HTTP (no WebSocket)
    const latestBh = await this.getLatestBlockhash('confirmed');
    const deadline = latestBh.lastValidBlockHeight;
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise(r => setTimeout(r, 2000));
      const statusRes = await fetch(getApiUrl('/api/solana-rpc'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getSignatureStatuses',
          params: [[signature], { searchTransactionHistory: false }],
        }),
      });
      const statusJson = await statusRes.json();
      const status = statusJson?.result?.value?.[0];
      if (status) {
        if (status.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
        if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
          return signature;
        }
      }
      // Check if block height exceeded
      const blockRes = await fetch(getApiUrl('/api/solana-rpc'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBlockHeight', params: [] }),
      });
      const blockJson = await blockRes.json();
      if (blockJson?.result > deadline) {
        throw new Error('Transaction expired (block height exceeded). Please try again.');
      }
    }
    throw new Error('Transaction confirmation timed out. It may still confirm — check your balance.');
  }

  /**
   * Poll for transaction confirmation via HTTP (no WebSocket).
   * Safe to call from background without triggering WS connection errors.
   */
  static async confirmSignatureViaHttp(signature: string, maxAttempts = 30): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const statusRes = await fetch(getApiUrl('/api/solana-rpc'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignatureStatuses',
            params: [[signature], { searchTransactionHistory: true }],
          }),
        });
        const statusJson = await statusRes.json();
        const status = statusJson?.result?.value?.[0];
        if (status) {
          if (status.err) {
            console.warn('Transaction failed on-chain:', status.err);
            return false;
          }
          if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
            return true;
          }
        }
      } catch {}
    }
    return false;
  }

  /**
   * Resilient blockhash fetch with automatic fallback and retries.
   */
  static async getLatestBlockhash(commitment: 'confirmed' | 'finalized' = 'confirmed'): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    try {
      const conn = this.getConnection();
      return await conn.getLatestBlockhash(commitment);
    } catch (err1) {
      console.warn('[SolanaService] Primary RPC blockhash fetch failed, trying direct devnet:', err1);
      try {
        const directConn = new Connection(DEVNET_RPC, { commitment });
        return await directConn.getLatestBlockhash(commitment);
      } catch (err2) {
        console.warn('[SolanaService] Direct devnet blockhash fetch failed, trying proxy raw fetch:', err2);
        const res = await fetch(getApiUrl('/api/solana-rpc'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getLatestBlockhash',
            params: [{ commitment }],
          }),
        });
        const data = await res.json();
        if (data?.result?.value?.blockhash) {
          return {
            blockhash: data.result.value.blockhash,
            lastValidBlockHeight: data.result.value.lastValidBlockHeight || 0,
          };
        }
        throw new Error((err1 as any)?.message || 'Failed to fetch recent blockhash');
      }
    }
  }

  /**
   * Load existing Keypair from localStorage or generate a real new one.
   */
  static getOrCreateKeypair(): Keypair {
    if (this.currentKeypair) {
      return this.currentKeypair;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      const savedSecret = window.localStorage.getItem(STORAGE_KEY);
      if (savedSecret) {
        try {
          const secretBytes = bs58.decode(savedSecret);
          this.currentKeypair = Keypair.fromSecretKey(secretBytes);
          return this.currentKeypair;
        } catch (e) {
          console.warn('Failed to parse saved private key, generating fresh one:', e);
        }
      }
    }

    // Generate fresh Keypair
    const fresh = Keypair.generate();
    this.currentKeypair = fresh;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, bs58.encode(fresh.secretKey));
    }
    return fresh;
  }

  /**
   * Import keypair via base58 private key string.
   */
  static importKeypair(base58Key: string): Keypair {
    const secretBytes = bs58.decode(base58Key.trim());
    if (secretBytes.length !== 64) {
      throw new Error('Invalid Solana private key length (must be 64 bytes).');
    }
    const kp = Keypair.fromSecretKey(secretBytes);
    this.currentKeypair = kp;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, bs58.encode(kp.secretKey));
    }
    return kp;
  }

  /**
   * Export private key as base58 string.
   */
  static exportPrivateKey(): string {
    const kp = this.getOrCreateKeypair();
    return bs58.encode(kp.secretKey);
  }

  private static solCache: Map<string, { value: number; time: number }> = new Map();
  private static usdcCache: Map<string, { value: number; time: number }> = new Map();
  private static skrCache: Map<string, { value: number; time: number }> = new Map();
  private static inFlightSol: Map<string, Promise<number>> = new Map();
  private static inFlightUsdc: Map<string, Promise<number>> = new Map();
  private static inFlightSkr: Map<string, Promise<number>> = new Map();
  private static readonly CACHE_TTL_MS = 15000; // 15 seconds fresh cache

  /**
   * Synchronously get cached SOL balance if available (memory or localStorage)
   */
  static getCachedSol(pubkeyStr: string): number | null {
    if (!pubkeyStr) return null;
    const mem = this.solCache.get(pubkeyStr);
    if (mem !== undefined && typeof mem.value === 'number' && !isNaN(mem.value)) {
      return mem.value;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(`blink_cached_sol_${pubkeyStr}`);
      if (stored !== null && stored !== '') {
        const val = parseFloat(stored);
        if (!isNaN(val)) {
          this.solCache.set(pubkeyStr, { value: val, time: 0 });
          return val;
        }
      }
    }
    return null;
  }

  /**
   * Synchronously get cached USDC balance if available (memory or localStorage)
   */
  static getCachedUsdc(pubkeyStr: string): number | null {
    if (!pubkeyStr) return null;
    const mem = this.usdcCache.get(pubkeyStr);
    if (mem !== undefined && typeof mem.value === 'number' && !isNaN(mem.value)) {
      return mem.value;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(`blink_cached_usdc_${pubkeyStr}`);
      if (stored !== null && stored !== '') {
        const val = parseFloat(stored);
        if (!isNaN(val)) {
          this.usdcCache.set(pubkeyStr, { value: val, time: 0 });
          return val;
        }
      }
    }
    return null;
  }

  /**
   * Synchronously get cached SKR balance if available (memory or localStorage)
   */
  static getCachedSkr(pubkeyStr: string): number | null {
    if (!pubkeyStr) return null;
    const mem = this.skrCache.get(pubkeyStr);
    if (mem !== undefined && typeof mem.value === 'number' && !isNaN(mem.value)) {
      return mem.value;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(`blink_cached_skr_${pubkeyStr}`);
      if (stored !== null && stored !== '') {
        const val = parseFloat(stored);
        if (!isNaN(val)) {
          this.skrCache.set(pubkeyStr, { value: val, time: 0 });
          return val;
        }
      }
    }
    return null;
  }

  /**
   * Manually prime or optimistically update cached balance (e.g. after a send or receive)
   */
  static setCachedBalance(pubkeyStr: string, sol?: number, usdc?: number, skr?: number) {
    if (!pubkeyStr) return;
    if (typeof sol === 'number' && !isNaN(sol)) {
      this.solCache.set(pubkeyStr, { value: sol, time: Date.now() });
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`blink_cached_sol_${pubkeyStr}`, String(sol));
      }
    }
    if (typeof usdc === 'number' && !isNaN(usdc)) {
      this.usdcCache.set(pubkeyStr, { value: usdc, time: Date.now() });
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`blink_cached_usdc_${pubkeyStr}`, String(usdc));
      }
    }
    if (typeof skr === 'number' && !isNaN(skr)) {
      this.skrCache.set(pubkeyStr, { value: skr, time: Date.now() });
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`blink_cached_skr_${pubkeyStr}`, String(skr));
      }
    }
  }

  /**
   * Query real on-chain balance in SOL with deduplication and stale-while-revalidate fallback.
   */
  static async getBalance(pubkeyStr: string, forceFresh = false): Promise<number> {
    if (!pubkeyStr) return 0;

    // Fast-path: return cached balance if within TTL
    if (!forceFresh) {
      const cached = this.solCache.get(pubkeyStr);
      if (cached && Date.now() - cached.time < this.CACHE_TTL_MS) {
        return cached.value;
      }
    }

    // 1. Primary: Backend /api/balance proxy (ultra-fast, bypasses mobile 429 & CORS)
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch(getApiUrl(`/api/balance?address=${encodeURIComponent(pubkeyStr.trim())}`));
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && typeof data.sol === 'number') {
            const solVal = Number(data.sol.toFixed(4));
            this.solCache.set(pubkeyStr, { value: solVal, time: Date.now() });
            if (typeof data.usdc === 'number') {
              this.usdcCache.set(pubkeyStr, { value: Number(data.usdc.toFixed(2)), time: Date.now() });
            }
            if (typeof data.skr === 'number') {
              const skrVal = Number(data.skr.toFixed(2));
              this.skrCache.set(pubkeyStr, { value: skrVal, time: Date.now() });
              if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(`blink_cached_skr_${pubkeyStr}`, String(skrVal));
              }
            }
            return solVal;
          }
        }
      }
    } catch {}

    // Deduplicate in-flight requests for the same address
    if (this.inFlightSol.has(pubkeyStr)) {
      return this.inFlightSol.get(pubkeyStr)!;
    }

    const task = (async (): Promise<number> => {
      try {
        const pubkey = new PublicKey(pubkeyStr);
        const lamports = await this.getConnection().getBalance(pubkey);
        const solVal = Number((lamports / LAMPORTS_PER_SOL).toFixed(4));

        this.solCache.set(pubkeyStr, { value: solVal, time: Date.now() });
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(`blink_cached_sol_${pubkeyStr}`, String(solVal));
        }
        return solVal;
      } catch (err: any) {
        console.warn('SolanaService.getBalance RPC error or rate-limited:', err?.message || err);
        // Fall back to cached balance so UI never flickers to 0
        const lastKnown = this.getCachedSol(pubkeyStr);
        if (lastKnown !== null) {
          return lastKnown;
        }
        return 0;
      } finally {
        this.inFlightSol.delete(pubkeyStr);
      }
    })();

    this.inFlightSol.set(pubkeyStr, task);
    return task;
  }

  /**
   * Derive Associated Token Account (ATA) for a wallet and mint.
   */
  static getAssociatedTokenAddress(owner: PublicKey, mint: PublicKey = USDC_DEVNET_MINT): PublicKey {
    const [address] = PublicKey.findProgramAddressSync(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    return address;
  }

  /**
   * Query real on-chain balance in USDC on Solana network with deduplication and cache fallback.
   */
  static async getUsdcBalance(pubkeyStr: string, forceFresh = false): Promise<number> {
    if (!pubkeyStr) return 0;

    if (!forceFresh) {
      const cached = this.usdcCache.get(pubkeyStr);
      if (cached && Date.now() - cached.time < this.CACHE_TTL_MS) {
        return cached.value;
      }
    }

    // 1. Primary: Backend /api/balance proxy (ultra-fast, bypasses mobile 429 & CORS)
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch(getApiUrl(`/api/balance?address=${encodeURIComponent(pubkeyStr.trim())}`));
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && typeof data.usdc === 'number') {
            const usdcVal = Number(data.usdc.toFixed(2));
            this.usdcCache.set(pubkeyStr, { value: usdcVal, time: Date.now() });
            if (typeof data.sol === 'number') {
              this.solCache.set(pubkeyStr, { value: Number(data.sol.toFixed(4)), time: Date.now() });
            }
            if (typeof data.skr === 'number') {
              const skrVal = Number(data.skr.toFixed(2));
              this.skrCache.set(pubkeyStr, { value: skrVal, time: Date.now() });
              if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(`blink_cached_skr_${pubkeyStr}`, String(skrVal));
              }
            }
            return usdcVal;
          }
        }
      }
    } catch {}

    if (this.inFlightUsdc.has(pubkeyStr)) {
      return this.inFlightUsdc.get(pubkeyStr)!;
    }

    const task = (async (): Promise<number> => {
      try {
        const pubkey = new PublicKey(pubkeyStr);
        let total = 0;

        // 1. Query official Circle Devnet USDC accounts
        try {
          const circleAccounts = await this.getConnection().getParsedTokenAccountsByOwner(pubkey, {
            mint: USDC_DEVNET_MINT,
          });
          if (circleAccounts && circleAccounts.value.length > 0) {
            for (const item of circleAccounts.value) {
              const parsed = item.account.data?.parsed?.info?.tokenAmount;
              if (parsed && typeof parsed.uiAmount === 'number') {
                total += parsed.uiAmount;
              }
            }
          }
        } catch (e) {
          // quiet ignore
        }

        // 2. Also check common Devnet SPL Faucet USDC mint
        try {
          const faucetMint = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
          const faucetAccounts = await this.getConnection().getParsedTokenAccountsByOwner(pubkey, {
            mint: faucetMint,
          });
          if (faucetAccounts && faucetAccounts.value.length > 0) {
            for (const item of faucetAccounts.value) {
              const parsed = item.account.data?.parsed?.info?.tokenAmount;
              if (parsed && typeof parsed.uiAmount === 'number') {
                total += parsed.uiAmount;
              }
            }
          }
        } catch (e) {
          // quiet ignore
        }

        const usdcVal = Number(total.toFixed(2));
        this.usdcCache.set(pubkeyStr, { value: usdcVal, time: Date.now() });
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(`blink_cached_usdc_${pubkeyStr}`, String(usdcVal));
        }
        return usdcVal;
      } catch (err: any) {
        console.warn('SolanaService.getUsdcBalance RPC error or rate-limited:', err?.message || err);
        const lastKnown = this.getCachedUsdc(pubkeyStr);
        if (lastKnown !== null) {
          return lastKnown;
        }
        return 0;
      } finally {
        this.inFlightUsdc.delete(pubkeyStr);
      }
    })();

    this.inFlightUsdc.set(pubkeyStr, task);
    return task;
  }

  /**
   * Query real on-chain balance in SKR (Solana Mobile Token) on mainnet/devnet with deduplication and cache fallback.
   */
  static async getSkrBalance(pubkeyStr: string, forceFresh = false): Promise<number> {
    if (!pubkeyStr) return 0;

    if (!forceFresh) {
      const cached = this.skrCache.get(pubkeyStr);
      if (cached && Date.now() - cached.time < this.CACHE_TTL_MS) {
        return cached.value;
      }
    }

    // 1. Primary: Backend /api/balance proxy (ultra-fast, bypasses mobile 429 & CORS)
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch(getApiUrl(`/api/balance?address=${encodeURIComponent(pubkeyStr.trim())}`));
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && typeof data.skr === 'number') {
            const skrVal = Number(data.skr.toFixed(2));
            this.skrCache.set(pubkeyStr, { value: skrVal, time: Date.now() });
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.setItem(`blink_cached_skr_${pubkeyStr}`, String(skrVal));
            }
            if (typeof data.sol === 'number') {
              this.solCache.set(pubkeyStr, { value: Number(data.sol.toFixed(4)), time: Date.now() });
            }
            if (typeof data.usdc === 'number') {
              this.usdcCache.set(pubkeyStr, { value: Number(data.usdc.toFixed(2)), time: Date.now() });
            }
            return skrVal;
          }
        }
      }
    } catch {}

    if (this.inFlightSkr.has(pubkeyStr)) {
      return this.inFlightSkr.get(pubkeyStr)!;
    }

    const task = (async (): Promise<number> => {
      try {
        const pubkey = new PublicKey(pubkeyStr);
        let total = 0;

        // 1. Query real SKR token balance on mainnet
        try {
          const mainnetConn = new Connection(MAINNET_RPC, 'confirmed');
          const mainnetAccounts = await mainnetConn.getParsedTokenAccountsByOwner(pubkey, {
            mint: SKR_DEVNET_MINT,
          });
          if (mainnetAccounts && mainnetAccounts.value.length > 0) {
            for (const item of mainnetAccounts.value) {
              const parsed = item.account.data?.parsed?.info?.tokenAmount;
              if (parsed && typeof parsed.uiAmount === 'number') {
                total += parsed.uiAmount;
              }
            }
          }
        } catch (e) {
          // quiet ignore
        }

        // 2. Also check devnet token account
        if (total === 0) {
          try {
            const devnetAccounts = await this.getConnection().getParsedTokenAccountsByOwner(pubkey, {
              mint: SKR_DEVNET_MINT,
            });
            if (devnetAccounts && devnetAccounts.value.length > 0) {
              for (const item of devnetAccounts.value) {
                const parsed = item.account.data?.parsed?.info?.tokenAmount;
                if (parsed && typeof parsed.uiAmount === 'number') {
                  total += parsed.uiAmount;
                }
              }
            }
          } catch (e) {
            // quiet ignore
          }
        }

        const skrVal = Number(total.toFixed(2));
        this.skrCache.set(pubkeyStr, { value: skrVal, time: Date.now() });
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(`blink_cached_skr_${pubkeyStr}`, String(skrVal));
        }
        return skrVal;
      } catch (err: any) {
        console.warn('SolanaService.getSkrBalance RPC error:', err?.message || err);
        const lastKnown = this.getCachedSkr(pubkeyStr);
        return lastKnown !== null ? lastKnown : 0;
      } finally {
        this.inFlightSkr.delete(pubkeyStr);
      }
    })();

    this.inFlightSkr.set(pubkeyStr, task);
    return task;
  }

  /**
   * Create SPL Token Transfer Instruction.
   */
  static createSplTokenTransferInstruction(
    source: PublicKey,
    destination: PublicKey,
    owner: PublicKey,
    amountUnits: bigint | number
  ): TransactionInstruction {
    const data = Buffer.alloc(9);
    data.writeUInt8(3, 0); // SPL Token instruction 3: Transfer
    data.writeBigUInt64LE(BigInt(amountUnits), 1);

    return new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: destination, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      data,
    });
  }

  /**
   * Create Associated Token Account (ATA) Instruction.
   */
  static createAssociatedTokenAccountInstruction(
    payer: PublicKey,
    ata: PublicKey,
    owner: PublicKey,
    mint: PublicKey = USDC_DEVNET_MINT
  ): TransactionInstruction {
    return new TransactionInstruction({
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: ata, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: Buffer.alloc(0),
    });
  }

  /**
   * Safely query account info with multi-tier fallback (Direct Devnet -> Primary Connection -> HTTP raw fetch)
   * to guarantee it never crashes with "TypeError: Failed to fetch".
   */
  static async getAccountInfoSafe(pubkey: PublicKey): Promise<any | null> {
    // 1. Direct official Solana Devnet RPC (natively supports CORS + solana-client header)
    try {
      const directConn = new Connection(DEVNET_RPC, { commitment: 'confirmed' });
      return await directConn.getAccountInfo(pubkey);
    } catch (err1) {
      console.warn('[SolanaService] Direct Devnet getAccountInfo failed, trying primary connection:', err1);
    }

    // 2. Primary connection
    try {
      const conn = this.getConnection();
      return await conn.getAccountInfo(pubkey);
    } catch (err2) {
      console.warn('[SolanaService] Primary connection getAccountInfo failed, trying HTTP raw fetch:', err2);
    }

    // 3. Raw HTTP fetch via proxy without solana-client header
    try {
      const res = await fetch(getApiUrl('/api/solana-rpc'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getAccountInfo',
          params: [pubkey.toBase58(), { encoding: 'base64' }],
        }),
      });
      const json = await res.json();
      if (json?.result?.value) {
        return json.result.value;
      }
    } catch (err3) {
      console.warn('[SolanaService] Raw fetch getAccountInfo failed:', err3);
    }

    return null;
  }

  /**
   * Resolve which USDC mint the sender holds tokens on.
   * Devnet has two common mints: official USDC_DEVNET_MINT (4zMMC...) and secondary faucet mint (Gh9Zw...).
   */
  static async resolveUsdcMint(senderPubkey: PublicKey): Promise<PublicKey> {
    try {
      const primaryAta = getAssociatedTokenAddressSync(USDC_DEVNET_MINT, senderPubkey);
      const acc1 = await this.getAccountInfoSafe(primaryAta);
      if (acc1) return USDC_DEVNET_MINT;

      const secondaryMint = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
      const secondaryAta = getAssociatedTokenAddressSync(secondaryMint, senderPubkey);
      const acc2 = await this.getAccountInfoSafe(secondaryAta);
      if (acc2) return secondaryMint;
    } catch (e) {
      console.warn('resolveUsdcMint error:', e);
    }
    return USDC_DEVNET_MINT;
  }

  /**
   * Build complete on-chain USDC transfer transaction on Solana network.
   * Auto-creates recipient ATA if not already existing.
   */
  static async buildUsdcTransferTransaction(
    senderPubkey: PublicKey,
    recipientPubkey: PublicKey,
    amountUsdc: number
  ): Promise<Transaction> {
    const mint = await this.resolveUsdcMint(senderPubkey);
    const senderAta = getAssociatedTokenAddressSync(mint, senderPubkey);
    const recipientAta = getAssociatedTokenAddressSync(mint, recipientPubkey);

    const transaction = new Transaction();

    // Check if recipient ATA exists on Solana network; create if not
    // If sender is sending to their own address, senderAta === recipientAta, which already exists!
    let needsAtaCreation = false;
    if (senderAta.equals(recipientAta)) {
      needsAtaCreation = false;
    } else {
      const recipientAtaInfo = await this.getAccountInfoSafe(recipientAta);
      needsAtaCreation = !recipientAtaInfo;
    }

    if (needsAtaCreation) {
      transaction.add(
        createAssociatedTokenAccountInstruction(senderPubkey, recipientAta, recipientPubkey, mint)
      );
    }

    // 1 USDC = 1,000,000 atomic units (6 decimals)
    const amountUnits = BigInt(Math.max(1, Math.round(amountUsdc * 1_000_000)));
    transaction.add(
      createTransferInstruction(senderAta, recipientAta, senderPubkey, amountUnits)
    );

    const latestBlockhash = await this.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = senderPubkey;

    return transaction;
  }

  /**
   * Build complete on-chain SKR transfer transaction on Solana network.
   * Auto-creates recipient SKR ATA if not already existing.
   */
  static async buildSkrTransferTransaction(
    senderPubkey: PublicKey,
    recipientPubkey: PublicKey,
    amountSkr: number
  ): Promise<Transaction> {
    const mint = SKR_DEVNET_MINT;
    const senderAta = getAssociatedTokenAddressSync(mint, senderPubkey);
    const recipientAta = getAssociatedTokenAddressSync(mint, recipientPubkey);

    const transaction = new Transaction();

    // Check if recipient ATA exists on Solana network; create if not
    let needsAtaCreation = false;
    if (senderAta.equals(recipientAta)) {
      needsAtaCreation = false;
    } else {
      const recipientAtaInfo = await this.getAccountInfoSafe(recipientAta);
      needsAtaCreation = !recipientAtaInfo;
    }

    if (needsAtaCreation) {
      transaction.add(
        createAssociatedTokenAccountInstruction(senderPubkey, recipientAta, recipientPubkey, mint)
      );
    }

    // 1 SKR = 1,000,000 atomic units (6 decimals)
    const amountUnits = BigInt(Math.max(1, Math.round(amountSkr * 1_000_000)));
    transaction.add(
      createTransferInstruction(senderAta, recipientAta, senderPubkey, amountUnits)
    );

    const latestBlockhash = await this.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = senderPubkey;

    return transaction;
  }

  /**
   * Request real 1 SOL airdrop on Devnet.
   */
  static async requestAirdrop(pubkeyStr: string): Promise<string> {
    if (this.activeNetwork !== 'devnet') {
      throw new Error('Airdrop is only available on Devnet.');
    }
    const pubkey = new PublicKey(pubkeyStr);
    try {
      const conn = this.getConnection();
      const signature = await conn.requestAirdrop(pubkey, 1 * LAMPORTS_PER_SOL);
      await this.confirmSignatureViaHttp(signature, 20);
      return signature;
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('429') || msg.includes('limit') || msg.includes('faucet')) {
        throw new Error('Solana Devnet faucet rate limit reached for this IP. Visit https://faucet.solana.com to claim test SOL.');
      }
      throw err;
    }
  }

  /**
   * Send real on-chain SOL transfer.
   * If Phantom/Solflare is connected, it pops up their real approval window!
   */
  static async sendSol(toPubkeyStr: string, amountSol: number): Promise<string> {
    const activeWallet = ExternalWalletService.getActiveWallet();
    const fromPubkey = activeWallet
      ? new PublicKey(activeWallet.publicKey)
      : this.getOrCreateKeypair().publicKey;

    const recipient = new PublicKey(toPubkeyStr.trim());
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey: recipient,
        lamports
      })
    );

    const latestBlockhash = await this.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = fromPubkey;

    return await ExternalWalletService.signAndSend(transaction);
  }

  /**
   * Fetch recent confirmed transactions from Solana RPC.
   */
  static async getRecentSignatures(pubkeyStr: string, limit: number = 50): Promise<OnChainTransactionInfo[]> {
    try {
      const pubkey = new PublicKey(pubkeyStr);
      const signatures = await this.getConnection().getSignaturesForAddress(pubkey, { limit });
      return signatures.map(s => ({
        signature: s.signature,
        slot: s.slot,
        err: s.err,
        memo: s.memo,
        blockTime: s.blockTime ?? null
      }));
    } catch (err) {
      console.error('Error fetching signatures:', err);
      return [];
    }
  }

  /**
   * Fetch recent transactions enriched with direction (Send/Receive) and amount.
   * Uses backend proxy /api/tx-history for maximum reliability on mobile devices with client RPC fallback.
   */
  static async getEnrichedRecentTransactions(pubkeyStr: string, limit: number = 50): Promise<EnrichedTransactionInfo[]> {
    if (!pubkeyStr) return [];

    // 1. Primary: Use backend /api/tx-history proxy (bypasses mobile RPC rate limits & CORS)
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch(getApiUrl(`/api/tx-history?address=${encodeURIComponent(pubkeyStr)}&limit=${limit}`));
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && Array.isArray(data.transactions)) {
            return data.transactions;
          }
        }
      }
    } catch (apiErr) {
      console.warn('Backend /api/tx-history lookup deferred, falling back to direct RPC:', apiErr);
    }

    // 2. Fallback: Direct client-side Solana RPC connection
    try {
      const pubkey = new PublicKey(pubkeyStr);
      const sigInfos = await this.getConnection().getSignaturesForAddress(pubkey, { limit });
      if (!sigInfos || sigInfos.length === 0) return [];

      const signatures = sigInfos.map(s => s.signature);

      // Fetch parsed transactions for the top recent items
      const parsedMap = new Map<string, any>();
      try {
        const topSignatures = signatures.slice(0, 8);
        const parsedBatch = await this.getConnection().getParsedTransactions(topSignatures, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        });
        topSignatures.forEach((sig, idx) => {
          if (parsedBatch && parsedBatch[idx]) {
            parsedMap.set(sig, parsedBatch[idx]);
          }
        });
      } catch (parseErr) {
        console.warn('Batch parsed transaction lookup throttled, using signature fallback:', parseErr);
      }

      return sigInfos.map((sigInfo) => {
        const parsed = parsedMap.get(sigInfo.signature);
        const details = parsed ? this.parseTransactionDetails(parsed, pubkeyStr) : null;

        return {
          signature: sigInfo.signature,
          slot: sigInfo.slot,
          err: sigInfo.err,
          memo: sigInfo.memo,
          blockTime: sigInfo.blockTime ?? null,
          direction: details?.direction || 'unknown',
          amountSol: details?.amountSol !== null && details?.amountSol !== undefined ? Number(details.amountSol.toFixed(6)) : null,
          amountUsdc: details?.amountUsdc !== null && details?.amountUsdc !== undefined ? Number(details.amountUsdc.toFixed(2)) : null,
          token: details?.token || 'SOL',
          counterparty: details?.counterparty || null,
        };
      });
    } catch (err) {
      console.warn('Direct RPC lookup failed for enriched transactions:', err);
      return [];
    }
  }


  /**
   * Universal on-chain transaction parser for SOL and SPL Tokens (USDC).
   */
  static parseTransactionDetails(parsed: any, userAddress?: string | null): {
    direction: 'send' | 'receive' | 'unknown';
    amountSol: number | null;
    amountUsdc: number | null;
    token: 'SOL' | 'USDC';
    sender: string | null;
    recipient: string | null;
    counterparty: string | null;
    feeSol: number;
  } {
    let direction: 'send' | 'receive' | 'unknown' = 'unknown';
    let amountSol: number | null = null;
    let amountUsdc: number | null = null;
    let token: 'SOL' | 'USDC' = 'SOL';
    let sender: string | null = null;
    let recipient: string | null = null;
    let counterparty: string | null = null;
    let feeSol = 0;

    if (!parsed || !parsed.transaction || !parsed.meta) {
      return { direction, amountSol, amountUsdc, token, sender, recipient, counterparty, feeSol };
    }

    const accountKeys: string[] = parsed.transaction.message.accountKeys.map(
      (k: any) => (typeof k === 'string' ? k : k.pubkey?.toString?.() || k.toString())
    );

    const feePayer = accountKeys[0] || null;
    feeSol = (parsed.meta.fee || 0) / LAMPORTS_PER_SOL;

    const userIndex = userAddress ? accountKeys.indexOf(userAddress) : -1;

    // 1. Check SPL Token Transfers (e.g. USDC) via pre/post token balances
    const preTokens = parsed.meta.preTokenBalances || [];
    const postTokens = parsed.meta.postTokenBalances || [];

    for (const post of postTokens) {
      const pre = preTokens.find((p: any) => p.accountIndex === post.accountIndex);
      const preAmount = pre?.uiTokenAmount?.uiAmount ?? 0;
      const postAmount = post?.uiTokenAmount?.uiAmount ?? 0;
      const diff = postAmount - preAmount;

      if (Math.abs(diff) > 0.000001) {
        token = 'USDC';
        const owner = post.owner || accountKeys[post.accountIndex];
        if (userAddress && owner === userAddress) {
          if (diff > 0) {
            direction = 'receive';
            amountUsdc = Number(diff.toFixed(2));
            recipient = userAddress;
          } else {
            direction = 'send';
            amountUsdc = Number(Math.abs(diff).toFixed(2));
            sender = userAddress;
          }
        }
      }
    }

    // 2. Also inspect instructions for transfers (SystemProgram or SplToken)
    const allInstructions = [
      ...(parsed.transaction.message.instructions || []),
      ...(parsed.meta.innerInstructions?.flatMap((i: any) => i.instructions) || []),
    ];

    for (const ix of allInstructions) {
      const parsedIx = (ix as any)?.parsed;
      const program = (ix as any)?.program || (ix as any)?.programId?.toString?.();

      if (parsedIx && parsedIx.info) {
        const info = parsedIx.info;
        // Native SOL transfer
        if (parsedIx.type === 'transfer' && (program === 'system' || info.lamports !== undefined)) {
          const lamports = Number(info.lamports || 0);
          const sol = lamports / LAMPORTS_PER_SOL;
          sender = info.source || sender || feePayer;
          recipient = info.destination || recipient;

          if (userAddress) {
            if (info.destination === userAddress) {
              direction = 'receive';
              amountSol = sol;
              counterparty = info.source || feePayer;
            } else if (info.source === userAddress) {
              direction = 'send';
              amountSol = sol;
              counterparty = info.destination;
            }
          } else {
            amountSol = sol;
          }
        }

        // SPL Token transfer (USDC)
        if (
          (parsedIx.type === 'transfer' || parsedIx.type === 'transferChecked') &&
          (program === 'spl-token' || info.tokenAmount || info.amount !== undefined)
        ) {
          token = 'USDC';
          let usdcAmount = 0;
          if (info.tokenAmount && typeof info.tokenAmount.uiAmount === 'number') {
            usdcAmount = info.tokenAmount.uiAmount;
          } else if (info.amount) {
            usdcAmount = Number(info.amount) / 1e6; // USDC decimals = 6
          }
          amountUsdc = Number(usdcAmount.toFixed(2));

          const tokenAuthority = info.authority || info.multisigAuthority || feePayer;
          sender = sender || tokenAuthority;

          if (userAddress) {
            if (tokenAuthority === userAddress) {
              direction = 'send';
              counterparty = recipient || info.destination;
            } else {
              direction = 'receive';
              counterparty = tokenAuthority;
              recipient = userAddress;
            }
          }
        }
      }
    }

    // 3. Native SOL balance diff fallback if amount still undetermined
    if (amountSol === null && amountUsdc === null && userIndex !== -1 && parsed.meta.preBalances && parsed.meta.postBalances) {
      const preBal = parsed.meta.preBalances[userIndex];
      const postBal = parsed.meta.postBalances[userIndex];
      const diff = postBal - preBal;

      if (diff < 0) {
        direction = 'send';
        const fee = parsed.meta.fee || 0;
        amountSol = Number((Math.abs(diff + (userIndex === 0 ? fee : 0)) / LAMPORTS_PER_SOL).toFixed(4));
        sender = userAddress || feePayer;
      } else if (diff > 0) {
        direction = 'receive';
        amountSol = Number((diff / LAMPORTS_PER_SOL).toFixed(4));
        recipient = userAddress || null;
        sender = feePayer;
        counterparty = feePayer;
      }
    }

    if (!sender && direction === 'receive') {
      sender = counterparty || feePayer || 'External Solana Address';
    }
    if (!recipient && direction === 'send') {
      recipient = counterparty || 'External Solana Address';
    }
    if (!counterparty) {
      counterparty = direction === 'send' ? recipient : sender;
    }

    return { direction, amountSol, amountUsdc, token, sender, recipient, counterparty, feeSol };
  }

  /**
   * On-demand complete transaction parser for receipts.
   */
  static async fetchFullTransactionDetails(signature: string, userAddress?: string | null) {
    try {
      const parsed = await this.getConnection().getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
      if (!parsed) return null;
      return {
        ...this.parseTransactionDetails(parsed, userAddress),
        blockTime: parsed.blockTime,
        slot: parsed.slot,
        err: parsed.meta?.err || null,
      };
    } catch (e) {
      console.warn('fetchFullTransactionDetails error:', e);
      return null;
    }
  }

  static getExplorerUrl(identifier: string): string {
    const isAddress = identifier.length < 50;
    const path = isAddress ? 'address' : 'tx';
    const cluster = this.activeNetwork === 'devnet' ? '?cluster=devnet' : '';
    return `https://explorer.solana.com/${path}/${identifier}${cluster}`;
  }
}
