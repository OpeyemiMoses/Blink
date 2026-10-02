import { Platform, Linking } from 'react-native';
import { Transaction, PublicKey, Connection } from '@solana/web3.js';
import * as LocalAuthentication from 'expo-local-authentication';
import bs58 from 'bs58';
import { SolanaService } from './solanaService';
import { WalletAccount, WalletProviderService } from './walletProviderService';
import { BiometricService } from './biometricService';

export interface MobileWalletAuthResult {
  address: string;
  authToken: string;
  walletName: string;
}

export interface BiometricSecurityStatus {
  hasHardware: boolean;
  isEnrolled: boolean;
  securityType: 'fingerprint' | 'face' | 'pin' | 'none';
}

export interface InstalledWalletInfo {
  id: 'phantom' | 'solflare' | 'backpack' | 'mwa';
  name: string;
  scheme: string;
  isInstalled: boolean;
}

const SMS_APP_IDENTITY = {
  name: 'Blink',
  uri: 'https://blink-production-5c36.up.railway.app',
  icon: 'favicon.ico',
};

export class SolanaMobileStackService {
  private static mwaAuthToken: string | null = null;
  private static cachedSecurityStatus: BiometricSecurityStatus | null = null;

  /**
   * Query device for installed Solana mobile wallets (Phantom, Solflare, Backpack).
   */
  static async getInstalledWallets(): Promise<InstalledWalletInfo[]> {
    const list: InstalledWalletInfo[] = [
      { id: 'phantom', name: 'Phantom', scheme: 'phantom://', isInstalled: false },
      { id: 'solflare', name: 'Solflare', scheme: 'solflare://', isInstalled: false },
      { id: 'backpack', name: 'Backpack', scheme: 'backpack://', isInstalled: false },
    ];

    if (Platform.OS === 'web') {
      return list.map((w) => ({
        ...w,
        isInstalled: typeof window !== 'undefined' && Boolean((window as any).solana || (window as any).phantom?.solana),
      }));
    }

    for (const w of list) {
      try {
        const canOpen = await Linking.canOpenURL(w.scheme);
        w.isInstalled = Boolean(canOpen);
      } catch {
        w.isInstalled = false;
      }
    }
    return list;
  }

