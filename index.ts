import './src/polyfill';
import { injectCursiveFont } from './src/styles/loadCursiveFont';
import { registerRootComponent } from 'expo';
import App from './App';

// Inject stylized cursive Google Fonts across the application
injectCursiveFont();

registerRootComponent(App);

