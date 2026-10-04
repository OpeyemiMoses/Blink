import React, { useState, useEffect } from 'react';
import { WalletProviderService, WalletAccount } from '../services/walletProviderService';
import { SolanaMobileStackService } from '../services/solanaMobileStackService';
import { UserProfileService } from '../services/userProfileService';
import { getApiUrl } from '../services/apiConfig';
import { Transaction } from '@solana/web3.js';

import { SolanaService } from '../services/solanaService';

const STORAGE_PRIVY_USER_KEY = 'blink_privy_user_v1';

function extractSolanaAddress(user: any): string {
  if (!user) return SolanaService.getOrCreateKeypair().publicKey.toBase58();

  // 1. Check linkedAccounts for Solana wallet
  if (Array.isArray(user.linkedAccounts)) {
    const solAcc = user.linkedAccounts.find((a: any) => {
      const isSolChain = a.chainType === 'solana' || a.chain_type === 'solana' || a.walletClientType === 'privy-solana';
      const addr = a.address;
      return (isSolChain || (addr && !addr.startsWith('0x') && addr.length >= 32 && addr.length <= 44)) && !addr?.startsWith('0x');
    });
    if (solAcc?.address) return solAcc.address;
  }

  // 2. Check user.wallet if it's NOT an EVM wallet
  if (user.wallet?.address && !user.wallet.address.startsWith('0x') && user.wallet.address.length >= 32) {
    return user.wallet.address;
  }

  // 3. Check cached Privy address
  if (typeof window !== 'undefined' && window.localStorage) {
    const cached = window.localStorage.getItem('blink_privy_solana_address');
    if (cached && !cached.startsWith('0x') && cached.length >= 32) {
      return cached;
    }
  }

  // 4. Fallback to real Ed25519 Solana keypair (NEVER a fake string or EVM address!)
  return SolanaService.getOrCreateKeypair().publicKey.toBase58();
}

// Global Event / Modal Bridge for React Native Native runtimes
type ModalListener = (isOpen: boolean, options: any) => void;
type AuthListener = (user: any | null, authenticated: boolean) => void;

class PrivyNativeBridgeClass {
  private isModalOpen = false;
  private modalOptions: any = null;
  private currentUser: any = null;
  private modalListeners = new Set<ModalListener>();
  private authListeners = new Set<AuthListener>();

  constructor() {
    this.restoreSession();
  }

  private restoreSession() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(STORAGE_PRIVY_USER_KEY);
        if (stored) {
          const user = JSON.parse(stored);
          if (user) {
            this.currentUser = user;
            const walletAddr = extractSolanaAddress(user);

            if (walletAddr) {
              WalletProviderService.setActiveAccount({
                name: user.google?.name || user.email?.address || 'Privy Solana Wallet',
                publicKey: walletAddr,
                isPrivy: true,
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('[PrivyNativeBridge] Failed to restore session:', e);
    }
  }

  isOpen(): boolean {
    return this.isModalOpen;
  }

  getOptions(): any {
    return this.modalOptions;
  }

  isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  getUser(): any | null {
    return this.currentUser;
  }

  open(options?: any) {
    this.isModalOpen = true;
    this.modalOptions = options || {};
    this.modalListeners.forEach((fn) => fn(true, this.modalOptions));
  }

  close() {
    this.isModalOpen = false;
    this.modalOptions = null;
    this.modalListeners.forEach((fn) => fn(false, null));
  }

  handleAuthSuccess(user: any) {
    this.currentUser = user;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_PRIVY_USER_KEY, JSON.stringify(user));
      }
    } catch {}

    const walletAddr = extractSolanaAddress(user);

    if (walletAddr) {
      WalletProviderService.setActiveAccount({
        name: user.google?.name || user.email?.address || 'Privy Solana Wallet',
        publicKey: walletAddr,
        isPrivy: true,
      });
    }

    // Automatically sync identity fields to UserProfile
    const email = user.email?.address || user.google?.email || null;
    const googleName = user.google?.name || null;
    const twitterHandle = user.twitter?.username ? `@${user.twitter.username.replace(/^@/, '')}` : null;
    const discordHandle = user.discord?.username || null;
    const githubHandle = user.github?.username ? `@${user.github.username.replace(/^@/, '')}` : null;

    UserProfileService.updateProfile({
      displayName: googleName || UserProfileService.getProfile().displayName,
      linkedAccounts: {
        ...UserProfileService.getProfile().linkedAccounts,
        ...(email ? { email } : {}),
        ...(user.google?.email ? { google: user.google.email } : {}),
        ...(twitterHandle ? { twitter: twitterHandle } : {}),
        ...(discordHandle ? { discord: discordHandle } : {}),
        ...(githubHandle ? { github: githubHandle } : {}),
      },
    });

    this.authListeners.forEach((fn) => fn(this.currentUser, true));
    this.close();

    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('blink_profile_updated'));
      window.dispatchEvent(new CustomEvent('blink_auth_success', { detail: user }));
    }
  }

  handleLinkSuccess(user: any) {
    this.currentUser = user;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_PRIVY_USER_KEY, JSON.stringify(user));
      }
    } catch {}

    const email = user.email?.address || user.google?.email || null;
    const twitterHandle = user.twitter?.username ? `@${user.twitter.username.replace(/^@/, '')}` : null;
    const discordHandle = user.discord?.username || null;
    const githubHandle = user.github?.username ? `@${user.github.username.replace(/^@/, '')}` : null;

    UserProfileService.updateProfile({
      linkedAccounts: {
        ...UserProfileService.getProfile().linkedAccounts,
        ...(email ? { email } : {}),
        ...(user.google?.email ? { google: user.google.email } : {}),
        ...(twitterHandle ? { twitter: twitterHandle } : {}),
        ...(discordHandle ? { discord: discordHandle } : {}),
        ...(githubHandle ? { github: githubHandle } : {}),
      },
    });

    this.authListeners.forEach((fn) => fn(this.currentUser, true));
    this.close();

    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('blink_profile_updated'));
    }
  }

  async logout() {
    this.currentUser = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_PRIVY_USER_KEY);
      }
    } catch {}

    WalletProviderService.disconnect();

    // Reset user profile to default guest
    UserProfileService.updateProfile({
      username: 'seeker_user',
      displayName: 'Seeker Pioneer',
      blinkId: '@seeker_user',
      hasCustomizedProfile: false,
      avatarUrl: UserProfileService.getRandomMascot(),
      linkedAccounts: {
        email: null,
        google: null,
        twitter: null,
        discord: null,
        telegram: null,
        github: null,
      },
    });

    this.authListeners.forEach((fn) => fn(null, false));

    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('blink_auth_signout'));
      window.dispatchEvent(new CustomEvent('blink_profile_updated'));
    }
  }

  async deleteAccount(addressOrId?: string): Promise<boolean> {
    const target = addressOrId || this.currentUser?.id || WalletProviderService.getActiveAccount()?.publicKey;
    if (target) {
      try {
        await fetch(getApiUrl(`/api/users/${encodeURIComponent(target)}`), {
          method: 'DELETE',
        });
      } catch (err) {
        console.warn('[PrivyNativeBridge] Delete account API error:', err);
      }
    }
    await this.logout();
    return true;
  }

  subscribeModal(fn: ModalListener): () => void {
    this.modalListeners.add(fn);
    return () => this.modalListeners.delete(fn);
  }

  subscribeAuth(fn: AuthListener): () => void {
    this.authListeners.add(fn);
    return () => this.authListeners.delete(fn);
  }
}

