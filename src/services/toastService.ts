export type ToastType = 'success' | 'info' | 'error';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  durationMs: number;
}

type ToastListener = (toast: ToastMessage | null) => void;
type ToastListListener = (toasts: ToastMessage[]) => void;

export class ToastService {
  private static listeners: Set<ToastListener> = new Set();
  private static listListeners: Set<ToastListListener> = new Set();
  private static activeToasts: ToastMessage[] = [];
  private static toastTimers: Map<string, any> = new Map();

  static subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    if (this.activeToasts.length > 0) {
      listener(this.activeToasts[this.activeToasts.length - 1]);
    } else {
      listener(null);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  static subscribeList(listener: ToastListListener): () => void {
    this.listListeners.add(listener);
    listener([...this.activeToasts]);
    return () => {
      this.listListeners.delete(listener);
    };
  }

  static show(message: string, type: ToastType = 'success', durationMs: number = 3800): void {
    if (!message) return;

    // Avoid identical duplicate toast message displayed simultaneously
    const existing = this.activeToasts.find(t => t.message === message);
    if (existing) return;

    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const toast: ToastMessage = {
      id,
      message,
      type,
      durationMs,
    };

    // Keep up to 3 active toasts visible simultaneously
    if (this.activeToasts.length >= 3) {
      const oldest = this.activeToasts.shift();
      if (oldest) {
        const oldTimer = this.toastTimers.get(oldest.id);
        if (oldTimer) clearTimeout(oldTimer);
        this.toastTimers.delete(oldest.id);
      }
    }

    this.activeToasts.push(toast);
    this.notify();

    const timer = setTimeout(() => {
      this.dismiss(id);
    }, durationMs);
    this.toastTimers.set(id, timer);
  }

  static success(message: string, durationMs: number = 3800): void {
    this.show(message, 'success', durationMs);
  }

  static info(message: string, durationMs: number = 3800): void {
    this.show(message, 'info', durationMs);
  }

  static error(message: string, durationMs: number = 4200): void {
    this.show(message, 'error', durationMs);
  }

  static dismiss(id?: string): void {
    if (id) {
      const timer = this.toastTimers.get(id);
      if (timer) clearTimeout(timer);
      this.toastTimers.delete(id);
      this.activeToasts = this.activeToasts.filter(t => t.id !== id);
    } else {
      this.toastTimers.forEach(t => clearTimeout(t));
      this.toastTimers.clear();
      this.activeToasts = [];
    }
    this.notify();
  }

  private static notify(): void {
    const latest = this.activeToasts.length > 0 ? this.activeToasts[this.activeToasts.length - 1] : null;
    for (const listener of this.listeners) {
      try {
        listener(latest);
      } catch (err) {
        console.warn('Toast listener error:', err);
      }
    }
    for (const listener of this.listListeners) {
      try {
        listener([...this.activeToasts]);
      } catch (err) {
        console.warn('Toast list listener error:', err);
      }
    }
  }
}
