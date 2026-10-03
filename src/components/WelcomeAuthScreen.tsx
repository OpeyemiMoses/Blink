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
  Mail,
  CheckCircle2,
} from 'lucide-react-native';
import { usePrivy } from '../auth/privyAdapter';
import { useTheme } from '../theme/ThemeContext';
import { BlinkBrandMark } from './BrandLogos';

interface WelcomeAuthScreenProps {
  onContinueGuest: () => void;
  onOpenAbout?: () => void;
}

export const WelcomeAuthScreen: React.FC<WelcomeAuthScreenProps> = ({
  onContinueGuest,
  onOpenAbout,
}) => {
  const { colors } = useTheme();
  const { login } = usePrivy();

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

      {/* Primary Authentication Card */}
      <View style={[styles.authCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.authCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Sparkles size={20} color={colors.accent} />
            <Text style={[styles.authCardTitle, { color: colors.textPrimary }]}>SIGN IN OR CREATE ACCOUNT</Text>
          </View>
          <View style={styles.nonCustodialBadge}>
            <Shield size={11} color="#10B981" />
            <Text style={styles.nonCustodialText}>Non-Custodial</Text>
          </View>
        </View>

        <Text style={[styles.authCardExplainer, { color: colors.textSecondary }]}>
          Sign in or create your account using SMS, Email, or your Solana wallet. Non-custodial embedded Solana keys are provisioned instantly.
        </Text>

        {/* Primary Action Button: Opens Privy Modal with SMS, Email & Wallet options */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => login()}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Get Started with Blink</Text>
          <ArrowRight size={16} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Security & Benefits list */}
        <View style={styles.benefitRow}>
          <CheckCircle2 size={13} color="#10B981" />
          <Text style={[styles.benefitText, { color: colors.textMuted }]}>
            Sign in with SMS (Phone), Email, or Solana wallet
          </Text>
        </View>
        <View style={styles.benefitRow}>
          <CheckCircle2 size={13} color="#10B981" />
          <Text style={[styles.benefitText, { color: colors.textMuted }]}>
            In-app biometric transaction signing — zero app switching
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
    letterSpacing: 0.5,
  },
  devnetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
    fontSize: 11,
    fontWeight: '600',
  },
  heroSection: {
    gap: 8,
    marginTop: 10,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroHeading: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  heroSubtext: {
    fontSize: 12,
    lineHeight: 18,
  },
  authCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  authCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authCardTitle: {
    fontSize: 11,
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
    borderRadius: 10,
  },
  nonCustodialText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  authCardExplainer: {
    fontSize: 11,
    lineHeight: 16,
  },
  primaryBtn: {
    backgroundColor: '#5B67F6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 4,
  },
  benefitText: {
    fontSize: 10,
    fontWeight: '500',
  },
  featuresList: {
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  guestLink: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  guestLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
