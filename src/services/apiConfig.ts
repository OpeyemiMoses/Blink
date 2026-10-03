import { Platform } from 'react-native';

/**
 * Global API configuration service for TapBlink.
 * Ensures relative endpoints (/api/...) resolve to the correct cloud backend
 * in both Native Android APKs and Web environments.
 */

// Fallback production backend URL if EXPO_PUBLIC_API_URL is not set
const DEFAULT_CLOUD_API_URL = 'https://blink-production-5c36.up.railway.app';

export function getApiBaseUrl(): string {
  // 1. If running in a web browser on any HTTP/HTTPS origin (e.g. loca.lt, Railway, localhost)
  // ALWAYS prefer window.location.origin so API calls hit the exact server serving the app
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, '');
    const isCapacitor = origin.startsWith('capacitor:') || origin.startsWith('ionic:');
    if (!isCapacitor && origin.startsWith('http')) {
      return origin;
    }
  }

  // 2. If explicit environment variable is set at build/runtime (useful for Native Android APK)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // 3. In Native Android/iOS builds or local Capacitor containers, fall back to configured cloud backend
  return DEFAULT_CLOUD_API_URL;
}

export function getApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
}

