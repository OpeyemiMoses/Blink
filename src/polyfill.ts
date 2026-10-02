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

const polyfillTargets = [
  globalThis,
  typeof global !== 'undefined' ? global : null,
  typeof window !== 'undefined' ? window : null,
].filter(Boolean);

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
