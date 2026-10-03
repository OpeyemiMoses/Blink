import { PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SolanaService } from './solanaService';

export interface WalletAccount {
  name: string;
  publicKey: string;
  isPrivy?: boolean;
  isSeedVault?: boolean;
}

type WalletEventCallback = (account: WalletAccount | null) => void;

const STORAGE_WALLET_KEY = 'solana_connected_wallet_name';

export class WalletProviderService {
  private static activeAccount: WalletAccount | null = null;
  private static listeners: WalletEventCallback[] = [];
  private static autoReconnectAttempted = false;
  private static privySigner: ((tx: Transaction) => Promise<string>) | null = null;

  static subscribe(callback: WalletEventCallback): () => void {
    this.listeners.push(callback);
    callback(this.activeAccount);

    // Attempt auto-reconnect once on subscription
    if (!this.autoReconnectAttempted) {
      this.autoReconnectAttempted = true;
      this.tryAutoReconnect();
    }

    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  static setActiveAccount(account: WalletAccount | null): void {
    this.activeAccount = account;
    this.notify();
  }

  static setPrivySigner(signer: ((tx: Transaction) => Promise<string>) | null): void {
    this.privySigner = signer;
  }

  private static notify() {
    this.listeners.forEach(cb => cb(this.activeAccount));
  }

  static getActiveAccount(): WalletAccount | null {
    return this.activeAccount;
  }

  /**
   * Resolve Phantom provider.
   */
  static getPhantomProvider(): any {
    if (typeof window === 'undefined') return null;
    const anyWindow = window as any;
    if (anyWindow.phantom?.solana?.isPhantom) {
      return anyWindow.phantom.solana;
    }
    if (anyWindow.solana?.isPhantom) {
      return anyWindow.solana;
    }
    return null;
  }

  /**
   * Resolve Solflare provider.
   */
  static getSolflareProvider(): any {
    if (typeof window === 'undefined') return null;
    const anyWindow = window as any;
    if (anyWindow.solflare?.isSolflare) {
      return anyWindow.solflare;
    }
    return null;
  }

  /**
   * Resolve Backpack provider.
   */
  static getBackpackProvider(): any {
    if (typeof window === 'undefined') return null;
    const anyWindow = window as any;
    if (anyWindow.backpack?.isBackpack) {
      return anyWindow.backpack;
    }
    if (anyWindow.xnft?.solana?.isBackpack) {
      return anyWindow.xnft.solana;
    }
    return null;
  }

  /**
   * Resolve Coinbase Wallet provider.
   */
  static getCoinbaseProvider(): any {
    if (typeof window === 'undefined') return null;
    const anyWindow = window as any;
    if (anyWindow.coinbaseSolana) {
      return anyWindow.coinbaseSolana;
    }
    if (anyWindow.solana?.isCoinbaseWallet) {
      return anyWindow.solana;
    }
    return null;
  }

  static isMobile(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  /**
   * Connect to specified wallet.
   */
  static async connect(walletName: WalletAccount['name'], silent = false): Promise<WalletAccount> {
    let provider: any = null;

    if (walletName === 'Phantom') {
      provider = this.getPhantomProvider();
    } else if (walletName === 'Solflare') {
      provider = this.getSolflareProvider();
    } else if (walletName === 'Backpack') {
      provider = this.getBackpackProvider();
    } else if (walletName === 'Coinbase Wallet') {
      provider = this.getCoinbaseProvider();
    }

    if (!provider) {
      if (this.isMobile() && typeof window !== 'undefined') {
        if (walletName === 'Phantom') {
          const { SolanaMobileStackService } = await import('./solanaMobileStackService');
          await SolanaMobileStackService.connectPhantomMobile();
          throw new Error('Opening Phantom Mobile App...');
        } else if (walletName === 'Solflare') {
          const { SolanaMobileStackService } = await import('./solanaMobileStackService');
          await SolanaMobileStackService.connectSolflareMobile();
          throw new Error('Opening Solflare Mobile App...');
        }
      }
      throw new Error(`${walletName} wallet not detected in your browser.`);
    }

    try {
      const connectOptions = silent ? { onlyIfTrusted: true } : {};
      const resp = await provider.connect(connectOptions);
      const pubkey = (resp?.publicKey || provider.publicKey).toString();

      this.activeAccount = {
        name: walletName,
        publicKey: pubkey,
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_WALLET_KEY, walletName);
      }

      // Attach account change and disconnect listeners
      if (typeof provider.on === 'function') {
        provider.on('accountChanged', (publicKey: PublicKey | null) => {
          if (publicKey) {
            this.activeAccount = {
              name: walletName,
              publicKey: publicKey.toString(),
            };
          } else {
            this.disconnect();
          }
          this.notify();
        });

        provider.on('disconnect', () => {
          this.disconnect();
        });
      }

      this.notify();
      return this.activeAccount;
    } catch (err: any) {
      if (!silent) {
        throw new Error(err?.message || `${walletName} connection request was rejected.`);
      }
      throw err;
    }
  }

  /**
   * Silently restore the previously connected wallet on page reload if trusted.
   */
  private static async tryAutoReconnect() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const saved = window.localStorage.getItem(STORAGE_WALLET_KEY) as WalletAccount['name'] | null;
    if (!saved) return;

    try {
      await this.connect(saved, true);
    } catch {
      // If user hasn't approved or auto-connect fails, keep activeAccount as null
      // Do NOT default to any random wallet!
      console.log('Auto-reconnect silent attempt finished.');
    }
  }

