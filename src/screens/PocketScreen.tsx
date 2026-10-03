import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Wallet,
  Clock,
  Key,
  Copy,
  Send,
  Plus,
  FileText,
  Tag,
  CheckCircle2,
  Activity,
} from 'lucide-react-native';
import { SolanaService, EnrichedTransactionInfo } from '../services/solanaService';
import { UserProfileService } from '../services/userProfileService';
import { PriceService } from '../services/priceService';
import { BlinkIdService } from '../services/blinkIdService';
import { WalletAccount } from '../services/walletProviderService';
import { LinkedAction, SolanaActionMetadata } from '../types';
import { PhantomIcon, SolflareIcon, BackpackIcon, CoinbaseIcon } from '../components/WalletIcons';
import { SolanaCoinLogo, UsdcCoinLogo, SkrCoinLogo, BlinkBrandMark } from '../components/BrandLogos';
import { PrivyIcon } from '../components/PrivyIcon';
import { usePrivy, useExportWallet } from '../auth/privyAdapter';
import { useTheme } from '../theme/ThemeContext';
import { ToastService } from '../services/toastService';
import { ReceiptService } from '../services/receiptService';
import { NotificationService } from '../services/notificationService';
import { PhysicalBlinkRegistry } from '../services/physicalBlinkRegistry';
import { ReceiptModal } from '../components/ReceiptModal';
import { TransactionReceipt } from '../types';

interface PocketScreenProps {
  activePublicKey: string | null;
  activeAccount: WalletAccount | null;
  onOpenManageWallet: () => void;
  onOpenTap: () => void;
  onOpenSend: () => void;
  onOpenReceive: () => void;
  onExecuteAction: (action: SolanaActionMetadata, link: LinkedAction) => void;
  onOpenProfile?: () => void;
  refreshTrigger: number;
}

