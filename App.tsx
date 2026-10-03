import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform, useWindowDimensions, StatusBar as RNStatusBar, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import {
  PrivyProvider,
  usePrivy,
  toSolanaWalletConnectors,
  useWallets as useSolanaWallets,
  useCreateWallet as useCreateSolanaWallet,
  useSignAndSendTransaction,
  useSignTransaction,
  defaultSolanaRpcsPlugin,
  PrivyNativeBridge,
} from './src/auth/privyAdapter';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

import { Header } from './src/components/Header';
import { MarketsScreen } from './src/screens/MarketsScreen';
import { SavedBlinksScreen } from './src/screens/SavedBlinksScreen';
import { PocketScreen } from './src/screens/PocketScreen';
import { TapScanScreen } from './src/screens/TapScanScreen';
import { StudioScreen } from './src/screens/StudioScreen';
import { BlinkStudioScreen } from './src/screens/BlinkStudioScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

import { FloatingMobileNav, TabKey } from './src/components/FloatingMobileNav';
import { DesktopSidebar } from './src/components/DesktopSidebar';
import { BlinkDetailModal } from './src/components/BlinkDetailModal';
import { CreateBlinkModal } from './src/components/CreateBlinkModal';
import { DatabaseService } from './src/services/databaseService';

import { SendModal } from './src/components/SendModal';
import { ReceiveModal } from './src/components/ReceiveModal';
import { SeedVaultModal } from './src/components/SeedVaultModal';
import { ReceiptModal } from './src/components/ReceiptModal';
import { NotificationService } from './src/services/notificationService';
import { SaleWatcherService } from './src/services/saleWatcherService';
import { getApiUrl } from './src/services/apiConfig';

// Sleep/wake & unhandled rejection safety guards to prevent idle blank screens
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('[Sleep/Wake Recovery] Caught unhandled rejection:', event.reason);
    if (event && event.preventDefault) event.preventDefault();
  });
  window.addEventListener('error', (event) => {
    console.warn('[Sleep/Wake Recovery] Caught window error:', event.error || event.message);
  });
}
import { LaunchSplashScreen } from './src/components/LaunchSplashScreen';
import { WelcomeAuthScreen } from './src/components/WelcomeAuthScreen';
import { OnboardingScreen } from './src/components/OnboardingScreen';

import { SolanaService } from './src/services/solanaService';
import { WalletProviderService, WalletAccount } from './src/services/walletProviderService';
import { BlinkEngine } from './src/services/blinkEngine';
import { SolanaMobileStackService } from './src/services/solanaMobileStackService';
import { UserProfileService, UserProfile } from './src/services/userProfileService';
import { BlinkIdService } from './src/services/blinkIdService';
import { PhysicalBlink, PhysicalBlinkRegistry } from './src/services/physicalBlinkRegistry';
import { ReceiptService } from './src/services/receiptService';
import { LinkedAction, SolanaActionMetadata, TransactionReceipt } from './src/types';
import { Toast } from './src/components/Toast';
import { ToastService } from './src/services/toastService';
import { PickUsernameModal } from './src/components/PickUsernameModal';
import { PushNotificationService } from './src/services/pushNotificationService';
import { PrivyWebAuthBridge } from './src/components/PrivyWebAuthBridge';

const solanaConnectors = toSolanaWalletConnectors();

