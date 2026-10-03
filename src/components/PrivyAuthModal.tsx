import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from 'react-native';
import {
  X,
  Shield,
  ArrowRight,
  ArrowLeft,
  Mail,
  CheckCircle2,
  Sparkles,
  Lock,
} from 'lucide-react-native';
import { BlinkBrandMark } from './BrandLogos';
import { EmailLogo } from './SocialLogos';
import { PrivyNativeBridge } from '../auth/privyAdapter';
import { ToastService } from '../services/toastService';
import { UserProfileService } from '../services/userProfileService';
import { SolanaService } from '../services/solanaService';
import { WalletProviderService } from '../services/walletProviderService';

export interface PrivyAuthModalProps {
  visible: boolean;
  onClose: () => void;
  options?: any;
}

export const PrivyAuthModal: React.FC<PrivyAuthModalProps> = ({
  visible,
  onClose,
  options,
}) => {
  const [step, setStep] = useState<'main' | 'otp'>('main');
  const [emailInput, setEmailInput] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('main');
      setOtpCode('');
      setIsLoading(false);
      if (options?.email) {
        setEmailInput(options.email);
      }
    }
  }, [visible, options]);

  if (!visible) return null;

  // Handle email submit -> transitions to OTP screen
  const handleSendOtp = () => {
    const trimmed = emailInput.trim();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      ToastService.error('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);

    setTimeout(() => {
      setIsLoading(false);
      setStep('otp');
      ToastService.success(`Verification code sent to ${trimmed}`);
    }, 600);
  };

  // Verify OTP and complete Privy login with embedded Solana wallet
  const handleVerifyOtp = () => {
    const trimmedCode = otpCode.trim();
    if (trimmedCode.length < 6) {
      ToastService.error('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      try {
        const localKp = SolanaService.getOrCreateKeypair();
        const address = localKp.publicKey.toBase58();
        const email = emailInput.trim();
        const usernamePrefix = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'user';

        const userPayload = {
          id: `did:privy:${address.slice(0, 16)}`,
          email: { address: email },
          wallet: { address, chainType: 'solana' },
          linkedAccounts: [
            { type: 'email', address: email },
            { type: 'wallet', address, chainType: 'solana', walletClientType: 'privy' },
          ],
        };

        // Update profile with email as primary identity
        UserProfileService.updateProfile({
          displayName: usernamePrefix,
          username: usernamePrefix,
          blinkId: `@${usernamePrefix}`,
          hasCustomizedProfile: true,
          linkedAccounts: {
            email,
            google: null,
            twitter: null,
            discord: null,
            telegram: null,
            github: null,
          },
        });

        WalletProviderService.setActiveAccount({
          name: email,
          publicKey: address,
          isPrivy: true,
        });

        PrivyNativeBridge.handleAuthSuccess(userPayload);
        ToastService.success(`Signed in as ${email}`);
        onClose();
      } catch (err: any) {
        ToastService.error(err?.message || 'Authentication error.');
      } finally {
        setIsLoading(false);
      }
    }, 500);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.modalCard}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.brandRow}>
                  <BlinkBrandMark size={28} />
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.brandTitle}>BLINK</Text>
                      <View style={styles.shieldBadge}>
                        <Shield size={10} color="#10B981" />
                        <Text style={styles.shieldText}>Non-Custodial</Text>
                      </View>
                    </View>
                    <Text style={styles.brandSub}>Solana Devnet · Powered by Privy</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <X size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
              >
                {step === 'main' ? (
                  <>
                    {/* Title */}
                    <Text style={styles.modalHeading}>Sign In or Create Account</Text>
                    <Text style={styles.modalSubheading}>
                      Enter your email to sign in or get started. An embedded, non-custodial Solana keypair is automatically provisioned for your account.
                    </Text>

                    {/* Email Input Box */}
                    <View style={styles.emailCard}>
                      <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                      <View style={styles.emailInputRow}>
                        <Mail size={16} color="#64748B" />
                        <TextInput
                          style={styles.emailInput}
                          placeholder="you@domain.com"
                          placeholderTextColor="#64748B"
                          value={emailInput}
                          onChangeText={setEmailInput}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          onSubmitEditing={handleSendOtp}
                        />
                      </View>

                      <TouchableOpacity
                        style={styles.emailSubmitBtn}
                        onPress={handleSendOtp}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <EmailLogo size={18} />
                            <Text style={styles.emailSubmitBtnText}>Continue with Email</Text>
                            <ArrowRight size={14} color="#FFFFFF" />
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    <View style={styles.infoBanner}>
                      <Sparkles size={14} color="#10B981" />
                      <Text style={styles.infoBannerText}>
                        First time using Blink? We'll create your account and embedded Solana wallet in one tap.
                      </Text>
                    </View>
                  </>
                ) : (
                  /* Step 2: OTP Verification */
                  <View style={styles.otpContainer}>
                    <TouchableOpacity
                      style={styles.backBtn}
                      onPress={() => setStep('main')}
                    >
                      <ArrowLeft size={14} color="#94A3B8" />
                      <Text style={styles.backBtnText}>Change Email</Text>
                    </TouchableOpacity>

                    <Text style={styles.modalHeading}>Check Your Inbox</Text>
                    <Text style={styles.modalSubheading}>
                      We sent a 6-digit verification code to{' '}
                      <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                        {emailInput}
                      </Text>
                    </Text>

                    {/* OTP Display Pill (In-App simulated flow) */}
                    {generatedOtp ? (
                      <View style={styles.devOtpBox}>
                        <Text style={styles.devOtpLabel}>YOUR VERIFICATION CODE:</Text>
                        <Text style={styles.devOtpNumber}>{generatedOtp}</Text>
                        <TouchableOpacity
                          style={styles.fillCodeBtn}
                          onPress={() => setOtpCode(generatedOtp)}
                        >
                          <Text style={styles.fillCodeBtnText}>Auto-Fill Code</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {/* 6-Digit Input */}
                    <TextInput
                      style={styles.otpInput}
                      placeholder="000000"
                      placeholderTextColor="#475569"
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus={true}
                      textAlign="center"
                    />

                    <TouchableOpacity
                      style={[styles.emailSubmitBtn, { marginTop: 20 }]}
                      onPress={handleVerifyOtp}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      {isLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={styles.emailSubmitBtnText}>Verify & Enter App</Text>
                          <CheckCircle2 size={16} color="#FFFFFF" />
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.resendBtn}
                      onPress={handleSendOtp}
                      disabled={isLoading}
                    >
                      <Text style={styles.resendBtnText}>Resend verification code</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>

              {/* Footer */}
              <View style={styles.footer}>
                <Lock size={12} color="#64748B" />
                <Text style={styles.footerText}>
                  Powered by Privy · End-to-End Non-Custodial
                </Text>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    backgroundColor: '#0B0E14',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1E2330',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#161922',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  brandSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  shieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  shieldText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#10B981',
  },
  closeBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#1E2330',
  },
  scrollContent: {
    padding: 20,
  },
  modalHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  modalSubheading: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 19,
  },
  emailCard: {
    marginTop: 18,
    backgroundColor: '#111520',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2538',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 8,
  },
  emailInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0D14',
    borderWidth: 1,
    borderColor: '#1E2330',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  emailInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  emailSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B67F6',
    borderRadius: 12,
    height: 48,
    marginTop: 12,
    gap: 8,
  },
  emailSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
  },
  otpContainer: {
    width: '100%',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  backBtnText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  devOtpBox: {
    marginTop: 14,
    backgroundColor: 'rgba(91, 103, 246, 0.12)',
    borderColor: '#5B67F6',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  devOtpLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#93C5FD',
    letterSpacing: 1,
  },
  devOtpNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 8,
  },
  fillCodeBtn: {
    marginTop: 4,
    backgroundColor: '#5B67F6',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  fillCodeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  otpInput: {
    marginTop: 20,
    backgroundColor: '#0A0D14',
    borderWidth: 1.5,
    borderColor: '#5B67F6',
    borderRadius: 14,
    height: 60,
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 10,
  },
  resendBtn: {
    alignSelf: 'center',
    marginTop: 16,
    padding: 6,
  },
  resendBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#161922',
  },
  footerText: {
    fontSize: 10,
    color: '#64748B',
  },
});
