import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  Shield,
  Sparkles,
  ArrowRight,
  Radio,
  Fingerprint,
  Mail,
  CheckCircle2,
} from 'lucide-react-native';
import { usePrivy } from '../auth/privyAdapter';
import { PrivyNativeBridge } from '../auth/privyAdapter';
import { useTheme } from '../theme/ThemeContext';
import { BlinkBrandMark } from './BrandLogos';
import { PrivyIcon } from './PrivyIcon';
import { EmailLogo } from './SocialLogos';
import { ToastService } from '../services/toastService';

/**
 * Detect if we're running inside a Capacitor Android WebView.
 */
const IS_ANDROID_WEBVIEW = (() => {
  try {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/wv/i.test(ua) && /android/i.test(ua)) return true;
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
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailAuth = (directEmail?: string) => {
    const targetEmail = (directEmail || email).trim();

    if (IS_ANDROID_WEBVIEW) {
      // In native APK: open in-app PrivyAuthModal with email OTP
      PrivyNativeBridge.open({
        mode: 'email',
        email: targetEmail || undefined,
      });
    } else {
      // In web browser: open Privy login configured for email
      login({ mode: 'email' });
    }
  };

  const handleSubmit = () => {
    if (email.trim() && (!email.includes('@') || !email.includes('.'))) {
      ToastService.error('Please enter a valid email address.');
      return;
    }
    handleEmailAuth(email.trim());
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
          Connect any real-world object to Solana on-chain Actions. Fast, secure, non-custodial transactions with zero manual friction.
        </Text>
      </View>

      {/* Primary Authentication Card: Email Only */}
      <View style={[styles.authCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.authCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <EmailLogo size={22} />
            <Text style={[styles.authCardTitle, { color: colors.textPrimary }]}>SIGN IN OR CREATE ACCOUNT</Text>
          </View>
          <View style={styles.nonCustodialBadge}>
            <Shield size={11} color="#10B981" />
            <Text style={styles.nonCustodialText}>Non-Custodial</Text>
          </View>
        </View>

        <Text style={[styles.authCardExplainer, { color: colors.textSecondary }]}>
          New to Blink? Enter your email to automatically create your account and provision an embedded Solana wallet in seconds.
        </Text>

        {/* Email Direct Input Field */}
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: colors.textMuted }]}>EMAIL ADDRESS</Text>
          <View style={[styles.emailInputWrapper, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <Mail size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.textInput, { color: colors.textPrimary }]}
              placeholder="name@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSubmit}
            />
          </View>
        </View>

        {/* Primary Action Button */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleSubmit}
          activeOpacity={0.85}
        >
          <EmailLogo size={20} />
          <Text style={styles.primaryBtnText}>
            {email.trim() ? 'Continue with Email' : 'Sign In with Email'}
          </Text>
          <ArrowRight size={16} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Benefits list */}
        <View style={styles.benefitRow}>
          <CheckCircle2 size={13} color="#10B981" />
          <Text style={[styles.benefitText, { color: colors.textMuted }]}>
            Instant 6-digit OTP code • No passwords required
          </Text>
        </View>
        <View style={styles.benefitRow}>
          <CheckCircle2 size={13} color="#10B981" />
          <Text style={[styles.benefitText, { color: colors.textMuted }]}>
            Non-custodial Solana keypair provisioned by Privy
          </Text>
        </View>
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

      {/* Links row: Guest Explore */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
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
    maxWidth: 540,
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  devnetText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroSection: {
    alignItems: 'center',
    textAlign: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  pillBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroHeading: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroSubtext: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 420,
  },
  authCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 14,
  },
  authCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  nonCustodialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  nonCustodialText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  authCardExplainer: {
    fontSize: 13,
    lineHeight: 19,
  },
  inputContainer: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  emailInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    height: '100%',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B67F6',
    borderRadius: 12,
    height: 48,
    gap: 10,
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 11,
    fontWeight: '500',
  },
  featuresList: {
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  featureDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  guestLink: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  guestLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
