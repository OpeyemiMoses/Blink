import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  Shield,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  X as XIcon,
} from 'lucide-react-native';
import { usePrivy, useWallets, useLoginWithOAuth } from '../auth/privyAdapter';
import { BlinkBrandMark } from './BrandLogos';
import { PrivyIcon } from './PrivyIcon';
import {
  EmailLogo,
  GoogleLogo,
  GithubLogo,
  XLogo,
  DiscordLogo,
} from './SocialLogos';
import { PhantomIcon } from './WalletIcons';

export const PrivyWebAuthBridge: React.FC = () => {
  const {
    login,
    logout,
    authenticated,
    user,
    ready,
    linkEmail,
    linkGoogle,
    linkTwitter,
    linkDiscord,
    linkGithub,
  } = usePrivy() as any;

  const { wallets } = useWallets();

  const [mode, setMode] = useState<string>('login');
  const [provider, setProvider] = useState<string | null>(null);
  const [authSuccessSent, setAuthSuccessSent] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setMode(params.get('mode') || 'login');
      setProvider(params.get('provider') || null);
    }
  }, []);

  const activeWallet =
    wallets?.find((w: any) => w.chainType === 'solana') ||
    wallets?.[0] ||
    user?.wallet ||
    user?.linkedAccounts?.find((a: any) => a.type === 'wallet');

  // Trigger link action if mode is 'link' and provider is specified
  useEffect(() => {
    if (ready && mode === 'link' && provider) {
      if (provider === 'google' && typeof linkGoogle === 'function') linkGoogle();
      else if (provider === 'twitter' && typeof linkTwitter === 'function') linkTwitter();
      else if (provider === 'discord' && typeof linkDiscord === 'function') linkDiscord();
      else if (provider === 'github' && typeof linkGithub === 'function') linkGithub();
      else if (provider === 'email' && typeof linkEmail === 'function') linkEmail();
    }
  }, [ready, mode, provider]);

  // Post auth success to React Native WebView parent
  useEffect(() => {
    if (authenticated && user && !authSuccessSent) {
      const payload = {
        type: mode === 'link' ? 'PRIVY_LINK_SUCCESS' : 'PRIVY_AUTH_SUCCESS',
        user: {
          id: user.id,
          email: user.email?.address || (user.google as any)?.email || null,
          google: user.google ? { email: (user.google as any).email, name: (user.google as any).name } : null,
          twitter: user.twitter ? { username: (user.twitter as any).username, name: (user.twitter as any).name } : null,
          discord: user.discord ? { username: (user.discord as any).username } : null,
          github: user.github ? { username: (user.github as any).username } : null,
          wallet: activeWallet ? { address: activeWallet.address, chainType: 'solana' } : null,
          linkedAccounts: user.linkedAccounts || [],
        },
      };

      if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify(payload));
        setAuthSuccessSent(true);
      }
    }
  }, [authenticated, user, activeWallet, authSuccessSent, mode]);

  const handleClose = () => {
    if (typeof window !== 'undefined' && (window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'PRIVY_AUTH_CANCEL' }));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <BlinkBrandMark size={36} />
            <View>
              <Text style={styles.title}>BLINK</Text>
              <Text style={styles.subtitle}>Privy Authentication Gateway</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <XIcon size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {authenticated && user ? (
          <View style={styles.successBox}>
            <CheckCircle2 size={44} color="#10B981" />
            <Text style={styles.successTitle}>Authentication Verified</Text>
            <Text style={styles.successDesc}>
              Connected securely to Privy. Synchronizing profile and embedded Solana wallet with your mobile app...
            </Text>
            <ActivityIndicator size="small" color="#5B67F6" style={{ marginTop: 12 }} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.nonCustodialBadge}>
              <Shield size={12} color="#10B981" />
              <Text style={styles.nonCustodialText}>Decentralized & Non-Custodial</Text>
            </View>

            <Text style={styles.heading}>
              {mode === 'link' ? `Link ${provider ? provider.toUpperCase() : 'Account'}` : 'Sign In or Create Account'}
            </Text>
            <Text style={styles.subtext}>
              {mode === 'link'
                ? `Connect your ${provider || 'social'} identity securely via Privy.`
                : 'Choose your preferred login method to access your embedded Solana wallet.'}
            </Text>

            {/* Quick Action Buttons */}
            <View style={styles.buttonList}>
              <TouchableOpacity
                style={[styles.loginBtn, { backgroundColor: '#1A1D26', borderColor: '#2A2F3D' }]}
                onPress={() => login({ loginMethods: ['google'] })}
              >
                <GoogleLogo size={20} />
                <Text style={styles.loginBtnText}>Continue with Google</Text>
                <ArrowRight size={16} color="#64748B" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginBtn, { backgroundColor: '#1A1D26', borderColor: '#2A2F3D' }]}
                onPress={() => login({ loginMethods: ['email'] })}
              >
                <EmailLogo size={20} />
                <Text style={styles.loginBtnText}>Continue with Email OTP</Text>
                <ArrowRight size={16} color="#64748B" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginBtn, { backgroundColor: '#1A1D26', borderColor: '#2A2F3D' }]}
                onPress={() => login({ loginMethods: ['twitter'] })}
              >
                <XLogo size={20} />
                <Text style={styles.loginBtnText}>Continue with X (Twitter)</Text>
                <ArrowRight size={16} color="#64748B" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginBtn, { backgroundColor: '#1A1D26', borderColor: '#2A2F3D' }]}
                onPress={() => login({ loginMethods: ['discord'] })}
              >
                <DiscordLogo size={20} />
                <Text style={styles.loginBtnText}>Continue with Discord</Text>
                <ArrowRight size={16} color="#64748B" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginBtn, { backgroundColor: '#1A1D26', borderColor: '#2A2F3D' }]}
                onPress={() => login({ loginMethods: ['wallet'] })}
              >
                <PhantomIcon size={20} />
                <Text style={styles.loginBtnText}>Connect Solana Wallet</Text>
                <ArrowRight size={16} color="#64748B" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginBtn, { backgroundColor: '#5B67F6', borderColor: '#4F5BE8', marginTop: 8 }]}
                onPress={() => login()}
              >
                <PrivyIcon size={20} />
                <Text style={[styles.loginBtnText, { color: '#FFFFFF', fontWeight: '800' }]}>
                  All Privy Sign-In Options
                </Text>
                <ArrowRight size={16} color="#FFFFFF" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F1117',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2330',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2330',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161922',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  nonCustodialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  nonCustodialText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '700',
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtext: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  buttonList: {
    width: '100%',
    gap: 10,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  loginBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  successBox: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
  },
  successDesc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
});
