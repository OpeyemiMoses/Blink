import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import {
  toSolanaWalletConnectors,
  useWallets as useSolanaWallets,
  useCreateWallet as useCreateSolanaWallet,
  useSignAndSendTransaction,
  useSignTransaction,
  defaultSolanaRpcsPlugin,
} from '@privy-io/react-auth/solana';
import bs58 from 'bs58';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

import { Header } from './src/components/Header';
import { MarketsScreen } from './src/screens/MarketsScreen';
import { SavedBlinksScreen } from './src/screens/SavedBlinksScreen';
import { PocketScreen } from './src/screens/PocketScreen';
import { TapScanScreen } from './src/screens/TapScanScreen';
import { StudioScreen } from './src/screens/StudioScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

import { FloatingMobileNav, TabKey } from './src/components/FloatingMobileNav';
import { DesktopSidebar } from './src/components/DesktopSidebar';
import { BlinkDetailModal } from './src/components/BlinkDetailModal';
import { CreateBlinkModal } from './src/components/CreateBlinkModal';
import { DatabaseService } from './src/services/databaseService';

import { SendModal } from './src/components/SendModal';
import { ReceiveModal } from './src/components/ReceiveModal';
import { SeedVaultModal } from './src/components/SeedVaultModal';
import { ReceiptModal } from './src/components/ReceiptModal';
import { AboutBlinkModal } from './src/components/AboutBlinkModal';
import { NotificationsModal } from './src/components/NotificationsModal';
import { SettingsModal } from './src/components/SettingsModal';
import { NotificationService } from './src/services/notificationService';
import { LaunchSplashScreen } from './src/components/LaunchSplashScreen';
import { WelcomeAuthScreen } from './src/components/WelcomeAuthScreen';

import { SolanaService } from './src/services/solanaService';
import { WalletProviderService, WalletAccount } from './src/services/walletProviderService';
import { BlinkEngine } from './src/services/blinkEngine';
import { SolanaMobileStackService } from './src/services/solanaMobileStackService';
import { UserProfileService, UserProfile } from './src/services/userProfileService';
import { BlinkIdService } from './src/services/blinkIdService';
import { PhysicalBlink } from './src/services/physicalBlinkRegistry';
import { LinkedAction, SolanaActionMetadata, TransactionReceipt } from './src/types';
import { Toast } from './src/components/Toast';
import { ToastService } from './src/services/toastService';
import { PickUsernameModal } from './src/components/PickUsernameModal';

const solanaConnectors = toSolanaWalletConnectors();

