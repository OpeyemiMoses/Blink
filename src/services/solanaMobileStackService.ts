import { Platform } from 'react-native';
import { Transaction, PublicKey, Connection } from '@solana/web3.js';
import * as LocalAuthentication from 'expo-local-authentication';
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

const SMS_APP_IDENTITY = {
  name: 'Seeker TapBlink',
  uri: 'https://seeker.tapblink.solana',
  icon: 'icon.png',
};

export class SolanaMobileStackService {
  private static mwaAuthToken: string | null = null;
  private static cachedSecurityStatus: BiometricSecurityStatus | null = null;

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
    try {
      // Dynamically import MWA protocol to avoid web bundle breakages
      const mwa = await import('@solana-mobile/mobile-wallet-adapter-protocol');
      if (typeof mwa.transact !== 'function') {
        throw new Error('MWA transact not available on this platform');
      }

      let authorizedAccount: WalletAccount | null = null;

      await mwa.transact(async (wallet: any) => {
        const authResult = await wallet.authorize({
          cluster: 'devnet',
          identity: SMS_APP_IDENTITY,
        });

        if (authResult?.accounts?.[0]) {
          const rawPubkey = authResult.accounts[0].address;
          const pubkeyBase58 = typeof rawPubkey === 'string'
            ? rawPubkey
            : new PublicKey(rawPubkey).toBase58();

          this.mwaAuthToken = authResult.auth_token || null;
          authorizedAccount = {
            name: authResult.wallet_uri_base || 'Solana Mobile Wallet',
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
    // 1. Try MWA if on Android
    if (this.isSolanaMobileEnvironment() && this.mwaAuthToken) {
      try {
        const mwa = await import('@solana-mobile/mobile-wallet-adapter-protocol');
        let txSig = '';

        await mwa.transact(async (wallet: any) => {
          const authResult = await wallet.reauthorize({
            auth_token: this.mwaAuthToken!,
            identity: SMS_APP_IDENTITY,
          });

          this.mwaAuthToken = authResult.auth_token;

          const signedTxs = await wallet.signAndSendTransactions({
            transactions: [tx.serialize({ requireAllSignatures: false }).toString('base64')],
          });

          if (signedTxs?.[0]) {
            txSig = signedTxs[0];
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
