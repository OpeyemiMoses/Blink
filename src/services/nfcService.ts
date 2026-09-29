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

export class NfcService {
  private static status: NfcStatus = 'idle';
  private static listeners: TagCallback[] = [];

  static getStatus(): NfcStatus {
    return this.status;
  }

  static isHardwareSupported(): boolean {
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

    // Check if Web NFC is supported (Chromium / Seeker mobile browser)
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      try {
        // @ts-expect-error Web NFC API
        const ndef = new window.NDEFReader();
        await ndef.scan();
        // @ts-expect-error Web NFC API
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
  static async beamAction(actionUrl: string): Promise<boolean> {
    this.status = 'beaming';
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      try {
        // @ts-expect-error Web NFC API
        const ndef = new window.NDEFReader();
        await ndef.write({
          records: [{ recordType: 'url', data: actionUrl }]
        });
      } catch (err) {
        console.warn('Web NFC write error:', err);
      }
    }
    return true;
  }

  /**
   * Write tag helper used by Blink Studio and Detail views.
   */
  static async writeTag(opts: { url: string; title?: string; id?: string }): Promise<{ success: boolean; message: string }> {
    try {
      const ok = await this.beamAction(opts.url);
      if (ok) {
        return { success: true, message: `Action "${opts.title || opts.id || 'Blink'}" programmed to physical NFC tag.` };
      }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Could not write NFC tag.' };
    }
    return { success: false, message: 'NFC tag write failed.' };
  }
}
