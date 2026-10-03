/**
 * privyAdapter.web.tsx
 *
 * Direct integration with official @privy-io/react-auth and @privy-io/react-auth/solana.
 * Fully active across web and mobile APK runtimes.
 */

import React from 'react';
import { getApiUrl } from '../services/apiConfig';
import { UserProfileService } from '../services/userProfileService';

// ─── Real Privy SDK ───────────────────────────────────────────────────────────
import {
  PrivyProvider as PrivyProviderWeb,
  usePrivy as usePrivyWeb,
  useLoginWithOAuth as useLoginWithOAuthWeb,
} from '@privy-io/react-auth';
import {
  toSolanaWalletConnectors as toSolanaWalletConnectorsWeb,
  useWallets as useWalletsWeb,
  useCreateWallet as useCreateWalletWeb,
  useSignAndSendTransaction as useSignAndSendTransactionWeb,
  useSignTransaction as useSignTransactionWeb,
  useExportWallet as useExportWalletWeb,
  defaultSolanaRpcsPlugin as defaultSolanaRpcsPluginWeb,
} from '@privy-io/react-auth/solana';

/** PrivyProvider – official Privy Provider wrapper */
export const PrivyProvider: React.FC<{ children: React.ReactNode; [key: string]: any }> = (props: any) => {
  const WebProvider = PrivyProviderWeb as any;
  return React.createElement(WebProvider, props);
};

/** usePrivy – returns official Privy auth state & helpers */
export function usePrivy() {
  const privy = usePrivyWeb();

  const deleteAccount = async () => {
    const address = privy.user?.wallet?.address || privy.user?.id;
    if (address) {
      try {
        await fetch(getApiUrl(`/api/users/${encodeURIComponent(address)}`), { method: 'DELETE' });
      } catch (e) {
        console.warn('Delete account error:', e);
      }
    }
    await privy.logout();
    UserProfileService.updateProfile({
      username: 'seeker_user',
      displayName: 'Seeker Pioneer',
      blinkId: '@seeker_user',
      hasCustomizedProfile: false,
      avatarUrl: UserProfileService.getRandomMascot(),
      linkedAccounts: { email: null, google: null, twitter: null, discord: null, telegram: null, github: null },
    });
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('blink_auth_signout'));
      window.dispatchEvent(new CustomEvent('blink_profile_updated'));
    }
  };

  return {
    ...privy,
    deleteAccount,
    login: (options?: any) => {
      if (options && (options.nativeEvent || options._dispatchInstances || typeof options.persist === 'function')) {
        return privy.login();
      }
      return privy.login(options);
    },
  };
}

export function useLoginWithOAuth(opts?: any) {
  return useLoginWithOAuthWeb(opts);
}

export function useWallets() {
  return useWalletsWeb();
}

export function useCreateWallet() {
  return useCreateWalletWeb();
}

import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';

export function useSignAndSendTransaction() {
  const hook = useSignAndSendTransactionWeb();
  return {
    signAndSendTransaction: async (...args: any[]) => {
      // Automatically inject optimisticBroadcast: true and skipSimulation: true
      // This bypasses Privy's broken devnet WebSocket endpoint ('wss://solana-devnet.rpc.privy.systems')
      // which returns HTTP 500 and throws 'Solana error #8190004: WebSocket failed to connect'
      const modifiedArgs = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          return {
            ...arg,
            options: {
              ...arg.options,
              optimisticBroadcast: true,
              skipSimulation: true,
            },
          };
        }
        return arg;
      });
      return hook.signAndSendTransaction(...(modifiedArgs as [any]));
    },
  };
}

export function useSignTransaction() {
  return useSignTransactionWeb();
}

export function useExportWallet() {
  return useExportWalletWeb();
}

export function toSolanaWalletConnectors() {
  return toSolanaWalletConnectorsWeb();
}

export function defaultSolanaRpcsPlugin(...args: any[]) {
  return {
    id: Symbol.for('default-solana-rpcs-plugin'),
    getDefaultRpcs: () => ({
      'solana:mainnet': {
        rpc: createSolanaRpc('https://api.mainnet-beta.solana.com'),
        rpcSubscriptions: createSolanaRpcSubscriptions('wss://api.mainnet-beta.solana.com/'),
        blockExplorerUrl: 'https://explorer.solana.com?cluster=mainnet',
      },
      'solana:devnet': {
        rpc: createSolanaRpc('https://api.devnet.solana.com'),
        rpcSubscriptions: createSolanaRpcSubscriptions('wss://api.devnet.solana.com/'),
        blockExplorerUrl: 'https://explorer.solana.com?cluster=devnet',
      },
    }),
  };
}

// Dummy bridge retained for backwards compatibility
export const PrivyNativeBridge = {
  isOpen: () => false,
  getOptions: () => null,
  open: (_opts?: any) => {},
  close: () => {},
  handleAuthSuccess: (_user: any) => {},
  handleLinkSuccess: (_user: any) => {},
  isAuthenticated: () => false,
  getUser: () => null,
  clearSession: () => {},
  logout: async () => {},
  deleteAccount: async () => false,
  subscribeModal: (_fn: any) => () => {},
  subscribeAuth: (_fn: any) => () => {},
};
