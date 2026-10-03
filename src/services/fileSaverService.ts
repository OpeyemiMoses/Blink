import { ToastService } from './toastService';

export interface SaveImageOptions {
  dataUrl: string;
  filename: string;
  title?: string;
  share?: boolean;
}

export class FileSaverService {
  /**
   * Universal mobile & web image downloader.
   * On Android APK (Capacitor): Saves PNG directly into device Pictures / Gallery via MediaStore.
   * On Web Browser: Triggers standard browser file download.
   */
  static async saveImage(options: SaveImageOptions): Promise<boolean> {
    const { dataUrl, filename, title = 'Blink Image', share = false } = options;

    if (!dataUrl) {
      ToastService.error('Cannot save empty image.');
      return false;
    }

    // 1. Try Native Android Capacitor File Saver
    if (typeof window !== 'undefined') {
      const cap = (window as any).Capacitor;
      const nativeSaver = cap?.Plugins?.NativeFileSaver;

      if (nativeSaver && typeof nativeSaver.saveImage === 'function') {
        try {
          const res = await nativeSaver.saveImage({
            dataUrl,
            filename,
            title,
            share,
          });

          if (res && res.success) {
            ToastService.success(`Saved to Pictures / Gallery: ${filename}`);
            return true;
          }
        } catch (err: any) {
          console.warn('NativeFileSaver plugin error:', err);
          // Fall through to browser download / blob URL fallback
        }
      }
    }

    // 2. Web Browser Fallback (or Capacitor fallback)
    try {
      if (typeof document !== 'undefined') {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        ToastService.success(`Downloaded ${filename}`);
        return true;
      }
    } catch (e: any) {
      console.error('FileSaverService download error:', e);
    }

    ToastService.error('Could not save image to device.');
    return false;
  }
}
