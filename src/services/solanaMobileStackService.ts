import { Platform, Linking } from 'react-native';
import { Transaction, PublicKey, Connection } from '@solana/web3.js';
import * as LocalAuthentication from 'expo-local-authentication';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { AppLauncher } from '@capacitor/app-launcher';
import { SolanaService } from './solanaService';
import { WalletAccount, WalletProviderService } from './walletProviderService';
import { BiometricService } from './biometricService';
import { ToastService } from './toastService';

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

const encodeBs58 = (bytes: Uint8Array): string => {
  if (typeof (bs58 as any).encode === 'function') return (bs58 as any).encode(bytes);
  if (typeof (bs58 as any).default?.encode === 'function') return (bs58 as any).default.encode(bytes);
  return Buffer.from(bytes).toString('base64');
};

const decodeBs58 = (str: string): Uint8Array => {
  if (typeof (bs58 as any).decode === 'function') return (bs58 as any).decode(str);
  if (typeof (bs58 as any).default?.decode === 'function') return (bs58 as any).default.decode(str);
  return new Uint8Array(Buffer.from(str, 'base64'));
};

export class SolanaMobileStackService {
  private static mwaAuthToken: string | null = null;
  private static cachedSecurityStatus: BiometricSecurityStatus | null = null;

  /**
   * Query device for installed Solana mobile wallets (Phantom, Solflare, Backpack, MWA).
   * Actively queries native package visibility on Android via Capacitor AppLauncher.
   */
  static async getInstalledWallets(): Promise<InstalledWalletInfo[]> {
    const list: InstalledWalletInfo[] = [
      { id: 'phantom', name: 'Phantom', scheme: 'phantom://', isInstalled: false },
      { id: 'solflare', name: 'Solflare', scheme: 'solflare://', isInstalled: false },
      { id: 'backpack', name: 'Backpack', scheme: 'backpack://', isInstalled: false },
      { id: 'mwa', name: 'Solana Mobile (MWA)', scheme: 'solana-wallet://', isInstalled: false },
    ];

    let checkedWithNative = false;

    // Check with Capacitor AppLauncher on native platforms (Android APK)
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isPluginAvailable?.('AppLauncher')) {
        for (const w of list) {
          try {
            const res = await AppLauncher.canOpenUrl({ url: w.scheme });
            w.isInstalled = Boolean(res?.value);
          } catch {
            w.isInstalled = false;
          }
        }
        checkedWithNative = true;
      }
    } catch (err) {
      console.warn('Capacitor AppLauncher check error:', err);
    }

    if (!checkedWithNative && Platform.OS !== 'web') {
      for (const w of list) {
        try {
          const canOpen = await Linking.canOpenURL(w.scheme);
          w.isInstalled = Boolean(canOpen);
        } catch {
          w.isInstalled = false;
        }
      }
      checkedWithNative = true;
    }

    // Web extension detection fallback
    if (!checkedWithNative && typeof window !== 'undefined') {
      const anyWin = window as any;
      list[0].isInstalled = Boolean(anyWin.phantom?.solana?.isPhantom || anyWin.solana?.isPhantom);
      list[1].isInstalled = Boolean(anyWin.solflare?.isSolflare);
      list[2].isInstalled = Boolean(anyWin.backpack?.isBackpack || anyWin.xnft?.solana?.isBackpack);
      list[3].isInstalled = Boolean(anyWin.solana);
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
      return (
        ua.includes('android') ||
        ua.includes('solana') ||
        ua.includes('saga') ||
        ua.includes('seeker') ||
        Boolean((window as any).Capacitor?.isNativePlatform?.())
      );
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
   * Authorize with Mobile Wallet Adapter (MWA) / Seeker Seed Vault.
   * In Capacitor WebViews, the React Native MWA transact() is unavailable.
   * Instead, we use the solana-wallet:// intent via AppLauncher to open the
   * Seed Vault / any MWA-compatible wallet natively, then rely on deep link
   * callback via blink://onConnect to receive the authorized public key.
   */
  static async connectMWA(): Promise<WalletAccount | null> {
    // Try Capacitor AppLauncher first (works in both web and native contexts)
    try {
      const seedVaultScheme = 'solana-wallet://';

      if (typeof window !== 'undefined' && (window as any).Capacitor?.isPluginAvailable?.('AppLauncher')) {
        // Check if Seed Vault / MWA wallet is installed
        let canOpen = false;
        try {
          const res = await AppLauncher.canOpenUrl({ url: seedVaultScheme });
          canOpen = Boolean(res?.value);
        } catch { canOpen = false; }

        if (canOpen) {
          // Build the connect URL with our dapp keypair for encrypted handshake
          const dappKeyPair = nacl.box.keyPair();
          const secretHex = Buffer.from(dappKeyPair.secretKey).toString('hex');
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('mwa_dapp_secret_key', secretHex);
          }
          const dappPubkeyBase58 = encodeBs58(dappKeyPair.publicKey);
          const appUrl = encodeURIComponent('https://blink-production-5c36.up.railway.app');
          const redirectLink = encodeURIComponent('blink://onConnect');
          const cluster = SolanaService.getNetwork() === 'devnet' ? 'devnet' : 'mainnet-beta';

          const mwaUrl = `solana-wallet://v1/connect?app_url=${appUrl}&dapp_encryption_public_key=${dappPubkeyBase58}&redirect_link=${redirectLink}&cluster=${cluster}`;

          await AppLauncher.openUrl({ url: mwaUrl });
          // Returns null here — account arrives via deep link callback (blink://onConnect)
          return null;
        }

        ToastService.info('Seed Vault / MWA wallet not installed on this device.');
        return null;
      }
    } catch (err: any) {
      console.warn('Capacitor AppLauncher MWA attempt:', err?.message || err);
    }

    // Fallback: try React Native MWA transact() (works on Expo / bare RN, not Capacitor)
    try {
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
          const pubkeyBase58 =
            typeof rawPubkey === 'string'
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
        await this.syncOrRegisterWalletAccount(authorizedAccount);
        return authorizedAccount;
      }
    } catch (err: any) {
      console.warn('MWA transact fallback attempt:', err?.message || err);
    }

    return null;
  }

  /**
   * Launch Phantom mobile app with official Universal / Scheme connect handshake.
   */
  static async connectPhantomMobile(): Promise<void> {
    try {
      const dappKeyPair = nacl.box.keyPair();
      const secretHex = Buffer.from(dappKeyPair.secretKey).toString('hex');
      const dappPubkeyBase58 = encodeBs58(dappKeyPair.publicKey);

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('phantom_dapp_secret_key', secretHex);
        window.localStorage.setItem('phantom_dapp_public_key', dappPubkeyBase58);
        window.localStorage.removeItem('phantom_session_dapp_secret_key');
        window.localStorage.removeItem('phantom_session_dapp_public_key');
        window.localStorage.removeItem('wallet_mobile_session');
        window.localStorage.removeItem('wallet_shared_secret');
      }

      const isNative =
        typeof window !== 'undefined' &&
        Boolean((window as any).Capacitor?.isNativePlatform?.());

      const currentOrigin =
        typeof window !== 'undefined' && window.location?.origin?.startsWith('http')
          ? window.location.origin
          : 'https://blink-production-5c36.up.railway.app';

      const appUrl = encodeURIComponent(
        currentOrigin.includes('localhost') ? 'https://blink-production-5c36.up.railway.app' : currentOrigin
      );
      const redirectLink = encodeURIComponent(
        isNative ? 'blink://onConnect' : `${currentOrigin}/onConnect`
      );
      const cluster = SolanaService.getNetwork() === 'devnet' ? 'devnet' : 'mainnet-beta';

      // Official Phantom deeplink domain is phantom.com
      const phantomUrl = `https://phantom.com/ul/v1/connect?app_url=${appUrl}&dapp_encryption_public_key=${dappPubkeyBase58}&redirect_link=${redirectLink}&cluster=${cluster}`;

      console.log('[SolanaMobileStack] Launching Phantom connect URL:', phantomUrl);

      let launched = false;
      try {
        if (typeof window !== 'undefined' && (window as any).Capacitor?.isPluginAvailable?.('AppLauncher')) {
          await AppLauncher.openUrl({ url: phantomUrl });
          launched = true;
        }
      } catch (e) {
        console.warn('AppLauncher openUrl failed:', e);
      }

      if (!launched) {
        try {
          await Linking.openURL(phantomUrl);
          launched = true;
        } catch {
          if (typeof window !== 'undefined') {
            window.location.href = phantomUrl;
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to initiate Phantom mobile connection:', err);
      ToastService.error(`Could not open Phantom: ${err?.message || err}`);
    }
  }

  /**
   * Launch Solflare mobile app with official connect handshake.
   */
  static async connectSolflareMobile(): Promise<void> {
    try {
      const dappKeyPair = nacl.box.keyPair();
      const secretHex = Buffer.from(dappKeyPair.secretKey).toString('hex');
      const dappPubkeyBase58 = encodeBs58(dappKeyPair.publicKey);

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('solflare_dapp_secret_key', secretHex);
        window.localStorage.setItem('solflare_dapp_public_key', dappPubkeyBase58);
        window.localStorage.removeItem('phantom_session_dapp_secret_key');
        window.localStorage.removeItem('phantom_session_dapp_public_key');
        window.localStorage.removeItem('wallet_mobile_session');
        window.localStorage.removeItem('wallet_shared_secret');
      }

      const isNative =
        typeof window !== 'undefined' &&
        Boolean((window as any).Capacitor?.isNativePlatform?.());

      const currentOrigin =
        typeof window !== 'undefined' && window.location?.origin?.startsWith('http')
          ? window.location.origin
          : 'https://blink-production-5c36.up.railway.app';

      const appUrl = encodeURIComponent(
        currentOrigin.includes('localhost') ? 'https://blink-production-5c36.up.railway.app' : currentOrigin
      );
      const redirectLink = encodeURIComponent(
        isNative ? 'blink://onConnect' : `${currentOrigin}/onConnect`
      );
      const cluster = SolanaService.getNetwork() === 'devnet' ? 'devnet' : 'mainnet-beta';

      const solflareUrl = `https://solflare.com/ul/v1/connect?app_url=${appUrl}&dapp_encryption_public_key=${dappPubkeyBase58}&redirect_link=${redirectLink}&cluster=${cluster}`;

      console.log('[SolanaMobileStack] Launching Solflare connect URL:', solflareUrl);

      let launched = false;
      try {
        if (typeof window !== 'undefined' && (window as any).Capacitor?.isPluginAvailable?.('AppLauncher')) {
          await AppLauncher.openUrl({ url: solflareUrl });
          launched = true;
        }
      } catch (e) {
        console.warn('AppLauncher openUrl failed:', e);
      }

      if (!launched) {
        try {
          await Linking.openURL(solflareUrl);
        } catch {
          if (typeof window !== 'undefined') {
            window.location.href = solflareUrl;
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to initiate Solflare mobile connection:', err);
      ToastService.error(`Could not open Solflare: ${err?.message || err}`);
    }
  }

  /**
   * Handle incoming deep link callback from Phantom / Solflare.
   * Decrypts the authorization payload, extracts public key,
   * registers/syncs the account, and triggers immediate app login.
   */
  static async handleConnectCallback(urlString: string): Promise<WalletAccount | null> {
    try {
      console.log('[SolanaMobileStack] Processing wallet connect callback:', urlString);
      const cleanUrl = urlString.replace('blink://', 'https://blink.local/').replace('solana-wallet://', 'https://blink.local/');
      const parsedUrl = new URL(cleanUrl);
      const searchParams = parsedUrl.searchParams;

      const errorCode = searchParams.get('errorCode');
      const errorMessage = searchParams.get('errorMessage');
      if (errorCode || errorMessage) {
        console.warn('Wallet connection cancelled or rejected by user:', errorCode, errorMessage);
        ToastService.info(errorMessage || 'Wallet connection was cancelled.');
        return null;
      }

      const walletPubkeyBase58 =
        searchParams.get('phantom_encryption_public_key') ||
        searchParams.get('solflare_encryption_public_key');
      const nonceBase58 = searchParams.get('nonce');
      const dataBase58 = searchParams.get('data');

      if (!walletPubkeyBase58 || !nonceBase58 || !dataBase58) {
        console.warn('Missing crypto handshake parameters in callback:', urlString);
        return null;
      }

      const storedSecretHex =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('phantom_dapp_secret_key') ||
            window.localStorage.getItem('solflare_dapp_secret_key') ||
            window.localStorage.getItem('mwa_dapp_secret_key')
          : null;

      if (!storedSecretHex) {
        console.error('Dapp encryption secret key not found in storage.');
        return null;
      }

      const dappSecretKey = new Uint8Array(Buffer.from(storedSecretHex, 'hex'));
      const walletEncryptionPubkey = decodeBs58(walletPubkeyBase58);
      const nonce = decodeBs58(nonceBase58);
      const encryptedData = decodeBs58(dataBase58);

      // Decrypt X25519 box
      const sharedSecret = nacl.box.before(walletEncryptionPubkey, dappSecretKey);
      const decrypted = nacl.box.open.after(encryptedData, nonce, sharedSecret);

      if (!decrypted) {
        console.error('Failed to decrypt wallet payload.');
        return null;
      }

      const payloadStr = new TextDecoder().decode(decrypted);
      const payload = JSON.parse(payloadStr);

      const solanaPubkey = payload.public_key;
      const session = payload.session;

      if (!solanaPubkey) {
        console.error('No public_key found in decrypted wallet payload.');
        return null;
      }

      const walletName = searchParams.get('phantom_encryption_public_key') ? 'Phantom' : 'Solflare';

      const account: WalletAccount = {
        name: `${walletName} Mobile`,
        publicKey: solanaPubkey,
        isPrivy: false,
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        if (session) {
          window.localStorage.setItem('wallet_mobile_session', session);
          window.localStorage.setItem('wallet_shared_secret', Buffer.from(sharedSecret).toString('hex'));
          // Lock in the dapp secret key and public key used for THIS session — never overwrite after connect
          const currentSecret = window.localStorage.getItem('phantom_dapp_secret_key') ||
            window.localStorage.getItem('solflare_dapp_secret_key');
          if (currentSecret) {
            window.localStorage.setItem('phantom_session_dapp_secret_key', currentSecret);
            try {
              const currentKeyPair = nacl.box.keyPair.fromSecretKey(new Uint8Array(Buffer.from(currentSecret, 'hex')));
              window.localStorage.setItem('phantom_session_dapp_public_key', encodeBs58(currentKeyPair.publicKey));
            } catch {}
          }
        }
        window.localStorage.setItem('solana_connected_wallet_name', account.name);
        window.localStorage.setItem('blink_connected_native_wallet', JSON.stringify(account));
      }

      WalletProviderService.setActiveAccount(account);
      await this.syncOrRegisterWalletAccount(account);

      return account;
    } catch (err: any) {
      console.error('Error handling wallet callback:', err);
      ToastService.error(`Wallet connection failed: ${err?.message || err}`);
      return null;
    }
  }

  /**
   * Helper: Restore cloud account or register new profile for connected wallet
   */
  private static async syncOrRegisterWalletAccount(account: WalletAccount) {
    try {
      const { DatabaseService } = await import('./databaseService');
      const { UserProfileService } = await import('./userProfileService');
      const { BlinkIdService } = await import('./blinkIdService');

      const solanaPubkey = account.publicKey;
      const walletName = account.name || 'Solana Wallet';

      let cloudUser = await DatabaseService.syncUserFromCloud(solanaPubkey).catch(() => null);
      if (cloudUser && cloudUser.username && cloudUser.username !== 'seeker_user') {
        const updated = UserProfileService.updateProfile({
          address: solanaPubkey,
          publicKey: solanaPubkey,
          displayName: cloudUser.displayName || `${walletName} User`,
          username: cloudUser.username,
          avatarUrl: cloudUser.avatarUrl || UserProfileService.getRandomMascot(),
          bio: cloudUser.bio || '',
          hasCustomizedProfile: true,
          linkedAccounts: cloudUser.linkedAccounts || {
            email: cloudUser.email || null,
            google: null,
            twitter: null,
            discord: null,
            telegram: null,
            github: null,
          },
        });
        ToastService.success(`Welcome back @${cloudUser.username}! Connected with ${walletName}`);
      } else {
        // Clean fresh account for this newly connected Solana wallet
        const shortAddr = `${solanaPubkey.slice(0, 4)}_${solanaPubkey.slice(-4)}`.toLowerCase();
        const prefix = walletName.toLowerCase().includes('phantom') ? 'phantom' : 'sol';
        const defaultHandle = `${prefix}_${shortAddr}`;
        const defaultName = `${walletName.replace(/mobile|wallet/gi, '').trim() || 'Solana'} User`;

        const newProf = UserProfileService.updateProfile({
          address: solanaPubkey,
          publicKey: solanaPubkey,
          displayName: defaultName,
          username: defaultHandle,
          avatarUrl: UserProfileService.getRandomMascot(),
          bio: 'Building and tapping physical Solana Blinks in the wild.',
          hasCustomizedProfile: false,
          linkedAccounts: {
            email: null,
            google: null,
            twitter: null,
            discord: null,
            telegram: null,
            github: null,
          },
        });

        DatabaseService.saveUserAccount({
          id: solanaPubkey,
          address: solanaPubkey,
          publicKey: solanaPubkey,
          displayName: newProf.displayName,
          username: newProf.username,
          name: newProf.displayName,
          avatarUrl: newProf.avatarUrl,
          createdAt: Date.now(),
        });
        BlinkIdService.registerBlinkId(`@${newProf.username}`, solanaPubkey, newProf.displayName, newProf.avatarUrl);
        ToastService.success(`Connected to ${walletName}! Account ready: @${newProf.username}`);
      }

      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('blink_wallet_connected', { detail: account }));
        window.dispatchEvent(new CustomEvent('blink_profile_updated'));
      }
    } catch (e) {
      console.warn('syncOrRegisterWalletAccount error:', e);
    }
  }

  /**
   * Connect to a specific installed wallet app (Phantom, Solflare, Backpack, MWA).
   */
  static async connectWalletApp(walletId: 'phantom' | 'solflare' | 'backpack' | 'mwa'): Promise<WalletAccount | null> {
    if (walletId === 'phantom') {
      // Check if Phantom is actually installed before trying to open it
      let phantomInstalled = false;
      try {
        if (typeof window !== 'undefined' && (window as any).Capacitor?.isPluginAvailable?.('AppLauncher')) {
          const res = await AppLauncher.canOpenUrl({ url: 'phantom://' });
          phantomInstalled = Boolean(res?.value);
        }
      } catch { phantomInstalled = false; }

      if (phantomInstalled) {
        await this.connectPhantomMobile();
        return null;
      } else {
        ToastService.info('Phantom is not installed on this device. Install it from the Play Store.');
        return null;
      }
    }
    if (walletId === 'solflare') {
      let solflareInstalled = false;
      try {
        if (typeof window !== 'undefined' && (window as any).Capacitor?.isPluginAvailable?.('AppLauncher')) {
          const res = await AppLauncher.canOpenUrl({ url: 'solflare://' });
          solflareInstalled = Boolean(res?.value);
        }
      } catch { solflareInstalled = false; }

      if (solflareInstalled) {
        await this.connectSolflareMobile();
        return null;
      } else {
        ToastService.info('Solflare is not installed on this device. Install it from the Play Store.');
        return null;
      }
    }
    if (walletId === 'mwa') {
      return await this.connectMWA();
    }

    // Backpack
    const scheme = 'backpack://';
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isPluginAvailable?.('AppLauncher')) {
        const res = await AppLauncher.canOpenUrl({ url: scheme });
        if (res?.value) {
          await AppLauncher.openUrl({ url: scheme });
        } else {
          ToastService.info('Backpack is not installed on this device.');
        }
      } else {
        await Linking.openURL(scheme);
      }
    } catch (err) {
      console.warn('Cannot open wallet scheme:', err);
      ToastService.info('Could not open Backpack wallet.');
    }
    return null;
  }

  /**
   * Execute payment authorization using device biometric (fingerprint/face/pin).
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

  private static pendingSignTransaction: {
    resolve: (signature: string) => void;
    reject: (err: any) => void;
    timer: any;
  } | null = null;

  /**
   * Launch Phantom mobile app with official Universal Link signAndSendTransaction payload.
   * Encrypts transaction, opens Phantom approval sheet, and awaits signature callback.
   */
  static async signAndSendTransactionViaPhantomDeeplink(tx: Transaction): Promise<string> {
    try {
      const activeAccount = WalletProviderService.getActiveAccount();
      if (!activeAccount?.publicKey) {
        throw new Error('No active Phantom account found.');
      }

      const connection = SolanaService.getConnection();
      if (!tx.recentBlockhash) {
        const latest = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = latest.blockhash;
      }
      if (!tx.feePayer) {
        tx.feePayer = new PublicKey(activeAccount.publicKey);
      }

      // Serialize without requiring signatures yet
      const serializedTx = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const bs58Tx = encodeBs58(serializedTx);

      const session =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('wallet_mobile_session')
          : null;
      const sharedSecretHex =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('wallet_shared_secret')
          : null;
      // Use the session-locked secret key (set during connect, never overwritten)
      const dappSecretHex =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('phantom_session_dapp_secret_key') ||
            window.localStorage.getItem('phantom_dapp_secret_key')
          : null;

      if (!session || !sharedSecretHex || !dappSecretHex) {
        console.warn('[SolanaMobileStack] Missing Phantom session or secrets. Prompting reconnect...');
        ToastService.info('Reconnecting Phantom session for secure signing...');
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('wallet_mobile_session');
          window.localStorage.removeItem('wallet_shared_secret');
          window.localStorage.removeItem('phantom_session_dapp_secret_key');
          window.localStorage.removeItem('phantom_session_dapp_public_key');
        }
        await this.connectPhantomMobile();
        throw new Error('Please approve connection in Phantom and try again.');
      }

      const sharedSecret = new Uint8Array(Buffer.from(sharedSecretHex, 'hex'));
      const dappSecretKey = new Uint8Array(Buffer.from(dappSecretHex, 'hex'));
      const dappKeyPair = nacl.box.keyPair.fromSecretKey(dappSecretKey);

      const payload = {
        session,
        transaction: bs58Tx,
      };

      const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
      const nonce = nacl.randomBytes(24);
      const encryptedPayload = nacl.box.after(payloadBytes, nonce, sharedSecret);

      const storedSessionPubkey = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem('phantom_session_dapp_public_key')
        : null;
      const dappPubkeyBase58 = storedSessionPubkey || encodeBs58(dappKeyPair.publicKey);
      const nonceBase58 = encodeBs58(nonce);
      const payloadBase58 = encodeBs58(encryptedPayload);

      const isNative =
        typeof window !== 'undefined' &&
        Boolean((window as any).Capacitor?.isNativePlatform?.());

      const currentOrigin =
        typeof window !== 'undefined' && window.location?.origin?.startsWith('http')
          ? window.location.origin
          : 'https://blink-production-5c36.up.railway.app';

      const redirectLink = isNative
        ? 'blink://onSignTransaction'
        : `${currentOrigin}/onSignTransaction`;

      const params = new URLSearchParams({
        dapp_encryption_public_key: dappPubkeyBase58,
        nonce: nonceBase58,
        redirect_link: redirectLink,
        payload: payloadBase58,
      });

      // Official Phantom deeplink domain is phantom.com (not phantom.app)
      const phantomUrl = `https://phantom.com/ul/v1/signTransaction?${params.toString()}`;

      console.log('[SolanaMobileStack] Launching Phantom signTransaction URL:', phantomUrl);
      ToastService.info('Opening Phantom to approve transaction...');

      let launched = false;
      try {
        if (typeof window !== 'undefined' && (window as any).Capacitor?.isPluginAvailable?.('AppLauncher')) {
          await AppLauncher.openUrl({ url: phantomUrl });
          launched = true;
        }
      } catch (e) {
        console.warn('AppLauncher openUrl failed:', e);
      }

      if (!launched) {
        try {
          await Linking.openURL(phantomUrl);
          launched = true;
        } catch {
          if (typeof window !== 'undefined') {
            window.location.href = phantomUrl;
          }
        }
      }

      return new Promise<string>((resolve, reject) => {
        if (this.pendingSignTransaction?.timer) {
          clearTimeout(this.pendingSignTransaction.timer);
        }

        const timer = setTimeout(() => {
          this.pendingSignTransaction = null;
          reject(new Error('Transaction signing in Phantom timed out or was cancelled.'));
        }, 120000);

        this.pendingSignTransaction = {
          resolve: (sig: string) => {
            clearTimeout(timer);
            this.pendingSignTransaction = null;
            resolve(sig);
          },
          reject: (err: any) => {
            clearTimeout(timer);
            this.pendingSignTransaction = null;
            reject(err);
          },
          timer,
        };
      });
    } catch (err: any) {
      console.error('Failed to initiate Phantom signAndSend:', err);
      throw err;
    }
  }

  /**
   * Launch Solflare mobile app with official Universal Link signAndSendTransaction payload.
   */
  static async signAndSendTransactionViaSolflareDeeplink(tx: Transaction): Promise<string> {
    try {
      const activeAccount = WalletProviderService.getActiveAccount();
      if (!activeAccount?.publicKey) {
        throw new Error('No active Solflare account found.');
      }

      const connection = SolanaService.getConnection();
      if (!tx.recentBlockhash) {
        const latest = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = latest.blockhash;
      }
      if (!tx.feePayer) {
        tx.feePayer = new PublicKey(activeAccount.publicKey);
      }

      const serializedTx = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const bs58Tx = encodeBs58(serializedTx);

      const session =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('wallet_mobile_session')
          : null;
      const sharedSecretHex =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('wallet_shared_secret')
          : null;
      // Use the session-locked secret key (set during connect, never overwritten)
      const dappSecretHex =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('phantom_session_dapp_secret_key') ||
            window.localStorage.getItem('solflare_dapp_secret_key')
          : null;

      if (!session || !sharedSecretHex || !dappSecretHex) {
        console.warn('[SolanaMobileStack] Missing Solflare session or secrets. Prompting reconnect...');
        ToastService.info('Reconnecting Solflare session for secure signing...');
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('wallet_mobile_session');
          window.localStorage.removeItem('wallet_shared_secret');
          window.localStorage.removeItem('phantom_session_dapp_secret_key');
          window.localStorage.removeItem('phantom_session_dapp_public_key');
        }
        await this.connectSolflareMobile();
        throw new Error('Please approve connection in Solflare and try again.');
      }

      const sharedSecret = new Uint8Array(Buffer.from(sharedSecretHex, 'hex'));
      const dappSecretKey = new Uint8Array(Buffer.from(dappSecretHex, 'hex'));
      const dappKeyPair = nacl.box.keyPair.fromSecretKey(dappSecretKey);

      const payload = {
        session,
        transaction: bs58Tx,
      };

      const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
      const nonce = nacl.randomBytes(24);
      const encryptedPayload = nacl.box.after(payloadBytes, nonce, sharedSecret);

      const storedSessionPubkey = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem('phantom_session_dapp_public_key')
        : null;
      const dappPubkeyBase58 = storedSessionPubkey || encodeBs58(dappKeyPair.publicKey);
      const nonceBase58 = encodeBs58(nonce);
      const payloadBase58 = encodeBs58(encryptedPayload);

      const isNative =
        typeof window !== 'undefined' &&
        Boolean((window as any).Capacitor?.isNativePlatform?.());

      const currentOrigin =
        typeof window !== 'undefined' && window.location?.origin?.startsWith('http')
          ? window.location.origin
          : 'https://blink-production-5c36.up.railway.app';

      const redirectLink = isNative
        ? 'blink://onSignTransaction'
        : `${currentOrigin}/onSignTransaction`;

      const params = new URLSearchParams({
        dapp_encryption_public_key: dappPubkeyBase58,
        nonce: nonceBase58,
        redirect_link: redirectLink,
        payload: payloadBase58,
      });

      const solflareUrl = `https://solflare.com/ul/v1/signTransaction?${params.toString()}`;

      console.log('[SolanaMobileStack] Launching Solflare signTransaction URL:', solflareUrl);
      ToastService.info('Opening Solflare to approve transaction...');

      let launched = false;
      try {
        if (typeof window !== 'undefined' && (window as any).Capacitor?.isPluginAvailable?.('AppLauncher')) {
          await AppLauncher.openUrl({ url: solflareUrl });
          launched = true;
        }
      } catch (e) {
        console.warn('AppLauncher openUrl failed:', e);
      }

      if (!launched) {
        try {
          await Linking.openURL(solflareUrl);
          launched = true;
        } catch {
          if (typeof window !== 'undefined') {
            window.location.href = solflareUrl;
          }
        }
      }

      return new Promise<string>((resolve, reject) => {
        if (this.pendingSignTransaction?.timer) {
          clearTimeout(this.pendingSignTransaction.timer);
        }

        const timer = setTimeout(() => {
          this.pendingSignTransaction = null;
          reject(new Error('Transaction signing in Solflare timed out.'));
        }, 120000);

        this.pendingSignTransaction = {
          resolve: (sig: string) => {
            clearTimeout(timer);
            this.pendingSignTransaction = null;
            resolve(sig);
          },
          reject: (err: any) => {
            clearTimeout(timer);
            this.pendingSignTransaction = null;
            reject(err);
          },
          timer,
        };
      });
    } catch (err: any) {
      console.error('Failed to initiate Solflare signAndSend:', err);
      throw err;
    }
  }

  /**
   * Handle incoming deep link callback from Phantom / Solflare signAndSendTransaction.
   * Decrypts the signature/transaction payload and resolves the pending promise.
   */
  static async handleSignAndSendCallback(urlString: string): Promise<string | null> {
    try {
      console.log('[SolanaMobileStack] Handling signAndSend callback:', urlString);
      const cleanUrl = urlString
        .replace('blink://', 'https://blink.local/')
        .replace('solana-wallet://', 'https://blink.local/');
      const parsedUrl = new URL(cleanUrl);
      const searchParams = parsedUrl.searchParams;

      const errorCode = searchParams.get('errorCode');
      const errorMessage = searchParams.get('errorMessage');
      if (errorCode || errorMessage) {
        const errorText = errorMessage || 'Transaction rejected in wallet';
        console.warn('Wallet transaction rejected:', errorCode, errorText);
        // Clear stale session if error is related to invalid session or decryption failure
        if (errorCode === '-32603' || String(errorText).toLowerCase().includes('session') || String(errorText).toLowerCase().includes('unexpected')) {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem('wallet_mobile_session');
            window.localStorage.removeItem('wallet_shared_secret');
            window.localStorage.removeItem('phantom_session_dapp_secret_key');
            window.localStorage.removeItem('phantom_session_dapp_public_key');
          }
        }
        ToastService.error(errorText);
        if (this.pendingSignTransaction) {
          this.pendingSignTransaction.reject(new Error(errorText));
        }
        return null;
      }

      let nonceBase58 = searchParams.get('nonce');
      let dataBase58 = searchParams.get('data');
      if (!nonceBase58 || !dataBase58) {
        if (parsedUrl.hash && parsedUrl.hash.length > 1) {
          const hashParams = new URLSearchParams(parsedUrl.hash.substring(1));
          nonceBase58 = nonceBase58 || hashParams.get('nonce');
          dataBase58 = dataBase58 || hashParams.get('data');
        }
      }

      if (!nonceBase58 || !dataBase58) {
        console.warn('Missing crypto parameters in signAndSend callback:', urlString);
        return null;
      }

      const sharedSecretHex =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('wallet_shared_secret')
          : null;

      if (!sharedSecretHex) {
        console.error('Shared secret not found for decrypting signAndSend response');
        if (this.pendingSignTransaction) {
          this.pendingSignTransaction.reject(new Error('Wallet session secret missing.'));
        }
        return null;
      }

      const sharedSecret = new Uint8Array(Buffer.from(sharedSecretHex, 'hex'));
      const nonce = decodeBs58(nonceBase58);
      const encryptedData = decodeBs58(dataBase58);

      const decrypted = nacl.box.open.after(encryptedData, nonce, sharedSecret);
      if (!decrypted) {
        console.error('Failed to decrypt signAndSend response payload');
        if (this.pendingSignTransaction) {
          this.pendingSignTransaction.reject(new Error('Failed to decrypt wallet signature response.'));
        }
        return null;
      }

      const payloadStr = new TextDecoder().decode(decrypted);
      const payload = JSON.parse(payloadStr);

      let txSignature = '';
      if (payload.signature) {
        txSignature = payload.signature;
      } else if (payload.transaction) {
        // If wallet used signTransaction, broadcast the signed wire bytes
        const signedBytes = decodeBs58(payload.transaction);
        txSignature = await SolanaService.sendRawTransactionAndConfirm(signedBytes);
      }

      if (!txSignature) {
        console.error('No signature found in signAndSend response:', payload);
        if (this.pendingSignTransaction) {
          this.pendingSignTransaction.reject(new Error('No signature returned from wallet.'));
        }
        return null;
      }

      console.log('[SolanaMobileStack] Successfully obtained signature from wallet:', txSignature);
      ToastService.success('Transaction confirmed on Solana!');

      if (this.pendingSignTransaction) {
        this.pendingSignTransaction.resolve(txSignature);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('blink_wallet_signed', { detail: { signature: txSignature } })
        );
        window.dispatchEvent(new CustomEvent('blink_tx_updated'));
      }

      return txSignature;
    } catch (err: any) {
      console.error('Error handling signAndSend callback:', err);
      if (this.pendingSignTransaction) {
        this.pendingSignTransaction.reject(err);
      }
      return null;
    }
  }

  /**
   * Sign and send transaction via Phantom/Solflare mobile deeplink or native MWA.
   */
  static async signAndSendTransaction(tx: Transaction): Promise<string> {
    const activeAcc = WalletProviderService.getActiveAccount();
    const accName = (activeAcc?.name || '').toLowerCase();

    // 1. Direct Phantom Universal Link Deeplink with encrypted payload
    if (accName.includes('phantom')) {
      return await this.signAndSendTransactionViaPhantomDeeplink(tx);
    }

    // 2. Direct Solflare Universal Link Deeplink with encrypted payload
    if (accName.includes('solflare')) {
      return await this.signAndSendTransactionViaSolflareDeeplink(tx);
    }

    // 3. Native MWA protocol (Seeker / Saga Android native)
    const isMwaActive = accName.includes('mwa') || accName.includes('seed vault');
    if (Platform.OS === 'android' && isMwaActive) {
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
            txSig = typeof sig === 'string' ? sig : encodeBs58(sig);
          }
        });

        if (txSig) return txSig;
      } catch (err: any) {
        console.warn('MWA signing error:', err);
        throw new Error(err?.message || 'MWA signing failed');
      }
    }

    throw new Error(`No mobile signing provider available for ${activeAcc?.name || 'wallet'}`);
  }
}

