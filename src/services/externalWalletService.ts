import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { SolanaService } from './solanaService';

export type WalletType = 'phantom' | 'solflare' | 'on_device';

export interface ConnectedWalletInfo {
  type: WalletType;
  name: string;
  publicKey: string;
}

export class ExternalWalletService {
  private static activeWallet: ConnectedWalletInfo | null = null;

  static getActiveWallet(): ConnectedWalletInfo | null {
    return this.activeWallet;
  }

  static setActiveWallet(wallet: ConnectedWalletInfo | null) {
    this.activeWallet = wallet;
  }

  static isPhantomAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).solana?.isPhantom || (window as any).phantom?.solana?.isPhantom);
  }

  static isSolflareAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window as any).solflare?.isSolflare;
  }

  /**
   * Connect to real Phantom wallet.
   */
  static async connectPhantom(): Promise<ConnectedWalletInfo> {
    if (typeof window === 'undefined') {
      throw new Error('Window environment not available.');
    }

    const provider = (window as any).phantom?.solana || (window as any).solana;
    if (!provider || !provider.isPhantom) {
      if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        const { SolanaMobileStackService } = await import('./solanaMobileStackService');
        await SolanaMobileStackService.connectPhantomMobile();
        throw new Error('Opening in Phantom Mobile App...');
      }
      throw new Error('Phantom extension not detected in this browser. Install Phantom or import your private key below.');
    }

    const res = await provider.connect();
    const pubkey = res.publicKey.toString();

    this.activeWallet = {
      type: 'phantom',
      name: 'Phantom Wallet',
      publicKey: pubkey,
    };
    return this.activeWallet;
  }

  /**
   * Connect to real Solflare wallet.
   */
  static async connectSolflare(): Promise<ConnectedWalletInfo> {
    if (typeof window === 'undefined') {
      throw new Error('Window environment not available.');
    }

    const provider = (window as any).solflare;
    if (!provider) {
      if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        const currentUrl = encodeURIComponent(window.location.href);
        window.location.href = `https://solflare.com/ul/v1/browse/${currentUrl}?ref=${currentUrl}`;
        throw new Error('Opening in Solflare Mobile App...');
      }
      throw new Error('Solflare extension not detected in this browser.');
    }

    await provider.connect();
    const pubkey = provider.publicKey.toString();

    this.activeWallet = {
      type: 'solflare',
      name: 'Solflare Wallet',
      publicKey: pubkey,
    };
    return this.activeWallet;
  }

  /**
   * Sign and broadcast a real Solana transaction through the connected wallet.
   * If Phantom is connected, this pops up Phantom's real transaction approval window!
   */
  static async signAndSend(transaction: Transaction): Promise<string> {
    const connection = SolanaService.getConnection();

    // 1. If Phantom is active, route through Phantom's real approval window
    if (this.activeWallet?.type === 'phantom') {
      const provider = (window as any).phantom?.solana || (window as any).solana;
      if (!provider) throw new Error('Phantom provider disconnected.');
      const { signature } = await provider.signAndSendTransaction(transaction);
      return signature;
    }

    // 2. If Solflare is active, route through Solflare's real approval window
    if (this.activeWallet?.type === 'solflare') {
      const provider = (window as any).solflare;
      if (!provider) throw new Error('Solflare provider disconnected.');
      const { signature } = await provider.signAndSendTransaction(transaction);
      return signature;
    }

    // 3. On-device Seeker keypair
    const sender = SolanaService.getOrCreateKeypair();
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [sender],
      { commitment: 'confirmed' }
    );
    return signature;
  }

  /**
   * Disconnect active wallet.
   */
  static disconnect(): void {
    if (this.activeWallet?.type === 'phantom') {
      try {
        ((window as any).phantom?.solana || (window as any).solana)?.disconnect();
      } catch {}
    }
    if (this.activeWallet?.type === 'solflare') {
      try {
        (window as any).solflare?.disconnect();
      } catch {}
    }
    this.activeWallet = null;
  }
}
