export type ToastType = 'success' | 'info' | 'error';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  durationMs: number;
}

type ToastListener = (toast: ToastMessage | null) => void;

export class ToastService {
  private static listeners: Set<ToastListener> = new Set();
  private static currentToast: ToastMessage | null = null;
  private static timer: any = null;

  static subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    if (this.currentToast) {
      listener(this.currentToast);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  static show(message: string, type: ToastType = 'success', durationMs: number = 3500): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const toast: ToastMessage = {
      id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      message,
      type,
      durationMs,
    };

    this.currentToast = toast;
    this.notify();

    this.timer = setTimeout(() => {
      this.dismiss();
    }, durationMs);
  }

  static success(message: string, durationMs: number = 3500): void {
    this.show(message, 'success', durationMs);
  }

  static info(message: string, durationMs: number = 3500): void {
    this.show(message, 'info', durationMs);
  }

  static error(message: string, durationMs: number = 4000): void {
    this.show(message, 'error', durationMs);
  }

  static dismiss(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.currentToast = null;
    this.notify();
  }

  private static notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentToast);
      } catch (err) {
        console.warn('Toast listener error:', err);
      }
    }
  }
}
