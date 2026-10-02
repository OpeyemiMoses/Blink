import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar as RNStatusBar,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { X, Shield, RefreshCw, ExternalLink } from 'lucide-react-native';
import { BlinkBrandMark } from './BrandLogos';
import { PrivyIcon } from './PrivyIcon';
import { PrivyNativeBridge } from '../auth/privyAdapter';
import { useTheme } from '../theme/ThemeContext';

export interface PrivyAuthModalProps {
  visible: boolean;
  onClose: () => void;
  options?: any;
}

// Production and fallback endpoints for Privy In-App Auth Bridge (direct target without redirect hop)
const PROD_AUTH_URL = 'https://blink-production-5c36.up.railway.app/?auth_modal=1';
const LOCAL_TUNNEL_URL = 'https://every-baboons-knock.loca.lt/?auth_modal=1';

export const PrivyAuthModal: React.FC<PrivyAuthModalProps> = ({
  visible,
  onClose,
  options,
}) => {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [useTunnel, setUseTunnel] = useState(false);
  const webViewRef = React.useRef<any>(null);

  const queryParams = new URLSearchParams();
  queryParams.set('auth_modal', '1');
  if (options?.mode) queryParams.set('mode', options.mode);
  if (options?.provider) queryParams.set('provider', options.provider);
  if (options?.loginMethods && Array.isArray(options.loginMethods)) {
    queryParams.set('methods', options.loginMethods.join(','));
  }

  const baseTarget = useTunnel ? LOCAL_TUNNEL_URL : PROD_AUTH_URL;
  const targetUrl = baseTarget.includes('?') 
    ? `${baseTarget}&${queryParams.toString().replace('auth_modal=1&', '')}`
    : `${baseTarget}?${queryParams.toString()}`;

  const handleMessage = (event: any) => {
    try {
      const rawData = event?.nativeEvent?.data;
      if (!rawData) return;
      const data = JSON.parse(rawData);

      if (data.type === 'PRIVY_AUTH_SUCCESS' && data.user) {
        PrivyNativeBridge.handleAuthSuccess(data.user);
        onClose();
      } else if (data.type === 'PRIVY_LINK_SUCCESS' && data.user) {
        PrivyNativeBridge.handleLinkSuccess(data.user);
        onClose();
      } else if (data.type === 'PRIVY_AUTH_CANCEL') {
        onClose();
      }
    } catch (err) {
      console.warn('[PrivyAuthModal] Error parsing message:', err);
    }
  };

  const handleReload = () => {
    setLoading(true);
    setHasError(false);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  const handleOpenBrowser = () => {
    Linking.openURL(targetUrl).catch((err) => console.warn('Cannot open browser:', err));
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Top Header */}
        <View style={[styles.header, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
          <View style={styles.brandGroup}>
            <BlinkBrandMark size={28} />
            <View style={styles.titleCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>PRIVY SECURE AUTH</Text>
                <View style={styles.badge}>
                  <Shield size={10} color="#10B981" />
                  <Text style={styles.badgeText}>Non-Custodial</Text>
                </View>
              </View>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>
                Solana Devnet · Powered by Privy
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={handleOpenBrowser}
              style={[styles.iconBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
              activeOpacity={0.7}
              accessibilityLabel="Open in external browser"
            >
              <ExternalLink size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleReload}
              style={[styles.iconBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
              activeOpacity={0.7}
              accessibilityLabel="Reload authentication view"
            >
              <RefreshCw size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.iconBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
              activeOpacity={0.7}
              accessibilityLabel="Close authentication"
            >
              <X size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* WebView Body */}
        <View style={styles.webviewContainer}>
          {Platform.OS !== 'web' ? (
            <WebView
              ref={webViewRef}
              source={{ uri: targetUrl }}
              style={styles.webview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              scalesPageToFit={true}
              javaScriptCanOpenWindowsAutomatically={true}
              setSupportMultipleWindows={false}
              userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
              mixedContentMode="always"
              allowsInlineMediaPlayback={true}
              cacheEnabled={false}
              originWhitelist={['*']}
              onMessage={handleMessage}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={(e) => {
                console.warn('[Privy WebView Error]:', e.nativeEvent);
                setLoading(false);
                setHasError(true);
              }}
              renderLoading={() => (
                <View style={[styles.loadingOverlay, { backgroundColor: colors.bg }]}>
                  <ActivityIndicator size="large" color={colors.accent} />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    Connecting to Privy secure authentication...
                  </Text>
                </View>
              )}
            />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16 }}>
                Privy modal is active on web.
              </Text>
            </View>
          )}

          {hasError && (
            <View style={[styles.errorOverlay, { backgroundColor: colors.bg }]}>
              <PrivyIcon size={40} />
              <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Connection Error</Text>
              <Text style={[styles.errorSub, { color: colors.textSecondary }]}>
                Could not reach the authentication gateway. Check your internet connection or switch to the alternative tunnel gateway.
              </Text>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.retryBtn, { backgroundColor: colors.accent }]}
                  onPress={handleReload}
                >
                  <Text style={styles.retryBtnText}>Retry Connection</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.retryBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border, borderWidth: 1 }]}
                  onPress={() => {
                    setUseTunnel(!useTunnel);
                    handleReload();
                  }}
                >
                  <Text style={[styles.retryBtnText, { color: colors.textPrimary }]}>
                    {useTunnel ? 'Use Cloud Gateway' : 'Use Direct Tunnel'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleCol: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sub: {
    fontSize: 11,
    marginTop: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#10B981',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  errorSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
