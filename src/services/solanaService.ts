import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { ExternalWalletService } from './externalWalletService';

export const DEVNET_RPC = 'https://api.devnet.solana.com';
export const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

// Official Solana Devnet USDC & SKR SPL Mint & Program IDs
export const USDC_DEVNET_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
export const SKR_DEVNET_MINT = new PublicKey('SKR1111111111111111111111111111111111111111');
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

const STORAGE_KEY = 'seeker_solana_private_key';

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
  private static connection = new Connection(DEVNET_RPC, 'confirmed');
  private static activeNetwork: 'devnet' = 'devnet';
  private static currentKeypair: Keypair | null = null;

  static setNetwork(_network?: string) {
    // Strictly locked to devnet
    this.activeNetwork = 'devnet';
    this.connection = new Connection(DEVNET_RPC, 'confirmed');
  }

  static getNetwork(): 'devnet' {
    return 'devnet';
  }

  static getConnection(): Connection {
    return this.connection;
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
  private static inFlightSol: Map<string, Promise<number>> = new Map();
  private static inFlightUsdc: Map<string, Promise<number>> = new Map();
  private static readonly CACHE_TTL_MS = 15000; // 15 seconds fresh cache

  /**
   * Synchronously get cached SOL balance if available (memory or localStorage)
   */
  static getCachedSol(pubkeyStr: string): number | null {
    if (!pubkeyStr) return null;
    const mem = this.solCache.get(pubkeyStr);
    if (mem !== undefined) {
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
    if (mem !== undefined) {
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
   * Manually prime or optimistically update cached balance (e.g. after a send or receive)
   */
  static setCachedBalance(pubkeyStr: string, sol?: number, usdc?: number) {
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

    // Deduplicate in-flight requests for the same address
    if (this.inFlightSol.has(pubkeyStr)) {
      return this.inFlightSol.get(pubkeyStr)!;
    }

    const task = (async (): Promise<number> => {
      try {
        const pubkey = new PublicKey(pubkeyStr);
        const lamports = await this.connection.getBalance(pubkey);
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

    if (this.inFlightUsdc.has(pubkeyStr)) {
      return this.inFlightUsdc.get(pubkeyStr)!;
    }

    const task = (async (): Promise<number> => {
      try {
        const pubkey = new PublicKey(pubkeyStr);
        let total = 0;

        // 1. Query official Circle Devnet USDC accounts
        try {
          const circleAccounts = await this.connection.getParsedTokenAccountsByOwner(pubkey, {
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
          const faucetAccounts = await this.connection.getParsedTokenAccountsByOwner(pubkey, {
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
   * Build complete on-chain USDC transfer transaction on Solana network.
   * Auto-creates recipient ATA if not already existing.
   */
  static async buildUsdcTransferTransaction(
    senderPubkey: PublicKey,
    recipientPubkey: PublicKey,
    amountUsdc: number
  ): Promise<Transaction> {
    const senderAta = this.getAssociatedTokenAddress(senderPubkey, USDC_DEVNET_MINT);
    const recipientAta = this.getAssociatedTokenAddress(recipientPubkey, USDC_DEVNET_MINT);

    const transaction = new Transaction();

    // Check if recipient ATA exists on Solana network
    const recipientAtaInfo = await this.connection.getAccountInfo(recipientAta);
    if (!recipientAtaInfo) {
      transaction.add(
        this.createAssociatedTokenAccountInstruction(senderPubkey, recipientAta, recipientPubkey, USDC_DEVNET_MINT)
      );
    }

    // 1 USDC = 1,000,000 atomic units (6 decimals)
    const amountUnits = BigInt(Math.max(1, Math.round(amountUsdc * 1_000_000)));
    transaction.add(
      this.createSplTokenTransferInstruction(senderAta, recipientAta, senderPubkey, amountUnits)
    );

    const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');
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
    const senderAta = this.getAssociatedTokenAddress(senderPubkey, SKR_DEVNET_MINT);
    const recipientAta = this.getAssociatedTokenAddress(recipientPubkey, SKR_DEVNET_MINT);

    const transaction = new Transaction();

    // Check if recipient ATA exists on Solana network
    const recipientAtaInfo = await this.connection.getAccountInfo(recipientAta);
    if (!recipientAtaInfo) {
      transaction.add(
        this.createAssociatedTokenAccountInstruction(senderPubkey, recipientAta, recipientPubkey, SKR_DEVNET_MINT)
      );
    }

    // 1 SKR = 1,000,000 atomic units (6 decimals)
    const amountUnits = BigInt(Math.max(1, Math.round(amountSkr * 1_000_000)));
    transaction.add(
      this.createSplTokenTransferInstruction(senderAta, recipientAta, senderPubkey, amountUnits)
    );

    const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');
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
      const signature = await this.connection.requestAirdrop(pubkey, 1 * LAMPORTS_PER_SOL);
      const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');
      await this.connection.confirmTransaction({
        signature,
        ...latestBlockhash
      }, 'confirmed');
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

    const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');
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
      const signatures = await this.connection.getSignaturesForAddress(pubkey, { limit });
      return signatures.map(s => ({
        signature: s.signature,
        slot: s.slot,
        err: s.err,
        memo: s.memo,
        blockTime: s.blockTime
      }));
    } catch (err) {
      console.error('Error fetching signatures:', err);
      return [];
    }
  }

  /**
   * Fetch recent transactions enriched with direction (Send/Receive) and amount.
   */
  static async getEnrichedRecentTransactions(pubkeyStr: string, limit: number = 50): Promise<EnrichedTransactionInfo[]> {
    try {
      const pubkey = new PublicKey(pubkeyStr);
      const sigInfos = await this.connection.getSignaturesForAddress(pubkey, { limit });
      if (!sigInfos || sigInfos.length === 0) return [];

      const signatures = sigInfos.map(s => s.signature);

      // Fetch parsed transactions for the top recent items to stay within Solana public RPC limits
      const parsedMap = new Map<string, any>();
      try {
        const topSignatures = signatures.slice(0, 8);
        const parsedBatch = await this.connection.getParsedTransactions(topSignatures, {
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
          blockTime: sigInfo.blockTime,
          direction: details?.direction || 'unknown',
          amountSol: details?.amountSol !== null && details?.amountSol !== undefined ? Number(details.amountSol.toFixed(6)) : null,
          amountUsdc: details?.amountUsdc !== null && details?.amountUsdc !== undefined ? Number(details.amountUsdc.toFixed(2)) : null,
          token: details?.token || 'SOL',
          counterparty: details?.counterparty || null,
        };
      });
    } catch (err) {
      console.error('Error fetching enriched transactions:', err);
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
        recipient = userAddress;
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
      const parsed = await this.connection.getParsedTransaction(signature, {
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