export const PocketScreen: React.FC<PocketScreenProps> = ({
  activePublicKey,
  activeAccount,
  onOpenManageWallet,
  onOpenTap,
  onOpenSend,
  onOpenReceive,
  onExecuteAction,
  onOpenProfile,
  refreshTrigger,
}) => {
  const { colors, isDark } = useTheme();
  const {
    login,
    logout,
    authenticated,
  } = usePrivy();
  const { exportWallet } = useExportWallet();
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleExportKey = async () => {
    if (!activePublicKey) {
      ToastService.error('No connected Solana wallet.');
      return;
    }
    setIsExporting(true);
    try {
      await exportWallet({ address: activePublicKey });
    } catch (err: any) {
      console.warn('Privy wallet export flow:', err);
      if (err?.message && !err.message.toLowerCase().includes('closed')) {
        ToastService.error(err.message || 'Could not export wallet');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const [balance, setBalance] = useState<number>(() => {
    if (activePublicKey) {
      const cached = SolanaService.getCachedSol(activePublicKey);
      if (cached !== null) return cached;
    }
    return 0;
  });
  const [usdcBalance, setUsdcBalance] = useState<number>(() => {
    if (activePublicKey) {
      const cached = SolanaService.getCachedUsdc(activePublicKey);
      if (cached !== null) return cached;
    }
    return 0;
  });
  const [skrBalance, setSkrBalance] = useState<number>(() => {
    if (activePublicKey) {
      const cached = SolanaService.getCachedSkr(activePublicKey);
      if (cached !== null) return cached;
    }
    return 0;
  });
  const [solPrice, setSolPrice] = useState<number>(() => PriceService.getSolPriceSync());
  const [loading, setLoading] = useState<boolean>(false);
  const [signatures, setSignatures] = useState<EnrichedTransactionInfo[]>([]);
  const [isAirdropping, setIsAirdropping] = useState<boolean>(false);
  const [selectedReceipt, setSelectedReceipt] = useState<TransactionReceipt | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | '90d' | '30d' | '7d' | '24h'>('all');

  const knownSignaturesRef = React.useRef<Set<string>>(new Set());
  const isInitialLoadRef = React.useRef<boolean>(true);

  const userProfile = UserProfileService.getProfile();
  const connectedLabel = userProfile.displayName || userProfile.username || activeAccount?.name || 'Solana Wallet';
  const userBlinkId = useMemo(() => {
    if (userProfile.blinkId && !userProfile.blinkId.startsWith('@user_') && userProfile.blinkId !== '@seeker_user') {
      return userProfile.blinkId.startsWith('@') ? userProfile.blinkId : `@${userProfile.blinkId}`;
    }
    const cleanUser = (userProfile.username || '').trim().replace(/^@+/, '');
    if (cleanUser && cleanUser !== 'seeker_user' && !/^[1-9A-HJ-NP-za-km-z]{32,44}$/.test(cleanUser)) {
      return `@${cleanUser}`;
    }
    return BlinkIdService.formatBlinkId(cleanUser || userProfile.displayName, activePublicKey || undefined);
  }, [userProfile.username, userProfile.blinkId, userProfile.displayName, activePublicKey]);

  useEffect(() => {
    const unsub = PriceService.subscribe((p) => setSolPrice(p.sol));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (activePublicKey) {
      const cachedSol = SolanaService.getCachedSol(activePublicKey);
      const cachedUsdc = SolanaService.getCachedUsdc(activePublicKey);
      if (cachedSol !== null) setBalance(cachedSol);
      if (cachedUsdc !== null) setUsdcBalance(cachedUsdc);
    }
  }, [activePublicKey]);

  useEffect(() => {
    if (activePublicKey && userBlinkId) {
      BlinkIdService.registerBlinkId(userBlinkId, activePublicKey, connectedLabel, userProfile.avatarUrl);
    }
  }, [activePublicKey, userBlinkId, connectedLabel, userProfile.avatarUrl]);

  const loadOnChainData = async (showLoading = true) => {
    if (!activePublicKey) {
      setBalance(0);
      setUsdcBalance(0);
      setSignatures([]);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      // 1. Fetch balances, enriched transactions, and cloud receipts in parallel with fault tolerance
      const [balRes, usdcRes, skrRes, sigsRes, cloudReceiptsRes] = await Promise.allSettled([
        SolanaService.getBalance(activePublicKey, showLoading),
        SolanaService.getUsdcBalance(activePublicKey, showLoading),
        SolanaService.getSkrBalance(activePublicKey, showLoading),
        SolanaService.getEnrichedRecentTransactions(activePublicKey, 50),
        ReceiptService.fetchCloudReceiptsForAddress(activePublicKey),
      ]);

      if (balRes.status === 'fulfilled' && typeof balRes.value === 'number' && !isNaN(balRes.value)) {
        setBalance(balRes.value);
      }
      if (usdcRes.status === 'fulfilled' && typeof usdcRes.value === 'number' && !isNaN(usdcRes.value)) {
        setUsdcBalance(usdcRes.value);
      }
      if (skrRes.status === 'fulfilled' && typeof skrRes.value === 'number' && !isNaN(skrRes.value)) {
        setSkrBalance(skrRes.value);
      }

      const sigs: EnrichedTransactionInfo[] = sigsRes.status === 'fulfilled' && Array.isArray(sigsRes.value)
        ? sigsRes.value
        : [];

      // 2. Instantly merge local + cloud receipts
      const localReceipts = ReceiptService.getAllReceipts();
      const existingSigSet = new Set(sigs.map((s) => s.signature));

      // If any on-chain signature matches a receipt with full metadata, enrich it directly
      for (const sig of sigs) {
        const cachedRcpt = ReceiptService.getReceiptBySignature(sig.signature);
        if (cachedRcpt && cachedRcpt.amount > 0) {
          if (!sig.amountSol && !sig.amountUsdc) {
            if (cachedRcpt.token === 'SOL') {
              sig.amountSol = cachedRcpt.amount;
              sig.token = 'SOL';
            } else {
              sig.amountUsdc = cachedRcpt.amount;
              sig.token = 'USDC';
            }
          }
          if (cachedRcpt.payerAddress && (cachedRcpt.payerAddress === activePublicKey || cachedRcpt.payerAddress.toLowerCase() === activePublicKey.toLowerCase())) {
            sig.direction = 'send';
          } else if (cachedRcpt.recipientAddress && (cachedRcpt.recipientAddress === activePublicKey || cachedRcpt.recipientAddress.toLowerCase() === activePublicKey.toLowerCase())) {
            sig.direction = 'receive';
          } else if (sig.direction === 'unknown' || !sig.direction) {
            sig.direction = cachedRcpt.payerAddress === activePublicKey ? 'send' : 'receive';
          }
          if (!sig.counterparty) {
            sig.counterparty = (sig.direction === 'send' ? cachedRcpt.recipientAddress : cachedRcpt.payerAddress) || null;
          }
        }
      }

      const syntheticFromReceipts: EnrichedTransactionInfo[] = localReceipts
        .filter((r) => r.signature && !existingSigSet.has(r.signature))
        .filter((r) =>
          (r.payerAddress && (r.payerAddress === activePublicKey || r.payerAddress.toLowerCase() === activePublicKey.toLowerCase())) ||
          (r.recipientAddress && (r.recipientAddress === activePublicKey || r.recipientAddress.toLowerCase() === activePublicKey.toLowerCase()))
        )
        .map((r) => {
          const isSend = Boolean(r.payerAddress && (r.payerAddress === activePublicKey || r.payerAddress.toLowerCase() === activePublicKey.toLowerCase()));
          return {
            signature: r.signature,
            slot: 0,
            err: r.status === 'failed' ? true : null,
            memo: r.blinkTitle || null,
            blockTime: Math.floor((r.timestamp || Date.now()) / 1000),
            direction: isSend ? 'send' : 'receive',
            amountSol: r.token === 'SOL' ? r.amount : null,
            amountUsdc: r.token === 'USDC' ? r.amount : null,
            token: r.token || 'SOL',
            counterparty: (isSend ? r.recipientAddress : r.payerAddress) || null,
          };
        });

      const combined = [...syntheticFromReceipts, ...sigs].sort(
        (a, b) => (b.blockTime || 0) - (a.blockTime || 0)
      );

      try {
        // Seed all on-chain signatures into knownSignaturesRef so history is tracked cleanly
        combined.forEach((item) => {
          if (item.signature) {
            knownSignaturesRef.current.add(item.signature);
          }
        });
      } catch (notifErr) {
        console.warn('Non-fatal notification processing warning:', notifErr);
      }
      isInitialLoadRef.current = false;

      setSignatures(combined);
    } catch (err) {
      console.warn('Error loading Solana data (retaining last verified balance):', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const filteredSignatures = useMemo(() => {
    if (dateFilter === 'all') {
      return signatures;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const filtered = signatures.filter((sig) => {
      if (!sig.blockTime) return true;
      const ageSec = Math.max(0, nowSec - sig.blockTime);
      switch (dateFilter) {
        case '24h':
          return ageSec <= 86400;
        case '7d':
          return ageSec <= 7 * 86400;
        case '30d':
          return ageSec <= 30 * 86400;
        case '90d':
        default:
          return ageSec <= 90 * 86400;
      }
    });
    return filtered;
  }, [signatures, dateFilter]);

  const handleRequestAirdrop = async () => {
    if (!activePublicKey) {
      ToastService.error('Please connect a wallet first.');
      return;
    }
    setIsAirdropping(true);
    try {
      await SolanaService.requestAirdrop(activePublicKey);
      ToastService.success('Airdropped 1 SOL on Devnet!');
      await loadOnChainData(true);
    } catch (err: any) {
      console.warn('Airdrop failed or rate limited:', err);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(activePublicKey);
        } catch {}
      }
      ToastService.info('Copied wallet address! Opening official Solana faucet...');
      if (typeof window !== 'undefined') {
        window.open('https://faucet.solana.com', '_blank');
      }
    } finally {
      setIsAirdropping(false);
    }
  };

  // Continuous auto-detection of incoming/outgoing transactions without requiring manual refresh
  useEffect(() => {
    if (!activePublicKey) return;

    loadOnChainData(true);

    // Live auto-polling every 3.5 seconds to automatically catch incoming transfers
    const interval = setInterval(() => {
      loadOnChainData(false);
    }, 3500);

    // Instant listener for when user sends, receives, or executes any transaction
    const handleTxUpdate = () => {
      loadOnChainData(false);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('blink_tx_updated', handleTxUpdate);
      window.addEventListener('blink_balance_refresh', handleTxUpdate);
      window.addEventListener('focus', handleTxUpdate);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('blink_tx_updated', handleTxUpdate);
        window.removeEventListener('blink_balance_refresh', handleTxUpdate);
        window.removeEventListener('focus', handleTxUpdate);
      }
    };
  }, [activePublicKey, refreshTrigger]);

  const safeSol = typeof balance === 'number' && !isNaN(balance) ? balance : 0;
  const safeUsdc = typeof usdcBalance === 'number' && !isNaN(usdcBalance) ? usdcBalance : 0;
  const safeSkr = typeof skrBalance === 'number' && !isNaN(skrBalance) ? skrBalance : 0;

  const solUsdValue = PriceService.convertSolToUsdt(safeSol);
  const usdcUsdValue = safeUsdc;
  const skrUsdValue = PriceService.convertSkrToUsdt(safeSkr);
  const totalUsdValue = PriceService.calculateTotalPortfolioUsdt(safeSol, safeUsdc, safeSkr);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        activePublicKey ? (
          <RefreshControl refreshing={loading} onRefresh={loadOnChainData} tintColor={colors.accent} />
        ) : undefined
      }
    >
      {/* Wallet Balance Hero Section */}
      {activeAccount ? (
        <View style={styles.heroSection}>
          <View style={styles.heroBalanceCol}>
            <Text style={[styles.heroAmount, { color: colors.textPrimary }]}>
              ${totalUsdValue.toFixed(2)}
            </Text>
          </View>

          {/* Quick Action Buttons */}
          <View style={styles.heroActionsRow}>
            <TouchableOpacity style={styles.depositBtn} onPress={onOpenReceive} activeOpacity={0.8}>
              <ArrowDownLeft size={15} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.depositBtnText}>Receive / Deposit</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={onOpenSend} activeOpacity={0.8}>
              <ArrowUpRight size={15} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.secondaryBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Disconnected State Hero Card */
        <View style={[styles.disconnectedCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <BlinkBrandMark size={52} />
          <Text style={[styles.disconnectedTitle, { color: colors.textPrimary }]}>Sign In to Blink</Text>
          <Text style={[styles.disconnectedSub, { color: colors.textSecondary }]}>
            Sign in with Privy using Google, Apple, Email, or your Solana wallet. Non-custodial embedded Solana keys are provisioned instantly.
          </Text>
          <TouchableOpacity
            style={styles.connectWalletBtn}
            onPress={() => login()}
            activeOpacity={0.8}
          >
            <PrivyIcon size={16} />
            <Text style={styles.connectWalletBtnText}>Sign In with Privy</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Connected Account Card */}
      {activeAccount && (
        <View style={[styles.accountCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[styles.accountCardLeft, { flex: 1 }]}>
            {activeAccount.name === 'Phantom' && <PhantomIcon size={22} />}
            {activeAccount.name === 'Solflare' && <SolflareIcon size={22} />}
            {activeAccount.name === 'Backpack' && <BackpackIcon size={22} />}
            {activeAccount.name === 'Coinbase Wallet' && <CoinbaseIcon size={22} />}
            {!['Phantom', 'Solflare', 'Backpack', 'Coinbase Wallet'].includes(activeAccount.name) && (
              <Wallet size={22} color={colors.accent} />
            )}
            <View style={{ marginLeft: 10, flex: 1 }}>
              {/* Unique Blink ID with Copy Button */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: 'rgba(20, 241, 149, 0.12)',
                    borderColor: 'rgba(20, 241, 149, 0.3)',
                    borderWidth: 1,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}
                >
                  <Tag size={10} color="#14F195" />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#14F195' }}>{userBlinkId}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(userBlinkId);
                      ToastService.success(`Copied unique Blink ID (${userBlinkId})! Anyone can send directly to this ID.`);
                    }
                  }}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2, paddingHorizontal: 6 }}
                >
                  <Copy size={11} color={colors.accent} />
                  <Text style={{ fontSize: 10, color: colors.accent, fontWeight: '600' }}>Copy ID</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                Unique Blink ID
              </Text>

              {/* Solana On-chain Address */}
              <TouchableOpacity
                onPress={() => {
                  if (activePublicKey && typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(activePublicKey);
                    ToastService.success('Solana address copied to clipboard!');
                  }
                }}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}
              >
                <Text style={[styles.accountKey, { color: colors.textSecondary }]}>
                  {activePublicKey ? `${activePublicKey.slice(0, 6)}...${activePublicKey.slice(-6)}` : ''}
                </Text>
                <Copy size={10} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.accountCardRight}>
            {authenticated && (
              <TouchableOpacity
                style={[
                  styles.switchBtn,
                  {
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    borderColor: 'rgba(245, 158, 11, 0.35)',
                    borderWidth: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  },
                ]}
                onPress={handleExportKey}
                disabled={isExporting}
                activeOpacity={0.7}
              >
                <Key size={12} color="#F59E0B" />
                <Text style={[styles.switchBtnText, { color: '#F59E0B', fontWeight: '700' }]}>
                  {isExporting ? '...' : 'Export'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.refreshIconBtn}
              onPress={() => {
                loadOnChainData();
                ToastService.info('Refreshing wallet balance...');
              }}
              activeOpacity={0.7}
            >
              <RefreshCw size={13} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Live Detected Devnet Balance & Faucet Card */}
      {activeAccount && (
        <View style={[styles.balanceCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.balanceCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.liveDot} />
              <Text style={[styles.balanceWalletLabel, { color: colors.textSecondary }]}>
                Connected: {connectedLabel}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                loadOnChainData();
                ToastService.info('Refreshing wallet balance...');
              }}
              disabled={loading}
              style={styles.balanceRefreshBtn}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#14F195" />
              ) : (
                <Text style={[styles.balanceRefreshText, { color: colors.accent }]}>Refresh</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.balanceMainRow}>
            <View>
              <Text style={[styles.balanceSubTitle, { color: colors.textMuted }]}>Detected Devnet Balances</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <Text style={[styles.balanceNumber, { color: colors.textPrimary }]}>
                  {balance > 0 ? `${balance.toFixed(4)} SOL` : '0.0000 SOL'}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>+</Text>
                <Text style={[styles.balanceNumber, { color: '#2775CA' }]}>
                  {usdcBalance > 0 ? `${usdcBalance.toFixed(2)} USDC` : '0.00 USDC'}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 6 }}>
              <TouchableOpacity
                onPress={() => {
                  if (typeof window !== 'undefined') {
                    window.open('https://faucet.solana.com', '_blank');
                  }
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingVertical: 5,
                  paddingHorizontal: 9,
                  backgroundColor: (colors as any).surfaceHover || colors.bgCard || '#1A1C24',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border || '#232733',
                }}
              >
                <Text style={{ fontSize: 10, color: colors.accent, fontWeight: '600' }}>
                  SOL Faucet
                </Text>
                <ExternalLink size={9} color={colors.accent} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (activePublicKey && typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(activePublicKey);
                  }
                  ToastService.info('Copied address! Opening Circle Devnet USDC faucet...');
                  if (typeof window !== 'undefined') {
                    window.open('https://faucet.circle.com', '_blank');
                  }
                }}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingVertical: 5,
                  paddingHorizontal: 9,
                  backgroundColor: 'rgba(39, 117, 202, 0.12)',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(39, 117, 202, 0.3)',
                }}
              >
                <Text style={{ fontSize: 10, color: '#2775CA', fontWeight: '600' }}>
                  USDC Faucet
                </Text>
                <ExternalLink size={9} color="#2775CA" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Holdings Section */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Assets & Balances</Text>
      </View>

      <View style={styles.holdingsList}>
        {/* SOL Holding */}
        <View style={[styles.holdingItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.holdingItemLeft}>
            <SolanaCoinLogo size={42} />
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.holdingSymbol, { color: colors.textPrimary }]}>SOL</Text>
              <Text style={[styles.holdingName, { color: colors.textSecondary }]}>Solana Native</Text>
            </View>
          </View>
          <View style={styles.holdingItemRight}>
            <Text style={[styles.holdingPrice, { color: colors.textPrimary }]}>${solUsdValue.toFixed(2)}</Text>
            <Text style={[styles.holdingBalance, { color: colors.textMuted }]}>
              {safeSol > 0 ? `${safeSol.toFixed(4)} SOL` : '0.00 SOL'}
            </Text>
          </View>
        </View>

        {/* USDC Holding */}
        <View style={[styles.holdingItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.holdingItemLeft}>
            <UsdcCoinLogo size={42} />
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.holdingSymbol, { color: colors.textPrimary }]}>USDC</Text>
              <Text style={[styles.holdingName, { color: colors.textSecondary }]}>Circle USD Coin</Text>
            </View>
          </View>
          <View style={styles.holdingItemRight}>
            <Text style={[styles.holdingPrice, { color: colors.textPrimary }]}>${safeUsdc.toFixed(2)}</Text>
            <Text style={[styles.holdingBalance, { color: colors.textMuted }]}>
              {safeUsdc > 0 ? `${safeUsdc.toFixed(2)} USDC` : '0.00 USDC'}
            </Text>
          </View>
        </View>

        {/* SKR Holding */}
        <View style={[styles.holdingItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.holdingItemLeft}>
            <SkrCoinLogo size={42} />
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.holdingSymbol, { color: colors.textPrimary }]}>SKR</Text>
              <Text style={[styles.holdingName, { color: colors.textSecondary }]}>Seeker Ecosystem Token</Text>
            </View>
          </View>
          <View style={styles.holdingItemRight}>
            <Text style={[styles.holdingPrice, { color: colors.textPrimary }]}>${skrUsdValue.toFixed(2)}</Text>
            <Text style={[styles.holdingBalance, { color: colors.textMuted }]}>
              {safeSkr > 0 ? `${safeSkr.toFixed(2)} SKR` : '0.00 SKR'}
            </Text>
          </View>
        </View>
      </View>

      {/* On-Chain Ledger & History */}
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Clock size={14} color={colors.textSecondary} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>On-Chain Ledger</Text>
          <View style={styles.devnetTag}>
            <Text style={styles.devnetTagText}>Devnet</Text>
          </View>
        </View>
        {activePublicKey && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => loadOnChainData(true)}
              style={[styles.solscanLink, { backgroundColor: colors.bgCardAlt, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }]}
              activeOpacity={0.7}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.accent} style={{ transform: [{ scale: 0.75 }] }} />
              ) : (
                <RefreshCw size={11} color={colors.accent} />
              )}
              <Text style={[styles.solscanLinkText, { color: colors.accent, fontWeight: '600' }]}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => window.open?.(`https://solscan.io/account/${activePublicKey}?cluster=devnet`, '_blank')}
              style={styles.solscanLink}
              activeOpacity={0.7}
            >
              <Text style={styles.solscanLinkText}>Solscan (Devnet)</Text>
              <ExternalLink size={11} color={colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => window.open?.(`https://explorer.solana.com/address/${activePublicKey}?cluster=devnet`, '_blank')}
              style={styles.solscanLink}
              activeOpacity={0.7}
            >
              <Text style={styles.solscanLinkText}>Explorer</Text>
              <ExternalLink size={11} color={colors.accent} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Transaction Range Filter Selector */}
      {activePublicKey && (
        <View style={styles.filterRow}>
          {(['all', '90d', '30d', '7d', '24h'] as const).map((tab) => {
            const isActive = dateFilter === tab;
            const label = tab === 'all' ? 'All' : tab === '90d' ? '90 Days' : tab === '30d' ? '30 Days' : tab === '7d' ? '7 Days' : '24 Hours';
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.filterTab,
                  {
                    backgroundColor: isActive ? colors.accent : colors.bgCardAlt,
                    borderColor: isActive ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => setDateFilter(tab)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    { color: isActive ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {filteredSignatures.length === 0 ? (
        <View style={styles.emptyStateWrap}>
          {signatures.length === 0 && !loading ? (
            // Fresh wallet — no transactions at all
            <View style={[styles.emptyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={[styles.emptyIconCircle, { backgroundColor: 'rgba(91,103,246,0.1)', borderColor: 'rgba(91,103,246,0.25)' }]}>
                <Activity size={32} color={colors.accent} strokeWidth={1.5} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Your wallet is ready</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Receive some SOL or USDC to get started. All Blink payments and transfers will appear here.
              </Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={[styles.emptyActionBtn, { backgroundColor: colors.accent }]}
                  onPress={onOpenReceive}
                  activeOpacity={0.85}
                >
                  <ArrowDownLeft size={14} color="#FFF" strokeWidth={2.5} />
                  <Text style={styles.emptyActionBtnText}>Receive / Deposit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.emptyActionBtnSecondary, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                  onPress={onOpenTap}
                  activeOpacity={0.85}
                >
                  <Tag size={14} color={colors.accent} strokeWidth={2} />
                  <Text style={[styles.emptyActionBtnSecondaryText, { color: colors.accent }]}>Tap a Blink</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Has transactions but filtered out
            <View style={[styles.emptyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Transactions in Timeframe</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                No transactions found within this filter. Switch to "All" to see your full history.
              </Text>
              {dateFilter !== 'all' && (
                <TouchableOpacity
                  style={[styles.resetFilterBtn, { backgroundColor: colors.accent }]}
                  onPress={() => setDateFilter('all')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resetFilterBtnText}>Show All Transactions</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.txList}>
          {filteredSignatures.map((sig, idx) => {
            const isSend = sig.direction === 'send';
            const isReceive = sig.direction === 'receive';
            const dirLabel = isSend ? 'Sent' : isReceive ? 'Received' : 'Transaction';
            const dirColor = isSend ? '#EF4444' : isReceive ? '#10B981' : colors.textSecondary;
            const amountPrefix = isSend ? '-' : isReceive ? '+' : '';

            // Time ago
            let timeLabel = '';
            if (sig.blockTime) {
              const diffSec = Math.floor(Date.now() / 1000 - sig.blockTime);
              if (diffSec < 60) timeLabel = 'Just now';
              else if (diffSec < 3600) timeLabel = `${Math.floor(diffSec / 60)}m ago`;
              else if (diffSec < 86400) timeLabel = `${Math.floor(diffSec / 3600)}h ago`;
              else timeLabel = `${Math.floor(diffSec / 86400)}d ago`;
            }

            return (
              <TouchableOpacity
                key={sig.signature}
                style={styles.txItem}
                onPress={() => {
                  if (activePublicKey) {
                    const rcpt = ReceiptService.getOrCreateReceiptForTx(sig, activePublicKey);
                    setSelectedReceipt(rcpt);
                    // Asynchronously fetch complete receipt from cloud or on-chain parser
                    ReceiptService.getReceiptAsync(sig.signature, activePublicKey).then((upgraded) => {
                      if (upgraded) {
                        setSelectedReceipt(upgraded);
                      }
                    });
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.txItemLeft}>
                  {/* Direction badge */}
                  <View style={[
                    styles.txBadge,
                    sig.err
                      ? { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }
                      : isSend
                      ? { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.18)' }
                      : isReceive
                      ? { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }
                      : { backgroundColor: colors.bgCardAlt, borderColor: colors.border },
                  ]}>
                    {sig.err ? (
                      <Clock size={17} color="#EF4444" strokeWidth={2.2} />
                    ) : isSend ? (
                      <ArrowUpRight size={17} color="#EF4444" strokeWidth={2.5} />
                    ) : isReceive ? (
                      <ArrowDownLeft size={17} color="#10B981" strokeWidth={2.5} />
                    ) : (
                      <Activity size={17} color={colors.textSecondary} strokeWidth={2} />
                    )}
                  </View>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    {/* Direction label as bold pill */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={[styles.txTitle, { color: dirColor, fontWeight: '800' }]}>
                        {dirLabel}
                      </Text>
                      {sig.memo && !sig.memo.toLowerCase().includes('transfer') && (
                        <View style={{ backgroundColor: 'rgba(91,103,246,0.1)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 9, color: colors.accent, fontWeight: '700' }} numberOfLines={1}>
                            {sig.memo.slice(0, 20)}{sig.memo.length > 20 ? '…' : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                    {sig.counterparty ? (
                      <Text style={[styles.txHash, { color: colors.textMuted }]}>
                        {isSend ? '→' : '←'} {sig.counterparty.slice(0, 8)}...{sig.counterparty.slice(-4)}
                      </Text>
                    ) : (
                      <Text style={[styles.txHash, { color: colors.textMuted }]}>
                        {`${sig.signature.slice(0, 8)}...${sig.signature.slice(-6)}`}
                      </Text>
                    )}
                    {timeLabel ? (
                      <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                        {timeLabel}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.txItemRight}>
                  {sig.token === 'USDC' && sig.amountUsdc !== null && sig.amountUsdc !== undefined ? (
                    <Text style={[styles.txStatus, { color: dirColor, fontWeight: '900', fontSize: 14 }]}>
                      {amountPrefix}${sig.amountUsdc.toFixed(2)}
                    </Text>
                  ) : sig.amountSol !== null && sig.amountSol !== undefined ? (
                    <Text style={[styles.txStatus, { color: dirColor, fontWeight: '900', fontSize: 14 }]}>
                      {amountPrefix}{sig.amountSol.toFixed(4)}
                    </Text>
                  ) : (
                    <Text style={[styles.txStatus, sig.err ? styles.txStatusErr : styles.txStatusOk]}>
                      {sig.err ? 'Failed' : 'Confirmed'}
                    </Text>
                  )}
                  <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '600', textAlign: 'right' }}>
                    {sig.token === 'USDC' ? 'USDC' : sig.token === 'SKR' ? 'SKR' : 'SOL'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                    <FileText size={10} color={colors.accent} />
                    <Text style={{ fontSize: 9, color: colors.accent, fontWeight: '700' }}>Receipt</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Expanded Transaction Receipt Modal */}
      <ReceiptModal
        visible={!!selectedReceipt}
        receipt={selectedReceipt}
        viewerAddress={activePublicKey}
        onClose={() => setSelectedReceipt(null)}
      />

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080B',
  },
  content: {
    paddingHorizontal: 6,
    paddingTop: 12,
    paddingBottom: 32,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  heroSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  heroBalanceCol: {
    flex: 1,
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  gainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  gainText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  solSubtext: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  depositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#5B67F6',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    shadowColor: '#5B67F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  depositBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#12141F',
    borderWidth: 1,
    borderColor: '#222636',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  disconnectedCard: {
    backgroundColor: '#0F111A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 24,
    alignItems: 'center',
    textAlign: 'center',
    marginVertical: 16,
  },
  disconnectedTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 14,
  },
  disconnectedSub: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 18,
    marginVertical: 10,
    maxWidth: 340,
  },
  connectWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#5B67F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  connectWalletBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  accountCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F111A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 8,
    marginBottom: 8,
  },
  accountCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  accountKey: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  accountCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchBtn: {
    backgroundColor: '#181B27',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  switchBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  refreshIconBtn: {
    backgroundColor: '#181B27',
    padding: 5,
    borderRadius: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  solscanLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  solscanLinkText: {
    color: '#5B67F6',
    fontSize: 10,
    fontWeight: '700',
  },
  holdingsList: {
    backgroundColor: '#0F111A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1D212E',
    overflow: 'hidden',
    marginBottom: 12,
  },
  holdingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#171A25',
  },
  holdingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  holdingSymbol: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  holdingName: {
    color: '#64748B',
    fontSize: 9.5,
    marginTop: 1,
  },
  holdingItemRight: {
    alignItems: 'flex-end',
  },
  holdingPrice: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  holdingBalance: {
    color: '#10B981',
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 1,
  },
  emptyCard: {
    backgroundColor: '#0F111A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 18,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySub: {
    color: '#64748B',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 320,
  },
  emptyStateWrap: {
    marginHorizontal: 4,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    width: '100%',
  },
  emptyActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 12,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyActionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyActionBtnSecondaryText: {
    fontSize: 11,
    fontWeight: '800',
  },

  txList: {
    backgroundColor: '#0F111A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1D212E',
    overflow: 'hidden',
  },
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#171A25',
  },
  txItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txBadgeOk: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  txBadgeSend: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  txBadgeNeutral: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  txBadgeErr: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  txTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  txHash: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  txItemRight: {
    alignItems: 'flex-end',
  },
  txStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
  txStatusOk: {
    color: '#10B981',
  },
  txStatusErr: {
    color: '#EF4444',
  },
  txBlock: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  balanceCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    marginTop: 4,
  },
  balanceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  balanceWalletLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  balanceRefreshBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  balanceRefreshText: {
    fontSize: 10,
    fontWeight: '700',
  },
  balanceMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceSubTitle: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  balanceNumber: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  airdropBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  airdropBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  devnetTag: {
    backgroundColor: 'rgba(20, 241, 149, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(20, 241, 149, 0.3)',
  },
  devnetTagText: {
    color: '#14F195',
    fontSize: 10,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 10,
    fontWeight: '700',
  },
  resetFilterBtn: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'center',
  },
  resetFilterBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
