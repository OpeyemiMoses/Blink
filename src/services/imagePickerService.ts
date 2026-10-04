import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export class ImagePickerService {
  /**
   * Take photo using the device camera (Used for Avatar changes and Camera snaps)
   * Respects user constraint: Avatar changes must strictly use camera.
   */
  static async pickFromCamera(): Promise<string | null> {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Camera permission not granted');
          return null;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
          base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          return await this.uriToBase64(asset.uri, asset.base64);
        }
        return null;
      }

      // Web Fallback with DOM input
      return new Promise((resolve) => {
        if (typeof document === 'undefined') return resolve(null);
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.setAttribute('capture', 'environment');
        fileInput.onchange = (event: any) => {
          const file = event.target?.files?.[0];
          if (!file) return resolve(null);
          const reader = new FileReader();
          reader.onload = (e) => {
            const rawDataUrl = e.target?.result as string;
            if (!rawDataUrl) return resolve(null);
            const img = new (window as any).Image();
            img.onload = () => {
              const MAX = 256;
              const scale = Math.min(MAX / img.width, MAX / img.height, 1);
              const canvas = document.createElement('canvas');
              canvas.width = Math.round(img.width * scale);
              canvas.height = Math.round(img.height * scale);
              const ctx = canvas.getContext('2d');
              if (!ctx) return resolve(rawDataUrl);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = rawDataUrl;
          };
          reader.readAsDataURL(file);
        };
        fileInput.click();
      });
    } catch (err) {
      console.warn('[ImagePickerService] pickFromCamera error:', err);
      return null;
    }
  }

  /**
   * Pick an image for Blink banner/product (from gallery or camera)
   */
  static async pickBlinkImage(): Promise<string | null> {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          // Fall back to camera if media library permission is denied
          return this.pickFromCamera();
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.75,
          base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          return await this.uriToBase64(asset.uri, asset.base64);
        }
        return null;
      }

      // Web Fallback with DOM input
      return new Promise((resolve) => {
        if (typeof document === 'undefined') return resolve(null);
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = (event: any) => {
          const file = event.target?.files?.[0];
          if (!file) return resolve(null);
          const reader = new FileReader();
          reader.onload = (e) => {
            const rawDataUrl = e.target?.result as string;
            if (!rawDataUrl) return resolve(null);
            const img = new (window as any).Image();
            img.onload = () => {
              const MAX = 480;
              const scale = Math.min(MAX / img.width, MAX / img.height, 1);
              const canvas = document.createElement('canvas');
              canvas.width = Math.round(img.width * scale);
              canvas.height = Math.round(img.height * scale);
              const ctx = canvas.getContext('2d');
              if (!ctx) return resolve(rawDataUrl);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = rawDataUrl;
          };
          reader.readAsDataURL(file);
        };
        fileInput.click();
      });
    } catch (err) {
      console.warn('[ImagePickerService] pickBlinkImage error:', err);
      return null;
    }
  }

  /**
   * Converts any local or temporary image URI into a durable base64 data URL.
   */
  private static async uriToBase64(uri: string, existingBase64?: string | null): Promise<string> {
    if (existingBase64) {
      return existingBase64.startsWith('data:') ? existingBase64 : `data:image/jpeg;base64,${existingBase64}`;
    }
    if (uri.startsWith('data:')) {
      return uri;
    }
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve((reader.result as string) || uri);
        };
        reader.onerror = () => resolve(uri);
        reader.readAsDataURL(blob);
      });
    } catch {
      return uri;
    }
  }
}