  /**
   * Check if device is running in an Android / Solana Mobile Stack environment.
   */
  static isSolanaMobileEnvironment(): boolean {
    if (Platform.OS === 'android') return true;
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      return ua.includes('android') || ua.includes('solana') || ua.includes('saga') || ua.includes('seeker');
    }
    return false;
  }

  /**
   * Query device biometric and PIN hardware enrollment.
   */
  static async getBiometricSecurityStatus(): Promise<BiometricSecurityStatus> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      let securityType: 'fingerprint' | 'face' | 'pin' | 'none' = 'none';
      if (isEnrolled) {
        if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          securityType = 'fingerprint';
        } else if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          securityType = 'face';
        } else {
          securityType = 'pin';
        }
      }

      const status: BiometricSecurityStatus = {
        hasHardware,
        isEnrolled,
        securityType,
      };

      this.cachedSecurityStatus = status;
      return status;
    } catch (err) {
      console.warn('Biometric status check failed:', err);
      return {
        hasHardware: false,
        isEnrolled: false,
        securityType: 'none',
      };
    }
  }

  /**
   * Authorize with Mobile Wallet Adapter (MWA) on Android / Seeker device.
   * If MWA is unavailable (e.g. running in web browser), falls back cleanly.
   */
  static async connectMWA(): Promise<WalletAccount | null> {
    if (Platform.OS === 'web') {
      console.log('MWA is designed for Android native / Seeker devices.');
      return null;
    }

    try {
      // Dynamically import MWA web3js to avoid web bundle breakages
      const { transact } = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
      if (typeof transact !== 'function') {
        throw new Error('MWA transact not available on this platform');
      }

      let authorizedAccount: WalletAccount | null = null;
      const targetCluster = SolanaService.getNetwork() === 'devnet' ? 'devnet' : 'mainnet-beta';

      await transact(async (wallet: any) => {
        const authResult = await wallet.authorize({
          cluster: targetCluster,
          identity: SMS_APP_IDENTITY,
        });

        if (authResult?.accounts?.[0]) {
          const rawPubkey = authResult.accounts[0].address;
          const pubkeyBase58 = typeof rawPubkey === 'string'
            ? rawPubkey
            : new PublicKey(rawPubkey).toBase58();

          this.mwaAuthToken = authResult.auth_token || null;
          authorizedAccount = {
            name: authResult.wallet_uri_base || 'Seeker Seed Vault (MWA)',
            publicKey: pubkeyBase58,
            isPrivy: false,
          };
        }
      });

      if (authorizedAccount) {
        WalletProviderService.setActiveAccount(authorizedAccount);
        return authorizedAccount;
      }
    } catch (err: any) {
      console.warn('MWA connect attempt:', err?.message || err);
    }

    return null;
  }

  /**
   * Connect to a specific installed wallet app (Phantom, Solflare, Backpack).
   * Attempts MWA first, and if not responsive, launches wallet scheme.
   */
  static async connectWalletApp(walletId: 'phantom' | 'solflare' | 'backpack' | 'mwa'): Promise<WalletAccount | null> {
    try {
      const mwaResult = await this.connectMWA();
      if (mwaResult) return mwaResult;
    } catch (e) {
      console.warn('MWA connect attempt:', e);
    }

    const scheme = walletId === 'solflare' ? 'solflare://' : walletId === 'backpack' ? 'backpack://' : 'phantom://';
    try {
      const canOpen = await Linking.canOpenURL(scheme);
      if (canOpen) {
        await Linking.openURL(scheme);
      }
    } catch (err) {
      console.warn('Cannot open wallet scheme:', err);
    }
    return null;
  }

  /**
   * Execute payment authorization using device biometric (fingerprint/face/pin).
   * If security is enrolled, user authenticates with their fingerprint/face
   * and the transaction executes automatically WITHOUT needing redundant signing screens!
   * If no security is enrolled on device, returns needsManualSigning: true.
   */
  static async authorizePaymentWithDeviceBiometrics(
    title: string,
    amountLabel: string
  ): Promise<{ authorized: boolean; needsManualSigning: boolean; error?: string }> {
    try {
      const bioResult = await BiometricService.authenticate(`Authorize: ${amountLabel} (${title})`);

      if (bioResult.success) {
        return {
          authorized: true,
          needsManualSigning: false,
        };
      } else {
        if (bioResult.error === 'user_cancel' || bioResult.error?.includes('cancelled')) {
          return {
            authorized: false,
            needsManualSigning: false,
            error: 'Biometric authorization cancelled.',
          };
        }
        return {
          authorized: false,
          needsManualSigning: true,
          error: bioResult.error,
        };
      }
    } catch (err: any) {
      return {
        authorized: false,
        needsManualSigning: true,
        error: err?.message,
      };
    }
  }

  /**
   * Sign and send transaction via MWA if active, otherwise via WalletProviderService signer.
   */
  static async signAndSendTransaction(tx: Transaction): Promise<string> {
    // 1. Try MWA if on Android or if MWA account is active
    const activeAcc = WalletProviderService.getActiveAccount();
    const isMwaActive = activeAcc?.name?.includes('MWA') || activeAcc?.name?.includes('Seed Vault') || activeAcc?.name?.includes('Mobile');

    if (Platform.OS === 'android' || isMwaActive) {
      try {
        const { transact } = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
        let txSig = '';
        const targetCluster = SolanaService.getNetwork() === 'devnet' ? 'devnet' : 'mainnet-beta';

        await transact(async (wallet: any) => {
          if (this.mwaAuthToken) {
            try {
              const reauthResult = await wallet.reauthorize({
                auth_token: this.mwaAuthToken,
                identity: SMS_APP_IDENTITY,
              });
              this.mwaAuthToken = reauthResult.auth_token;
            } catch {
              // If reauth fails, re-authorize
              const authResult = await wallet.authorize({
                cluster: targetCluster,
                identity: SMS_APP_IDENTITY,
              });
              this.mwaAuthToken = authResult.auth_token;
            }
          } else {
            const authResult = await wallet.authorize({
              cluster: targetCluster,
              identity: SMS_APP_IDENTITY,
            });
            this.mwaAuthToken = authResult.auth_token;
          }

          const signedTxs = await wallet.signAndSendTransactions({
            transactions: [tx],
          });

          if (signedTxs?.[0]) {
            const sig = signedTxs[0];
            txSig = typeof sig === 'string' ? sig : bs58.encode(sig);
          }
        });

        if (txSig) return txSig;
      } catch (err) {
        console.warn('MWA signing fallback to default provider:', err);
      }
    }

    // 2. Fall back to WalletProviderService signer (Privy embedded key / browser wallet)
    return await WalletProviderService.signAndSendTransaction(tx);
  }
}