function BlinkMainApp() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const { colors, toggleTheme, isDark, theme } = useTheme();

  // If in Privy Web Auth Bridge mode inside WebView, render dedicated auth UI
  const isAuthModalMode = Platform.OS === 'web' && typeof window !== 'undefined' && (
    window.location.search.includes('auth_modal=1') || window.location.pathname === '/auth-modal'
  );

  if (isAuthModalMode) {
    return <PrivyWebAuthBridge />;
  }

  // Real Privy authentication & account management
  const { login, logout, authenticated, user, ready } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { createWallet: createSolanaWallet } = useCreateSolanaWallet();
  const { signAndSendTransaction: privySignAndSend } = useSignAndSendTransaction();
  const { signTransaction: privySignTransaction } = useSignTransaction();

  const [currentTab, setCurrentTabState] = useState<TabKey>('markets');
  const [tabHistory, setTabHistory] = useState<TabKey[]>(['markets']);
  const tabHistoryRef = useRef<TabKey[]>(['markets']);
  tabHistoryRef.current = tabHistory;

  const currentTabRef = useRef<TabKey>('markets');
  currentTabRef.current = currentTab;

  const setCurrentTab = (newTab: TabKey) => {
    if (newTab !== currentTabRef.current) {
      setTabHistory(prev => {
        const filtered = prev.filter(t => t !== newTab);
        return [...filtered, newTab];
      });
      setCurrentTabState(newTab);
    }
  };
  const [balanceSol, setBalanceSol] = useState<number>(0);
  const [balanceUsdc, setBalanceUsdc] = useState<number>(0);
  const [network] = useState<'devnet'>('devnet');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Splash Screen, Guest mode & Onboarding state
  const [showSplash, setShowSplash] = useState(true);
  // Extra gate: don't show WelcomeAuthScreen until Privy SDK has confirmed auth state.
  // This prevents the 1-frame flash of WelcomeAuthScreen on app restart when the user
  // is actually logged in (real Privy needs ~200-400ms to rehydrate its JWT session).
  const [isAuthReady, setIsAuthReady] = useState(() => {
    // If we already have a restored native session from localStorage, skip the wait
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const nativeUser = window.localStorage.getItem('blink_privy_user_v1');
        const nativeWallet = window.localStorage.getItem('blink_connected_native_wallet');
        if (nativeUser || nativeWallet) return true;
      } catch {}
    }
    return false;
  });

  useEffect(() => {
    if (ready) {
      setIsAuthReady(true);
    }
    const timer = setTimeout(() => {
      setIsAuthReady(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [ready]);

  const [isGuestMode, setIsGuestMode] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => UserProfileService.getProfile());

  // In-app detail modal state for physical / scanned / deep-linked Blink
  const [selectedDetailBlink, setSelectedDetailBlink] = useState<PhysicalBlink | null>(null);


  // Native Connected Mobile Wallet (Phantom / Solflare / MWA)
  const [nativeWalletAccount, setNativeWalletAccount] = useState<WalletAccount | null>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem('blink_connected_native_wallet');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return WalletProviderService.getActiveAccount();
  });

  // Listen for native wallet connect / update events
  useEffect(() => {
    const handleWalletConnected = (e: any) => {
      const acc = e?.detail || WalletProviderService.getActiveAccount();
      if (acc) {
        setNativeWalletAccount(acc);
        setIsGuestMode(false);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('blink_wallet_connected', handleWalletConnected);
      return () => window.removeEventListener('blink_wallet_connected', handleWalletConnected);
    }
  }, []);

  // Listen for inbound deep links (e.g. blink://onConnect from Phantom / Solflare, or blink://t/<id>)
  useEffect(() => {
    let removeListener: (() => void) | null = null;
    const initDeepLinkListener = async () => {
      const handleUrl = async (urlStr: string) => {
        if (!urlStr) return;
        console.log('[App] Received inbound deep link URL:', urlStr);
        if (
          urlStr.includes('onConnect') ||
          urlStr.includes('phantom_encryption_public_key') ||
          urlStr.includes('solflare_encryption_public_key')
        ) {
          SolanaMobileStackService.handleConnectCallback(urlStr);
          return;
        }

        // Inbound Blink payment/interaction link: blink://t/<id>, /t/<id>, or canonical URL
        if (urlStr.includes('/t/') || urlStr.startsWith('blink://')) {
          try {
            let resolved = PhysicalBlinkRegistry.resolve(urlStr);
            if (!resolved) {
              await PhysicalBlinkRegistry.syncFromCloud().catch(() => {});
              resolved = PhysicalBlinkRegistry.resolve(urlStr);
            }
            if (resolved) {
              setSelectedDetailBlink(resolved);
              ToastService.info(`Opened: ${resolved.name}`);
            }
          } catch (err) {
            console.warn('[App] Failed to resolve deep link blink:', err);
          }
        }
      };

      try {
        const { App: CapApp } = await import('@capacitor/app');

        const sub = await CapApp.addListener('appUrlOpen', (event) => {
          handleUrl(event.url);
        });
        removeListener = () => sub.remove();

        const launchUrl = await CapApp.getLaunchUrl();
        if (launchUrl?.url) {
          handleUrl(launchUrl.url);
        }
      } catch (e) {
        // Fallback on web/browser
      }

      if (typeof window !== 'undefined' && window.location) {
        const href = window.location.href;
        if (
          href.includes('phantom_encryption_public_key') ||
          href.includes('solflare_encryption_public_key')
        ) {
          SolanaMobileStackService.handleConnectCallback(href);
        } else if (window.location.pathname.startsWith('/t/')) {
          handleUrl(href);
        }

        const handlePopState = () => {
          if (window.location.pathname.startsWith('/t/')) {
            handleUrl(window.location.href);
          }
        };
        window.addEventListener('popstate', handlePopState);
      }
    };

    initDeepLinkListener();
    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  // Listen for signout to reset guest mode & native wallet
  useEffect(() => {
    const handleSignOut = () => {
      setNativeWalletAccount(null);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('blink_connected_native_wallet');
        window.localStorage.removeItem('solana_connected_wallet_name');
        window.localStorage.removeItem('wallet_mobile_session');
        window.localStorage.removeItem('wallet_shared_secret');
      }
      WalletProviderService.disconnect();
      setIsGuestMode(false);
      setCurrentTab('markets');
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('blink_auth_signout', handleSignOut);
      return () => window.removeEventListener('blink_auth_signout', handleSignOut);
    }
  }, []);

  // Mark onboarding complete & persist
  const finishOnboarding = () => {
    setShowOnboarding(false);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('blink_onboarding_done', '1');
      }
    } catch {}
  };

  useEffect(() => {
    const handleProfileUpdate = () => {
      setUserProfile(UserProfileService.getProfile());
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('blink_profile_updated', handleProfileUpdate);
      return () => window.removeEventListener('blink_profile_updated', handleProfileUpdate);
    }
  }, []);

  // Initialize push notifications on app mount
  useEffect(() => {
    PushNotificationService.initialize().catch(() => {});
    // Listen for notification taps (e.g. navigate to Pocket tab)
    const unsub = PushNotificationService.addResponseListener((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.type === 'blink_sale' || data?.type === 'payment_received') {
        setCurrentTab('wallet');
      }
    });
    return () => { if (unsub) unsub(); };
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
      window.addEventListener('blink_notifications_updated', handleNotifsUpdate);
      window.addEventListener('tapblink_notifications_updated', handleNotifsUpdate);
      return () => {
        window.removeEventListener('blink_notifications_updated', handleNotifsUpdate);
        window.removeEventListener('tapblink_notifications_updated', handleNotifsUpdate);
      };
    }
  }, []);

  // Active action
  const [pendingAction, setPendingAction] = useState<SolanaActionMetadata | null>(null);
  const [pendingLink, setPendingLink] = useState<LinkedAction | null>(null);
  const [lastReceipt, setLastReceipt] = useState<TransactionReceipt | null>(null);

  const modalsRef = useRef({
    selectedDetailBlink,
    sendModalVisible,
    receiveModalVisible,
    seedVaultModalVisible,
    receiptModalVisible,
    createBlinkModalVisible,
    pickUsernameModalVisible,
    notificationsModalVisible,
    settingsModalVisible,
    pendingAction,
    pendingLink,
    lastReceipt,
    showOnboarding,
  });
  modalsRef.current = {
    selectedDetailBlink,
    sendModalVisible,
    receiveModalVisible,
    seedVaultModalVisible,
    receiptModalVisible,
    createBlinkModalVisible,
    pickUsernameModalVisible,
    notificationsModalVisible,
    settingsModalVisible,
    pendingAction,
    pendingLink,
    lastReceipt,
    showOnboarding,
  };

  // Hardware Back Button & Page Stack Handler
  useEffect(() => {
    let removeListener: (() => void) | null = null;
    let removeRnBack: (() => void) | null = null;

    const handleBackAction = (exitAppFn?: () => void): boolean => {
      const m = modalsRef.current;
      // 1. If detail modal is open, close it
      if (m.selectedDetailBlink) {
        setSelectedDetailBlink(null);
        return true;
      }
      // 2. If any popup/sheet modal is open, close it
      if (m.sendModalVisible) { setSendModalVisible(false); return true; }
      if (m.receiveModalVisible) { setReceiveModalVisible(false); return true; }
      if (m.seedVaultModalVisible) { setSeedVaultModalVisible(false); return true; }
      if (m.receiptModalVisible) { setReceiptModalVisible(false); return true; }
      if (m.createBlinkModalVisible) { setCreateBlinkModalVisible(false); return true; }
      if (m.pickUsernameModalVisible) { setPickUsernameModalVisible(false); return true; }
      if (m.notificationsModalVisible) { setNotificationsModalVisible(false); return true; }
      if (m.settingsModalVisible) { setSettingsModalVisible(false); return true; }
      if (m.pendingAction) { setPendingAction(null); return true; }
      if (m.pendingLink) { setPendingLink(null); return true; }
      if (m.lastReceipt) { setLastReceipt(null); return true; }
      if (m.showOnboarding) { setShowOnboarding(false); return true; }

      // 3. If there is a tab history stack, navigate back to previous screen
      const history = tabHistoryRef.current;
      if (history.length > 1) {
        const nextHistory = [...history];
        nextHistory.pop(); // remove current tab
        const prevTab = nextHistory[nextHistory.length - 1];
        setTabHistory(nextHistory);
        setCurrentTabState(prevTab);
        return true;
      }

      // 4. If current tab is not root 'markets', return to 'markets'
      if (currentTabRef.current !== 'markets') {
        setCurrentTabState('markets');
        setTabHistory(['markets']);
        return true;
      }

      // 5. Root page reached with no modals open -> exit app
      if (exitAppFn) {
        exitAppFn();
        return true;
      }
      return false;
    };

    // Capacitor Native Android back button listener
    const initCapacitorBack = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        const sub = await CapApp.addListener('backButton', () => {
          handleBackAction(() => CapApp.exitApp());
        });
        removeListener = () => sub.remove();
      } catch {}
    };
    initCapacitorBack();

    // React Native BackHandler fallback
    const rnSub = BackHandler.addEventListener('hardwareBackPress', () => {
      return handleBackAction();
    });
    removeRnBack = () => rnSub.remove();

    return () => {
      if (removeListener) removeListener();
      if (removeRnBack) removeRnBack();
    };
  }, []);

  // Derive active Solana account from Privy
  const existingLinkedWallet = user?.linkedAccounts?.find(
    (acc: any) => acc.type === 'wallet' && acc.chainType === 'solana'
  ) as any;

  // Find the first wallet from solanaWallets that has signing capability
  const activeSolanaWallet =
    solanaWallets?.find((w: any) => typeof w.signTransaction === 'function' || typeof w.signAndSendTransaction === 'function') ||
    solanaWallets?.[0] ||
    null;

  const solanaAddress =
    activeSolanaWallet?.address ||
    existingLinkedWallet?.address ||
    null;

  // Only check Solana wallets — user.wallet is always an EVM wallet, not Solana
  const hasExistingWallet = Boolean(
    (solanaWallets && solanaWallets.length > 0) ||
    existingLinkedWallet
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

  const effectiveAddress =
    nativeWalletAccount?.publicKey ||
    solanaAddress ||
    fallbackSolanaAddress;

  const isUserLoggedIn = authenticated || Boolean(nativeWalletAccount?.publicKey);

  // Global background poller for incoming cloud receipts and global Blink stats sync
  const initialSyncDoneRef = React.useRef(false);
  const syncedSigsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!effectiveAddress) return;
    const syncCloudData = async () => {
      try {
        await PhysicalBlinkRegistry.syncFromCloud().catch(() => {});

        const [newReceipts, enrichedTxs] = await Promise.all([
          ReceiptService.fetchCloudReceiptsForAddress(effectiveAddress).catch(() => []),
          SolanaService.getEnrichedRecentTransactions(effectiveAddress, 25).catch(() => []),
        ]);

        const existingNotifs = NotificationService.getNotifications();
        const notifSigSet = new Set(existingNotifs.map((n) => n.signature).filter(Boolean));
        let hasNewIncoming = false;

        if (initialSyncDoneRef.current) {
          if (Array.isArray(newReceipts) && newReceipts.length > 0) {
            for (const rcpt of newReceipts) {
              const recip = (rcpt.recipientAddress || '').toLowerCase().trim();
              const recipNoAt = recip.replace(/^@+/, '');
              const myEffAddr = (effectiveAddress || '').toLowerCase().trim();
              const myUserClean = (userProfile?.username || '').toLowerCase().trim().replace(/^@+/, '');
              const myBlinkClean = (userProfile?.blinkId || '').toLowerCase().trim().replace(/^@+/, '');

              const isForMe = recip === myEffAddr || recipNoAt === myEffAddr ||
                              (myUserClean && (recip === myUserClean || recipNoAt === myUserClean)) ||
                              (myBlinkClean && (recip === myBlinkClean || recipNoAt === myBlinkClean));

              if (
                rcpt.signature &&
                !syncedSigsRef.current.has(rcpt.signature) &&
                isForMe &&
                !notifSigSet.has(rcpt.signature)
              ) {
                hasNewIncoming = true;
                notifSigSet.add(rcpt.signature);
                syncedSigsRef.current.add(rcpt.signature);

                // STRICT: Only genuine Blink sales carrying a blinkId trigger Blink Sale notifications.
                // Standard P2P transfers are strictly tagged as Payment Received.
                let isRealBlinkSale = false;
                let blinkTitle = '';

                if (rcpt.blinkId) {
                  isRealBlinkSale = true;
                  const foundBlink = PhysicalBlinkRegistry.getBlinkById(rcpt.blinkId);
                  blinkTitle = foundBlink?.name || rcpt.blinkTitle || 'Blink Sale';
                }

                if (isRealBlinkSale) {
                  NotificationService.notifyBlinkPaid(
                    blinkTitle || 'Blink Sale',
                    rcpt.amount,
                    rcpt.token,
                    rcpt.payerAddress || 'Solana Wallet',
                    rcpt.signature,
                    rcpt.blinkId
                  );
                } else {
                  NotificationService.notifyPaymentReceived(
                    rcpt.amount,
                    rcpt.token,
                    rcpt.payerAddress || 'Solana Wallet',
                    rcpt.signature
                  );
                }
              }
            }
          }

          if (Array.isArray(enrichedTxs) && enrichedTxs.length > 0) {
            for (const tx of enrichedTxs) {
              if (
                tx.signature &&
                !syncedSigsRef.current.has(tx.signature) &&
                tx.direction === 'receive' &&
                !tx.err &&
                !notifSigSet.has(tx.signature)
              ) {
                const amt = tx.token === 'SOL' ? (tx.amountSol || 0) : (tx.amountUsdc || 0);
                if (amt > 0) {
                  hasNewIncoming = true;
                  notifSigSet.add(tx.signature);
                  syncedSigsRef.current.add(tx.signature);
                  NotificationService.notifyPaymentReceived(
                    amt,
                    tx.token || 'SOL',
                    tx.counterparty || 'Solana Wallet',
                    tx.signature
                  );
                }
              }
            }
          }
        }

        // Seed all known signatures into syncedSigsRef so they are never re-notified
        if (Array.isArray(newReceipts)) {
          newReceipts.forEach((r) => {
            if (r.signature) syncedSigsRef.current.add(r.signature);
          });
        }
        if (Array.isArray(enrichedTxs)) {
          enrichedTxs.forEach((t) => {
            if (t.signature) syncedSigsRef.current.add(t.signature);
          });
        }
        initialSyncDoneRef.current = true;

        if (hasNewIncoming && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('blink_tx_updated'));
          window.dispatchEvent(new CustomEvent('blink_balance_refresh'));
        }
      } catch (err) {
        console.warn('Background cloud sync error:', err);
      }
    };

    syncCloudData();
    const interval = setInterval(syncCloudData, 5000);
    return () => clearInterval(interval);
  }, [effectiveAddress]);

  // Real-time sale watcher: instant SSE streaming + 3s fallback poller
  useEffect(() => {
    if (effectiveAddress) {
      SaleWatcherService.start(effectiveAddress, userProfile?.username);
    } else {
      SaleWatcherService.stop();
    }
    return () => {
      SaleWatcherService.stop();
    };
  }, [effectiveAddress, userProfile?.username]);

  // Open profile handler: if guest, returns user to front page (WelcomeAuthScreen) to sign in/up
  const handleOpenProfile = () => {
    if (!isUserLoggedIn) {
      setIsGuestMode(false);
    } else {
      setCurrentTab('profile');
    }
  };

  const activeAccount: WalletAccount | null =
    nativeWalletAccount
      ? nativeWalletAccount
      : (authenticated && effectiveAddress
          ? {
              name: (userProfile.displayName && userProfile.displayName !== 'Seeker Pioneer')
                ? userProfile.displayName
                : user?.email?.address
                ? user.email.address
                : user?.phone?.number
                ? user.phone.number
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
                : (activeSolanaWallet as any)?.walletClientType === 'phantom'
                ? 'Phantom'
                : (activeSolanaWallet as any)?.walletClientType === 'solflare'
                ? 'Solflare'
                : userProfile.displayName || 'Privy Solana Wallet',
              publicKey: effectiveAddress,
              isPrivy: true,
            }
          : null);

  // Ensure unauthenticated users never have a profile page to navigate to
  useEffect(() => {
    if (!isUserLoggedIn || !activeAccount) {
      if (currentTab === 'profile') {
        setCurrentTab('markets');
      }
    }
  }, [isUserLoggedIn, activeAccount, currentTab]);

  // Persist user account into database when authenticated via Privy or native wallet
  useEffect(() => {
    if (isUserLoggedIn && !isGuestMode && activeAccount?.publicKey) {
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
  }, [isUserLoggedIn, isGuestMode, activeAccount?.publicKey, activeAccount?.name, activeAccount?.isPrivy, user?.id, userProfile.avatarUrl]);

  // Cloud Account Restoration across devices & Google/Custom auto-derivation
  useEffect(() => {
    if (!isUserLoggedIn) return;

    const lookupKey = effectiveAddress || user?.email?.address || user?.id;
    if (!lookupKey) return;

    const googleAccount =
      user?.google ||
      (user?.linkedAccounts?.find((acc: any) => acc.type === 'google_oauth') as any);

    const googleEmail =
      user?.google?.email ||
      googleAccount?.email ||
      (user?.email?.address && user.email.address.toLowerCase().endsWith('@gmail.com') ? user.email.address : null);

    const userEmail = googleEmail || user?.email?.address || null;

    // Check cloud database first to restore profile on this device
    DatabaseService.syncUserFromCloud(lookupKey).then(async (cloudUser) => {
      let resolvedCloudUser = cloudUser;

      // If user profile on current address has an auto-assigned handle (e.g. user_xxx), check if user email had an established custom handle
      if (
        userEmail &&
        (!resolvedCloudUser || !resolvedCloudUser.username || resolvedCloudUser.username.startsWith('user_') || resolvedCloudUser.username === 'seeker_user')
      ) {
        try {
          const emailUser = await DatabaseService.syncUserFromCloud(userEmail);
          if (emailUser && emailUser.username && !emailUser.username.startsWith('user_')) {
            resolvedCloudUser = emailUser;
          }
        } catch (e) {}
      }

      if (resolvedCloudUser && resolvedCloudUser.username && resolvedCloudUser.username !== 'seeker_user') {
        const restored = UserProfileService.updateProfile({
          displayName: resolvedCloudUser.displayName,
          username: resolvedCloudUser.username,
          avatarUrl: resolvedCloudUser.avatarUrl || userProfile.avatarUrl,
          bio: resolvedCloudUser.bio || userProfile.bio,
          hasCustomizedProfile: true,
          linkedAccounts: {
            ...userProfile.linkedAccounts,
            ...(userEmail ? { email: userEmail, google: userEmail } : {}),
          },
        });
        setUserProfile(restored);
        if (effectiveAddress) {
          DatabaseService.saveUserAccount({
            id: effectiveAddress,
            address: effectiveAddress,
            publicKey: effectiveAddress,
            displayName: restored.displayName,
            username: restored.username,
            name: restored.displayName,
            avatarUrl: restored.avatarUrl,
            bio: restored.bio,
            email: userEmail || undefined,
          });
          BlinkIdService.registerBlinkId(`@${restored.username}`, effectiveAddress, restored.displayName, restored.avatarUrl, userEmail || undefined);
        }
        PhysicalBlinkRegistry.syncFromCloud();
        return;
      }

      // If no customized profile on cloud, proceed with onboarding derivation
      const isGoogleAuth = Boolean(googleEmail);
      const currentProf = UserProfileService.getProfile();

      if (isGoogleAuth && googleEmail) {
        if (!currentProf.hasCustomizedProfile || currentProf.username === 'seeker_user') {
          const googleName = user?.google?.name || googleAccount?.name;
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
          // Show onboarding for first-time users
          try {
            const done = typeof localStorage !== 'undefined' ? localStorage.getItem('blink_onboarding_done') : '1';
            if (!done) setShowOnboarding(true);
          } catch {}
        }
      } else if (userEmail) {
        if (!currentProf.hasCustomizedProfile || currentProf.username === 'seeker_user' || currentProf.username.startsWith('user_')) {
          const emailPrefix = userEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
          const cleanUser = emailPrefix.length >= 2 ? emailPrefix : 'mybitcoind';
          const updated = UserProfileService.updateProfile({
            displayName: cleanUser,
            username: cleanUser,
            avatarUrl: currentProf.avatarUrl || UserProfileService.getRandomMascot(),
            hasCustomizedProfile: true,
            linkedAccounts: {
              ...userProfile.linkedAccounts,
              email: userEmail,
            },
          });
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
              email: userEmail,
              createdAt: Date.now(),
            });
            BlinkIdService.registerBlinkId(`@${updated.username}`, effectiveAddress, updated.displayName, updated.avatarUrl, userEmail);
          }
          ToastService.success(`Welcome @${updated.username}! Signed in via Email.`);
        }
      } else {
        if (!currentProf.hasCustomizedProfile && currentProf.username === 'seeker_user') {
          // Show onboarding for first-time non-Google users too
          try {
            const done = typeof localStorage !== 'undefined' ? localStorage.getItem('blink_onboarding_done') : '1';
            if (!done) setShowOnboarding(true);
          } catch {}
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
        // Ensure recentBlockhash and feePayer are set and fresh
        if (!tx.recentBlockhash) {
          const latestBh = await SolanaService.getLatestBlockhash('confirmed');
          tx.recentBlockhash = latestBh.blockhash;
        }
        if (!tx.feePayer && activeAccount?.publicKey) {
          try {
            tx.feePayer = new PublicKey(activeAccount.publicKey);
          } catch {}
        }

        const serialized = tx.serialize({ requireAllSignatures: false });

        // Approach 1: Headless signing with privySignTransaction + broadcast via HTTP polling (NO WebSocket!)
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

              try {
                // Send and confirm via HTTP polling (no WebSocket at all)
                const sig = await SolanaService.sendRawTransactionAndConfirm(rawBytes);
                console.log('Successfully broadcasted & confirmed via HTTP polling:', sig);
                return sig;
              } catch (broadcastErr: any) {
                console.warn('sendRawTransactionAndConfirm error:', broadcastErr);
                throw broadcastErr;
              }
            }
          } catch (signErr: any) {
            console.warn('privySignTransaction error, falling through to privySignAndSend:', signErr);
            // Fall through to Approach 2
          }
        }

        // Approach 2: privySignAndSend with optimisticBroadcast: true (skips Privy's broken WebSocket confirmation!)
        if (privySignAndSend) {
          try {
            const res = await privySignAndSend({
              transaction: serialized,
              wallet: activeSolanaWallet,
              chain: 'solana:devnet',
              options: {
                optimisticBroadcast: true,
                skipSimulation: true,
              } as any,
            });
            const sig = typeof res.signature === 'string' ? res.signature : bs58.encode(res.signature);
            if (sig) {
              console.log('Successfully signed & sent via Privy signAndSend:', sig);
              return sig;
            }
          } catch (privyErr: any) {
            const errMsg = privyErr?.message || String(privyErr);
            console.warn('Privy signAndSend threw:', errMsg);

            if (/reject|cancel|denied|dismiss/i.test(errMsg)) {
              throw privyErr;
            }

            // If the error itself contains a real signature (87-88 chars), extract it
            if (privyErr?.signature) {
              const sig = typeof privyErr.signature === 'string' ? privyErr.signature : bs58.encode(privyErr.signature);
              if (sig && sig.length >= 80) return sig;
            }

            // If Privy threw a WebSocket error, check if the transaction actually reached the network
            if (errMsg.includes('WebSocket') || errMsg.includes('8190004')) {
              console.warn('Privy threw WebSocket error, checking recent signatures on-chain...');
              if (activeAccount?.publicKey) {
                try {
                  const recent = await SolanaService.getRecentSignatures(activeAccount.publicKey, 1);
                  if (recent[0]?.signature) {
                    return recent[0].signature;
                  }
                } catch {}
              }
            }

            // Re-throw all other errors
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

  // Mark auth as ready once Privy SDK confirms state (prevents WelcomeAuthScreen flash)
  useEffect(() => {
    if (ready) {
      // Small delay ensures React has propagated the authenticated state to all children
      const t = setTimeout(() => setIsAuthReady(true), 200);
      return () => clearTimeout(t);
    }
  }, [ready]);

  // 1. Loading splash screen with disassociating pixels & Lego mascots (1.2s duration)
  if (showSplash) {
    return <LaunchSplashScreen onFinish={() => setShowSplash(false)} durationMs={1200} />;
  }

  // 1b. Brief post-splash auth settling — keep splash-like background while Privy rehydrates
  if (!isAuthReady && !isUserLoggedIn) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#07080B', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  let mainScreenContent: React.ReactNode = null;

  // 2. Gate unauthenticated users to login/signup page unless browsing as guest
  if (!isUserLoggedIn && !isGuestMode) {
    mainScreenContent = (
      <WelcomeAuthScreen
        onContinueGuest={() => setIsGuestMode(true)}
      />
    );
  } else if (showOnboarding) {
    // 2b. First-time user onboarding (after sign-in, before main app)
    mainScreenContent = (
      <OnboardingScreen onFinish={finishOnboarding} />
    );
  } else {
    mainScreenContent = isDesktop ? (
        /* Desktop Viewport with Left Side Navigation */
        <View style={styles.desktopLayout}>
          <DesktopSidebar
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            network={network}
            onToggleNetwork={toggleNetwork}
            activeAccount={activeAccount}
            onOpenWalletConnect={login}
            onOpenNotifications={() => setCurrentTab('notifications')}
            unreadNotificationsCount={unreadNotificationsCount}
            onOpenSettings={() => setCurrentTab('settings')}
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
              />
            )}

            {currentTab === 'studio' && (
              <BlinkStudioScreen
                activeAccount={activeAccount}
                balanceSol={balanceSol}
                balanceUsdc={balanceUsdc}
                network={network}
                onToggleNetwork={toggleNetwork}
                onOpenWalletConnect={login}
                onOpenDeposit={handleOpenReceive}
                onSelectBlink={(blink) => setSelectedDetailBlink(blink)}
                onOpenStudioCreate={() => setCreateBlinkModalVisible(true)}
                refreshTrigger={refreshTrigger}
                onOpenProfile={handleOpenProfile}
                avatarUrl={userProfile.avatarUrl}
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

            {currentTab === 'notifications' && (
              <NotificationsScreen onSelectTab={setCurrentTab} />
            )}

            {currentTab === 'settings' && (
              <SettingsScreen
                activeAccount={activeAccount}
                onOpenWalletConnect={login}
                onReturnToAuth={() => setIsGuestMode(false)}
              />
            )}

            {currentTab === 'profile' && (
              <ProfileScreen
                activeAccount={activeAccount}
                onOpenWalletConnect={login}
                network={network}
                onReturnToAuth={() => setIsGuestMode(false)}
              />
            )}
          </View>
        </View>
      ) : (
        /* Mobile Viewport with Floating Bottom Nav Capsule */
        <View style={styles.mobileLayout}>
          <Header
            network={network}
            activeAccount={activeAccount}
            onOpenNotifications={() => setCurrentTab('notifications')}
            unreadNotificationsCount={unreadNotificationsCount}
            onOpenSettings={() => setCurrentTab('settings')}
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
              />
            )}

            {currentTab === 'studio' && (
              <BlinkStudioScreen
                activeAccount={activeAccount}
                balanceSol={balanceSol}
                balanceUsdc={balanceUsdc}
                network={network}
                onToggleNetwork={toggleNetwork}
                onOpenWalletConnect={login}
                onOpenDeposit={handleOpenReceive}
                onSelectBlink={(blink) => setSelectedDetailBlink(blink)}
                onOpenStudioCreate={() => setCreateBlinkModalVisible(true)}
                refreshTrigger={refreshTrigger}
                onOpenProfile={handleOpenProfile}
                avatarUrl={userProfile.avatarUrl}
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

            {currentTab === 'notifications' && (
              <NotificationsScreen onSelectTab={setCurrentTab} />
            )}

            {currentTab === 'settings' && (
              <SettingsScreen
                activeAccount={activeAccount}
                onOpenWalletConnect={login}
                onReturnToAuth={() => setIsGuestMode(false)}
              />
            )}

            {currentTab === 'profile' && (
              <ProfileScreen
                activeAccount={activeAccount}
                onOpenWalletConnect={login}
                network={network}
                onReturnToAuth={() => setIsGuestMode(false)}
              />
            )}
          </View>

          {/* Floating Pill Bottom Dock */}
          <FloatingMobileNav
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            isAuthenticated={isUserLoggedIn && !!activeAccount}
          />
        </View>
      );
  }

  return (
    <SafeAreaView style={[styles.appRoot, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {mainScreenContent}

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

      {/* Deploy Physical Blink Modal */}
      <CreateBlinkModal
        visible={createBlinkModalVisible}
        onClose={() => setCreateBlinkModalVisible(false)}
        defaultRecipient={activePublicKey || undefined}
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
            loginMethods: ['sms', 'email', 'wallet'],
        embeddedWallets: {
          showWalletUIs: false,
          solana: {
            createOnLogin: 'all-users',
          },
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
        solana: {
          rpcs: {
            'solana:devnet': {
              rpc: createSolanaRpc('https://api.devnet.solana.com'),
              rpcSubscriptions: createSolanaRpcSubscriptions('wss://api.devnet.solana.com/'),
            },
            'solana:mainnet': {
              rpc: createSolanaRpc('https://api.mainnet-beta.solana.com'),
              rpcSubscriptions: createSolanaRpcSubscriptions('wss://api.mainnet-beta.solana.com/'),
            },
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
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0,
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
