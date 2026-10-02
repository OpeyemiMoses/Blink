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
import { SolanaMobileStackService } from '../services/solanaMobileStackService';
import { ToastService } from '../services/toastService';

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

  const { initOAuth } = useLoginWithOAuth({
    onError: (err: any) => {
      console.warn('OAuth error:', err);
      const msg = err?.message || '';
      if (msg.includes('popup') || msg.includes('origin') || msg.includes('domain') || msg.includes('block')) {
        setAuthNotice('Google popup was blocked or tunnel domain restricted. Opening sign-in modal...');
      }
      login({ loginMethods: ['google', 'email', 'wallet'] });
    },
  });

  const handleGoogleLogin = async () => {
    setAuthNotice(null);
    try {
      if (initOAuth) {
        await initOAuth({ provider: 'google' });
      } else {
        login({ loginMethods: ['google', 'email', 'wallet'] });
      }
    } catch (err: any) {
      console.warn('Google login exception:', err);
      login({ loginMethods: ['google', 'email', 'wallet'] });
    }
  };

  const handleEmailLogin = () => {
    setAuthNotice(null);
    login({ loginMethods: ['email'] });
  };

  const handleMwaConnect = async () => {
    try {
      ToastService.info('Connecting to Mobile Wallet Adapter...');
      const account = await SolanaMobileStackService.connectMWA();
      if (account) {
        ToastService.success(`Connected to ${account.name || 'Solana Wallet'}`);
        onContinueGuest();
      } else {
        ToastService.info('No MWA wallet app detected. Opening wallet connector...');
        login({ loginMethods: ['wallet', 'email', 'google'] });
      }
    } catch (err: any) {
      console.warn('MWA connect error:', err);
      ToastService.info('Opening wallet connector...');
      login({ loginMethods: ['wallet', 'email', 'google'] });
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
          onPress={login}
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
            onPress={login}
            activeOpacity={0.7}
          >
            <XLogo size={16} />
            <Text style={[styles.socialPillText, { color: colors.textPrimary }]}>X</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialPill, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
            onPress={login}
            activeOpacity={0.7}
          >
            <TelegramLogo size={18} />
            <Text style={[styles.socialPillText, { color: colors.textPrimary }]}>Telegram</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialPill, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
            onPress={login}
            activeOpacity={0.7}
          >
            <DiscordLogo size={18} />
            <Text style={[styles.socialPillText, { color: colors.textPrimary }]}>Discord</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialPill, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
            onPress={login}
            activeOpacity={0.7}
          >
            <GithubLogo size={18} />
            <Text style={[styles.socialPillText, { color: colors.textPrimary }]}>GitHub</Text>
          </TouchableOpacity>
        </View>

        {/* Mobile Wallet Adapter button for Android/Seeker */}
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
