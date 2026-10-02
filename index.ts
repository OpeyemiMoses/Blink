import 'react-native-get-random-values';
import './src/polyfill';
import { injectAppFont } from './src/styles/loadCursiveFont';
import { registerRootComponent } from 'expo';
import App from './App';

// Inject modern professional Google Fonts (Poppins & Plus Jakarta Sans) across the application
injectAppFont();

registerRootComponent(App);