export const PrivyNativeBridge = new PrivyNativeBridgeClass();

export const PrivyProvider: React.FC<{ children: React.ReactNode; [key: string]: any }> = ({ children }) => {
  return <>{children}</>;
};

export const toSolanaWalletConnectors = () => [];
export const defaultSolanaRpcsPlugin = () => ({});

export function usePrivy() {
  const [user, setUser] = useState<any | null>(() => PrivyNativeBridge.getUser());
  const [authenticated, setAuthenticated] = useState<boolean>(() => PrivyNativeBridge.isAuthenticated());

  useEffect(() => {
    return PrivyNativeBridge.subscribeAuth((newUser, isAuth) => {
      setUser(newUser);
      setAuthenticated(isAuth);
    });
  }, []);

  const login = async (options?: any) => {
    PrivyNativeBridge.open({ mode: 'login', ...options });
  };

  const logout = async () => {
    await PrivyNativeBridge.logout();
  };

  const linkEmail = () => PrivyNativeBridge.open({ mode: 'link', provider: 'email' });
  const linkGoogle = () => PrivyNativeBridge.open({ mode: 'link', provider: 'google' });
  const linkTwitter = () => PrivyNativeBridge.open({ mode: 'link', provider: 'twitter' });
  const linkDiscord = () => PrivyNativeBridge.open({ mode: 'link', provider: 'discord' });
  const linkGithub = () => PrivyNativeBridge.open({ mode: 'link', provider: 'github' });

  const unlinkEmail = async (_val?: string) => {
    const prof = UserProfileService.getProfile();
    UserProfileService.updateProfile({ linkedAccounts: { ...prof.linkedAccounts, email: null } });
  };

  const unlinkGoogle = async (_val?: string) => {
    const prof = UserProfileService.getProfile();
    UserProfileService.updateProfile({ linkedAccounts: { ...prof.linkedAccounts, google: null } });
  };

  const unlinkTwitter = async (_val?: string) => {
    const prof = UserProfileService.getProfile();
    UserProfileService.updateProfile({ linkedAccounts: { ...prof.linkedAccounts, twitter: null } });
  };

  const unlinkDiscord = async (_val?: string) => {
    const prof = UserProfileService.getProfile();
    UserProfileService.updateProfile({ linkedAccounts: { ...prof.linkedAccounts, discord: null } });
  };

  const unlinkGithub = async (_val?: string) => {
    const prof = UserProfileService.getProfile();
    UserProfileService.updateProfile({ linkedAccounts: { ...prof.linkedAccounts, github: null } });
  };

  const deleteAccount = async () => {
    await PrivyNativeBridge.deleteAccount();
  };

  return {
    ready: true,
    authenticated,
    user: user || (authenticated ? {
      id: WalletProviderService.getActiveAccount()?.publicKey,
      linkedAccounts: [
        {
          type: 'wallet',
          address: WalletProviderService.getActiveAccount()?.publicKey,
          chainType: 'solana',
          walletClientType: 'privy',
        },
      ],
    } : null),
    login,
    logout,
    linkEmail,
    linkGoogle,
    linkTwitter,
    linkDiscord,
    linkGithub,
    unlinkEmail,
    unlinkGoogle,
    unlinkTwitter,
    unlinkDiscord,
    unlinkGithub,
    deleteAccount,
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
      return WalletProviderService.getActiveAccount();
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
    initOAuth: async (args?: any) => {
      PrivyNativeBridge.open({ mode: 'login', provider: args?.provider || 'google' });
    },
  };
}
