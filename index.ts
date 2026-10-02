import 'react-native-get-random-values';
import './src/polyfill';
import { injectAppFont } from './src/styles/loadCursiveFont';
import { registerRootComponent } from 'expo';
import App from './App';

// Global crash guard to prevent uncaught exceptions from killing the native Android host process
if (typeof global !== 'undefined' && (global as any).ErrorUtils) {
  const originalHandler = (global as any).ErrorUtils.getGlobalHandler();
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    console.warn('[Crash Guard - Caught Unhandled Exception]:', error?.message || error);
    if (!isFatal && originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

// Inject modern professional Google Fonts (Poppins & Plus Jakarta Sans) across the application
injectAppFont();

registerRootComponent(App);
