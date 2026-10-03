import { Platform } from 'react-native';

/**
 * Global API configuration service for TapBlink.
 * Ensures relative endpoints (/api/...) resolve to the correct cloud backend
 * in both Native Android APKs and Web environments.
 */

// Fallback production backend URL if EXPO_PUBLIC_API_URL is not set
const DEFAULT_CLOUD_API_URL = 'https://blink-production-5c36.up.railway.app';

export function getApiBaseUrl(): string {
  // 1. If explicit environment variable is set at build/runtime
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // 2. If running in a web browser on a remote origin (not localhost / capacitor)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, '');
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1') || origin.startsWith('capacitor:');
    if (!isLocalhost) {
      return origin;
    }
  }

  // 3. In Native Android/iOS builds or local Capacitor containers, fall back to configured cloud backend
  return DEFAULT_CLOUD_API_URL;
}

export function getApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
}
