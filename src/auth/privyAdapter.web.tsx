import { usePrivy as usePrivyRaw, useLoginWithOAuth, PrivyProvider } from '@privy-io/react-auth';

export { PrivyProvider, useLoginWithOAuth };

export function usePrivy() {
  const privy = usePrivyRaw();
  return {
    ...privy,
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
