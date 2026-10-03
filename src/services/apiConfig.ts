import { Platform } from 'react-native';

/**
 * Global API configuration service for TapBlink.
 * Ensures relative endpoints (/api/...) resolve to the correct cloud backend
 * in both Native Android APKs and Web environments.
 */

export const DEFAULT_CLOUD_API_URL = 'https://blink-production-5c36.up.railway.app';

export function getApiBaseUrl(): string {
  // 1. If running in Capacitor Native Android/iOS or local webview container, ALWAYS use cloud API
  if (typeof window !== 'undefined') {
    const isCapacitorNative = Boolean((window as any).Capacitor?.isNativePlatform?.());
    const origin = (window.location?.origin || '').replace(/\/$/, '');
    if (
      isCapacitorNative ||
      origin.startsWith('capacitor:') ||
      origin.startsWith('ionic:') ||
      origin.startsWith('file:') ||
      origin.startsWith('content:') ||
      origin === 'http://localhost' ||
      origin === 'https://localhost' ||
      origin === 'null' ||
      !origin
    ) {
      return process.env.EXPO_PUBLIC_API_URL ? process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '') : DEFAULT_CLOUD_API_URL;
    }

    // 2. If running in a web browser on any remote HTTP/HTTPS origin (loca.lt, Railway, custom domain)
    if (origin.startsWith('http')) {
      return origin;
    }
  }

  // 3. Environment variable fallback
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  return DEFAULT_CLOUD_API_URL;
}

export function getApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
}

