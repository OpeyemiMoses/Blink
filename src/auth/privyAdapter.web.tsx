/**
 * privyAdapter.web.tsx
 *
 * This module is bundled in the Expo web build (used by both the Railway web app
 * and the Capacitor Android APK). At RUNTIME, it detects whether it is running
 * inside a Capacitor native container (APK) or a plain web browser.
 *
 * - Inside Capacitor APK → delegates to PrivyNativeBridge (no OAuth redirects, fully in-app).
 * - Plain web browser   → delegates to the real @privy-io/react-auth SDK.
 *
 * The hook-rules concern is handled by always calling both hook implementations
 * and selecting the result afterward — but in practice only one branch will ever
 * be active for a given session (Capacitor flag is stable across the app lifetime).
 */

import React, { useEffect, useState } from 'react';
import { getApiUrl } from '../services/apiConfig';
import { UserProfileService } from '../services/userProfileService';

// ─── Real Privy web SDK (only used in plain-browser context) ──────────────────
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

// ─── Native bridge adapter (always included in bundle, only activated in APK) ─
import {
  PrivyNativeBridge as _NativeBridge,
  usePrivy as usePrivyNative,
  useWallets as useWalletsNative,
  useCreateWallet as useCreateWalletNative,
  useSignAndSendTransaction as useSignAndSendTransactionNative,
  useSignTransaction as useSignTransactionNative,
  useExportWallet as useExportWalletNative,
  PrivyProvider as PrivyProviderNative,
  toSolanaWalletConnectors as toSolanaWalletConnectorsNative,
  defaultSolanaRpcsPlugin as defaultSolanaRpcsPluginNative,
} from './privyAdapter.native';

// ─── Runtime Capacitor detection ──────────────────────────────────────────────
// This is evaluated once and cached. Capacitor injects `window.Capacitor`
// before any JS runs, so this is safe at module evaluation time.
const IS_CAPACITOR = (() => {
  try {
    if (typeof window === 'undefined') return false;
    const cap = (window as any).Capacitor;
    if (!cap) return false;
    // isNativePlatform() is the official API
    if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
    // Older Capacitor sets cap.platform
    if (cap.platform === 'android' || cap.platform === 'ios') return true;
    return false;
  } catch {
    return false;
  }
})();

// ─── Exports ──────────────────────────────────────────────────────────────────

export const PrivyNativeBridge = IS_CAPACITOR ? _NativeBridge : {
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

/** PrivyProvider – wraps the correct auth provider for the runtime context */
export const PrivyProvider: React.FC<{ children: React.ReactNode; [key: string]: any }> = IS_CAPACITOR
  ? PrivyProviderNative
  : (props: any) => {
      const WebProvider = PrivyProviderWeb as any;
      return React.createElement(WebProvider, props);
    };

/** usePrivy – returns the correct privy state for the runtime context */
export function usePrivy() {
  // We call the correct hook based on context. Since IS_CAPACITOR is a module-level
  // constant (stable), React's rules-of-hooks are satisfied: the same hook is always
  // called for a given bundle execution context.
  if (IS_CAPACITOR) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return usePrivyNative();
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
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

/** useLoginWithOAuth – on Capacitor, opens the in-app modal instead of a browser popup */
export function useLoginWithOAuth(opts?: any) {
  if (IS_CAPACITOR) {
    return {
      initOAuth: async (args?: any) => {
        _NativeBridge.open({ mode: 'login', provider: args?.provider || 'google' });
      },
      state: { status: 'initial' as const },
    };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useLoginWithOAuthWeb(opts);
}

// ─── Solana wallet hooks ───────────────────────────────────────────────────────
export function useWallets() {
  if (IS_CAPACITOR) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useWalletsNative();
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useWalletsWeb();
}

export function useCreateWallet() {
  if (IS_CAPACITOR) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useCreateWalletNative();
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useCreateWalletWeb();
}

export function useSignAndSendTransaction() {
  if (IS_CAPACITOR) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSignAndSendTransactionNative();
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSignAndSendTransactionWeb();
}

export function useSignTransaction() {
  if (IS_CAPACITOR) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSignTransactionNative();
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSignTransactionWeb();
}

export function useExportWallet() {
  if (IS_CAPACITOR) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useExportWalletNative();
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useExportWalletWeb();
}

export function toSolanaWalletConnectors() {
  return IS_CAPACITOR ? toSolanaWalletConnectorsNative() : toSolanaWalletConnectorsWeb();
}

export function defaultSolanaRpcsPlugin(...args: any[]) {
  return IS_CAPACITOR ? defaultSolanaRpcsPluginNative(...args) : (defaultSolanaRpcsPluginWeb as any)(...args);
}
