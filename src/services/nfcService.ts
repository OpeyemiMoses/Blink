import { Platform } from 'react-native';

export type NfcStatus = 'idle' | 'listening' | 'tag_detected' | 'beaming' | 'error';

export interface NfcPayload {
  type: 'solana-action' | 'solana-pay' | 'skr-drop';
  url: string;
  metadata?: {
    title?: string;
    amount?: number;
    token?: string;
  };
}

type TagCallback = (payload: NfcPayload) => void;

let NfcManager: any = null;
let NfcTech: any = null;
let Ndef: any = null;

try {
  if (Platform.OS !== 'web') {
    // Dynamically require react-native-nfc-manager for native APK builds
    const nfcModule = require('react-native-nfc-manager');
    NfcManager = nfcModule.default || nfcModule.NfcManager;
    NfcTech = nfcModule.NfcTech;
    Ndef = nfcModule.Ndef;
  }
} catch (e) {
  console.warn('Native NFC Manager loading omitted:', e);
}

export class NfcService {
  private static status: NfcStatus = 'idle';
  private static listeners: TagCallback[] = [];
  private static isInitialized = false;

  private static async ensureInitialized(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (Platform.OS === 'web' || !NfcManager) return false;
    try {
      if (typeof NfcManager.start === 'function') {
        await NfcManager.start();
        this.isInitialized = true;
        return true;
      }
    } catch (err) {
      console.warn('[NfcService] Safe init caught error:', err);
    }
    return false;
  }

  static getStatus(): NfcStatus {
    return this.status;
  }

  static isHardwareSupported(): boolean {
    if (Platform.OS !== 'web' && NfcManager) return true;
    return typeof window !== 'undefined' && 'NDEFReader' in window;
  }

  static subscribe(callback: TagCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Start listening for physical NFC tag or phone-to-phone contact.
   */
  static async startListening(): Promise<boolean> {
    this.status = 'listening';

    // 1. Native APK (Android/iOS via react-native-nfc-manager)
    if (Platform.OS !== 'web' && NfcManager && NfcTech && Ndef) {
      try {
        await this.ensureInitialized();
        await NfcManager.requestTechnology(NfcTech.Ndef);
        const tag = await NfcManager.getTag();
        if (tag && tag.ndefMessage && tag.ndefMessage.length > 0) {
          const payloadUrl = Ndef.uri.decodePayload(tag.ndefMessage[0].payload);
          if (payloadUrl) {
            this.handleTagDetected({
              type: 'solana-action',
              url: payloadUrl
            });
          }
        }
        return true;
      } catch (err) {
        console.warn('Native NFC listener error:', err);
      } finally {
        try {
          await NfcManager.cancelTechnologyRequest();
        } catch {}
      }
    }

    // 2. Web NFC (Chromium / Seeker mobile browser)
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      try {
        // @ts-expect-error Web NFC API
        const ndef = new window.NDEFReader();
        await ndef.scan();
        // @ts-ignore Web NFC API
        ndef.addEventListener('reading', ({ message }: any) => {
          for (const record of message.records) {
            if (record.recordType === 'url' || record.recordType === 'text') {
              const textDecoder = new TextDecoder(record.encoding || 'utf-8');
              const url = textDecoder.decode(record.data);
              this.handleTagDetected({
                type: 'solana-action',
                url
              });
            }
          }
        });
        return true;
      } catch (err) {
        console.warn('Web NFC scan error or permission denied:', err);
      }
    }

    return true;
  }

  static stopListening(): void {
    this.status = 'idle';
    if (Platform.OS !== 'web' && NfcManager) {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  }

  /**
   * Emulate / trigger NFC tag detection (used by hardware listener or simulator tap).
   */
  static handleTagDetected(payload: NfcPayload): void {
    this.status = 'tag_detected';
    // Haptic feedback if available
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      navigator.vibrate([80, 40, 100]);
    }

    this.listeners.forEach(cb => cb(payload));

    setTimeout(() => {
      this.status = 'idle';
    }, 1500);
  }

  /**
   * Beam an action out over NFC (Host Card Emulation / NDEF Write).
   */
  static async beamAction(actionUrl: string): Promise<{ success: boolean; error?: string; isUnsupported?: boolean }> {
    this.status = 'beaming';

    // 1. Native APK (Android / Solana Seeker APK via react-native-nfc-manager)
    if (Platform.OS !== 'web' && NfcManager && NfcTech && Ndef) {
      try {
        await NfcManager.requestTechnology(NfcTech.Ndef);
        const bytes = Ndef.encodeMessage([Ndef.uriRecord(actionUrl)]);
        if (bytes) {
          await NfcManager.ndefHandler.writeNdefMessage(bytes);
        }
        if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
        this.status = 'idle';
        return { success: true };
      } catch (err: any) {
        console.warn('Native NFC write error:', err);
        this.status = 'error';
        const msg = err?.message || String(err);
        if (msg.includes('cancelled') || msg.includes('cancel')) {
          return { success: false, error: 'NFC writing cancelled.' };
        }
        return { success: false, error: msg || 'Hold blank NFC tag to back of phone and try again.' };
      } finally {
        try {
          await NfcManager.cancelTechnologyRequest();
        } catch {}
      }
    }

    // 2. Web NFC (Chromium / Seeker Browser)
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      try {
        // @ts-expect-error Web NFC API
        const ndef = new window.NDEFReader();
        await ndef.write({
          records: [{ recordType: 'url', data: actionUrl }]
        });
        if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
        this.status = 'idle';
        return { success: true };
      } catch (err: any) {
        console.warn('Web NFC write error:', err);
        this.status = 'error';
        const msg = err?.message || String(err);
        if (msg.includes('user_cancel') || msg.includes('AbortError') || msg.includes('cancel')) {
          return { success: false, error: 'NFC writing cancelled.' };
        }
        return { success: false, error: msg || 'Hold blank NFC tag closer to the back of your phone and try again.' };
      }
    }

    this.status = 'idle';
    return {
      success: false,
      isUnsupported: true,
      error: 'NFC Tag Writing requires an Android phone/Seeker device with NFC enabled.',
    };
  }

  /**
   * Write tag helper used by Blink Studio and Detail views.
   */
  static async writeTag(opts: { url: string; title?: string; id?: string }): Promise<{ success: boolean; message: string; isUnsupported?: boolean }> {
    try {
      const res = await this.beamAction(opts.url);
      if (res.success) {
        return { success: true, message: `Blink "${opts.title || opts.id || 'Blink'}" successfully written to physical NFC tag!` };
      }
      return { success: false, isUnsupported: res.isUnsupported, message: res.error || 'NFC tag write failed.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Could not write NFC tag.' };
    }
  }
}
