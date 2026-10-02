import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import {
  Radio,
  Scan,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Lock,
  Sparkles,
  Camera,
  Info,
  QrCode,
  Tag,
  Cpu,
  Zap,
  Copy,
  AlertCircle,
  Wallet,
  X,
  User,
} from 'lucide-react-native';
import { CameraQrScanner } from '../components/CameraQrScanner';
import { NfcService } from '../services/nfcService';
import { PhysicalBlinkRegistry, PhysicalBlink } from '../services/physicalBlinkRegistry';
import { WalletProviderService, WalletAccount } from '../services/walletProviderService';
import { SolanaService } from '../services/solanaService';
import { PriceService } from '../services/priceService';
import { StreakService } from '../services/streakService';
import { NotificationService } from '../services/notificationService';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BiometricService } from '../services/biometricService';
import { ToastService } from '../services/toastService';
import { CoffeeShopLogo, HackerHouseLogo, BlinkBrandMark } from '../components/BrandLogos';
import { useTheme } from '../theme/ThemeContext';
import { ReceiptService } from '../services/receiptService';
import { ReceiptModal } from '../components/ReceiptModal';
import { TransactionReceipt } from '../types';
import { UserProfileService } from '../services/userProfileService';
import { BlinkIdService } from '../services/blinkIdService';

interface TapScanScreenProps {
  onOpenWalletConnect: () => void;
  onTagDetected?: (action: any) => void;
  onOpenAbout?: () => void;
}

