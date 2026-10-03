import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import {
  Shield,
  Sparkles,
  ArrowRight,
  Radio,
  Fingerprint,
  Wallet,
  Globe,
  CheckCircle2,
} from 'lucide-react-native';
import { usePrivy, useLoginWithOAuth } from '../auth/privyAdapter';
import { PrivyNativeBridge } from '../auth/privyAdapter';
import { useTheme } from '../theme/ThemeContext';
import { BlinkBrandMark, BlinkLogo } from './BrandLogos';
import { PrivyIcon } from './PrivyIcon';
import {
  EmailLogo,
  GoogleLogo,
  GithubLogo,
  XLogo,
  DiscordLogo,
  TelegramLogo,
} from './SocialLogos';
import { PhantomIcon, SolflareIcon } from './WalletIcons';
import { SolanaMobileStackService, InstalledWalletInfo } from '../services/solanaMobileStackService';
import { ToastService } from '../services/toastService';

/**
 * Detect if we're running inside a Capacitor Android WebView.
 * Uses multiple signals for reliability:
 * 1. Android WebView UA always contains "wv" (most reliable)
 * 2. window.Capacitor object (injected by native bridge)
 * 3. Platform + Capacitor combo
 * This avoids relying on isNativePlatform() timing issues.
 */
const IS_ANDROID_WEBVIEW = (() => {
  try {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    // Capacitor WebView on Android always has 'wv' in user agent
    if (/wv/i.test(ua) && /android/i.test(ua)) return true;
    // Secondary check: Capacitor object present
    if (typeof window !== 'undefined') {
      const cap = (window as any).Capacitor;
      if (cap?.isNativePlatform?.()) return true;
      if (cap?.getPlatform?.() === 'android') return true;
      if (cap?.platform === 'android') return true;
    }
    return false;
  } catch { return false; }
})();

interface WelcomeAuthScreenProps {
  onContinueGuest: () => void;
  onOpenAbout?: () => void;
}