  /**
   * Sign and send transaction through the connected wallet.
   */
  static async signAndSendTransaction(transaction: Transaction): Promise<string> {
    // 1. Direct Seeker Seed Vault hardware biometric signing (Zero app switching)
    if (this.activeAccount?.isSeedVault) {
      const { BiometricService } = await import('./biometricService');
      const auth = await BiometricService.authenticate('Authorize payment with Seeker Seed Vault', true);
      if (!auth.success) {
        throw new Error(auth.error === 'user_cancel' ? 'Transaction was cancelled by user.' : (auth.error || 'Biometric authentication failed.'));
      }

      const keypair = SolanaService.getOrCreateKeypair();

      if (!transaction.recentBlockhash) {
        const latest = await SolanaService.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = latest.blockhash;
      }
      if (!transaction.feePayer) {
        transaction.feePayer = keypair.publicKey;
      }

      transaction.partialSign(keypair);
      const serialized = transaction.serialize();
      return await SolanaService.sendRawTransactionAndConfirm(serialized);
    }

    // 2. Direct Injected Browser Providers (Extension or Phantom/Solflare In-App Browser)
    let provider: any = null;
    const accName = (this.activeAccount?.name || '').toLowerCase();
    if (accName.includes('phantom')) {
      provider = this.getPhantomProvider();
    } else if (accName.includes('solflare')) {
      provider = this.getSolflareProvider();
    } else if (accName.includes('backpack')) {
      provider = this.getBackpackProvider();
    } else if (accName.includes('coinbase')) {
      provider = this.getCoinbaseProvider();
    }

    if (provider) {
      try {
        if (typeof provider.signAndSendTransaction === 'function') {
          const res = await provider.signAndSendTransaction(transaction);
          return res.signature || res;
        }

        if (typeof provider.sendTransaction === 'function') {
          return await provider.sendTransaction(transaction);
        }
      } catch (err: any) {
        console.warn('Wallet provider transaction signing error:', err);
        throw err;
      }
    }

    // 3. Mobile Deeplink / SMS (Phantom Mobile, Solflare Mobile, Seeker MWA)
    if (
      this.activeAccount?.name?.includes('MWA') ||
      this.activeAccount?.name?.includes('Mobile') ||
      accName.includes('phantom') ||
      accName.includes('solflare')
    ) {
      const { SolanaMobileStackService } = await import('./solanaMobileStackService');
      return await SolanaMobileStackService.signAndSendTransaction(transaction);
    }

    // 4. Privy Signer
    if (this.privySigner) {
      try {
        return await this.privySigner(transaction);
      } catch (err: any) {
        console.warn('Privy signer error, checking fallback:', err);
        if (this.activeAccount?.isPrivy) {
          throw err;
        }
      }
    }

    // Fall back to real on-chain transaction via Seeker On-Device Keypair
    try {
      const connection = SolanaService.getConnection();
      const localKeypair = SolanaService.getOrCreateKeypair();

      // Check balance on Devnet and request 1 SOL airdrop if needed
      try {
        const bal = await connection.getBalance(localKeypair.publicKey);
        if (bal < 0.005 * LAMPORTS_PER_SOL) {
          const airdropSig = await connection.requestAirdrop(localKeypair.publicKey, 1 * LAMPORTS_PER_SOL);
          await SolanaService.confirmSignatureViaHttp(airdropSig, 15);
        }
      } catch (airdropErr) {
        console.warn('Devnet airdrop check warning:', airdropErr);
      }

      // Re-target fee payer & instructions to ensure valid signature
      const latestBlockhash = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.feePayer = localKeypair.publicKey;

      if (transaction.instructions.length > 0) {
        for (const ix of transaction.instructions) {
          for (const key of ix.keys) {
            if (key.isSigner && !key.pubkey.equals(localKeypair.publicKey)) {
              key.pubkey = localKeypair.publicKey;
            }
          }
        }
      }

      try {
        transaction.sign(localKeypair);
        const rawTx = transaction.serialize();
        const sig = await SolanaService.sendRawTransactionAndConfirm(rawTx);
        return sig;
      } catch (confirmErr: any) {
        throw confirmErr;
      }
    } catch (onChainErr: any) {
      console.error('Real on-chain transaction broadcast error:', onChainErr);
      throw new Error(`On-chain Solana transaction failed: ${onChainErr?.message || onChainErr}`);
    }
  }

  /**
   * Sign transaction.
   */
  static async signTransaction(transaction: Transaction): Promise<Transaction> {
    let provider: any = null;
    if (this.activeAccount) {
      if (this.activeAccount.name === 'Phantom') provider = this.getPhantomProvider();
      else if (this.activeAccount.name === 'Solflare') provider = this.getSolflareProvider();
      else if (this.activeAccount.name === 'Backpack') provider = this.getBackpackProvider();
    }

    if (provider && typeof provider.signTransaction === 'function') {
      try {
        return await provider.signTransaction(transaction);
      } catch (err) {
        console.warn('Provider signTransaction error:', err);
      }
    }

    return transaction;
  }

  /**
   * Disconnect the active wallet and clear stored session.
   */
  static disconnect(): void {
    if (this.activeAccount) {
      let provider: any = null;
      if (this.activeAccount.name === 'Phantom') provider = this.getPhantomProvider();
      else if (this.activeAccount.name === 'Solflare') provider = this.getSolflareProvider();
      else if (this.activeAccount.name === 'Backpack') provider = this.getBackpackProvider();

      try {
        if (provider && typeof provider.disconnect === 'function') {
          provider.disconnect();
        }
      } catch {}
    }

    this.activeAccount = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_WALLET_KEY);
    }
    this.notify();
  }
}
