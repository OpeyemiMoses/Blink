import React, { useState, useEffect } from 'react';
import { WalletProviderService, WalletAccount } from '../services/walletProviderService';
import { SolanaMobileStackService } from '../services/solanaMobileStackService';
import { SolanaService } from '../services/solanaService';
import { Transaction } from '@solana/web3.js';

export const PrivyProvider: React.FC<{ children: React.ReactNode; [key: string]: any }> = ({ children }) => {
  return <>{children}</>;
};

export const toSolanaWalletConnectors = () => [];
export const defaultSolanaRpcsPlugin = () => ({});

export function usePrivy() {
  const [account, setAccount] = useState<WalletAccount | null>(() => WalletProviderService.getActiveAccount());

  useEffect(() => {
    return WalletProviderService.subscribe((acc) => {
      setAccount(acc);
    });
  }, []);

  const login = async (options?: any) => {
    try {
      const mwaAcc = await SolanaMobileStackService.connectMWA();
      if (mwaAcc) return;
    } catch (e) {
      console.warn('MWA connect fallback on native:', e);
    }

    const kp = SolanaService.getOrCreateKeypair();
    WalletProviderService.setActiveAccount({
      name: 'Seeker Seed Vault',
      publicKey: kp.publicKey.toBase58(),
      isPrivy: false,
    });
  };

  const logout = async () => {
    WalletProviderService.disconnect();
  };

  return {
    ready: true,
    authenticated: !!account,
    user: account
      ? {
          id: account.publicKey,
          linkedAccounts: [
            {
              type: 'wallet',
              address: account.publicKey,
              chainType: 'solana',
              walletClientType: account.name || 'solana',
            },
          ],
        }
      : null,
    login,
    logout,
  };
}

export function useWallets() {
  const [account, setAccount] = useState<WalletAccount | null>(() => WalletProviderService.getActiveAccount());

  useEffect(() => {
    return WalletProviderService.subscribe((acc) => {
      setAccount(acc);
    });
  }, []);

  return {
    wallets: account
      ? [
          {
            address: account.publicKey,
            chainType: 'solana',
            walletClientType: account.name || 'solana',
          },
        ]
      : [],
  };
}

export function useCreateWallet() {
  return {
    createWallet: async () => {
      const kp = SolanaService.getOrCreateKeypair();
      const acc: WalletAccount = {
        name: 'Seeker Seed Vault',
        publicKey: kp.publicKey.toBase58(),
        isPrivy: false,
      };
      WalletProviderService.setActiveAccount(acc);
      return acc;
    },
  };
}

export function useSignAndSendTransaction() {
  return {
    signAndSendTransaction: async ({ transaction }: { transaction: Transaction | any }) => {
      const sig = await WalletProviderService.signAndSendTransaction(transaction);
      return { signature: sig };
    },
  };
}

export function useSignTransaction() {
  return {
    signTransaction: async ({ transaction }: { transaction: Transaction | any }) => {
      const signed = await WalletProviderService.signTransaction(transaction);
      return { signedTransaction: signed };
    },
  };
}

export function useExportWallet() {
  return {
    exportWallet: async () => {
      console.log('Native wallet export handled via SeedVaultModal');
    },
  };
}

export function useLoginWithOAuth(_opts?: any) {
  return {
    initOAuth: async (_args?: any) => {
      try {
        const mwaAcc = await SolanaMobileStackService.connectMWA();
        if (mwaAcc) return;
      } catch (e) {
        console.warn('OAuth fallback to MWA:', e);
      }

      const kp = SolanaService.getOrCreateKeypair();
      WalletProviderService.setActiveAccount({
        name: 'Seeker Seed Vault',
        publicKey: kp.publicKey.toBase58(),
        isPrivy: false,
      });
    },
  };
}
