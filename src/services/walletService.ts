import { SeedVaultAuthResult } from '../types';

export interface WalletState {
  connected: boolean;
  publicKey: string;
  balanceSol: number;
  balanceUsdc: number;
  balanceSkr: number;
  network: 'devnet' | 'mainnet-beta';
  isSeedVaultAvailable: boolean;
}

export class WalletService {
  private static state: WalletState = {
    connected: true,
    publicKey: 'Seeker8XqY3uA7h2mZ1B4eP9tW5kVrQ6dLsC0nM',
    balanceSol: 4.85,
    balanceUsdc: 245.50,
    balanceSkr: 5250,
    network: 'devnet',
    isSeedVaultAvailable: true
  };

  static getState(): WalletState {
    return { ...this.state };
  }

  static setNetwork(network: 'devnet' | 'mainnet-beta') {
    this.state.network = network;
  }

  /**
   * Request authorization through the Solana Mobile Stack (MWA) and Seed Vault.
   * Simulates/executes biometric fingerprint approval.
   */
  static async signWithSeedVault(
    memo: string,
    amountUsd?: number
  ): Promise<SeedVaultAuthResult> {
    return new Promise((resolve) => {
      // Small delay simulating biometric sensor read
      setTimeout(() => {
        // Deduct balances if spending
        if (amountUsd) {
          if (this.state.balanceUsdc >= amountUsd) {
            this.state.balanceUsdc = Number((this.state.balanceUsdc - amountUsd).toFixed(2));
          } else {
            const solEquivalent = amountUsd / 150;
            this.state.balanceSol = Number(Math.max(0, this.state.balanceSol - solEquivalent).toFixed(3));
          }
        }

        const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        let sig = '';
        for (let i = 0; i < 64; i++) {
          sig += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        resolve({
          approved: true,
          biometricType: 'fingerprint',
          publicKey: this.state.publicKey,
          signature: sig
        });
      }, 700);
    });
  }
}
