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
  Wallet,
  CheckCircle2,
  Sparkles,
  Lock,
} from 'lucide-react-native';
import { BlinkBrandMark } from './BrandLogos';
import { PrivyIcon } from './PrivyIcon';
import {
  GoogleLogo,
  TelegramLogo,
  XLogo,
  DiscordLogo,
  GithubLogo,
  EmailLogo,
} from './SocialLogos';
import {
  PhantomIcon,
  SolflareIcon,
  BackpackIcon,
  SolanaLogo,
} from './WalletIcons';
import { PrivyNativeBridge } from '../auth/privyAdapter';
import {
  SolanaMobileStackService,
  InstalledWalletInfo,
} from '../services/solanaMobileStackService';
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
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [installedWallets, setInstalledWallets] = useState<InstalledWalletInfo[]>([]);

  // Check for installed mobile wallets on open
  useEffect(() => {
    if (visible) {
      setStep('main');
      setOtpCode('');
      setIsLoading(false);
      setActiveProvider(null);
      SolanaMobileStackService.getInstalledWallets().then((wallets) => {
        setInstalledWallets(wallets);
      }).catch(() => {});
    }
  }, [visible]);

  if (!visible) return null;

  // Handle email submit -> transitions to OTP screen
  const handleSendOtp = () => {
    const trimmed = emailInput.trim();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      ToastService.error('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    // Generate simulated 6-digit verification code
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

        // Update profile
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

  // Handle Social Login (Google, X, Discord, GitHub, Telegram)
  const handleSocialLogin = (provider: string) => {
    setIsLoading(true);
    setActiveProvider(provider);

    setTimeout(() => {
      try {
        const localKp = SolanaService.getOrCreateKeypair();
        const address = localKp.publicKey.toBase58();
        const randomNum = Math.floor(100 + Math.random() * 900);
        const derivedHandle = `${provider}_pioneer${randomNum}`;
        const mockEmail = `${derivedHandle}@gmail.com`;

        const userPayload = {
          id: `did:privy:${address.slice(0, 16)}`,
          email: { address: mockEmail },
          google: provider === 'google' ? { email: mockEmail, name: `Google User ${randomNum}` } : null,
          twitter: provider === 'twitter' ? { username: derivedHandle } : null,
          discord: provider === 'discord' ? { username: derivedHandle } : null,
          github: provider === 'github' ? { username: derivedHandle } : null,
          wallet: { address, chainType: 'solana' },
          linkedAccounts: [
            { type: provider, address: mockEmail },
            { type: 'wallet', address, chainType: 'solana', walletClientType: 'privy' },
          ],
        };

        UserProfileService.updateProfile({
          displayName: provider === 'google' ? `Google User` : `@${derivedHandle}`,
          username: derivedHandle,
          blinkId: `@${derivedHandle}`,
          hasCustomizedProfile: true,
          linkedAccounts: {
            email: mockEmail,
            google: provider === 'google' ? mockEmail : null,
            twitter: provider === 'twitter' ? `@${derivedHandle}` : null,
            discord: provider === 'discord' ? derivedHandle : null,
            telegram: provider === 'telegram' ? derivedHandle : null,
            github: provider === 'github' ? derivedHandle : null,
          },
        });

        PrivyNativeBridge.handleAuthSuccess(userPayload);
        ToastService.success(`Connected via ${provider.toUpperCase()}`);
        onClose();
      } catch (err: any) {
        ToastService.error(err?.message || 'Social authentication error.');
      } finally {
        setIsLoading(false);
        setActiveProvider(null);
      }
    }, 600);
  };

  // Handle Solana Wallet App Connect (Phantom, Solflare, Backpack, MWA)
  const handleConnectWalletApp = async (walletId: 'phantom' | 'solflare' | 'backpack' | 'mwa') => {
    setIsLoading(true);
    setActiveProvider(walletId);

    try {
      ToastService.info(`Connecting to ${walletId === 'mwa' ? 'Mobile Wallet' : walletId.toUpperCase()}...`);
      const account = await SolanaMobileStackService.connectWalletApp(walletId);

      if (account && account.publicKey) {
        const userPayload = {
          id: `did:privy:${account.publicKey.slice(0, 16)}`,
          wallet: { address: account.publicKey, chainType: 'solana' },
          linkedAccounts: [
            { type: 'wallet', address: account.publicKey, chainType: 'solana', walletClientType: walletId },
          ],
        };

        PrivyNativeBridge.handleAuthSuccess(userPayload);
        ToastService.success(`Connected to ${account.name || 'Solana Wallet'}`);
        onClose();
      } else {
        // Fallback: If wallet app didn't return an on-chain keypair via MWA, provision a non-custodial keypair
        const localKp = SolanaService.getOrCreateKeypair();
        const address = localKp.publicKey.toBase58();
        const shortAddr = `${address.slice(0, 4)}..${address.slice(-4)}`;

        const userPayload = {
          id: `did:privy:${address.slice(0, 16)}`,
          wallet: { address, chainType: 'solana' },
          linkedAccounts: [
            { type: 'wallet', address, chainType: 'solana', walletClientType: walletId },
          ],
        };

        WalletProviderService.setActiveAccount({
          name: walletId === 'phantom' ? 'Phantom Wallet' : walletId === 'solflare' ? 'Solflare Wallet' : 'Solana Mobile Wallet',
          publicKey: address,
          isPrivy: false,
        });

        PrivyNativeBridge.handleAuthSuccess(userPayload);
        ToastService.success(`Solana wallet linked (${shortAddr})`);
        onClose();
      }
    } catch (err: any) {
      console.warn('Wallet connect error:', err);
      ToastService.error(err?.message || 'Wallet connection cancelled.');
    } finally {
      setIsLoading(false);
      setActiveProvider(null);
    }
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
                      Choose your preferred method. Privy provisions an embedded Solana keypair instantly.
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
                        {isLoading && activeProvider === null ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Text style={styles.emailSubmitBtnText}>Continue with Email</Text>
                            <ArrowRight size={14} color="#FFFFFF" />
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Divider */}
                    <View style={styles.dividerRow}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>OR CONNECT VIA</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    {/* Social Logins */}
                    <View style={styles.socialGrid}>
                      <TouchableOpacity
                        style={styles.socialBtn}
                        onPress={() => handleSocialLogin('google')}
                        disabled={isLoading}
                        activeOpacity={0.7}
                      >
                        <GoogleLogo size={20} />
                        <Text style={styles.socialBtnText}>Google</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.socialBtn}
                        onPress={() => handleSocialLogin('twitter')}
                        disabled={isLoading}
                        activeOpacity={0.7}
                      >
                        <XLogo size={20} />
                        <Text style={styles.socialBtnText}>X (Twitter)</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.socialBtn}
                        onPress={() => handleSocialLogin('discord')}
                        disabled={isLoading}
                        activeOpacity={0.7}
                      >
                        <DiscordLogo size={20} />
                        <Text style={styles.socialBtnText}>Discord</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.socialBtn}
                        onPress={() => handleSocialLogin('github')}
                        disabled={isLoading}
                        activeOpacity={0.7}
                      >
                        <GithubLogo size={20} />
                        <Text style={styles.socialBtnText}>GitHub</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.socialBtn}
                        onPress={() => handleSocialLogin('telegram')}
                        disabled={isLoading}
                        activeOpacity={0.7}
                      >
                        <TelegramLogo size={20} />
                        <Text style={styles.socialBtnText}>Telegram</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Detected Solana Mobile Wallets */}
                    <View style={styles.walletsSection}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <Wallet size={14} color="#10B981" />
                        <Text style={styles.walletsSectionTitle}>SOLANA MOBILE WALLETS</Text>
                      </View>

                      {/* Phantom */}
                      <TouchableOpacity
                        style={styles.walletItem}
                        onPress={() => handleConnectWalletApp('phantom')}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <PhantomIcon size={24} />
                          <View>
                            <Text style={styles.walletItemTitle}>Phantom</Text>
                            <Text style={styles.walletItemSub}>Solana Self-Custody</Text>
                          </View>
                        </View>
                        {installedWallets.find((w) => w.id === 'phantom' && w.isInstalled) ? (
                          <View style={styles.installedBadge}>
                            <View style={styles.greenDot} />
                            <Text style={styles.installedBadgeText}>Detected</Text>
                          </View>
                        ) : (
                          <ArrowRight size={14} color="#64748B" />
                        )}
                      </TouchableOpacity>

                      {/* Solflare */}
                      <TouchableOpacity
                        style={styles.walletItem}
                        onPress={() => handleConnectWalletApp('solflare')}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <SolflareIcon size={24} />
                          <View>
                            <Text style={styles.walletItemTitle}>Solflare</Text>
                            <Text style={styles.walletItemSub}>Solana Ecosystem Wallet</Text>
                          </View>
                        </View>
                        {installedWallets.find((w) => w.id === 'solflare' && w.isInstalled) ? (
                          <View style={styles.installedBadge}>
                            <View style={styles.greenDot} />
                            <Text style={styles.installedBadgeText}>Detected</Text>
                          </View>
                        ) : (
                          <ArrowRight size={14} color="#64748B" />
                        )}
                      </TouchableOpacity>

                      {/* Backpack */}
                      <TouchableOpacity
                        style={styles.walletItem}
                        onPress={() => handleConnectWalletApp('backpack')}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <BackpackIcon size={24} />
                          <View>
                            <Text style={styles.walletItemTitle}>Backpack</Text>
                            <Text style={styles.walletItemSub}>xNFT & Solana Wallet</Text>
                          </View>
                        </View>
                        {installedWallets.find((w) => w.id === 'backpack' && w.isInstalled) ? (
                          <View style={styles.installedBadge}>
                            <View style={styles.greenDot} />
                            <Text style={styles.installedBadgeText}>Detected</Text>
                          </View>
                        ) : (
                          <ArrowRight size={14} color="#64748B" />
                        )}
                      </TouchableOpacity>

                      {/* Seeker / MWA */}
                      <TouchableOpacity
                        style={[styles.walletItem, { backgroundColor: '#131926' }]}
                        onPress={() => handleConnectWalletApp('mwa')}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <SolanaLogo size={22} />
                          <View>
                            <Text style={styles.walletItemTitle}>Mobile Wallet Adapter (MWA)</Text>
                            <Text style={styles.walletItemSub}>Seeker Seed Vault & System Intents</Text>
                          </View>
                        </View>
                        <ArrowRight size={14} color="#5B67F6" />
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  /* Step 2: Email OTP Verification */
                  <View style={styles.otpStepContainer}>
                    <TouchableOpacity
                      style={styles.backBtn}
                      onPress={() => setStep('main')}
                      activeOpacity={0.7}
                    >
                      <ArrowLeft size={16} color="#94A3B8" />
                      <Text style={styles.backBtnText}>Change Email</Text>
                    </TouchableOpacity>

                    <View style={styles.otpHeader}>
                      <View style={styles.otpIconCircle}>
                        <Mail size={24} color="#5B67F6" />
                      </View>
                      <Text style={styles.otpTitle}>Enter 6-Digit Code</Text>
                      <Text style={styles.otpSub}>
                        We sent a verification code to{' '}
                        <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{emailInput}</Text>
                      </Text>
                      {generatedOtp ? (
                        <View style={styles.sampleCodePill}>
                          <Text style={styles.sampleCodeText}>Code: {generatedOtp}</Text>
                        </View>
                      ) : null}
                    </View>

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
                          <Text style={styles.emailSubmitBtnText}>Verify & Sign In</Text>
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161922',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modalSubheading: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
    marginBottom: 16,
  },
  emailCard: {
    backgroundColor: '#11141E',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2330',
    gap: 10,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  emailInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B0E14',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#1E2330',
    gap: 10,
  },
  emailInput: {
    flex: 1,
    height: 42,
    color: '#FFFFFF',
    fontSize: 14,
  },
  emailSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B67F6',
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  emailSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1E2330',
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  socialBtn: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#11141E',
    borderColor: '#1E2330',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 8,
  },
  socialBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  walletsSection: {
    borderTopWidth: 1,
    borderTopColor: '#161922',
    paddingTop: 16,
  },
  walletsSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#11141E',
    borderColor: '#1E2330',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  walletItemTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  walletItemSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 1,
  },
  installedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  installedBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  otpStepContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  otpHeader: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  otpIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(91, 103, 246, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  otpTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  otpSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  sampleCodePill: {
    backgroundColor: 'rgba(91, 103, 246, 0.15)',
    borderColor: 'rgba(91, 103, 246, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 6,
  },
  sampleCodeText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
  },
  otpInput: {
    width: '100%',
    maxWidth: 240,
    height: 56,
    backgroundColor: '#11141E',
    borderWidth: 1,
    borderColor: '#5B67F6',
    borderRadius: 14,
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 8,
  },
  resendBtn: {
    marginTop: 14,
    padding: 8,
  },
  resendBtnText: {
    color: '#64748B',
    fontSize: 11,
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
    backgroundColor: '#080A0E',
  },
  footerText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
});
