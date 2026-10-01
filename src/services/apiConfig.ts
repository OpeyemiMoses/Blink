import { Platform } from 'react-native';

/**
 * Global API configuration service for TapBlink.
 * Ensures relative endpoints (/api/...) resolve to the correct cloud backend
 * in both Native Android APKs and Web environments.
 */

// Fallback production backend URL if EXPO_PUBLIC_API_URL is not set
const DEFAULT_CLOUD_API_URL = 'https://blink-production-3a6d.up.railway.app';

export function getApiBaseUrl(): string {
  // 1. If explicit environment variable is set at build/runtime
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // 2. If running in a web browser, use current origin
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  // 3. In Native Android/iOS builds, fall back to configured cloud backend
  return DEFAULT_CLOUD_API_URL;
}

export function getApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
}