export const WelcomeAuthScreen: React.FC<WelcomeAuthScreenProps> = ({
  onContinueGuest,
  onOpenAbout,
}) => {
  const { colors, isDark } = useTheme();
  const { login } = usePrivy();
  const [authNotice, setAuthNotice] = React.useState<string | null>(null);
  const [installedWallets, setInstalledWallets] = React.useState<InstalledWalletInfo[]>([]);
  const [isDetectingWallets, setIsDetectingWallets] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    SolanaMobileStackService.getInstalledWallets()
      .then((wallets) => {
        if (active) {
          setInstalledWallets(wallets);
          setIsDetectingWallets(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to detect wallets:', err);
        if (active) setIsDetectingWallets(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // ─── Unified login handler ────────────────────────────────────────────────
  // In Capacitor APK: ALWAYS open the in-app PrivyAuthModal (no browser OAuth).
  // On Railway web browser: use the real Privy SDK (real OAuth flows).
  const openAuthModal = (opts?: { provider?: string; mode?: string }) => {
    if (IS_ANDROID_WEBVIEW) {
      // Native path: show in-app modal — email OTP + simulated social logins
      PrivyNativeBridge.open({ mode: 'login', ...opts });
    } else {
      // Web path: real Privy OAuth
      if (opts?.provider) {
        login({ provider: opts.provider });
      } else if (opts?.mode) {
        login({ mode: opts.mode });
      } else {
        login();
      }
    }
  };

  const handleGoogleLogin = () => { setAuthNotice(null); openAuthModal({ provider: 'google' }); };
  const handleEmailLogin = () => { setAuthNotice(null); openAuthModal({ mode: 'email' }); };
  const handleSocialLogin = (provider: string) => { setAuthNotice(null); openAuthModal({ provider }); };

  const handleConnectInstalledWallet = async (walletId: 'phantom' | 'solflare' | 'backpack' | 'mwa') => {
    try {
      const name = walletId === 'phantom' ? 'Phantom' : walletId === 'solflare' ? 'Solflare' : 'Solana Wallet';
      ToastService.info(`Connecting to ${name}...`);
      await SolanaMobileStackService.connectWalletApp(walletId);
    } catch (err: any) {
      console.warn('Wallet connection error:', err);
      ToastService.error(`Could not connect: ${err?.message || err}`);
    }
  };

  const handleMwaConnect = async () => {
    try {
      ToastService.info('Checking device for Solana wallets...');
      const wallets = await SolanaMobileStackService.getInstalledWallets();
      const detected = wallets.filter((w) => w.isInstalled);
      if (detected.length > 0) {
        ToastService.info(`Connecting to ${detected[0].name}...`);
        await SolanaMobileStackService.connectWalletApp(detected[0].id);
        return;
      }
      // Try Seeker Seed Vault / MWA
      const mwaResult = await SolanaMobileStackService.connectMWA();
      if (mwaResult) {
        ToastService.success(`Connected to ${mwaResult.name}`);
        return;
      }
      // Final fallback: open in-app modal with wallet options
      if (IS_ANDROID_WEBVIEW) {
        PrivyNativeBridge.open({ mode: 'login', section: 'wallets' });
      } else {
        ToastService.info('No Solana wallet app found. Install Phantom or use Privy login.');
      }
    } catch (err: any) {
      console.warn('MWA connect error:', err);
      if (IS_ANDROID_WEBVIEW) {
        PrivyNativeBridge.open({ mode: 'login', section: 'wallets' });
      } else {
        ToastService.info('No external Solana wallet responded. Please use Privy login.');
      }
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Top Brand Header */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <BlinkBrandMark size={44} />
          <View style={{ marginLeft: 10 }}>
            <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>BLINK</Text>
            <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
              Physical Solana Layer
            </Text>
          </View>
        </View>

        <View style={[styles.devnetBadge, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.greenDot} />
          <Text style={[styles.devnetText, { color: colors.textSecondary }]}>Devnet</Text>
        </View>
      </View>

      {/* Hero Welcome Message */}
      <View style={styles.heroSection}>
        <View style={[styles.pillBadge, { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder }]}>
          <Sparkles size={12} color={colors.accent} />
          <Text style={[styles.pillBadgeText, { color: colors.accent }]}>SOLANA MOBILE STACK READY</Text>
        </View>

        <Text style={[styles.heroHeading, { color: colors.textPrimary }]}>
          Tap. Transact. Execute.
        </Text>
        <Text style={[styles.heroSubtext, { color: colors.textSecondary }]}>
          Connect any real-world object to Solana on-chain Actions. Use your device fingerprint or face unlock for instant payments without manual signing.
        </Text>
      </View>

      {/* Primary Authentication Card */}
      <View style={[styles.authCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.authCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <PrivyIcon size={22} />
            <Text style={[styles.authCardTitle, { color: colors.textPrimary }]}>SIGN IN OR CREATE ACCOUNT</Text>
          </View>
          <View style={styles.nonCustodialBadge}>
            <Shield size={11} color="#10B981" />
            <Text style={styles.nonCustodialText}>Non-Custodial</Text>
          </View>
        </View>

        <Text style={[styles.authCardExplainer, { color: colors.textSecondary }]}>
          Privy provisions a non-custodial Solana keypair instantly for you. Sign in with any social identity or external wallet.
        </Text>

        {/* Primary 1-Click Privy Action */}
        <TouchableOpacity
          style={styles.primaryPrivyBtn}
          onPress={() => openAuthModal()}
          activeOpacity={0.85}
        >
          <PrivyIcon size={20} />
          <Text style={styles.primaryPrivyBtnText}>Sign In / Sign Up with Privy</Text>
          <ArrowRight size={16} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textMuted }]}>or connect via</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* 6 Social Identity Quick Triggers */}
        <View style={styles.socialGrid}>
          <TouchableOpacity
            style={[styles.socialPill, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
            onPress={handleGoogleLogin}
            activeOpacity={0.7}
          >
            <GoogleLogo size={18} />
            <Text style={[styles.socialPillText, { color: colors.textPrimary }]}>Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialPill, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
            onPress={handleEmailLogin}
            activeOpacity={0.7}
          >
            <EmailLogo size={18} />
            <Text style={[styles.socialPillText, { color: colors.textPrimary }]}>Email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialPill, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
            onPress={() => handleSocialLogin('twitter')}
            activeOpacity={0.7}
          >
            <XLogo size={16} />
            <Text style={[styles.socialPillText, { color: colors.textPrimary }]}>X</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialPill, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
            onPress={() => handleSocialLogin('telegram')}
            activeOpacity={0.7}
          >
            <TelegramLogo size={18} />
            <Text style={[styles.socialPillText, { color: colors.textPrimary }]}>Telegram</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialPill, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
            onPress={() => handleSocialLogin('discord')}
            activeOpacity={0.7}
          >
            <DiscordLogo size={18} />
            <Text style={[styles.socialPillText, { color: colors.textPrimary }]}>Discord</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialPill, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
            onPress={() => handleSocialLogin('github')}
            activeOpacity={0.7}
          >
            <GithubLogo size={18} />
            <Text style={[styles.socialPillText, { color: colors.textPrimary }]}>GitHub</Text>
          </TouchableOpacity>
        </View>

        {/* Detected Native Mobile Wallets (Phantom / Solflare / MWA) */}
        {installedWallets.some((w) => w.isInstalled) ? (
          <View style={styles.detectedWalletsBox}>
            <View style={styles.detectedWalletsHeader}>
              <View style={styles.greenPulseDot} />
              <Text style={[styles.detectedWalletsHeaderText, { color: '#10B981' }]}>
                SOLANA WALLETS DETECTED ON THIS DEVICE
              </Text>
            </View>

            {installedWallets
              .filter((w) => w.isInstalled)
              .map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[
                    styles.detectedWalletBtn,
                    w.id === 'phantom'
                      ? { backgroundColor: 'rgba(171, 159, 242, 0.12)', borderColor: '#AB9FF2' }
                      : w.id === 'solflare'
                      ? { backgroundColor: 'rgba(252, 129, 34, 0.12)', borderColor: '#FC8122' }
                      : { backgroundColor: colors.accentSoft, borderColor: colors.accent },
                  ]}
                  onPress={() => handleConnectInstalledWallet(w.id)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {w.id === 'phantom' ? (
                      <PhantomIcon size={24} />
                    ) : w.id === 'solflare' ? (
                      <SolflareIcon size={24} />
                    ) : (
                      <Wallet size={20} color={colors.accent} />
                    )}
                    <View>
                      <Text style={[styles.detectedWalletTitle, { color: colors.textPrimary }]}>
                        Connect {w.name}
                      </Text>
                      <Text style={[styles.detectedWalletSub, { color: colors.textSecondary }]}>
                        Installed • 1-tap instant login
                      </Text>
                    </View>
                  </View>
                  <ArrowRight
                    size={16}
                    color={
                      w.id === 'phantom' ? '#AB9FF2' : w.id === 'solflare' ? '#FC8122' : colors.accent
                    }
                  />
                </TouchableOpacity>
              ))}
          </View>
        ) : (
          /* Mobile Wallet Adapter button fallback */
          <TouchableOpacity
            style={[styles.mwaButton, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
            onPress={handleMwaConnect}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Wallet size={16} color={colors.accent} />
              <Text style={[styles.mwaButtonText, { color: colors.textPrimary }]}>
                Mobile Wallet Adapter (MWA) / Phantom
              </Text>
            </View>
            <ArrowRight size={14} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {authNotice && (
          <View style={[styles.authNoticeBox, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <Text style={[styles.authNoticeText, { color: colors.textPrimary }]}>{authNotice}</Text>
          </View>
        )}

        <Text style={[styles.loginTipText, { color: colors.textMuted }]}>
          Tip: You can also log in instantly with Email (6-digit OTP code) or connect any Solana Wallet (Phantom / Solflare).
        </Text>
      </View>

      {/* Feature Highlights Grid */}
      <View style={styles.featuresList}>
        <View style={[styles.featureItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[styles.featureIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
            <Fingerprint size={20} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>
              Biometric One-Tap Payment
            </Text>
            <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
              Use your device fingerprint or face unlock to approve payments without signing friction.
            </Text>
          </View>
        </View>

        <View style={[styles.featureItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[styles.featureIconWrap, { backgroundColor: 'rgba(91, 103, 246, 0.12)' }]}>
            <Radio size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>
              Physical NFC Blinks
            </Text>
            <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
              Hardware-anchored Solana Actions. Tap any physical NFC tag or card to pay merchants in USDC/SOL.
            </Text>
          </View>
        </View>
      </View>

      {/* Links row: Guest Explore + Docs & Help */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 4 }}>
        <TouchableOpacity
          style={styles.guestLink}
          onPress={onContinueGuest}
          activeOpacity={0.7}
        >
          <Text style={[styles.guestLinkText, { color: colors.textSecondary }]}>
            Explore Dashboard as Guest →
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
    paddingBottom: 60,
    maxWidth: 580,
    width: '100%',
    alignSelf: 'center',
    gap: 20,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  devnetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  devnetText: {
    fontSize: 10,
    fontWeight: '700',
  },
  heroSection: {
    gap: 10,
    marginTop: 8,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroHeading: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  heroSubtext: {
    fontSize: 12,
    lineHeight: 22,
    fontWeight: '500',
  },
  authCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  authCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  nonCustodialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nonCustodialText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  authCardExplainer: {
    fontSize: 11,
    lineHeight: 18,
  },
  primaryPrivyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#5B67F6',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: '#5B67F6',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryPrivyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '600',
  },
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  socialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexGrow: 1,
    justifyContent: 'center',
  },
  socialPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  mwaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 4,
  },
  mwaButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
  detectedWalletsBox: {
    gap: 8,
    marginTop: 6,
  },
  detectedWalletsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  detectedWalletsHeaderText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detectedWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detectedWalletTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  detectedWalletSub: {
    fontSize: 10,
    marginTop: 1,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  featureIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 10,
    lineHeight: 16,
  },
  guestLink: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  guestLinkText: {
    fontSize: 11,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  authNoticeBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  authNoticeText: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loginTipText: {
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 12,
  },
});