export const TapScanScreen: React.FC<TapScanScreenProps> = ({
  onOpenWalletConnect,
  onTagDetected,
  onOpenAbout,
}) => {
  const { colors, isDark } = useTheme();
  const [activeAccount, setActiveAccount] = useState<WalletAccount | null>(() =>
    WalletProviderService.getActiveAccount()
  );
  const [activeMode, setActiveMode] = useState<'nfc' | 'qr'>('nfc');
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [isNfcHardwareSupported, setIsNfcHardwareSupported] = useState(false);
  const [inputId, setInputId] = useState('');
  const [resolvedBlink, setResolvedBlink] = useState<PhysicalBlink | null>(null);
  const [recipientBalance, setRecipientBalance] = useState<number | null>(null);
  const [resolving, setResolving] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nfcTapped, setNfcTapped] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<TransactionReceipt | null>(null);
  const [disambiguationMatches, setDisambiguationMatches] = useState<PhysicalBlink[]>([]);
  const [showDisambiguationModal, setShowDisambiguationModal] = useState(false);
  const [userBalanceSol, setUserBalanceSol] = useState<number | null>(() => {
    const acc = WalletProviderService.getActiveAccount();
    return acc?.publicKey ? SolanaService.getCachedSol(acc.publicKey) : null;
  });
  const [userBalanceUsdc, setUserBalanceUsdc] = useState<number | null>(() => {
    const acc = WalletProviderService.getActiveAccount();
    return acc?.publicKey ? SolanaService.getCachedUsdc(acc.publicKey) : null;
  });
  const [userBalanceSkr, setUserBalanceSkr] = useState<number | null>(() => {
    const acc = WalletProviderService.getActiveAccount();
    return acc?.publicKey ? SolanaService.getCachedSkr(acc.publicKey) : null;
  });

  const fetchUserBalances = async (pubkey: string) => {
    if (!pubkey) return;
    try {
      const [sol, usdc, skr] = await Promise.all([
        SolanaService.getBalance(pubkey),
        SolanaService.getUsdcBalance(pubkey),
        SolanaService.getSkrBalance(pubkey, true),
      ]);
      setUserBalanceSol(sol);
      setUserBalanceUsdc(usdc);
      setUserBalanceSkr(skr);
    } catch {
      // Retain previous known balances
    }
  };

  useEffect(() => {
    const unsub = WalletProviderService.subscribe((acc) => {
      setActiveAccount(acc);
      if (acc?.publicKey) {
        fetchUserBalances(acc.publicKey);
      } else {
        setUserBalanceSol(null);
        setUserBalanceUsdc(null);
        setUserBalanceSkr(null);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (activeAccount?.publicKey) {
      fetchUserBalances(activeAccount.publicKey);
      const iv = setInterval(() => {
        fetchUserBalances(activeAccount.publicKey);
      }, 12000);
      return () => clearInterval(iv);
    }
  }, [activeAccount?.publicKey]);

  const [, setPriceTick] = useState(0);

  useEffect(() => {
    const unsub = PriceService.subscribe(() => setPriceTick(prev => prev + 1));
    return () => unsub();
  }, []);

  useEffect(() => {
    setIsNfcHardwareSupported(NfcService.isHardwareSupported());
  }, []);

  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('navigator.clipboard.writeText failed:', err);
      }
    }
    if (typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) return true;
      } catch (err) {
        console.warn('execCommand copy failed:', err);
      }
    }
    return false;
  };

  const fetchRecipientBalance = async (pubkey: string, token: 'SOL' | 'USDC' | 'SKR' = resolvedBlink?.token || 'SOL') => {
    if (!pubkey) return;
    try {
      if (token === 'USDC') {
        const bal = await SolanaService.getUsdcBalance(pubkey);
        setRecipientBalance(bal);
      } else {
        const bal = await SolanaService.getBalance(pubkey);
        setRecipientBalance(bal);
      }
    } catch {
      setRecipientBalance(null);
    }
  };

  useEffect(() => {
    if (resolvedBlink?.recipient) {
      fetchRecipientBalance(resolvedBlink.recipient, resolvedBlink.token);
      const iv = setInterval(() => {
        fetchRecipientBalance(resolvedBlink.recipient, resolvedBlink.token);
      }, 15000);
      return () => clearInterval(iv);
    } else {
      setRecipientBalance(null);
    }
  }, [resolvedBlink?.recipient, resolvedBlink?.token]);

  // Real Hardware Web NFC Listener
  useEffect(() => {
    if (activeMode === 'nfc') {
      NfcService.startListening();

      const unsubscribe = NfcService.subscribe((payload) => {
        setNfcTapped(true);
        handleResolveIdOrUrl(payload.url);
        setTimeout(() => setNfcTapped(false), 2000);
      });

      return () => {
        NfcService.stopListening();
        unsubscribe();
      };
    }
  }, [activeMode]);

  const handleResolveIdOrUrl = (query: string) => {
    if (!activeAccount?.publicKey) {
      ToastService.error('Guests cannot tap or scan Blinks. Please sign in to continue.');
      onOpenWalletConnect();
      return;
    }

    setError(null);
    setTxSignature(null);
    setResolving(true);

    const matches = PhysicalBlinkRegistry.resolveAll(query);
    if (matches.length > 1) {
      setDisambiguationMatches(matches);
      setShowDisambiguationModal(true);
      setResolving(false);
      return;
    }

    const blink = matches.length === 1 ? matches[0] : PhysicalBlinkRegistry.resolve(query);
    if (blink) {
      setResolvedBlink(blink);
      fetchRecipientBalance(blink.recipient, blink.token);
    } else {
      setError(`No Physical Blink registered for "${query}". Check the ID or register it in Studio.`);
    }
    setResolving(false);
  };

  const handleExecutePayment = async () => {
    if (!resolvedBlink) return;
    setError(null);

    const activeAcc = WalletProviderService.getActiveAccount() || activeAccount;
    if (!activeAcc?.publicKey) {
      ToastService.error('Guests cannot authorize payments. Please sign in.');
      onOpenWalletConnect();
      return;
    }

    const userProfile = UserProfileService.getProfile();
    const userBlinkId = BlinkIdService.formatBlinkId(userProfile.username || userProfile.displayName, activeAcc?.publicKey).toLowerCase();
    const userUsername = (userProfile.username || '').trim().toLowerCase().replace(/^@+/, '');
    const myAddress = (activeAcc?.publicKey || '').trim().toLowerCase();

    const recipientClean = (resolvedBlink?.recipient || '').trim().toLowerCase().replace(/^@+/, '');
    const ownerClean = (resolvedBlink?.owner || '').trim().toLowerCase().replace(/^@+/, '');
    const creatorClean = (resolvedBlink?.creatorAddress || '').trim().toLowerCase().replace(/^@+/, '');

    const isOwnerOfBlink = Boolean(
      activeAcc?.publicKey &&
      resolvedBlink &&
      (
        (myAddress && (recipientClean === myAddress || ownerClean === myAddress || creatorClean === myAddress)) ||
        (userUsername && (recipientClean === userUsername || ownerClean === userUsername || creatorClean === userUsername)) ||
        (userBlinkId && (resolvedBlink.recipient?.toLowerCase() === userBlinkId || resolvedBlink.owner?.toLowerCase() === userBlinkId))
      )
    );

    if (isOwnerOfBlink) {
      const msg = "It's not possible to send funds to your own wallet address or Blink.";
      setError(msg);
      ToastService.error(msg);
      return;
    }

    setAuthorizing(true);
    try {
      const senderPubkeyStr = activeAcc.publicKey;

      const [freshSol, freshUsdc, freshSkr] = await Promise.all([
        SolanaService.getBalance(senderPubkeyStr, true),
        SolanaService.getUsdcBalance(senderPubkeyStr, true),
        SolanaService.getSkrBalance(senderPubkeyStr, true),
      ]);
      setUserBalanceSol(freshSol);
      setUserBalanceUsdc(freshUsdc);
      setUserBalanceSkr(freshSkr);

      const MIN_GAS_SOL = 0.00001; // Minimum SOL required for network transaction gas

      const streakBonus = StreakService.getStreakBonusPercent();
      const liveDetails = PriceService.getLiveBlinkDetails(resolvedBlink, streakBonus);
      const checkoutAmount = liveDetails.displayAmount;

      if (resolvedBlink.token === 'USDC') {
        if (freshUsdc < resolvedBlink.amount) {
          const msg = `Insufficient USDC balance. You have $${freshUsdc.toFixed(2)} USDC, but this Blink requires $${resolvedBlink.amount.toFixed(2)} USDC.`;
          setError(msg);
          ToastService.error(msg);
          setAuthorizing(false);
          return;
        }
        if (freshSol < MIN_GAS_SOL) {
          const msg = `Insufficient SOL for network fee. You need at least 0.00001 SOL for Solana gas, but have ${freshSol.toFixed(4)} SOL.`;
          setError(msg);
          ToastService.error(msg);
          setAuthorizing(false);
          return;
        }
      } else if (resolvedBlink.token === 'SKR') {
        if (freshSkr < checkoutAmount) {
          const msg = `Insufficient SKR balance. You have ${freshSkr.toFixed(2)} SKR, but this Blink requires ${checkoutAmount.toFixed(2)} SKR.`;
          setError(msg);
          ToastService.error(msg);
          setAuthorizing(false);
          return;
        }
        if (freshSol < MIN_GAS_SOL) {
          const msg = `Insufficient SOL for network fee. You need at least 0.00001 SOL for Solana gas, but have ${freshSol.toFixed(4)} SOL.`;
          setError(msg);
          ToastService.error(msg);
          setAuthorizing(false);
          return;
        }
      } else {
        const totalNeeded = resolvedBlink.amount + MIN_GAS_SOL;
        if (freshSol < totalNeeded) {
          const msg = `Insufficient SOL balance. You have ${freshSol.toFixed(4)} SOL, but this transaction requires ${totalNeeded.toFixed(4)} SOL (including network gas fee).`;
          setError(msg);
          ToastService.error(msg);
          setAuthorizing(false);
          return;
        }
      }

      // 2. Biometric / Fingerprint confirmation
      const priceLabel = resolvedBlink.token === 'SOL'
        ? `${resolvedBlink.amount} SOL`
        : (resolvedBlink.token === 'SKR'
          ? `${checkoutAmount} SKR`
          : `$${resolvedBlink.amount.toFixed(2)} USDC`);
      const isAuth = await BiometricService.authenticate(
        `Authorize ${priceLabel} to ${resolvedBlink.name}`
      );
      if (!isAuth.success) {
        throw new Error(isAuth.error || 'Biometric authorization cancelled or failed.');
      }

      if (!activeAccount) {
        throw new Error('Please connect your Solana wallet first');
      }
      const connection = SolanaService.getConnection();
      const senderPubkey = new PublicKey(activeAccount.publicKey);
      let recipientPubkey: PublicKey;
      try {
        recipientPubkey = new PublicKey(resolvedBlink.recipient);
      } catch {
        recipientPubkey = senderPubkey;
      }

      let transaction: Transaction;
      if (resolvedBlink.token === 'USDC') {
        // Native SPL USDC transfer on Solana network
        transaction = await SolanaService.buildUsdcTransferTransaction(
          senderPubkey,
          recipientPubkey,
          resolvedBlink.amount
        );
      } else if (resolvedBlink.token === 'SKR') {
        // Native SPL SKR transfer on Solana network
        transaction = await SolanaService.buildSkrTransferTransaction(
          senderPubkey,
          recipientPubkey,
          checkoutAmount
        );
      } else {
        // Native SOL transfer on Solana network
        const lamports = Math.round(resolvedBlink.amount * LAMPORTS_PER_SOL);
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: senderPubkey,
            toPubkey: recipientPubkey,
            lamports,
          })
        );
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = senderPubkey;
      }

      const signature = await WalletProviderService.signAndSendTransaction(transaction);

      // Non-blocking: verify transaction on-chain in background (don't block success UI)
      connection.getLatestBlockhash('confirmed').then((latestBlockhash) => {
        connection.confirmTransaction(
          { signature, ...latestBlockhash },
          'confirmed'
        ).then((confirmation) => {
          if (confirmation?.value?.err) {
            console.warn('TapScan payment failed on-chain after broadcast:', confirmation.value.err);
            ToastService.error('Transaction may have failed on-chain. Please check your balance.');
          }
        }).catch((confirmErr) => {
          console.warn('TapScan confirmation check error (may still succeed):', confirmErr);
        });
      }).catch(() => {});


      setTxSignature(signature);
      PhysicalBlinkRegistry.recordTap(resolvedBlink.id, true, resolvedBlink.amount);

      const freshBlink = PhysicalBlinkRegistry.resolve(resolvedBlink.id);
      if (freshBlink) {
        setResolvedBlink({ ...freshBlink });
      }

      // Save official non-custodial receipt
      const rcpt: TransactionReceipt = {
        id: `rcpt_${signature.slice(0, 10)}`,
        signature,
        blinkTitle: resolvedBlink.name,
        blinkId: resolvedBlink.id,
        amount: resolvedBlink.amount,
        token: resolvedBlink.token,
        payerAddress: activeAccount?.publicKey || '',
        recipientAddress: resolvedBlink.recipient,
        timestamp: Date.now(),
        status: 'confirmed',
        method: activeMode === 'nfc' ? 'nfc_tap' : 'qr_scan',
        actionType: resolvedBlink.actionType,
        verifiedDomain: resolvedBlink.verifiedDomain,
      };
      ReceiptService.saveReceipt(rcpt);
      NotificationService.notifyPaymentSent(resolvedBlink.amount, resolvedBlink.token, resolvedBlink.recipient, signature);
      
      // Only notify Blink Sale if the active user is actually the creator/recipient of this Blink
      const isOwnerOrRecipient = Boolean(
        activeAccount?.publicKey &&
        resolvedBlink.recipient &&
        (resolvedBlink.recipient === activeAccount.publicKey || resolvedBlink.recipient.toLowerCase() === activeAccount.publicKey.toLowerCase())
      );
      if (isOwnerOrRecipient) {
        NotificationService.notifyBlinkPaid(
          resolvedBlink.name,
          resolvedBlink.amount,
          resolvedBlink.token,
          activeAccount?.publicKey || 'Solana Wallet',
          signature,
          resolvedBlink.id
        );
      }

      // Optimistically update cached balance so UI reflects new balance at 0 milliseconds
      if (activeAccount?.publicKey) {
        const currentSol = (SolanaService.getCachedSol(activeAccount.publicKey) ?? userBalanceSol) || 0;
        const currentUsdc = (SolanaService.getCachedUsdc(activeAccount.publicKey) ?? userBalanceUsdc) || 0;
        const currentSkr = (SolanaService.getCachedSkr(activeAccount.publicKey) ?? userBalanceSkr) || 0;
        if (resolvedBlink.token === 'SOL') {
          const nextSol = Math.max(0, Number((currentSol - resolvedBlink.amount - 0.000005).toFixed(4)));
          SolanaService.setCachedBalance(activeAccount.publicKey, nextSol);
          setUserBalanceSol(nextSol);
        } else if (resolvedBlink.token === 'SKR') {
          const nextSkr = Math.max(0, Number((currentSkr - checkoutAmount).toFixed(2)));
          SolanaService.setCachedBalance(activeAccount.publicKey, undefined, undefined, nextSkr);
          setUserBalanceSkr(nextSkr);
        } else {
          const nextUsdc = Math.max(0, Number((currentUsdc - resolvedBlink.amount).toFixed(2)));
          SolanaService.setCachedBalance(activeAccount.publicKey, undefined, nextUsdc);
          setUserBalanceUsdc(nextUsdc);
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('blink_balance_refresh'));
        window.dispatchEvent(new CustomEvent('blink_tx_updated', { detail: rcpt }));
        window.dispatchEvent(new CustomEvent('blink_registry_updated', { detail: freshBlink || resolvedBlink }));
      }

      const displayPaid = resolvedBlink.token === 'SOL'
        ? `${resolvedBlink.amount} SOL`
        : (resolvedBlink.token === 'SKR'
          ? `${checkoutAmount.toFixed(2)} SKR`
          : `$${resolvedBlink.amount.toFixed(2)} USDC`);
      ToastService.success(`Payment of ${displayPaid} confirmed on-chain.`);

      // Refresh balances automatically as funds land
      setTimeout(async () => {
        await Promise.all([
          fetchRecipientBalance(resolvedBlink.recipient, resolvedBlink.token),
          fetchUserBalances(activeAcc.publicKey),
        ]);
      }, 1200);
      setTimeout(async () => {
        await Promise.all([
          fetchRecipientBalance(resolvedBlink.recipient, resolvedBlink.token),
          fetchUserBalances(activeAcc.publicKey),
        ]);
      }, 3500);
    } catch (err: any) {
      console.error('TapScan on-chain payment error:', err);
      const errorMsg = err?.message || `Transaction failed. Please check your ${resolvedBlink.token} balance.`;
      setError(errorMsg);
      ToastService.error(errorMsg);
    } finally {
      setAuthorizing(false);
    }
  };

  const handleReset = () => {
    setResolvedBlink(null);
    setRecipientBalance(null);
    setTxSignature(null);
    setError(null);
    setInputId('');
  };

  const getBlinkLogo = (id: string, blink?: PhysicalBlink) => {
    const item = blink || resolvedBlink;
    if (item?.imageUrl) {
      return (
        <Image
          source={{ uri: item.imageUrl }}
          style={{ width: 36, height: 36, borderRadius: 10 }}
          resizeMode="cover"
        />
      );
    }
    const cleanId = id.toLowerCase();
    if (cleanId.includes('coffee')) return <CoffeeShopLogo size={36} />;
    if (cleanId.includes('pass') || cleanId.includes('event')) return <HackerHouseLogo size={36} />;
    return <BlinkBrandMark size={32} variant="white" />;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Header Explainer Card */}
      <View style={[styles.introCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.introTopRow}>
          <View style={styles.introTag}>
            <Radio size={11} color={colors.accent} />
            <Text style={styles.introTagText}>PHYSICAL INTERACTION LAYER</Text>
          </View>
        </View>

        <Text style={[styles.introTitle, { color: colors.textPrimary }]}>Tap or Scan to Execute Actions</Text>
        <Text style={[styles.introSubtitle, { color: colors.textSecondary }]}>
          Tap an NFC tag or scan a QR code to authorize instant Solana transactions.
        </Text>
      </View>

      {/* Segmented Mode Selector matching Markets Screen Filter Pills */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[
            styles.filterPill,
            { backgroundColor: colors.bgCard, borderColor: colors.border },
            activeMode === 'nfc' && [
              styles.filterPillActive,
              {
                backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                borderColor: isDark ? '#FFFFFF' : '#0F172A',
              },
            ],
          ]}
          onPress={() => setActiveMode('nfc')}
          activeOpacity={0.8}
        >
          <Radio size={14} color={activeMode === 'nfc' ? (isDark ? '#07080B' : '#FFFFFF') : colors.textMuted} />
          <Text
            style={[
              styles.filterText,
              { color: colors.textMuted },
              activeMode === 'nfc' && [
                styles.filterTextActive,
                { color: isDark ? '#07080B' : '#FFFFFF', fontWeight: '700' },
              ],
            ]}
          >
            NFC Hardware Tap
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterPill,
            { backgroundColor: colors.bgCard, borderColor: colors.border },
            activeMode === 'qr' && [
              styles.filterPillActive,
              {
                backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                borderColor: isDark ? '#FFFFFF' : '#0F172A',
              },
            ],
          ]}
          onPress={() => setActiveMode('qr')}
          activeOpacity={0.8}
        >
          <Scan size={14} color={activeMode === 'qr' ? (isDark ? '#07080B' : '#FFFFFF') : colors.textMuted} />
          <Text
            style={[
              styles.filterText,
              { color: colors.textMuted },
              activeMode === 'qr' && [
                styles.filterTextActive,
                { color: isDark ? '#07080B' : '#FFFFFF', fontWeight: '700' },
              ],
            ]}
          >
            Live Camera QR
          </Text>
        </TouchableOpacity>
      </View>

      {/* State 1: Active Hardware NFC Tap Mode */}
      {!resolvedBlink && activeMode === 'nfc' && (
        <View style={[styles.radarCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.hwStatusRow}>
            {isNfcHardwareSupported ? (
              <View style={styles.hwBadgeActive}>
                <View style={styles.hwDotGreen} />
                <Text style={styles.hwTextGreen}>Web NFC Hardware Active</Text>
              </View>
            ) : (
              <View style={styles.hwBadgeWarn}>
                <Info size={12} color={colors.accent} />
                <Text style={styles.hwTextWarn}>Web NFC active on Android Chrome. QR scanner available below.</Text>
              </View>
            )}
          </View>

          {/* Sleek Periwinkle Pulse Radar */}
          <TouchableOpacity
            style={[styles.radarCircle, nfcTapped && styles.radarCircleSuccess]}
            onPress={() => {
              if (!activeAccount?.publicKey) {
                ToastService.error('Guests cannot tap Blinks. Please sign in first.');
                onOpenWalletConnect();
              }
            }}
            activeOpacity={!activeAccount?.publicKey ? 0.7 : 1}
          >
            {nfcTapped ? (
              <CheckCircle2 size={44} color="#10B981" />
            ) : !activeAccount?.publicKey ? (
              <Lock size={40} color={colors.accent} />
            ) : (
              <Radio size={44} color={colors.accent} />
            )}
          </TouchableOpacity>

          <Text style={[styles.radarTitle, { color: colors.textPrimary }]}>
            {nfcTapped
              ? 'Physical Blink Detected!'
              : !activeAccount?.publicKey
              ? 'Sign In to Tap Blinks'
              : 'Ready to Tap'}
          </Text>
          <Text style={[styles.radarSubtitle, { color: colors.textSecondary }]}>
            {!activeAccount?.publicKey
              ? 'Guests cannot tap or authorize physical Blinks. Sign in with Privy or your Solana wallet to interact with physical tags.'
              : isNfcHardwareSupported
              ? 'Hold your mobile device against any Physical Blink NFC tag.'
              : 'Web NFC hardware listener is active. On devices without NFC hardware, switch to Live Camera QR scanner.'}
          </Text>

          {!activeAccount?.publicKey && (
            <TouchableOpacity
              style={[styles.primaryActionBtn, { marginTop: 18 }]}
              onPress={onOpenWalletConnect}
              activeOpacity={0.8}
            >
              <Lock size={16} color="#FFFFFF" />
              <Text style={styles.primaryActionBtnText}>Sign In with Privy to Tap</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* State 2: QR & Camera Scanner Mode */}
      {!resolvedBlink && activeMode === 'qr' && (
        <View style={{ width: '100%' }}>
          {showCameraScanner ? (
            <CameraQrScanner
              onScan={(data) => {
                setShowCameraScanner(false);
                handleResolveIdOrUrl(data);
              }}
              onClose={() => setShowCameraScanner(false)}
            />
          ) : (
            <View style={[styles.cameraHeroCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.cameraIconCircle}>
                <Camera size={24} color="#5B67F6" />
              </View>
              <Text style={[styles.cameraHeroTitle, { color: colors.textPrimary }]}>Live Camera QR Scanner</Text>
              <Text style={[styles.cameraHeroSub, { color: colors.textSecondary }]}>
                Scan physical QR codes on counter displays, wristbands, or cards.
              </Text>

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => {
                  if (!activeAccount?.publicKey) {
                    ToastService.error('Guests cannot scan or tap Blinks. Please sign in first.');
                    onOpenWalletConnect();
                    return;
                  }
                  setShowCameraScanner(true);
                }}
                activeOpacity={0.8}
              >
                <Camera size={15} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnText}>Launch Camera Scanner</Text>
              </TouchableOpacity>

              {/* Manual ID Resolver Divider */}
              <View style={styles.orDividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.orText, { color: colors.textMuted }]}>OR LOOKUP BY BLINK ID</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              {/* Quick ID Resolver Input */}
              <View style={[styles.inputContainer, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="e.g. coffee-shop-001"
                  placeholderTextColor={colors.textMuted}
                  value={inputId}
                  onChangeText={setInputId}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.resolveBtn}
                  onPress={() => {
                    if (!activeAccount?.publicKey) {
                      ToastService.error('Guests cannot scan or tap Blinks. Please sign in first.');
                      onOpenWalletConnect();
                      return;
                    }
                    handleResolveIdOrUrl(inputId);
                  }}
                  disabled={resolving || !inputId.trim()}
                >
                  {resolving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.resolveBtnText}>Resolve</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* State 3: Resolved Action Detail Card (Adaptive Light/Dark Theme & High Contrast) */}
      {resolvedBlink && !txSignature && (
        <View style={[styles.detailCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.detailTopRow}>
            <View style={styles.detailLogoWrap}>
              {getBlinkLogo(resolvedBlink.id, resolvedBlink)}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>{resolvedBlink.name}</Text>
              <View style={styles.verifiedRow}>
                <ShieldCheck size={13} color="#10B981" />
                <Text style={styles.verifiedText}>Verified Solana Action</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleReset} style={[styles.cancelBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Back</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.detailDesc, { color: colors.textSecondary }]}>{resolvedBlink.description}</Text>

          {/* Amount Hero */}
          {(() => {
            const streakBonus = StreakService.getStreakBonusPercent();
            const liveDetails = PriceService.getLiveBlinkDetails(resolvedBlink, streakBonus);

            return (
              <View style={styles.amountHeroContainer}>
                {resolvedBlink.token === 'SKR' && liveDetails.fullAmount > liveDetails.displayAmount && (
                  <View style={styles.originalPriceRow}>
                    <Text style={[styles.originalPriceText, { color: colors.textMuted }]}>
                      {liveDetails.fullString}
                    </Text>
                    <Text style={[styles.originalPriceUsdc, { color: colors.textMuted }]}>
                      (${liveDetails.baseUsdc.toFixed(2)})
                    </Text>
                  </View>
                )}
                <View style={styles.amountHeroRow}>
                  <Text style={[styles.amountValue, { color: colors.textPrimary }]}>
                    {liveDetails.displayString}
                  </Text>
                  {resolvedBlink.token === 'SKR' && (
                    <View style={styles.skrDiscountBadge}>
                      <Text style={styles.skrDiscountBadgeText}>
                        {liveDetails.discountPercent > 10
                          ? `${liveDetails.discountPercent}% SKR Discount`
                          : '10% SKR Discount'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })()}

          {/* Detail Properties Table */}
          <View style={[styles.propsTable, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
            <View style={styles.propRow}>
              <Text style={[styles.propLabel, { color: colors.textSecondary }]}>Blink ID</Text>
              <TouchableOpacity
                onPress={async () => {
                  const ok = await copyToClipboard(resolvedBlink.id);
                  if (ok) ToastService.success(`Blink ID copied: ${resolvedBlink.id}`);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                activeOpacity={0.7}
              >
                <Text style={[styles.propValue, { fontFamily: 'monospace', color: colors.accent, fontWeight: '700' }]}>
                  {resolvedBlink.id}
                </Text>
                <Copy size={12} color={colors.accent} />
              </TouchableOpacity>
            </View>

            <View style={[styles.propRow, { alignItems: 'flex-start', paddingVertical: 8 }]}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.propLabel, { color: colors.textSecondary }]}>Receiving Address</Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  const ok = await copyToClipboard(resolvedBlink.recipient);
                  if (ok) ToastService.success('Receiving address copied.');
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgCard, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                activeOpacity={0.7}
              >
                <Text style={[styles.propValue, { fontFamily: 'monospace', color: colors.textPrimary }]}>
                  {`${resolvedBlink.recipient.slice(0, 5)}...${resolvedBlink.recipient.slice(-5)}`}
                </Text>
                <Copy size={12} color={colors.accent} />
              </TouchableOpacity>
            </View>

            <View style={styles.propRow}>
              <Text style={[styles.propLabel, { color: colors.textSecondary }]}>Settlement Speed</Text>
              <Text style={[styles.propValue, { color: colors.textPrimary }]}>~400ms Sub-second Finality</Text>
            </View>
            <View style={styles.propRow}>
              <Text style={[styles.propLabel, { color: colors.textSecondary }]}>Network Fee</Text>
              <Text style={[styles.propValue, { color: colors.textPrimary }]}>&lt; $0.00025 SOL</Text>
            </View>
          </View>

          {/* User Available Balance Indicator */}
          {activeAccount?.publicKey && (
            <View style={[styles.userBalanceBar, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Wallet size={13} color={colors.textSecondary} />
                <Text style={[styles.userBalanceLabel, { color: colors.textSecondary }]}>Your Balance:</Text>
              </View>
              {(() => {
                const streakBonus = StreakService.getStreakBonusPercent();
                const liveDetails = PriceService.getLiveBlinkDetails(resolvedBlink, streakBonus);
                const checkoutAmount = liveDetails.displayAmount;

                const isInsufficient = resolvedBlink.token === 'USDC'
                  ? (userBalanceUsdc !== null && userBalanceUsdc < resolvedBlink.amount)
                  : (resolvedBlink.token === 'SKR'
                    ? (userBalanceSkr !== null && userBalanceSkr < checkoutAmount)
                    : (userBalanceSol !== null && userBalanceSol < resolvedBlink.amount + 0.00001));

                return (
                  <Text
                    style={[
                      styles.userBalanceVal,
                      {
                        color: isInsufficient ? '#EF4444' : colors.textPrimary,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {resolvedBlink.token === 'USDC'
                      ? `${userBalanceUsdc !== null ? `$${userBalanceUsdc.toFixed(2)} USDC` : 'Loading...'}`
                      : (resolvedBlink.token === 'SKR'
                        ? `${userBalanceSkr !== null ? `${userBalanceSkr.toLocaleString('en-US', { maximumFractionDigits: 2 })} SKR` : 'Loading...'}`
                        : `${userBalanceSol !== null ? `${userBalanceSol.toFixed(4)} SOL` : 'Loading...'}`)}
                  </Text>
                );
              })()}
            </View>
          )}

          {/* Owner Notice & Authorize Action Button */}
          {(() => {
            const userProf = UserProfileService.getProfile();
            const myBlinkId = BlinkIdService.formatBlinkId(userProf.username || userProf.displayName, activeAccount?.publicKey).toLowerCase();
            const myUname = (userProf.username || '').trim().toLowerCase().replace(/^@+/, '');
            const myAddr = (activeAccount?.publicKey || '').trim().toLowerCase();

            const rClean = (resolvedBlink?.recipient || '').trim().toLowerCase().replace(/^@+/, '');
            const oClean = (resolvedBlink?.owner || '').trim().toLowerCase().replace(/^@+/, '');
            const cClean = (resolvedBlink?.creatorAddress || '').trim().toLowerCase().replace(/^@+/, '');

            const isOwner = Boolean(
              activeAccount?.publicKey &&
              resolvedBlink &&
              (
                (myAddr && (rClean === myAddr || oClean === myAddr || cClean === myAddr)) ||
                (myUname && (rClean === myUname || oClean === myUname || cClean === myUname)) ||
                (myBlinkId && (resolvedBlink.recipient?.toLowerCase() === myBlinkId || resolvedBlink.owner?.toLowerCase() === myBlinkId))
              )
            );

            return (
              <>
                {isOwner && (
                  <View style={{ backgroundColor: 'rgba(99, 102, 241, 0.12)', borderColor: '#6366F1', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Info size={18} color="#6366F1" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>You created this Blink</Text>
                      <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>Self-payment to your own wallet is disabled. Share your Blink ID or QR tag to receive payments from others.</Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.primaryActionBtn,
                    isOwner && { backgroundColor: colors.bgCardAlt, borderColor: colors.border, borderWidth: 1, opacity: 0.65 }
                  ]}
                  onPress={handleExecutePayment}
                  disabled={authorizing || isOwner}
                  activeOpacity={0.8}
                >
                  {authorizing ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : isOwner ? (
                    <>
                      <ShieldCheck size={16} color={colors.textMuted} />
                      <Text style={[styles.primaryActionBtnText, { color: colors.textMuted }]}>
                        Your Blink (Self-Payment Disabled)
                      </Text>
                    </>
                  ) : !activeAccount?.publicKey ? (
                    <>
                      <Lock size={16} color="#FFFFFF" />
                      <Text style={styles.primaryActionBtnText}>Sign In with Privy to Authorize</Text>
                    </>
                  ) : (
                    <>
                      <Lock size={16} color="#FFFFFF" />
                      {(() => {
                        const streakBonus = StreakService.getStreakBonusPercent();
                        const liveDetails = PriceService.getLiveBlinkDetails(resolvedBlink, streakBonus);

                        return (
                          <Text style={styles.primaryActionBtnText}>
                            {resolvedBlink.token === 'SOL'
                              ? `Authorize ${resolvedBlink.amount} SOL`
                              : resolvedBlink.token === 'SKR'
                                ? `Authorize ${liveDetails.displayString}`
                                : `Authorize $${resolvedBlink.amount.toFixed(2)} USDC`}
                          </Text>
                        );
                      })()}
                    </>
                  )}
                </TouchableOpacity>
              </>
            );
          })()}
        </View>
      )}

      {/* State 4: Transaction Confirmed Receipt */}
      {txSignature && resolvedBlink && (
        <View style={[styles.receiptCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <CheckCircle2 size={54} color="#10B981" />
          <Text style={[styles.receiptTitle, { color: colors.textPrimary }]}>Payment Settled!</Text>
          <Text style={styles.receiptAmount}>
            {resolvedBlink.token === 'SOL' ? `${resolvedBlink.amount} SOL` : `$${resolvedBlink.amount.toFixed(2)} ${resolvedBlink.token}`}
          </Text>
          <Text style={[styles.receiptTo, { color: colors.textSecondary }]}>Sent to {resolvedBlink.name}</Text>

          {/* Expand to Official Receipt Modal with Download Option */}
          <TouchableOpacity
            style={[styles.receiptActionBtn, { backgroundColor: colors.accent }]}
            onPress={() => {
              if (txSignature) {
                const r = ReceiptService.getReceiptBySignature(txSignature);
                if (r) setActiveReceipt(r);
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.receiptActionBtnText}>View & Download Receipt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.solscanBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
            onPress={() =>
              window.open?.(
                SolanaService.getExplorerUrl(txSignature),
                '_blank'
              )
            }
          >
            <Text style={[styles.solscanBtnText, { color: colors.textPrimary }]}>View on Solana Explorer</Text>
            <ExternalLink size={13} color="#5B67F6" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
            onPress={handleReset}
          >
            <Text style={[styles.doneBtnText, { color: colors.textPrimary }]}>Tap Next Blink</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Official Transaction Receipt Modal */}
      <ReceiptModal
        visible={!!activeReceipt}
        receipt={activeReceipt}
        viewerAddress={activeAccount?.publicKey}
        onClose={() => setActiveReceipt(null)}
      />

      {/* Disambiguation Modal for Multiple Creators with Same Blink ID */}
      <Modal
        visible={showDisambiguationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDisambiguationModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 20, width: '100%', maxWidth: 440 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }}>Choose Creator to Pay</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Multiple creators registered a Blink with this ID.</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDisambiguationModal(false)}
                style={{ padding: 6, borderRadius: 12, backgroundColor: colors.bgCardAlt }}
              >
                <X size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {disambiguationMatches.map((m, idx) => {
                const creatorShort = (m.creatorAddress || m.recipient).slice(0, 6) + '...' + (m.creatorAddress || m.recipient).slice(-4);
                return (
                  <TouchableOpacity
                    key={`${m.id}-${m.recipient}-${idx}`}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.bgCardAlt,
                      marginBottom: 8,
                    }}
                    onPress={() => {
                      setResolvedBlink(m);
                      fetchRecipientBalance(m.recipient, m.token);
                      setShowDisambiguationModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>{m.name}</Text>
                      <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                        {m.verifiedDomain ? m.verifiedDomain : `Creator: ${creatorShort}`}
                      </Text>
                      {m.description ? (
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                          {m.description}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: '#10B981', fontWeight: '800', fontSize: 13 }}>
                        {m.token === 'SKR' && m.baseUsdcAmount ? `${m.amount} SKR` : (m.token === 'SOL' ? `${m.amount} SOL` : `$${m.amount} USDC`)}
                      </Text>
                      <View style={{ marginTop: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.accent }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>Select</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={{ height: 130 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080B',
  },
  content: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 130,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  introCard: {
    backgroundColor: '#0F111A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 10,
    marginBottom: 8,
  },
  introTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  introTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(91, 103, 246, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  introTagText: {
    color: '#818CF8',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  aboutLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aboutLinkText: {
    color: '#818CF8',
    fontSize: 9.5,
    fontWeight: '700',
  },
  introTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  introSubtitle: {
    color: '#94A3B8',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#12141F',
    borderWidth: 1,
    borderColor: '#1D212E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  filterPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  filterText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#07080B',
    fontWeight: '700',
  },
  radarCard: {
    backgroundColor: '#0F111A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 12,
    alignItems: 'center',
    textAlign: 'center',
  },
  hwStatusRow: {
    marginBottom: 10,
  },
  hwBadgeActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  hwDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  hwTextGreen: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  hwBadgeWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(91, 103, 246, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  hwTextWarn: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '600',
  },
  radarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(91, 103, 246, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(91, 103, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  radarCircleSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  radarTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  radarSubtitle: {
    color: '#94A3B8',
    fontSize: 9.5,
    textAlign: 'center',
    lineHeight: 15,
    maxWidth: 300,
  },
  cameraHeroCard: {
    backgroundColor: '#0F111A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 12,
    alignItems: 'center',
  },
  cameraIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(91, 103, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  cameraHeroTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  cameraHeroSub: {
    color: '#94A3B8',
    fontSize: 9.5,
    textAlign: 'center',
    lineHeight: 14,
    maxWidth: 300,
    marginBottom: 8,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#5B67F6',
    width: '100%',
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#5B67F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 6,
    gap: 6,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1D212E',
  },
  orText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 3,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 4,
    fontSize: 11,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  resolveBtn: {
    backgroundColor: '#5B67F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolveBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 9.5,
    textAlign: 'center',
  },
  detailCard: {
    backgroundColor: '#0F111A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 14,
  },
  detailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLogoWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#090A0F', // Always dark circle so the white logo pops beautifully!
    borderWidth: 1,
    borderColor: '#242838',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  userBalanceBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  userBalanceLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  userBalanceVal: {
    fontSize: 11,
  },
  insufficientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  insufficientBannerText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
  },
  detailTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  verifiedText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: '#181B27',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  detailDesc: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 16,
  },
  amountHeroContainer: {
    marginBottom: 16,
  },
  originalPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  originalPriceText: {
    textDecorationLine: 'line-through',
    fontSize: 13,
    fontWeight: '700',
  },
  originalPriceUsdc: {
    fontSize: 12,
    fontWeight: '600',
  },
  amountHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  amountValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  amountToken: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '700',
  },
  skrDiscountBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'center',
  },
  skrDiscountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#10B981',
  },
  propsTable: {
    backgroundColor: '#12141F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 12,
    marginBottom: 18,
    gap: 8,
  },
  propRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  propLabel: {
    color: '#64748B',
    fontSize: 10,
  },
  propValue: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  receiptCard: {
    backgroundColor: '#0F111A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 28,
    alignItems: 'center',
    textAlign: 'center',
  },
  receiptTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 14,
  },
  receiptAmount: {
    color: '#10B981',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 6,
  },
  receiptTo: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 16,
  },
  receiptActionBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#5B67F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  receiptActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  solscanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#12141F',
    borderWidth: 1,
    borderColor: '#1D212E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  solscanBtnText: {
    color: '#5B67F6',
    fontSize: 11,
    fontWeight: '700',
  },
  doneBtn: {
    backgroundColor: '#5B67F6',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