function BlinkMainApp() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { colors, toggleTheme, isDark, theme } = useTheme();

  // Real Privy authentication & account management
  const { login, logout, authenticated, user, ready } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { createWallet: createSolanaWallet } = useCreateSolanaWallet();
  const { signAndSendTransaction: privySignAndSend } = useSignAndSendTransaction();
  const { signTransaction: privySignTransaction } = useSignTransaction();

  const [currentTab, setCurrentTab] = useState<TabKey>('markets');
  const [balanceSol, setBalanceSol] = useState<number>(0);
  const [balanceUsdc, setBalanceUsdc] = useState<number>(0);
  const [network] = useState<'devnet'>('devnet');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Splash Screen & Guest mode state
  const [showSplash, setShowSplash] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => UserProfileService.getProfile());

  useEffect(() => {
    const handleProfileUpdate = () => {
      setUserProfile(UserProfileService.getProfile());
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('blink_profile_updated', handleProfileUpdate);
      return () => window.removeEventListener('blink_profile_updated', handleProfileUpdate);
    }
  }, []);

  // Prevent mobile browser auto-zoom when tapping text inputs
  useEffect(() => {
    if (typeof document !== 'undefined') {
      let meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'viewport');
        document.head.appendChild(meta);
      }
      meta.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no'
      );

      const styleId = 'anti-zoom-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          input, textarea, select {
            font-size: 16px !important;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  // Detail Modal for Screenshot 2 view
  const [selectedDetailBlink, setSelectedDetailBlink] = useState<PhysicalBlink | null>(null);

  useEffect(() => {
    const handleBlinkDeleted = (e: any) => {
      const deletedId = e?.detail?.id;
      if (deletedId && selectedDetailBlink?.id && selectedDetailBlink.id.toLowerCase() === String(deletedId).toLowerCase()) {
        setSelectedDetailBlink(null);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('blink_deleted', handleBlinkDeleted);
      window.addEventListener('tapblink_blink_deleted', handleBlinkDeleted);
      return () => {
        window.removeEventListener('blink_deleted', handleBlinkDeleted);
        window.removeEventListener('tapblink_blink_deleted', handleBlinkDeleted);
      };
    }
  }, [selectedDetailBlink?.id]);

  // Modals
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [receiveModalVisible, setReceiveModalVisible] = useState(false);
  const [seedVaultModalVisible, setSeedVaultModalVisible] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [createBlinkModalVisible, setCreateBlinkModalVisible] = useState(false);
  const [pickUsernameModalVisible, setPickUsernameModalVisible] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(() => NotificationService.getUnreadCount());

  useEffect(() => {
    const handleNotifsUpdate = () => {
      setUnreadNotificationsCount(NotificationService.getUnreadCount());
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('tapblink_notifications_updated', handleNotifsUpdate);
      return () => window.removeEventListener('tapblink_notifications_updated', handleNotifsUpdate);
    }
  }, []);

  // Active action
  const [pendingAction, setPendingAction] = useState<SolanaActionMetadata | null>(null);
  const [pendingLink, setPendingLink] = useState<LinkedAction | null>(null);
  const [lastReceipt, setLastReceipt] = useState<TransactionReceipt | null>(null);

  // Derive active Solana account from Privy
  const existingLinkedWallet = user?.linkedAccounts?.find(
    (acc: any) => acc.type === 'wallet' && (acc.chainType === 'solana' || acc.walletClientType === 'privy')
  ) as any;

  const activeSolanaWallet =
    solanaWallets?.find((w: any) => w.chainType === 'solana') ||
    solanaWallets?.[0] ||
    (existingLinkedWallet ? { address: existingLinkedWallet.address, chainType: 'solana' } : null);

  const solanaAddress =
    activeSolanaWallet?.address ||
    existingLinkedWallet?.address ||
    user?.wallet?.address ||
    null;

  const hasExistingWallet = Boolean(
    solanaAddress ||
    existingLinkedWallet ||
    user?.wallet?.address ||
    (solanaWallets && solanaWallets.length > 0)
  );

  // Auto-provision embedded Solana wallet ONLY if brand new account with NO wallet existing
  const creationAttemptedRef = React.useRef(false);
  useEffect(() => {
    if (ready && authenticated && user && !hasExistingWallet && createSolanaWallet && !creationAttemptedRef.current) {
      creationAttemptedRef.current = true;
      createSolanaWallet().catch((err: any) => {
        const msg = err?.message || String(err);
        if (!msg.includes('already has') && !msg.includes('already exists')) {
          console.warn('Auto create Solana wallet error:', err);
        }
      });
    }
  }, [ready, authenticated, user?.id, hasExistingWallet]);

  // Stable devnet fallback address if Solana wallet is provisioning
  const fallbackSolanaAddress = React.useMemo(() => {
    if (user?.id) {
      const cleanId = user.id.replace(/[^a-zA-Z0-9]/g, '');
      return `Sol${cleanId.slice(-32).padEnd(32, '1')}`;
    }
    return null;
  }, [user?.id]);

  const effectiveAddress = solanaAddress || fallbackSolanaAddress;

  // Open profile handler: if guest, opens Privy sign-up / sign-in directly
  const handleOpenProfile = () => {
    if (!authenticated) {
      login();
    } else {
      setCurrentTab('profile');
    }
  };

  const activeAccount: WalletAccount | null =
    authenticated && effectiveAddress
      ? {
          name: (userProfile.displayName && userProfile.displayName !== 'Seeker Pioneer')
            ? userProfile.displayName
            : user?.email?.address
            ? user.email.address
            : user?.google
            ? (user.google.email || (user.google as any)?.name || 'Google User')
            : user?.twitter
            ? `@${user.twitter.username}`
            : user?.github
            ? `@${user.github.username}`
            : user?.discord
            ? (user.discord.username || 'Discord User')
            : user?.telegram
            ? `@${user.telegram.username}`
            : activeSolanaWallet?.walletClientType === 'phantom'
            ? 'Phantom'
            : activeSolanaWallet?.walletClientType === 'solflare'
            ? 'Solflare'
            : userProfile.displayName || 'Privy Solana Wallet',
          publicKey: effectiveAddress,
          isPrivy: true,
        }
      : null;

  // Ensure unauthenticated users never have a profile page to navigate to
  useEffect(() => {
    if (!authenticated || !activeAccount) {
      if (currentTab === 'profile') {
        setCurrentTab('markets');
      }
    }
  }, [authenticated, activeAccount, currentTab]);

  // Persist user account into database when authenticated
  useEffect(() => {
    if (authenticated && activeAccount?.publicKey) {
      DatabaseService.saveUserAccount({
        id: activeAccount.publicKey,
        address: activeAccount.publicKey,
        publicKey: activeAccount.publicKey,
        displayName: activeAccount.name,
        name: activeAccount.name,
        createdAt: Date.now(),
        avatarUrl: userProfile.avatarUrl,
      });
    }
  }, [authenticated, activeAccount?.publicKey, activeAccount?.name, userProfile.avatarUrl]);

  // Cloud Account Restoration across devices & Google/Custom auto-derivation
  useEffect(() => {
    if (!authenticated || !user) return;

    const lookupKey = effectiveAddress || user?.email?.address || user?.id;
    if (!lookupKey) return;

    // Check cloud database first to restore profile on this device
    DatabaseService.syncUserFromCloud(lookupKey).then(async (cloudUser) => {
      if (cloudUser && cloudUser.username && cloudUser.username !== 'seeker_user') {
        const restored = UserProfileService.updateProfile({
          displayName: cloudUser.displayName,
          username: cloudUser.username,
          avatarUrl: cloudUser.avatarUrl || userProfile.avatarUrl,
          bio: cloudUser.bio || userProfile.bio,
          hasCustomizedProfile: true,
        });
        setUserProfile(restored);
        PhysicalBlinkRegistry.syncFromCloud();
        return;
      }

      // If no customized profile on cloud, proceed with onboarding derivation
      const googleAccount =
        user.google ||
        (user.linkedAccounts?.find((acc: any) => acc.type === 'google_oauth') as any);

      const googleEmail =
        user.google?.email ||
        googleAccount?.email ||
        (user.email?.address && user.email.address.toLowerCase().endsWith('@gmail.com') ? user.email.address : null);

      const isGoogleAuth = Boolean(googleEmail);
      const currentProf = UserProfileService.getProfile();

      if (isGoogleAuth && googleEmail) {
        if (!currentProf.hasCustomizedProfile || currentProf.username === 'seeker_user') {
          const googleName = user.google?.name || googleAccount?.name;
          const { profile: updated, wasUsernameTaken, assignedUsername, originalRequested } =
            await UserProfileService.setupGoogleProfileAsync(googleEmail, googleName, effectiveAddress || undefined);
          setUserProfile(updated);
          if (effectiveAddress) {
            DatabaseService.saveUserAccount({
              id: effectiveAddress,
              address: effectiveAddress,
              publicKey: effectiveAddress,
              displayName: updated.displayName,
              username: updated.username,
              name: updated.displayName,
              avatarUrl: updated.avatarUrl,
              createdAt: Date.now(),
            });
            BlinkIdService.registerBlinkId(`@${updated.username}`, effectiveAddress, updated.displayName, updated.avatarUrl);
          }
          if (wasUsernameTaken) {
            ToastService.info(
              `Welcome! Note: @${originalRequested} was already taken, so you were assigned unique handle @${assignedUsername}. You can change it anytime in Profile.`
            );
          } else {
            ToastService.success(`Welcome @${updated.username}! Signed in via Google.`);
          }
        }
      } else {
        if (!currentProf.hasCustomizedProfile && currentProf.username === 'seeker_user') {
          setPickUsernameModalVisible(true);
        }
      }
    });
  }, [authenticated, user?.id, effectiveAddress]);

  // Sync active account and signer with WalletProviderService
  useEffect(() => {
    WalletProviderService.setActiveAccount(activeAccount);

    if (activeSolanaWallet && (privySignTransaction || privySignAndSend)) {
      WalletProviderService.setPrivySigner(async (tx) => {
        const connection = SolanaService.getConnection();
        const serialized = tx.serialize({ requireAllSignatures: false });

        // Approach 1: Try signTransaction first, then broadcast directly via our SolanaService connection
        if (privySignTransaction) {
          try {
            const signRes = await privySignTransaction({
              transaction: serialized,
              wallet: activeSolanaWallet,
              chain: 'solana:devnet',
            });
            const signedRaw = (signRes as any)?.signedTransaction || (signRes as any)?.transaction || signRes;
            if (signedRaw) {
              const rawBytes = typeof signedRaw === 'string'
                ? bs58.decode(signedRaw)
                : signedRaw instanceof Uint8Array
                ? signedRaw
                : Buffer.from(signedRaw);

              const sig = await connection.sendRawTransaction(rawBytes, {
                skipPreflight: true,
                preflightCommitment: 'confirmed',
              });
              console.log('Successfully broadcasted transaction to Solana Devnet:', sig);
              return sig;
            }
          } catch (signErr: any) {
            console.warn('privySignTransaction error, falling back:', signErr);
            const errMsg = signErr?.message || String(signErr);
            if (/reject|cancel|denied|dismiss/i.test(errMsg)) {
              throw signErr;
            }
          }
        }

        // Approach 2: privySignAndSend fallback
        if (privySignAndSend) {
          try {
            const res = await privySignAndSend({
              transaction: serialized,
              wallet: activeSolanaWallet,
              chain: 'solana:devnet',
              options: {
                sponsor: false,
                optimisticBroadcast: true,
                skipSimulation: true,
              },
            });
            const sig = typeof res.signature === 'string' ? res.signature : bs58.encode(res.signature);
            return sig;
          } catch (privyErr: any) {
            const errMsg = privyErr?.message || String(privyErr);
            console.warn('Privy signAndSend threw, checking if tx landed:', errMsg);

            if (/reject|cancel|denied|dismiss/i.test(errMsg)) {
              throw privyErr;
            }

            if (privyErr?.signature) {
              const sig = typeof privyErr.signature === 'string' ? privyErr.signature : bs58.encode(privyErr.signature);
              return sig;
            }

            const sigMatch = errMsg.match(/[1-9A-HJ-NP-Za-km-z]{44,}/);
            if (sigMatch) {
              return sigMatch[0];
            }

            throw privyErr;
          }
        }

        throw new Error('No Solana signing provider available');
      });
    } else {
      WalletProviderService.setPrivySigner(null);
    }
  }, [activeAccount?.publicKey, activeSolanaWallet, privySignAndSend, privySignTransaction]);

  // Continuously detect live on-chain balance when account changes or on interval
  useEffect(() => {
    let isCancelled = false;

    // Immediately seed with cached balance if available to prevent 0.00 flash
    if (activeAccount?.publicKey) {
      const cachedSol = SolanaService.getCachedSol(activeAccount.publicKey);
      const cachedUsdc = SolanaService.getCachedUsdc(activeAccount.publicKey);
      if (cachedSol !== null) setBalanceSol(cachedSol);
      if (cachedUsdc !== null) setBalanceUsdc(cachedUsdc);
    }

    const prevBal = { sol: balanceSol, usdc: balanceUsdc };

    const updateBalance = async () => {
      if (activeAccount?.publicKey) {
        try {
          const [sol, usdc] = await Promise.all([
            SolanaService.getBalance(activeAccount.publicKey),
            SolanaService.getUsdcBalance(activeAccount.publicKey),
          ]);
          if (!isCancelled) {
            let changed = false;
            if (typeof sol === 'number' && !isNaN(sol)) {
              if (Math.abs(prevBal.sol - sol) > 0.00005) {
                changed = true;
                prevBal.sol = sol;
              }
              setBalanceSol(sol);
            }
            if (typeof usdc === 'number' && !isNaN(usdc)) {
              if (Math.abs(prevBal.usdc - usdc) > 0.005) {
                changed = true;
                prevBal.usdc = usdc;
              }
              setBalanceUsdc(usdc);
            }
            if (changed && typeof window !== 'undefined') {
              // Automatically notify screens of new on-chain funds arrival
              window.dispatchEvent(new CustomEvent('blink_tx_updated', { detail: { reason: 'balance_change' } }));
            }
          }
        } catch (err) {
          // Never wipe out balance on temporary RPC drop or rate limit
          console.warn('Silent balance polling error, retaining last known balance:', err);
        }
      } else {
        if (!isCancelled) {
          setBalanceSol(0);
          setBalanceUsdc(0);
        }
      }
    };

    updateBalance();
    // 20-second interval is polite and prevents Devnet 429 rate-limiting
    const interval = setInterval(updateBalance, 20000);

    // Refresh immediately when tab gains focus or on tx events
    const onWindowFocus = () => {
      updateBalance();
    };
    const onExternalTx = () => {
      updateBalance();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onWindowFocus);
      window.addEventListener('blink_tx_updated', onExternalTx);
      window.addEventListener('blink_balance_refresh', onExternalTx);
    }

    return () => {
      isCancelled = true;
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onWindowFocus);
        window.removeEventListener('blink_tx_updated', onExternalTx);
        window.removeEventListener('blink_balance_refresh', onExternalTx);
      }
    };
  }, [activeAccount?.publicKey, refreshTrigger]);

  // Synchronize and register unique Blink ID whenever active account or profile updates
  useEffect(() => {
    if (activeAccount?.publicKey) {
      const handle = BlinkIdService.formatBlinkId(userProfile.username || userProfile.displayName, activeAccount.publicKey);
      BlinkIdService.registerBlinkId(handle, activeAccount.publicKey, userProfile.displayName, userProfile.avatarUrl);
    }
  }, [activeAccount?.publicKey, userProfile.username, userProfile.displayName, userProfile.avatarUrl]);

  const activePublicKey = activeAccount?.publicKey || null;

  const handleExecuteAction = async (action: SolanaActionMetadata, link: LinkedAction) => {
    if (!activeAccount) {
      login();
      return;
    }

    // Biometric Security Check: Fingerprint / Face ID / PIN
    const bioResult = await SolanaMobileStackService.authorizePaymentWithDeviceBiometrics(
      action.title,
      link.label || 'Action'
    );

    if (bioResult.authorized) {
      // Biometrics succeeded: automatically execute without manual signing prompt
      try {
        const receipt = await BlinkEngine.executeAction(
          action,
          link,
          activePublicKey!
        );
        setLastReceipt(receipt);
        setReceiptModalVisible(true);
        setRefreshTrigger((prev) => prev + 1);
      } catch (err: any) {
        console.error('Blink execution error:', err);
      }
      return;
    }

    if (bioResult.needsManualSigning) {
      // Default to manual transaction signing modal if device has no enrolled biometrics/PIN
      setPendingAction(action);
      setPendingLink(link);
      setSeedVaultModalVisible(true);
    }
  };

  const handleApproveSeedVault = async () => {
    if (!pendingAction || !pendingLink || !activePublicKey) return;

    try {
      const receipt = await BlinkEngine.executeAction(
        pendingAction,
        pendingLink,
        activePublicKey
      );

      setLastReceipt(receipt);
      setSeedVaultModalVisible(false);
      setReceiptModalVisible(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      console.error('Blink execution error:', err);
    }
  };

  const handleTagDetected = (action: SolanaActionMetadata) => {
    const firstLink = action.links?.actions[0] || { label: action.label, href: '#' };
    handleExecuteAction(action, firstLink);
  };

  const [sendInitialRecipient, setSendInitialRecipient] = useState<string>('');

  const handleOpenSend = (recipient?: string) => {
    if (typeof recipient === 'string') {
      setSendInitialRecipient(recipient);
    } else {
      setSendInitialRecipient('');
    }
    if (!activeAccount) {
      login();
    } else {
      setSendModalVisible(true);
    }
  };

  const handleOpenReceive = () => {
    if (!activeAccount) {
      login();
    } else {
      setReceiveModalVisible(true);
    }
  };

  const toggleNetwork = () => {
    // Locked strictly to devnet
    SolanaService.setNetwork('devnet');
    setRefreshTrigger((prev) => prev + 1);
  };

  // 1. Loading splash screen with disassociating pixels & Lego mascots (3s duration)
  if (showSplash) {
    return <LaunchSplashScreen onFinish={() => setShowSplash(false)} durationMs={3000} />;
  }

  // 2. Gate unauthenticated users to Privy login/signup page unless browsing as guest
  if (!authenticated && !isGuestMode) {
    return (
      <SafeAreaView style={[styles.appRoot, { backgroundColor: colors.bg }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <WelcomeAuthScreen
          onContinueGuest={() => setIsGuestMode(true)}
          onOpenAbout={() => setAboutModalVisible(true)}
        />
        <AboutBlinkModal
          visible={aboutModalVisible}
          onClose={() => setAboutModalVisible(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.appRoot, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {isDesktop ? (
        /* Desktop Viewport with Left Side Navigation */
        <View style={styles.desktopLayout}>
          <DesktopSidebar
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            network={network}
            onToggleNetwork={toggleNetwork}
            activeAccount={activeAccount}
            onOpenWalletConnect={login}
            onOpenAbout={() => setAboutModalVisible(true)}
            onOpenNotifications={() => setNotificationsModalVisible(true)}
            unreadNotificationsCount={unreadNotificationsCount}
            onOpenSettings={() => setSettingsModalVisible(true)}
            onToggleTheme={toggleTheme}
            isDark={isDark}
          />

          <View style={styles.desktopMainContent}>
            {currentTab === 'markets' && (
              <MarketsScreen
                activeAccount={activeAccount}
                balanceSol={balanceSol}
                balanceUsdc={balanceUsdc}
                network={network}
                onToggleNetwork={toggleNetwork}
                onOpenWalletConnect={login}
                onOpenDeposit={handleOpenReceive}
                onSelectBlink={(blink) => setSelectedDetailBlink(blink)}
                onOpenStudioCreate={() => setCreateBlinkModalVisible(true)}
                hideBrandLogo={true}
                refreshTrigger={refreshTrigger}
                onOpenProfile={handleOpenProfile}
                avatarUrl={userProfile.avatarUrl}
                onOpenAbout={() => setAboutModalVisible(true)}
              />
            )}

            {currentTab === 'saved' && (
              <SavedBlinksScreen
                onSelectBlink={(blink) => setSelectedDetailBlink(blink)}
                onExploreMarkets={() => setCurrentTab('markets')}
                onOpenCreateBlink={() => setCreateBlinkModalVisible(true)}
              />
            )}

            {currentTab === 'tap' && (
              <TapScanScreen
                onOpenWalletConnect={login}
                onTagDetected={handleTagDetected}
                onOpenAbout={() => setAboutModalVisible(true)}
              />
            )}

            {currentTab === 'studio' && (
              <StudioScreen
                activeAccount={activeAccount}
                onOpenWalletConnect={login}
                onOpenCreateBlinkModal={() => setCreateBlinkModalVisible(true)}
                onSelectBlink={(blink) => setSelectedDetailBlink(blink)}
                onOpenSend={(recipientAddress) => handleOpenSend(recipientAddress)}
              />
            )}

            {currentTab === 'wallet' && (
              <PocketScreen
                activePublicKey={activePublicKey}
                activeAccount={activeAccount}
                onOpenManageWallet={login}
                onOpenTap={() => setCurrentTab('tap')}
                onOpenSend={handleOpenSend}
                onOpenReceive={handleOpenReceive}
                onExecuteAction={handleExecuteAction}
                onOpenProfile={handleOpenProfile}
                refreshTrigger={refreshTrigger}
              />
            )}

            {currentTab === 'profile' && (
              authenticated && activeAccount ? (
                <ProfileScreen
                  activeAccount={activeAccount}
                  onOpenWalletConnect={login}
                  network={network}
                  onOpenAbout={() => setAboutModalVisible(true)}
                />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 8 }}>
                    Sign In Required
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 20, maxWidth: 300 }}>
                    Create an account or sign in to customize your profile, export private keys, and link social accounts.
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: '#5B67F6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}
                    onPress={login}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Sign In with Privy</Text>
                  </TouchableOpacity>
                </View>
              )
            )}
          </View>
        </View>
      ) : (
        /* Mobile Viewport with Floating Bottom Nav Capsule */
        <View style={styles.mobileLayout}>
          <Header
            network={network}
            activeAccount={activeAccount}
            onToggleNetwork={toggleNetwork}
            onOpenWalletConnect={login}
            onOpenAbout={() => setAboutModalVisible(true)}
            onOpenNotifications={() => setNotificationsModalVisible(true)}
            unreadNotificationsCount={unreadNotificationsCount}
            onOpenSettings={() => setSettingsModalVisible(true)}
            isDark={isDark}
            onOpenProfile={handleOpenProfile}
            avatarUrl={userProfile.avatarUrl}
          />

          <View style={styles.mobileContentArea}>
            {currentTab === 'markets' && (
              <MarketsScreen
                activeAccount={activeAccount}
                balanceSol={balanceSol}
                balanceUsdc={balanceUsdc}
                network={network}
                onToggleNetwork={toggleNetwork}
                onOpenWalletConnect={login}
                onOpenDeposit={handleOpenReceive}
                onSelectBlink={(blink) => setSelectedDetailBlink(blink)}
                onOpenStudioCreate={() => setCreateBlinkModalVisible(true)}
                onOpenAbout={() => setAboutModalVisible(true)}
                refreshTrigger={refreshTrigger}
                onOpenProfile={handleOpenProfile}
                avatarUrl={userProfile.avatarUrl}
              />
            )}

            {currentTab === 'saved' && (
              <SavedBlinksScreen
                onSelectBlink={(blink) => setSelectedDetailBlink(blink)}
                onExploreMarkets={() => setCurrentTab('markets')}
                onOpenCreateBlink={() => setCreateBlinkModalVisible(true)}
              />
            )}

            {currentTab === 'tap' && (
              <TapScanScreen
                onOpenWalletConnect={login}
                onTagDetected={handleTagDetected}
                onOpenAbout={() => setAboutModalVisible(true)}
              />
            )}

            {currentTab === 'studio' && (
              <StudioScreen
                activeAccount={activeAccount}
                onOpenWalletConnect={login}
                onOpenCreateBlinkModal={() => setCreateBlinkModalVisible(true)}
                onSelectBlink={(blink) => setSelectedDetailBlink(blink)}
                onOpenSend={(recipientAddress) => handleOpenSend(recipientAddress)}
              />
            )}

            {currentTab === 'wallet' && (
              <PocketScreen
                activePublicKey={activePublicKey}
                activeAccount={activeAccount}
                onOpenManageWallet={login}
                onOpenTap={() => setCurrentTab('tap')}
                onOpenSend={handleOpenSend}
                onOpenReceive={handleOpenReceive}
                onExecuteAction={handleExecuteAction}
                onOpenProfile={handleOpenProfile}
                refreshTrigger={refreshTrigger}
              />
            )}

            {currentTab === 'profile' && (
              authenticated && activeAccount ? (
                <ProfileScreen
                  activeAccount={activeAccount}
                  onOpenWalletConnect={login}
                  network={network}
                  onOpenAbout={() => setAboutModalVisible(true)}
                />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 8 }}>
                    Sign In Required
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 20, maxWidth: 300 }}>
                    Create an account or sign in to customize your profile, export private keys, and link social accounts.
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: '#5B67F6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}
                    onPress={login}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Sign In with Privy</Text>
                  </TouchableOpacity>
                </View>
              )
            )}
          </View>

          {/* Floating Pill Bottom Dock */}
          <FloatingMobileNav
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            isAuthenticated={authenticated && !!activeAccount}
          />
        </View>
      )}

      {/* Interactive Detail View Modal */}
      <BlinkDetailModal
        blink={selectedDetailBlink}
        onClose={() => setSelectedDetailBlink(null)}
        onOpenWalletConnect={login}
        currentBalanceSol={balanceSol}
        onUpdateBlink={(updated) => {
          setSelectedDetailBlink(updated);
          PhysicalBlinkRegistry.notifyChange(updated);
          setRefreshTrigger((prev) => prev + 1);
        }}
        onOpenSend={(recipientAddress) => handleOpenSend(recipientAddress)}
      />

      {/* Real Send Modal */}
      {activePublicKey && (
        <SendModal
          visible={sendModalVisible}
          onClose={() => {
            setSendModalVisible(false);
            setSendInitialRecipient('');
          }}
          currentBalanceSol={balanceSol}
          senderPublicKey={activePublicKey}
          initialRecipient={sendInitialRecipient}
          onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
          onOpenReceive={() => {
            setSendModalVisible(false);
            setReceiveModalVisible(true);
          }}
        />
      )}

      {/* Real Receive / Deposit Modal */}
      {activePublicKey && (
        <ReceiveModal
          visible={receiveModalVisible}
          onClose={() => setReceiveModalVisible(false)}
          publicKey={activePublicKey}
          onBalanceUpdated={() => setRefreshTrigger((prev) => prev + 1)}
          onOpenSend={() => {
            setReceiveModalVisible(false);
            setSendModalVisible(true);
          }}
        />
      )}

      {/* Real Biometric Authorization */}
      <SeedVaultModal
        visible={seedVaultModalVisible}
        actionTitle={pendingAction?.title || ''}
        amountLabel={pendingLink?.label || ''}
        merchantName={pendingAction?.merchantName}
        onApprove={handleApproveSeedVault}
        onCancel={() => setSeedVaultModalVisible(false)}
      />

      {/* Transaction Confirmation Receipt */}
      <ReceiptModal
        visible={receiptModalVisible}
        receipt={lastReceipt}
        onClose={() => setReceiptModalVisible(false)}
      />

      {/* About Blink Architecture & Explainer Modal */}
      <AboutBlinkModal
        visible={aboutModalVisible}
        onClose={() => setAboutModalVisible(false)}
        onOpenStudio={() => {
          setAboutModalVisible(false);
          setCurrentTab('studio');
        }}
        onOpenPocket={() => {
          setAboutModalVisible(false);
          setCurrentTab('wallet');
        }}
      />

      {/* Deploy Physical Blink Modal */}
      <CreateBlinkModal
        visible={createBlinkModalVisible}
        onClose={() => setCreateBlinkModalVisible(false)}
        creatorPublicKey={activePublicKey}
        onBlinkCreated={(blink) => {
          setCreateBlinkModalVisible(false);
          setRefreshTrigger((prev) => prev + 1);
          setSelectedDetailBlink(blink);
        }}
      />

      {/* Choose Display Name & Username Onboarding Modal for Non-Google signups */}
      <PickUsernameModal
        visible={pickUsernameModalVisible}
        onClose={() => setPickUsernameModalVisible(false)}
        publicKey={activePublicKey || ''}
        initialSuggestedName={
          user?.twitter?.username ||
          user?.github?.username ||
          (user?.email?.address ? user.email.address.split('@')[0] : '')
        }
        initialAvatarUrl={userProfile.avatarUrl}
      />

      {/* Notifications Modal */}
      <NotificationsModal
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        activeAccount={activeAccount}
      />

      {/* Universal Floating Toast Feedback System */}
      <Toast />
    </SafeAreaView>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('App crashed with ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#07080B', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 10 }}>Something went wrong</Text>
          <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
            {this.state.error?.message || 'Unexpected application error'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#5B67F6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 20 }}
            onPress={() => {
              if (typeof window !== 'undefined') window.location.reload();
              else this.setState({ hasError: false, error: null });
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Reload App</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const privyAppId =
    process.env.EXPO_PUBLIC_PRIVY_APP_ID ||
    (typeof window !== 'undefined' && (window as any).EXPO_PUBLIC_PRIVY_APP_ID) ||
    'cmujr1sl4036y0cifxks01maa';

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <PrivyProvider
          appId={privyAppId}
          config={{
            plugins: [defaultSolanaRpcsPlugin()],
            appearance: {
              theme: 'dark',
              accentColor: '#5B67F6',
              logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
              showWalletLoginFirst: false,
            },
            loginMethods: ['email', 'google', 'twitter', 'discord', 'telegram', 'github', 'wallet'],
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
      }}
    >
      <BlinkMainApp />
    </PrivyProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%',
  },
  desktopMainContent: {
    flex: 1,
    height: '100%',
    overflow: 'hidden',
  },
  mobileLayout: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  mobileContentArea: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
