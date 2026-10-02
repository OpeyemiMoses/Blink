import { usePrivy as usePrivyRaw, useLoginWithOAuth, PrivyProvider } from '@privy-io/react-auth';
import { getApiUrl } from '../services/apiConfig';
import { UserProfileService } from '../services/userProfileService';

export { PrivyProvider, useLoginWithOAuth };

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

export function usePrivy() {
  const privy = usePrivyRaw();

  const deleteAccount = async () => {
    const address = privy.user?.wallet?.address || privy.user?.id;
    if (address) {
      try {
        await fetch(getApiUrl(`/api/users/${encodeURIComponent(address)}`), {
          method: 'DELETE',
        });
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
      linkedAccounts: {
        email: null,
        google: null,
        twitter: null,
        discord: null,
        telegram: null,
        github: null,
      },
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

export {
  toSolanaWalletConnectors,
  useWallets,
  useCreateWallet,
  useSignAndSendTransaction,
  useSignTransaction,
  useExportWallet,
  defaultSolanaRpcsPlugin,
} from '@privy-io/react-auth/solana';
