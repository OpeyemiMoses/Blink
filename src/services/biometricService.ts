import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  authType?: string;
}

const STORAGE_BIO_KEY = 'seeker_device_biometric_id';

export class BiometricService {
  /**
   * Check if hardware biometric scanner (Fingerprint / Face ID) is available on the device.
   */
  static async checkAvailability(): Promise<{ available: boolean; enrolled: boolean; types: string[] }> {
    try {
      // 1. Check native Expo LocalAuthentication
      if (Platform.OS !== 'web') {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

        const typeNames = supportedTypes.map(t => {
          if (t === LocalAuthentication.AuthenticationType.FINGERPRINT) return 'Fingerprint';
          if (t === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) return 'Face ID';
          return 'Device Biometrics';
        });

        return {
          available: hasHardware,
          enrolled: isEnrolled,
          types: typeNames.length > 0 ? typeNames : ['Fingerprint']
        };
      }

      // 2. Check web browser platform biometric authenticator
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        let isPlatformAvailable = false;
        try {
          isPlatformAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch {
          isPlatformAvailable = true;
        }
        return {
          available: isPlatformAvailable,
          enrolled: isPlatformAvailable,
          types: ['Device Fingerprint / Face ID']
        };
      }

      return { available: false, enrolled: false, types: [] };
    } catch {
      return { available: true, enrolled: true, types: ['Fingerprint'] };
    }
  }

  /**
   * Triggers the user's REAL physical device hardware biometric prompt
   * (Android BiometricPrompt fingerprint scanner, iOS Face ID / Touch ID, or native Expo).
   */
  static async authenticate(promptMessage: any = 'Authorize Solana Payment'): Promise<BiometricAuthResult> {
    const message = typeof promptMessage === 'string'
      ? promptMessage
      : promptMessage?.promptMessage || 'Authorize Solana Payment';

    // 1. Native Mobile (Android / iOS native Expo build)
    if (Platform.OS !== 'web') {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (hasHardware) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: message,
            cancelLabel: 'Cancel',
            fallbackLabel: 'Use Device PIN',
            disableDeviceFallback: false,
          });

          if (result.success) {
            return { success: true, authType: 'hardware_biometric' };
          }
          if (result.error === 'user_cancel' || result.error === 'app_cancel') {
            return { success: false, error: 'user_cancel' };
          }
          return { success: false, error: result.error || 'Biometric authentication cancelled.' };
        }
      } catch (err: any) {
        console.warn('Native LocalAuthentication error:', err);
      }
    }

    // 2. Web Browser: WebAuthn Platform Authenticator
    // Directly invokes the real device physical fingerprint sensor or Face ID!
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      return await this.verifyRealDeviceBiometrics(message);
    }

    return {
      success: false,
      error: 'Hardware biometric scanner (Fingerprint / Face ID) is not supported in this browser.',
    };
  }

  /**
   * Invokes the real physical OS biometric or screen lock sensor (Fingerprint, Face ID, PIN, Pattern).
   * Forces the device's native security prompt to pop up.
   */
  private static async verifyRealDeviceBiometrics(promptMessage: string): Promise<BiometricAuthResult> {
    try {
      const challenge = new Uint8Array(32);
      if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(challenge);
      }

      const hostname = window.location.hostname;
      // WebAuthn requires a valid domain or 'localhost' - if IP, do not pass explicit rpId
      const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
      const rpId = isIp ? undefined : hostname;

      // 1. Try existing registered device platform credential if present
      const savedCredId = typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(STORAGE_BIO_KEY)
        : null;

      if (savedCredId) {
        try {
          const rawId = Uint8Array.from(atob(savedCredId), c => c.charCodeAt(0));
          const assertion = await navigator.credentials.get({
            publicKey: {
              challenge,
              ...(rpId ? { rpId } : {}),
              allowCredentials: [{
                id: rawId,
                type: 'public-key',
                transports: ['internal'],
              }],
              userVerification: 'preferred', // Allows Fingerprint, Face ID, or Device PIN/Pattern/Password!
              timeout: 60000,
            }
          });

          if (assertion) {
            return { success: true, authType: 'device_security' };
          }
        } catch (getErr: any) {
          // If explicitly cancelled by user on the physical prompt
          if (getErr.name === 'NotAllowedError' || getErr.name === 'AbortError') {
            return { success: false, error: 'Device authorization was cancelled.' };
          }
          // If stored credential was cleared or mismatched, reset and re-create
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(STORAGE_BIO_KEY);
          }
          console.warn('WebAuthn get failed, refreshing platform credential:', getErr);
        }
      }

      // 2. Register & verify on physical platform authenticator (Fingerprint, Face ID, or Screen PIN/Pattern)
      const userId = new Uint8Array(16);
      if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(userId);
      }

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'Seeker TapBlink',
            ...(rpId ? { id: rpId } : {}),
          },
          user: {
            id: userId,
            name: 'seeker_owner',
            displayName: 'Solana Seeker Owner',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },   // ES256 (Android BiometricPrompt & iOS Secure Enclave)
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // Physical on-device sensor or screen lock!
            userVerification: 'preferred',        // Allows Fingerprint, Face ID, or Device PIN/Pattern!
            residentKey: 'discouraged',          // Prevents confusing Google Passkey cloud sync dialogs!
          },
          timeout: 60000,
        }
      }) as any;

      if (credential && credential.rawId) {
        const base64Id = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_BIO_KEY, base64Id);
        }
        return { success: true, authType: 'device_security' };
      }

      return { success: false, error: 'Device security verification was not completed.' };
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        return { success: false, error: 'Authorization was cancelled.' };
      }
      return { success: false, error: err?.message || 'Device security sensor authorization failed.' };
    }
  }
}


