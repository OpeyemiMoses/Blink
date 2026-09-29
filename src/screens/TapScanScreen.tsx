import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
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
} from 'lucide-react-native';
import { CameraQrScanner } from '../components/CameraQrScanner';
import { NfcService } from '../services/nfcService';
import { PhysicalBlinkRegistry, PhysicalBlink } from '../services/physicalBlinkRegistry';
import { WalletProviderService, WalletAccount } from '../services/walletProviderService';
import { SolanaService } from '../services/solanaService';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BiometricService } from '../services/biometricService';
import { ToastService } from '../services/toastService';
import { CoffeeShopLogo, MusicianLogo, HackerHouseLogo, BlinkBrandMark } from '../components/BrandLogos';
import { useTheme } from '../theme/ThemeContext';
import { ReceiptService } from '../services/receiptService';
import { ReceiptModal } from '../components/ReceiptModal';
import { TransactionReceipt } from '../types';

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
  const [userBalanceSol, setUserBalanceSol] = useState<number | null>(null);
  const [userBalanceUsdc, setUserBalanceUsdc] = useState<number | null>(null);

  const fetchUserBalances = async (pubkey: string) => {
    if (!pubkey) return;
    try {
      const [sol, usdc] = await Promise.all([
        SolanaService.getBalance(pubkey),
        SolanaService.getUsdcBalance(pubkey),
      ]);
      setUserBalanceSol(sol);
      setUserBalanceUsdc(usdc);
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

  const fetchRecipientBalance = async (pubkey: string, token: 'SOL' | 'USDC' = resolvedBlink?.token || 'SOL') => {
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

    const blink = PhysicalBlinkRegistry.resolve(query);
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

    setAuthorizing(true);
    try {
      const senderPubkeyStr = activeAcc.publicKey;

      // 1. Live Pre-flight balance verification (SOL, USDC, and network fee)
      const [freshSol, freshUsdc] = await Promise.all([
        SolanaService.getBalance(senderPubkeyStr, true),
        SolanaService.getUsdcBalance(senderPubkeyStr, true),
      ]);
      setUserBalanceSol(freshSol);
      setUserBalanceUsdc(freshUsdc);

      const MIN_GAS_SOL = 0.00001; // Minimum SOL required for network transaction gas

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
      const isAuth = await BiometricService.authenticate(
        `Authorize ${resolvedBlink.token === 'SOL' ? `${resolvedBlink.amount} SOL` : `$${resolvedBlink.amount.toFixed(2)} USDC`} to ${resolvedBlink.name}`
      );
      if (!isAuth.success) {
        throw new Error(isAuth.error || 'Biometric authorization cancelled or failed.');
      }

      // 3. Build and sign Solana transaction
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

      // Verify transaction did not fail on-chain
      try {
        const latestBlockhash = await connection.getLatestBlockhash('confirmed');
        const confirmation = await connection.confirmTransaction(
          { signature, ...latestBlockhash },
          'confirmed'
        );
        if (confirmation?.value?.err) {
          throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
        }
      } catch (confirmErr: any) {
        if (confirmErr?.message?.includes('failed on-chain')) {
          throw confirmErr;
        }
      }

      setTxSignature(signature);
      PhysicalBlinkRegistry.recordTap(resolvedBlink.id, true, resolvedBlink.amount);

      // Save official non-custodial receipt
      const rcpt: TransactionReceipt = {
        id: `rcpt_${signature.slice(0, 10)}`,
        signature,
        blinkTitle: resolvedBlink.name,
        blinkId: resolvedBlink.id,
        amount: resolvedBlink.amount,
        token: resolvedBlink.token,
        payerAddress: activeAccount.publicKey,
        recipientAddress: resolvedBlink.recipient,
        timestamp: Date.now(),
        status: 'confirmed',
        method: activeMode === 'nfc' ? 'nfc_tap' : 'qr_scan',
        actionType: resolvedBlink.actionType,
        verifiedDomain: resolvedBlink.verifiedDomain,
      };
      ReceiptService.saveReceipt(rcpt);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('blink_tx_updated', { detail: rcpt }));
      }

      const displayPaid = resolvedBlink.token === 'SOL'
        ? `${resolvedBlink.amount} SOL`
        : `$${resolvedBlink.amount.toFixed(2)} USDC`;
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

  const getBlinkLogo = (id: string) => {
    if (id.includes('coffee')) return <CoffeeShopLogo size={36} />;
    if (id.includes('tip') || id.includes('music')) return <MusicianLogo size={36} />;
    if (id.includes('pass') || id.includes('event')) return <HackerHouseLogo size={36} />;
    return <BlinkBrandMark size={32} variant="white" />;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Header Explainer Card */}
      <View style={[styles.introCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.introTopRow}>
          <View style={styles.introTag}>
            <Radio size={12} color={colors.accent} />
            <Text style={styles.introTagText}>PHYSICAL INTERACTION LAYER</Text>
          </View>
          {onOpenAbout && (
            <TouchableOpacity onPress={onOpenAbout} style={styles.aboutLink}>
              <Sparkles size={11} color={colors.accent} />
              <Text style={styles.aboutLinkText}>What is Blink?</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.introTitle, { color: colors.textPrimary }]}>Tap or Scan to Execute Actions</Text>
        <Text style={[styles.introSubtitle, { color: colors.textSecondary }]}>
          Physical objects become instant Solana Actions. Tap an NFC tag or scan a QR code to authorize real transactions without URLs or friction.
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
                <Camera size={38} color="#5B67F6" />
              </View>
              <Text style={[styles.cameraHeroTitle, { color: colors.textPrimary }]}>Live Camera QR Scanner</Text>
              <Text style={[styles.cameraHeroSub, { color: colors.textSecondary }]}>
                Use your device camera to scan physical QR codes printed on counter displays, wristbands, or physical items.
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
                <Camera size={16} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnText}>Launch Camera Scanner</Text>
              </TouchableOpacity>

              {/* Manual ID Resolver Divider */}
              <View style={styles.orDividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.orText, { color: colors.textMuted }]}>OR LOOKUP BY BLINK ID</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              {/* Quick ID Resolver Input */}
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bgCardAlt, borderColor: colors.border, color: colors.textPrimary }]}
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
              {getBlinkLogo(resolvedBlink.id)}
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
          <View style={styles.amountHero}>
            <Text style={[styles.amountValue, { color: colors.textPrimary }]}>
              {resolvedBlink.token === 'SOL' ? `${resolvedBlink.amount} SOL` : `$${resolvedBlink.amount.toFixed(2)}`}
            </Text>
            {resolvedBlink.token !== 'SOL' && (
              <Text style={styles.amountToken}>{resolvedBlink.token}</Text>
            )}
          </View>

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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#14F195' }} />
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {recipientBalance !== null
                      ? `Live Balance: ${resolvedBlink.token === 'USDC' ? `$${recipientBalance.toFixed(2)} USDC` : `${recipientBalance.toFixed(4)} SOL`}`
                      : 'Checking balance...'}
                  </Text>
                </View>
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
              <Text
                style={[
                  styles.userBalanceVal,
                  {
                    color: (resolvedBlink.token === 'USDC'
                      ? (userBalanceUsdc !== null && userBalanceUsdc < resolvedBlink.amount)
                      : (userBalanceSol !== null && userBalanceSol < resolvedBlink.amount + 0.00001))
                      ? '#EF4444'
                      : colors.textPrimary,
                    fontWeight: '700',
                  },
                ]}
              >
                {resolvedBlink.token === 'USDC'
                  ? `${userBalanceUsdc !== null ? `$${userBalanceUsdc.toFixed(2)} USDC` : 'Loading...'}`
                  : `${userBalanceSol !== null ? `${userBalanceSol.toFixed(4)} SOL` : 'Loading...'}`}
              </Text>
            </View>
          )}

          {/* Insufficient Balance Warning Banner */}
          {activeAccount?.publicKey && (
            (resolvedBlink.token === 'USDC' && userBalanceUsdc !== null && userBalanceUsdc < resolvedBlink.amount) ||
            (resolvedBlink.token === 'SOL' && userBalanceSol !== null && userBalanceSol < resolvedBlink.amount + 0.00001)
          ) && (
            <View style={styles.insufficientBanner}>
              <AlertCircle size={14} color="#EF4444" />
              <Text style={styles.insufficientBannerText}>
                {resolvedBlink.token === 'USDC'
                  ? `Insufficient USDC balance ($${(userBalanceUsdc ?? 0).toFixed(2)} / $${resolvedBlink.amount.toFixed(2)} USDC required)`
                  : `Insufficient SOL balance (${(userBalanceSol ?? 0).toFixed(4)} / ${(resolvedBlink.amount + 0.00001).toFixed(4)} SOL required)`}
              </Text>
            </View>
          )}

          {/* Authorize Action Button */}
          <TouchableOpacity
            style={[
              styles.primaryActionBtn,
              (resolvedBlink.token === 'USDC'
                ? (userBalanceUsdc !== null && userBalanceUsdc < resolvedBlink.amount)
                : (userBalanceSol !== null && userBalanceSol < resolvedBlink.amount + 0.00001)) && { backgroundColor: '#EF4444' }
            ]}
            onPress={handleExecutePayment}
            disabled={authorizing}
            activeOpacity={0.8}
          >
            {authorizing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : !activeAccount?.publicKey ? (
              <>
                <Lock size={16} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnText}>Sign In with Privy to Authorize</Text>
              </>
            ) : (resolvedBlink.token === 'USDC'
                  ? (userBalanceUsdc !== null && userBalanceUsdc < resolvedBlink.amount)
                  : (userBalanceSol !== null && userBalanceSol < resolvedBlink.amount + 0.00001)) ? (
              <>
                <AlertCircle size={16} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnText}>
                  Insufficient {resolvedBlink.token} Balance
                </Text>
              </>
            ) : (
              <>
                <Lock size={16} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnText}>
                  Authorize ${resolvedBlink.amount.toFixed(2)} {resolvedBlink.token}
                </Text>
              </>
            )}
          </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxWidth: 680,
    width: '100%',
    marginHorizontal: 'auto',
  },
  introCard: {
    backgroundColor: '#0F111A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 18,
    marginBottom: 16,
  },
  introTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  introTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(91, 103, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  introTagText: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  aboutLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aboutLinkText: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '700',
  },
  introTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  introSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#12141F',
    borderWidth: 1,
    borderColor: '#1D212E',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  filterPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  filterText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#07080B',
    fontWeight: '700',
  },
  radarCard: {
    backgroundColor: '#0F111A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 30,
    alignItems: 'center',
    textAlign: 'center',
  },
  hwStatusRow: {
    marginBottom: 20,
  },
  hwBadgeActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  hwDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  hwTextGreen: {
    color: '#10B981',
    fontSize: 11,
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
    fontSize: 11,
    fontWeight: '600',
  },
  radarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(91, 103, 246, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(91, 103, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  radarCircleSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  radarTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  radarSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  cameraHeroCard: {
    backgroundColor: '#0F111A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 24,
    alignItems: 'center',
  },
  cameraIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(91, 103, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cameraHeroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  cameraHeroSub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
    marginBottom: 16,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5B67F6',
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: '#5B67F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 18,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1D212E',
  },
  orText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#12141F',
    borderWidth: 1,
    borderColor: '#1D212E',
    borderRadius: 12,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  resolveBtn: {
    backgroundColor: '#5B67F6',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  resolveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
  },
  detailCard: {
    backgroundColor: '#0F111A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 20,
  },
  detailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLogoWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontSize: 12,
    fontWeight: '600',
  },
  userBalanceVal: {
    fontSize: 13,
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
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  detailTitle: {
    color: '#FFFFFF',
    fontSize: 17,
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
    fontSize: 11,
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
    fontSize: 12,
    fontWeight: '600',
  },
  detailDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  amountHero: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 16,
  },
  amountValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  amountToken: {
    color: '#818CF8',
    fontSize: 16,
    fontWeight: '700',
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
    fontSize: 12,
  },
  propValue: {
    color: '#FFFFFF',
    fontSize: 12,
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
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
  },
  receiptAmount: {
    color: '#10B981',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 6,
  },
  receiptTo: {
    color: '#94A3B8',
    fontSize: 13,
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
    fontSize: 14,
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
    fontSize: 13,
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
    fontSize: 14,
    fontWeight: '700',
  },
});
