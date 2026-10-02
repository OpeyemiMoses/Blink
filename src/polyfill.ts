import 'react-native-get-random-values';
import { Buffer } from 'buffer';

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}
if (typeof (global as any) !== 'undefined' && typeof (global as any).Buffer === 'undefined') {
  (global as any).Buffer = Buffer;
}
if (typeof (window as any) !== 'undefined' && typeof (window as any).Buffer === 'undefined') {
  (window as any).Buffer = Buffer;
}
if (typeof (global as any) !== 'undefined') {
  if (typeof (global as any).process === 'undefined') {
    (global as any).process = { env: {} };
  } else if (!(global as any).process.env) {
    (global as any).process.env = {};
  }
}

// 1. Polyfill CustomEvent and Event for React Native native runtimes
class CustomEventPolyfill {
  type: string;
  detail: any;
  constructor(type: string, params?: { detail?: any }) {
    this.type = type;
    this.detail = params?.detail;
  }
}

if (typeof (globalThis as any).CustomEvent === 'undefined') {
  (globalThis as any).CustomEvent = CustomEventPolyfill;
}
if (typeof (global as any) !== 'undefined' && typeof (global as any).CustomEvent === 'undefined') {
  (global as any).CustomEvent = CustomEventPolyfill;
}
if (typeof (window as any) !== 'undefined' && typeof (window as any).CustomEvent === 'undefined') {
  (window as any).CustomEvent = CustomEventPolyfill;
}

if (typeof (globalThis as any).Event === 'undefined') {
  (globalThis as any).Event = CustomEventPolyfill;
}
if (typeof (global as any) !== 'undefined' && typeof (global as any).Event === 'undefined') {
  (global as any).Event = CustomEventPolyfill;
}
if (typeof (window as any) !== 'undefined' && typeof (window as any).Event === 'undefined') {
  (window as any).Event = CustomEventPolyfill;
}

// 2. Polyfill EventTarget methods (addEventListener, removeEventListener, dispatchEvent)
// React Native defines window = global, but does NOT implement EventTarget on Android/iOS native!
const eventBusListeners = new Map<string, Set<Function>>();

const addEventListenerPolyfill = (type: string, listener: Function) => {
  if (typeof listener !== 'function') return;
  if (!eventBusListeners.has(type)) {
    eventBusListeners.set(type, new Set());
  }
  eventBusListeners.get(type)!.add(listener);
};

const removeEventListenerPolyfill = (type: string, listener: Function) => {
  const set = eventBusListeners.get(type);
  if (set) {
    set.delete(listener);
  }
};

const dispatchEventPolyfill = (event: any) => {
  const type = typeof event === 'string' ? event : event?.type;
  if (!type) return true;
  const set = eventBusListeners.get(type);
  if (set) {
    set.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.warn(`[EventBus] Error in listener for ${type}:`, err);
      }
    });
  }
  return true;
};

// 3. Polyfill window.localStorage and sessionStorage safely
class MemoryStoragePolyfill {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  }
}

function createSafeStorage(name: 'localStorage' | 'sessionStorage') {
  try {
    if (typeof window !== 'undefined' && (window as any)[name]) {
      const storage = (window as any)[name];
      const testKey = `__blink_${name}_test__`;
      storage.setItem(testKey, '1');
      storage.removeItem(testKey);
      return storage;
    }
  } catch (e) {
    // Storage access is denied, disabled or threw SecurityError in WebView
    console.warn(`[SafeStorage] ${name} is restricted or threw SecurityError, using in-memory fallback`);
  }
  return new MemoryStoragePolyfill();
}

const safeLocalStorage = createSafeStorage('localStorage');
const safeSessionStorage = createSafeStorage('sessionStorage');

const polyfillTargets = [
  globalThis,
  typeof global !== 'undefined' ? global : null,
  typeof window !== 'undefined' ? window : null,
].filter(Boolean);

for (const target of polyfillTargets) {
  const t = target as any;
  try {
    if (!t.localStorage) {
      t.localStorage = safeLocalStorage;
    }
  } catch (_) {
    try {
      Object.defineProperty(t, 'localStorage', {
        value: safeLocalStorage,
        writable: true,
        configurable: true,
      });
    } catch (__) {}
  }

  try {
    if (!t.sessionStorage) {
      t.sessionStorage = safeSessionStorage;
    }
  } catch (_) {
    try {
      Object.defineProperty(t, 'sessionStorage', {
        value: safeSessionStorage,
        writable: true,
        configurable: true,
      });
    } catch (__) {}
  }
}

for (const target of polyfillTargets) {
  const t = target as any;
  if (typeof t.addEventListener !== 'function') {
    t.addEventListener = addEventListenerPolyfill;
  }
  if (typeof t.removeEventListener !== 'function') {
    t.removeEventListener = removeEventListenerPolyfill;
  }
  if (typeof t.dispatchEvent !== 'function') {
    t.dispatchEvent = dispatchEventPolyfill;
  }
}
