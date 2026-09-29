import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import {
  ArrowLeft,
  Share2,
  Bookmark,
  ShieldCheck,
  Shield,
  Radio,
  QrCode,
  ExternalLink,
  Lock,
  ArrowRight,
  CheckCircle2,
  Edit3,
  Check,
  X,
  Save,
  DollarSign,
  Fingerprint,
  Copy,
  AlertCircle,
  Users,
  Send,
  Sparkles,
  Layers,
  Trash2,
} from 'lucide-react-native';
import { QRCodeSVG } from 'qrcode.react';
import { PhysicalBlink, PhysicalBlinkRegistry } from '../services/physicalBlinkRegistry';
import { DatabaseService } from '../services/databaseService';
import { ToastService } from '../services/toastService';
import { NfcService } from '../services/nfcService';
import { CoffeeShopLogo, MusicianLogo, HackerHouseLogo, BlinkBrandMark } from './BrandLogos';
import { WalletProviderService } from '../services/walletProviderService';
import { SolanaService } from '../services/solanaService';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { BiometricService } from '../services/biometricService';
import { useTheme } from '../theme/ThemeContext';
import { ReceiptService, BlinkPayerInfo } from '../services/receiptService';
import { ReceiptModal } from './ReceiptModal';
import { TransactionReceipt } from '../types';
import { UserProfileService } from '../services/userProfileService';
import { BlinkIdService } from '../services/blinkIdService';

interface BlinkDetailModalProps {
  blink: PhysicalBlink | null;
  onClose: () => void;
  onOpenWalletConnect: () => void;
  onUpdateBlink?: (updated: PhysicalBlink) => void;
  currentBalanceSol?: number;
  onOpenSend?: (recipientAddress?: string) => void;
}

export const BlinkDetailModal: React.FC<BlinkDetailModalProps> = ({
  blink,
  onClose,
  onOpenWalletConnect,
  onUpdateBlink,
  currentBalanceSol,
  onOpenSend,
}) => {
  if (!blink) return null;
  const { colors, isDark } = useTheme();

  const [currentBlink, setCurrentBlink] = useState<PhysicalBlink>(blink);
  const [authorizing, setAuthorizing] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<TransactionReceipt | null>(null);

  // Price & Recipient Editing state
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [editPriceInput, setEditPriceInput] = useState(blink.amount.toString());
  const [editTokenInput, setEditTokenInput] = useState<'USDC' | 'SOL' | 'SKR'>(blink.token || 'USDC');
  const [editDescInput, setEditDescInput] = useState(blink.description);
  const [editRecipientInput, setEditRecipientInput] = useState(blink.recipient);
  const [isSaved, setIsSaved] = useState(false);

  // Live Wallet Balance states (both payer and recipient)
  const [walletBalanceSol, setWalletBalanceSol] = useState<number | null>(currentBalanceSol ?? null);
  const [walletBalanceUsdc, setWalletBalanceUsdc] = useState<number | null>(null);
  const [recipientBalance, setRecipientBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isAirdropping, setIsAirdropping] = useState(false);

  const activeAccount = WalletProviderService.getActiveAccount();
  const userProfile = UserProfileService.getProfile();
  const userBlinkId = BlinkIdService.formatBlinkId(userProfile.username || userProfile.displayName, activeAccount?.publicKey);
  const userUsername = (userProfile.username || '').trim().toLowerCase();

  const isCreator = Boolean(
    activeAccount?.publicKey &&
    (
      activeAccount.publicKey.toLowerCase() === (currentBlink.recipient || '').toLowerCase() ||
      ((currentBlink as any).creatorAddress && (currentBlink as any).creatorAddress.toLowerCase() === activeAccount.publicKey.toLowerCase()) ||
      (userUsername && userUsername.length > 0 && currentBlink.recipient && currentBlink.recipient.toLowerCase().includes(userUsername)) ||
      (userBlinkId && currentBlink.recipient && userBlinkId.toLowerCase() === currentBlink.recipient.toLowerCase()) ||
      (currentBlink.id && DatabaseService.getAllBlinks()?.some(b => b.id.toLowerCase() === currentBlink.id.toLowerCase()))
    )
  );

  const fetchLiveBalance = async () => {
    const acc = WalletProviderService.getActiveAccount();
    if (!acc?.publicKey) {
      setWalletBalanceSol(null);
      setWalletBalanceUsdc(null);
      return;
    }
    setIsLoadingBalance(true);
    try {
      const [sol, usdc] = await Promise.all([
        SolanaService.getBalance(acc.publicKey),
        SolanaService.getUsdcBalance(acc.publicKey),
      ]);
      if (typeof sol === 'number') setWalletBalanceSol(sol);
      if (typeof usdc === 'number') setWalletBalanceUsdc(usdc);
    } catch {
      // Retain current wallet balance
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const fetchRecipientBalance = async () => {
    if (!currentBlink?.recipient) return;
    try {
      if (currentBlink.token === 'USDC') {
        const bal = await SolanaService.getUsdcBalance(currentBlink.recipient);
        if (typeof bal === 'number') setRecipientBalance(bal);
      } else {
        const bal = await SolanaService.getBalance(currentBlink.recipient);
        if (typeof bal === 'number') setRecipientBalance(bal);
      }
    } catch {
      // Retain current recipient balance
    }
  };

  useEffect(() => {
    if (blink) {
      setCurrentBlink({ ...blink });
      setEditPriceInput(blink.amount.toString());
      setEditTokenInput(blink.token || 'USDC');
      setEditDescInput(blink.description || '');
      setEditRecipientInput(blink.recipient || '');
    }
  }, [blink?.id, blink?.amount, blink?.token, blink?.description, blink?.recipient]);

  useEffect(() => {
    const handleRegistryUpdate = (e: any) => {
      const detail = e?.detail;
      const target = Array.isArray(detail)
        ? detail.find((b: any) => b.id?.toLowerCase() === currentBlink?.id?.toLowerCase())
        : (detail && detail.id?.toLowerCase() === currentBlink?.id?.toLowerCase() ? detail : null);
      if (target) {
        setCurrentBlink({ ...target });
        setEditPriceInput(target.amount.toString());
        setEditTokenInput(target.token || 'USDC');
        setEditDescInput(target.description || '');
        setEditRecipientInput(target.recipient || '');
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('blink_registry_updated', handleRegistryUpdate);
      window.addEventListener('blink_database_updated', handleRegistryUpdate);
      window.addEventListener('blink_updated', handleRegistryUpdate);
      return () => {
        window.removeEventListener('blink_registry_updated', handleRegistryUpdate);
        window.removeEventListener('blink_database_updated', handleRegistryUpdate);
        window.removeEventListener('blink_updated', handleRegistryUpdate);
      };
    }
  }, [currentBlink?.id]);

  // Payers & Supporters state (for NFT mint fees, tips, vouchers, etc.)
  const [payers, setPayers] = useState<BlinkPayerInfo[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const loadPayers = async () => {
    if (!currentBlink) return;
    const cached = ReceiptService.getPayersForBlink(currentBlink.id, currentBlink.recipient);
    setPayers(cached);
    try {
      await ReceiptService.fetchCloudReceiptsForBlink(currentBlink.id, currentBlink.recipient);
      const updated = ReceiptService.getPayersForBlink(currentBlink.id, currentBlink.recipient);
      setPayers(updated);
    } catch {}
  };

  useEffect(() => {
    loadPayers();
    if (typeof window !== 'undefined') {
      const handleTxUpdate = () => loadPayers();
      window.addEventListener('blink_tx_updated', handleTxUpdate);
      window.addEventListener('blink_database_updated', handleTxUpdate);
      return () => {
        window.removeEventListener('blink_tx_updated', handleTxUpdate);
        window.removeEventListener('blink_database_updated', handleTxUpdate);
      };
    }
  }, [currentBlink?.id, currentBlink?.recipient]);

  const handleCopyAllAddresses = async () => {
    if (!payers || payers.length === 0) {
      ToastService.error('No payer addresses to copy.');
      return;
    }
    const allAddresses = payers.map((p) => p.address).join('\n');
    const ok = await copyToClipboard(allAddresses);
    if (ok) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
      ToastService.success(`Copied ${payers.length} payer wallet address${payers.length === 1 ? '' : 'es'} to clipboard!`);
    } else {
      ToastService.error('Failed to copy addresses.');
    }
  };

  const handleCopySingleAddress = async (addr: string) => {
    const ok = await copyToClipboard(addr);
    if (ok) {
      setCopiedAddress(addr);
      setTimeout(() => setCopiedAddress(null), 2000);
      ToastService.success(`Copied address: ${addr.slice(0, 4)}...${addr.slice(-4)}`);
    } else {
      ToastService.error('Failed to copy address.');
    }
  };

  useEffect(() => {
    fetchLiveBalance();
    fetchRecipientBalance();
    const interval = setInterval(() => {
      fetchLiveBalance();
      fetchRecipientBalance();
    }, 15000);
    return () => clearInterval(interval);
  }, [activeAccount?.publicKey, blink?.id, currentBlink?.recipient]);

  const handleRequestAirdrop = async () => {
    const acc = WalletProviderService.getActiveAccount();
    if (!acc?.publicKey) return;
    setIsAirdropping(true);
    try {
      await SolanaService.requestAirdrop(acc.publicKey);
      const newBal = await SolanaService.getBalance(acc.publicKey);
      if (typeof newBal === 'number') setWalletBalanceSol(newBal);
      ToastService.success('Airdropped 1.0 SOL on Devnet.');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('rate limit') || msg.includes('429') || msg.includes('faucet')) {
        await copyToClipboard(acc.publicKey);
        ToastService.info('Copied wallet address! Opening official Solana faucet...');
        if (typeof window !== 'undefined') {
          window.open('https://faucet.solana.com', '_blank');
        }
      } else {
        ToastService.error(err?.message || 'Airdrop rate limit reached. Please try again shortly.');
      }
    } finally {
      setIsAirdropping(false);
    }
  };

  useEffect(() => {
    if (blink) {
      setCurrentBlink(blink);
      setEditPriceInput(blink.amount.toString());
      setEditDescInput(blink.description);
      setEditRecipientInput(blink.recipient);
      setIsEditingPrice(false);
      setIsSaved(DatabaseService.isBookmarked(blink.id));
      fetchRecipientBalance();
    }
  }, [blink?.id, blink?.amount, blink?.description, blink?.recipient]);

  const copyToClipboard = async (text: string): Promise<boolean> => {
    // 1. Try modern navigator.clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('navigator.clipboard.writeText failed:', err);
      }
    }

    // 2. Legacy fallback
    if (typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, 99999);
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) return true;
      } catch (err) {
        console.warn('execCommand copy failed:', err);
      }
    }

    return false;
  };

  const handleToggleBookmark = () => {
    DatabaseService.saveBlink(currentBlink);
    const next = DatabaseService.toggleBookmark(currentBlink.id);
    setIsSaved(next);
    if (next) {
      ToastService.success('Saved to your bookmarks.');
    } else {
      ToastService.info('Removed from bookmarks');
    }
  };

  const handleShare = async () => {
    const url = PhysicalBlinkRegistry.getShareableUrl(currentBlink);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: currentBlink.name,
          text: currentBlink.description,
          url,
        });
        ToastService.success('Shared successfully!');
        return;
      } catch (err: any) {
        // If user cancelled or dismissed the share sheet, abort immediately without claiming copied
        if (err?.name === 'AbortError') {
          return;
        }
      }
    }

    const copied = await copyToClipboard(url);
    if (copied) {
      ToastService.success('Blink link copied to clipboard.');
    } else {
      ToastService.error('Failed to copy link to clipboard');
    }
  };

  const handleSavePrice = () => {
    if (!isCreator) {
      ToastService.error('Permission denied: Only the creator of this Blink can edit its price.');
      return;
    }
    setError(null);
    const sanitized = editPriceInput.replace(/[^0-9.]/g, '');
    const parsedAmount = parseFloat(sanitized);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid price greater than 0');
      return;
    }

    const updated = PhysicalBlinkRegistry.updateAction(currentBlink.id, {
      amount: parsedAmount,
      token: editTokenInput,
      description: editDescInput.trim() || currentBlink.description,
      recipient: editRecipientInput.trim() || currentBlink.recipient,
    });

    if (updated) {
      setCurrentBlink({ ...updated });
      setEditPriceInput(parsedAmount.toString());
      setEditTokenInput(updated.token);
      setEditRecipientInput(updated.recipient);
      setIsEditingPrice(false);
      const formatted = updated.token === 'SOL' ? `${parsedAmount} SOL` : (updated.token === 'SKR' ? `${parsedAmount} SKR` : `$${parsedAmount.toFixed(2)} USDC`);
      ToastService.success(`Blink updated to ${formatted} globally.`);
      onUpdateBlink?.(updated);
      fetchRecipientBalance();
    } else {
      setError('Failed to update Blink price.');
    }
  };

  const adjustPrice = (delta: number) => {
    const sanitized = editPriceInput.replace(/[^0-9.]/g, '');
    const curr = parseFloat(sanitized) || currentBlink.amount;
    const next = Math.max(0.01, Number((curr + delta).toFixed(4)));
    setEditPriceInput(next.toString());
  };

  const getBlinkLogo = (id: string) => {
    if (id.includes('coffee')) return <CoffeeShopLogo size={36} />;
    if (id.includes('tip') || id.includes('music')) return <MusicianLogo size={36} />;
    if (id.includes('pass') || id.includes('event')) return <HackerHouseLogo size={36} />;
    return <BlinkBrandMark size={36} />;
  };

  const handleAuthorize = async () => {
    setError(null);
    const activeAccount = WalletProviderService.getActiveAccount();
    if (!activeAccount) {
      onOpenWalletConnect();
      return;
    }

    if (isCreator) {
      ToastService.info('You created this Blink — creators cannot pay themselves.');
      return;
    }

    try {
      setAuthorizing(true);

      const editedAmountNum = parseFloat(editPriceInput.replace(/[^0-9.]/g, ''));
      const effectiveAmount = isEditingPrice && !isNaN(editedAmountNum) && editedAmountNum > 0
        ? editedAmountNum
        : currentBlink.amount;

      // 1. Pre-flight balance check before biometrics or transaction construction
      const [freshSol, freshUsdc] = await Promise.all([
        SolanaService.getBalance(activeAccount.publicKey, true),
        SolanaService.getUsdcBalance(activeAccount.publicKey, true),
      ]);
      setWalletBalanceSol(freshSol);
      setWalletBalanceUsdc(freshUsdc);

      const MIN_GAS_SOL = 0.00001;

      if (currentBlink.token === 'USDC') {
        if (freshUsdc < effectiveAmount) {
          const msg = `Insufficient USDC balance. You have $${freshUsdc.toFixed(2)} USDC, but this Blink requires $${effectiveAmount.toFixed(2)} USDC.`;
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
        const totalNeeded = effectiveAmount + MIN_GAS_SOL;
        if (freshSol < totalNeeded) {
          const msg = `Insufficient SOL balance. You have ${freshSol.toFixed(4)} SOL, but this transaction requires ${totalNeeded.toFixed(4)} SOL (including network gas fee).`;
          setError(msg);
          ToastService.error(msg);
          setAuthorizing(false);
          return;
        }
      }

      const priceLabel = currentBlink.token === 'SOL'
        ? `${effectiveAmount} SOL`
        : `$${effectiveAmount.toFixed(2)} USDC`;

      // 2. Invoke the real on-device biometric scanner (Android fingerprint / Face ID)
      const bioResult = await BiometricService.authenticate(
        `Authorize ${priceLabel} to ${currentBlink.name}`
      );

      if (!bioResult.success) {
        setAuthorizing(false);
        if (bioResult.error === 'user_cancel' || bioResult.error?.includes('cancelled')) {
          ToastService.info('Biometric authorization cancelled.');
        } else {
          ToastService.error(bioResult.error || 'Biometric hardware authorization failed.');
        }
        return;
      }

      // 3. Real biometrics verified! Broadcast REAL on-chain transaction
      await executeDirectPayment(effectiveAmount);
    } catch (err: any) {
      console.error('Authorization error:', err);
      setError(err?.message || 'Payment authorization failed');
      ToastService.error(err?.message || 'Payment authorization failed');
      setAuthorizing(false);
    }
  };

  const executeDirectPayment = async (checkoutAmount: number) => {
    setError(null);
    const activeAccount = WalletProviderService.getActiveAccount();
    if (!activeAccount) {
      setAuthorizing(false);
      return;
    }

    try {
      setAuthorizing(true);

      const fromPubkey = new PublicKey(activeAccount.publicKey);
      let toPubkey: PublicKey;
      try {
        toPubkey = new PublicKey(currentBlink.recipient);
      } catch {
        toPubkey = fromPubkey;
      }

      let tx: Transaction;
      if (currentBlink.token === 'USDC') {
        // Native SPL USDC transfer on Solana network
        tx = await SolanaService.buildUsdcTransferTransaction(fromPubkey, toPubkey, checkoutAmount);
      } else if (currentBlink.token === 'SKR') {
        // Native SPL SKR token transfer on Solana network
        tx = await SolanaService.buildSkrTransferTransaction(fromPubkey, toPubkey, checkoutAmount);
      } else {
        // Native SOL transfer on Solana network
        const connection = SolanaService.getConnection();
        const latestBlockhash = await connection.getLatestBlockhash('confirmed');
        const lamports = Math.round(checkoutAmount * LAMPORTS_PER_SOL);
        tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports,
          })
        );
        tx.recentBlockhash = latestBlockhash.blockhash;
        tx.feePayer = fromPubkey;
      }

      const sig = await WalletProviderService.signAndSendTransaction(tx);

      // Verify transaction did not fail on-chain
      try {
        const connection = SolanaService.getConnection();
        const latestBlockhash = await connection.getLatestBlockhash('confirmed');
        const confirmation = await connection.confirmTransaction(
          { signature: sig, ...latestBlockhash },
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

      setTxSignature(sig);
      PhysicalBlinkRegistry.recordTap(currentBlink.id, true, checkoutAmount);

      // Save official non-custodial receipt
      const rcpt: TransactionReceipt = {
        id: `rcpt_${sig.slice(0, 10)}`,
        signature: sig,
        blinkTitle: currentBlink.name,
        blinkId: currentBlink.id,
        amount: checkoutAmount,
        token: currentBlink.token,
        payerAddress: activeAccount.publicKey,
        recipientAddress: currentBlink.recipient,
        timestamp: Date.now(),
        status: 'confirmed',
        method: 'pocket_direct',
        actionType: currentBlink.actionType,
        verifiedDomain: currentBlink.verifiedDomain,
      };
      ReceiptService.saveReceipt(rcpt);

      const displayPaid = currentBlink.token === 'SOL'
        ? `${checkoutAmount} SOL`
        : `$${checkoutAmount.toFixed(2)} USDC`;
      ToastService.success(`Payment of ${displayPaid} confirmed on-chain.`);

      // Automatically refresh live balance of recipient and sender as SOL lands
      setTimeout(async () => {
        await fetchRecipientBalance();
        await fetchLiveBalance();
      }, 1200);
      setTimeout(async () => {
        await fetchRecipientBalance();
        await fetchLiveBalance();
      }, 3500);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('blink_balance_refresh'));
        window.dispatchEvent(new CustomEvent('blink_tx_updated', { detail: rcpt }));
      }
      onUpdateBlink?.(currentBlink);
    } catch (err: any) {
      console.error('Direct on-chain authorization error:', err);
      setError(err?.message || 'On-chain payment failed.');
      ToastService.error(err?.message || 'On-chain transaction failed on Solana Devnet.');
    } finally {
      setAuthorizing(false);
    }
  };

  const editedAmountNum = parseFloat(editPriceInput.replace(/[^0-9.]/g, ''));
  const effectiveAmount = isEditingPrice && !isNaN(editedAmountNum) && editedAmountNum > 0
    ? editedAmountNum
    : currentBlink.amount;

  return (
    <View style={[styles.modalOverlay, { backgroundColor: colors.bg }]}>
      <View style={[styles.modalContainer, { backgroundColor: colors.bgModal }]}>
        {/* Navigation Top Bar */}
        <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={[styles.iconBtn, { backgroundColor: colors.bgCardAlt }]} activeOpacity={0.7}>
            <ArrowLeft size={18} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.titleGroup}>
            {getBlinkLogo(blink.id)}
            <View style={{ marginLeft: 8 }}>
              <Text style={[styles.navTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {blink.name}
              </Text>
              <TouchableOpacity
                onPress={async () => {
                  await copyToClipboard(currentBlink.id);
                  ToastService.success(`Blink ID copied: ${currentBlink.id}`);
                }}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}
              >
                <Text style={[styles.navSub, { color: colors.textMuted }]}>ID: {currentBlink.id}</Text>
                <Copy size={11} color={colors.accent} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.topRightActions}>
            <TouchableOpacity
              style={[
                styles.iconBtn,
                { backgroundColor: isSaved ? colors.accentSoft : colors.bgCardAlt },
              ]}
              onPress={handleToggleBookmark}
              activeOpacity={0.7}
              accessibilityLabel={isSaved ? 'Remove from bookmarks' : 'Save blink'}
            >
              <Bookmark
                size={16}
                color={isSaved ? colors.accent : colors.textMuted}
                fill={isSaved ? colors.accent : 'transparent'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.bgCardAlt }]}
              onPress={handleShare}
              activeOpacity={0.7}
              accessibilityLabel="Share blink"
            >
              <Share2 size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
          {/* Hero Price & Volume Row or Inline Price Editor */}
          {isEditingPrice ? (
            <View style={styles.editPriceCard}>
              <View style={styles.editPriceHeader}>
                <View style={styles.editPriceTag}>
                  <Edit3 size={12} color="#5B67F6" />
                  <Text style={styles.editPriceTagText}>UPDATE BLINK PRICE</Text>
                </View>
                <TouchableOpacity onPress={() => setIsEditingPrice(false)} style={styles.closeEditBtn}>
                  <X size={15} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <View style={styles.priceInputRow}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.priceTextInput}
                  value={editPriceInput}
                  onChangeText={setEditPriceInput}
                  keyboardType="decimal-pad"
                  autoFocus
                  onSubmitEditing={handleSavePrice}
                  returnKeyType="done"
                  placeholder="0.00"
                  placeholderTextColor="#64748B"
                />
                <Text style={styles.tokenLabel}>{currentBlink.token}</Text>
              </View>

              {/* Quick Increment Presets */}
              <View style={styles.presetRow}>
                {[-5, -1, 1, 5, 10].map((delta) => (
                  <TouchableOpacity
                    key={delta}
                    style={styles.presetPill}
                    onPress={() => adjustPrice(delta)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.presetPillText}>
                      {delta > 0 ? `+${delta}` : `${delta}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description Input */}
              <Text style={styles.inputFieldLabel}>ACTION DESCRIPTION</Text>
              <TextInput
                style={styles.descTextInput}
                value={editDescInput}
                onChangeText={setEditDescInput}
                placeholder="What does this Blink action do?"
                placeholderTextColor="#64748B"
              />

              {/* Receiving Address Input */}
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={styles.inputFieldLabel}>RECEIVING WALLET ADDRESS</Text>
                  {activeAccount?.publicKey && editRecipientInput !== activeAccount.publicKey && (
                    <TouchableOpacity
                      onPress={() => setEditRecipientInput(activeAccount.publicKey)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 11, color: colors.accent, fontWeight: '700' }}>Use My Wallet</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={[styles.descTextInput, { fontSize: 13, fontFamily: 'monospace' }]}
                  value={editRecipientInput}
                  onChangeText={setEditRecipientInput}
                  placeholder="Recipient Solana address"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.editBtnRow}>
                <TouchableOpacity
                  style={styles.savePriceBtn}
                  onPress={handleSavePrice}
                  activeOpacity={0.8}
                >
                  <Check size={15} color="#FFFFFF" />
                  <Text style={styles.savePriceBtnText}>Save New Price</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelPriceBtn}
                  onPress={() => setIsEditingPrice(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelPriceBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.heroRow}>
              <View>
                <TouchableOpacity
                  style={styles.heroPriceClickable}
                  onPress={() => {
                    if (!isCreator) {
                      ToastService.error('Only the creator of this Blink can edit its price.');
                      return;
                    }
                    setEditPriceInput(currentBlink.amount.toString());
                    setEditDescInput(currentBlink.description);
                    setIsEditingPrice(true);
                  }}
                  activeOpacity={isCreator ? 0.8 : 1}
                >
                  <Text style={[styles.heroPrice, { color: colors.textPrimary }]}>
                    {currentBlink.token === 'SOL'
                      ? `${currentBlink.amount} SOL`
                      : `$${currentBlink.amount.toFixed(2)} USDC`}
                  </Text>
                  {isCreator && (
                    <View style={styles.editPricePill}>
                      <Edit3 size={11} color="#5B67F6" />
                      <Text style={styles.editPricePillText}>Edit Price</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={styles.changeBadge}>
                  <Text style={styles.changeText}>▲ Live on Solana Devnet</Text>
                </View>
              </View>

              <View style={styles.volBox}>
                <Text style={[styles.volNumber, { color: colors.textPrimary }]}>
                  ${currentBlink.stats.volumeUsdc.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
                <Text style={styles.volLabel}>Total Volume</Text>
              </View>
            </View>
          )}

          {/* Error Message */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Confirmed Receipt Alert */}
          {txSignature && (
            <View style={styles.successBox}>
              <CheckCircle2 size={20} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={styles.successTitle}>Confirmed on Solana</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <TouchableOpacity
                    onPress={() => {
                      const r = ReceiptService.getReceiptBySignature(txSignature);
                      if (r) setActiveReceipt(r);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '700' }}>View & Download Receipt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => window.open(SolanaService.getExplorerUrl(txSignature), '_blank')}
                    style={styles.explorerLinkRow}
                  >
                    <Text style={styles.explorerText}>Explorer</Text>
                    <ExternalLink size={11} color="#5B67F6" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* About Section */}
          <View style={[styles.aboutCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.aboutHeaderRow}>
              <Text style={[styles.aboutTitle, { color: colors.textPrimary }]}>About</Text>
              {isCreator && !isEditingPrice && (
                <TouchableOpacity
                  style={styles.editActionSmallBtn}
                  onPress={() => {
                    setEditPriceInput(currentBlink.amount.toString());
                    setEditDescInput(currentBlink.description);
                    setIsEditingPrice(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Edit3 size={12} color="#5B67F6" />
                  <Text style={styles.editActionSmallBtnText}>Edit Action</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.aboutBody, { color: colors.textSecondary }]}>
              {currentBlink.description ||
                'This Physical Blink connects an in-person physical object directly to a Solana Action. Transactions settle non-custodially on-chain in under 450ms.'}
            </Text>

            {/* Key Metadata Table */}
            <View style={[styles.metaTable, { borderTopColor: colors.border }]}>
              <View style={styles.metaRow}>
                <Text style={[styles.metaKey, { color: colors.textSecondary }]}>Blink ID</Text>
                <TouchableOpacity
                  onPress={async () => {
                    const copied = await copyToClipboard(currentBlink.id);
                    if (copied) ToastService.success(`Blink ID copied: ${currentBlink.id}`);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.metaVal, { fontFamily: 'monospace', color: colors.accent, fontWeight: '700' }]}>
                    {currentBlink.id}
                  </Text>
                  <Copy size={13} color={colors.accent} />
                </TouchableOpacity>
              </View>
              {currentBlink.verifiedDomain && (
                <View style={styles.metaRow}>
                  <Text style={[styles.metaKey, { color: colors.textSecondary }]}>Verified Domain</Text>
                  <View style={styles.verifiedRow}>
                    <ShieldCheck size={12} color="#14F195" />
                    <Text style={styles.verifiedText}>{currentBlink.verifiedDomain}</Text>
                  </View>
                </View>
              )}
              <View style={[styles.metaRow, { alignItems: 'flex-start', paddingVertical: 10 }]}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.metaKey, { color: colors.textSecondary }]}>Recipient Wallet</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#14F195' }} />
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      {recipientBalance !== null
                        ? `Live Balance: ${currentBlink.token === 'USDC' ? `$${recipientBalance.toFixed(2)} USDC` : `${recipientBalance.toFixed(4)} SOL`}`
                        : 'Checking balance...'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={async () => {
                    const copied = await copyToClipboard(currentBlink.recipient);
                    if (copied) ToastService.success('Recipient address copied to clipboard.');
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgCardAlt, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: colors.border }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.metaVal, { fontFamily: 'monospace', fontSize: 12, color: colors.textPrimary }]}>
                    {`${currentBlink.recipient.slice(0, 4)}...${currentBlink.recipient.slice(-4)}`}
                  </Text>
                  <Copy size={12} color={colors.accent} />
                </TouchableOpacity>
              </View>
              <View style={styles.metaRow}>
                <Text style={[styles.metaKey, { color: colors.textSecondary }]}>Security</Text>
                <View style={styles.verifiedRow}>
                  <Lock size={11} color="#14F195" />
                  <Text style={styles.verifiedText}>Non-Custodial</Text>
                </View>
              </View>
            </View>
          </View>

          {/* User Available Balance Indicator in BlinkDetailModal */}
          {activeAccount?.publicKey && (
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: colors.bgCard,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginTop: 12,
            }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '600' }}>Your Available Balance:</Text>
              <Text style={{
                fontSize: 13,
                fontWeight: '700',
                color: (currentBlink.token === 'USDC'
                  ? (walletBalanceUsdc !== null && walletBalanceUsdc < effectiveAmount)
                  : (walletBalanceSol !== null && walletBalanceSol < effectiveAmount + 0.00001))
                  ? '#EF4444'
                  : colors.textPrimary,
              }}>
                {currentBlink.token === 'USDC'
                  ? `${walletBalanceUsdc !== null ? `$${walletBalanceUsdc.toFixed(2)} USDC` : 'Loading...'}`
                  : `${walletBalanceSol !== null ? `${walletBalanceSol.toFixed(4)} SOL` : 'Loading...'}`}
              </Text>
            </View>
          )}

          {/* Insufficient Balance Warning Banner */}
          {activeAccount?.publicKey && (
            (currentBlink.token === 'USDC' && walletBalanceUsdc !== null && walletBalanceUsdc < effectiveAmount) ||
            (currentBlink.token === 'SOL' && walletBalanceSol !== null && walletBalanceSol < effectiveAmount + 0.00001)
          ) && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.3)',
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 14,
              marginTop: 10,
            }}>
              <AlertCircle size={15} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600', flex: 1 }}>
                {currentBlink.token === 'USDC'
                  ? `Insufficient USDC balance ($${(walletBalanceUsdc ?? 0).toFixed(2)} / $${effectiveAmount.toFixed(2)} USDC required)`
                  : `Insufficient SOL balance (${(walletBalanceSol ?? 0).toFixed(4)} / ${(effectiveAmount + 0.00001).toFixed(4)} SOL required)`}
              </Text>
            </View>
          )}

          {/* Payers Section (Visible ONLY to creator of the Blink) */}
          {isCreator && (
            <View style={[styles.aboutCard, { backgroundColor: colors.bgCard, borderColor: colors.border, marginTop: 14 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={16} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.aboutTitle, { color: colors.textPrimary, fontSize: 15 }]}>
                    Payers
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                    {payers.length} Verified Payer{payers.length === 1 ? '' : 's'} • {payers.reduce((sum, p) => sum + p.paymentCount, 0)} Payment{payers.reduce((sum, p) => sum + p.paymentCount, 0) === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>

              {payers.length > 0 && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: copiedAll ? '#10B981' : colors.accent,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 10,
                  }}
                  onPress={handleCopyAllAddresses}
                  activeOpacity={0.8}
                >
                  {copiedAll ? <Check size={13} color="#FFFFFF" /> : <Copy size={13} color="#FFFFFF" />}
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                    {copiedAll ? 'Copied All!' : 'Copy All Addresses'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Payers List */}
            {payers.length > 0 ? (
              <View style={{ gap: 10 }}>
                {payers.map((payer, idx) => {
                  const isCopied = copiedAddress === payer.address;
                  const shortAddr = `${payer.address.slice(0, 6)}...${payer.address.slice(-6)}`;
                  const formattedTime = new Date(payer.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <View
                      key={payer.address + idx}
                      style={{
                        backgroundColor: colors.bgCardAlt,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      {/* Top Row: Index Badge, Address, Amount */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
                          <View style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: colors.accentSoft,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.accent }}>#{idx + 1}</Text>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>
                              {shortAddr}
                            </Text>
                            <Text style={{ fontSize: 10, color: colors.textMuted }}>
                              {payer.paymentCount} tx • {formattedTime} • via {payer.lastMethod === 'nfc_tap' ? 'NFC Tap' : payer.lastMethod === 'qr_scan' ? 'QR Scan' : 'Direct'}
                            </Text>
                          </View>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#10B981' }}>
                            +{payer.token === 'SOL' ? `${payer.totalPaid} SOL` : `$${payer.totalPaid.toFixed(2)} USDC`}
                          </Text>
                          {payer.lastSignature && (
                            <TouchableOpacity
                              onPress={() => window.open(SolanaService.getExplorerUrl(payer.lastSignature), '_blank')}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}
                            >
                              <Text style={{ fontSize: 10, color: colors.accent, fontWeight: '600' }}>Explorer</Text>
                              <ExternalLink size={10} color={colors.accent} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      {/* Action Row: Copy Address & Send */}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            backgroundColor: isCopied ? '#10B98122' : colors.bgCard,
                            borderColor: isCopied ? '#10B981' : colors.border,
                            borderWidth: 1,
                            borderRadius: 10,
                            paddingVertical: 9,
                            paddingHorizontal: 12,
                          }}
                          onPress={() => handleCopySingleAddress(payer.address)}
                          activeOpacity={0.7}
                        >
                          {isCopied ? <Check size={13} color="#10B981" /> : <Copy size={13} color={colors.textPrimary} />}
                          <Text style={{ fontSize: 13, fontWeight: '700', color: isCopied ? '#10B981' : colors.textPrimary }}>
                            {isCopied ? 'Copied!' : 'Copy Address'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            backgroundColor: colors.accentSoft,
                            borderColor: colors.accent,
                            borderWidth: 1,
                            borderRadius: 10,
                            paddingVertical: 9,
                            paddingHorizontal: 12,
                          }}
                          onPress={() => {
                            onClose();
                            onOpenSend?.(payer.address);
                          }}
                          activeOpacity={0.7}
                        >
                          <Send size={13} color={colors.accent} />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>
                            Send
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 24,
                paddingHorizontal: 16,
                backgroundColor: colors.bgCardAlt,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                borderStyle: 'dashed',
              }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Users size={20} color={colors.textMuted} />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>
                  No Payments Received Yet
                </Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', maxWidth: 280 }}>
                  When users tap or scan to pay this Blink (e.g. mint fee), their wallet addresses and payment proofs will appear here so you can easily copy and airdrop their NFT.
                </Text>
              </View>
            )}
          </View>
          )}
        </ScrollView>

        {/* Floating Bottom Dual Action Bar */}
        <View style={[styles.bottomBar, { backgroundColor: colors.bgModal, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.secondaryActionBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
            onPress={() => setShowQr(!showQr)}
            activeOpacity={0.8}
          >
            <QrCode size={15} color={colors.textPrimary} />
            <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>QR / NFC</Text>
          </TouchableOpacity>

          {isCreator ? (
            <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[
                  styles.primaryActionBtn,
                  { flex: 1, backgroundColor: colors.accentSoft, borderColor: colors.accent, borderWidth: 1 },
                ]}
                onPress={() => {
                  setEditPriceInput(currentBlink.amount.toString());
                  setEditDescInput(currentBlink.description);
                  setIsEditingPrice(true);
                }}
                activeOpacity={0.8}
              >
                <Edit3 size={15} color={colors.accent} />
                <Text style={[styles.primaryBtnText, { color: colors.accent, marginLeft: 4, fontSize: 13 }]}>
                  Edit Price
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.secondaryActionBtn,
                  { backgroundColor: '#EF444418', borderColor: '#EF444466', borderWidth: 1, paddingHorizontal: 12 },
                ]}
                onPress={() => {
                  if (typeof window !== 'undefined' && window.confirm) {
                    const confirmed = window.confirm(`Delete "${currentBlink.name}"?\nThis will permanently remove this Blink from database and cloud.`);
                    if (!confirmed) return;
                  }
                  PhysicalBlinkRegistry.deleteBlink(currentBlink.id, activeAccount?.publicKey);
                  ToastService.success(`Deleted Blink "${currentBlink.name}".`);
                  if (onUpdateBlink) onUpdateBlink(currentBlink);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Trash2 size={15} color="#EF4444" />
                <Text style={[styles.secondaryBtnText, { color: '#EF4444', fontWeight: '700' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.primaryActionBtn,
                authorizing && styles.btnDisabled,
                (currentBlink.token === 'USDC'
                  ? (walletBalanceUsdc !== null && walletBalanceUsdc < effectiveAmount)
                  : (walletBalanceSol !== null && walletBalanceSol < effectiveAmount + 0.00001)) && { backgroundColor: '#EF4444' }
              ]}
              onPress={handleAuthorize}
              disabled={authorizing}
              activeOpacity={0.8}
            >
              {authorizing ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.primaryBtnText}>Authenticating...</Text>
                </View>
              ) : (
                <>
                  <Fingerprint size={16} color="#FFFFFF" />
                  <Text style={[styles.primaryBtnText, { marginLeft: 6 }]}>
                    {WalletProviderService.getActiveAccount()
                      ? (currentBlink.token === 'USDC'
                          ? (walletBalanceUsdc !== null && walletBalanceUsdc < effectiveAmount)
                          : (walletBalanceSol !== null && walletBalanceSol < effectiveAmount + 0.00001))
                        ? `Insufficient ${currentBlink.token} Balance`
                        : currentBlink.token === 'SOL'
                          ? `Pay ${effectiveAmount} SOL`
                          : `Pay $${effectiveAmount.toFixed(2)} USDC`
                      : 'Connect Wallet'}
                  </Text>
                  <ArrowRight size={15} color="#FFFFFF" style={{ marginLeft: 4 }} />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* QR Code & NFC Sheet / Modal */}
        {showQr && (
          <View style={styles.qrOverlay}>
            <View style={[styles.qrModalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={styles.qrModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <QrCode size={18} color={colors.accent} />
                  <Text style={[styles.qrModalTitle, { color: colors.textPrimary }]}>Physical QR & NFC Tag</Text>
                </View>
                <TouchableOpacity onPress={() => setShowQr(false)} style={[styles.closeBtn, { backgroundColor: colors.bgCardAlt }]}>
                  <X size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.qrCodeBox}>
                <QRCodeSVG
                  value={PhysicalBlinkRegistry.getShareableUrl(currentBlink)}
                  size={200}
                  level="H"
                  includeMargin
                />
              </View>

              <Text style={[styles.qrBlinkName, { color: colors.textPrimary }]}>{currentBlink.name}</Text>
              <Text style={[styles.qrBlinkSub, { color: colors.textSecondary }]}>
                Scan with mobile camera or hold to physical NFC tag to execute {effectiveAmount} {currentBlink.token}
              </Text>

              <View style={styles.qrActionRow}>
                <TouchableOpacity
                  style={[styles.qrActionBtn, { backgroundColor: colors.accent }]}
                  onPress={async () => {
                    const url = PhysicalBlinkRegistry.getShareableUrl(currentBlink);
                    const res = await NfcService.writeTag({ url, title: currentBlink.name, id: currentBlink.id });
                    if (res.success) {
                      ToastService.success(`Encoded onto NFC tag successfully.`);
                    } else {
                      ToastService.info(res.message);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Radio size={14} color="#FFFFFF" />
                  <Text style={styles.qrActionBtnText}>Write NFC Tag</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.qrActionBtnSecondary, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                  onPress={async () => {
                    const copied = await copyToClipboard(currentBlink.id);
                    if (copied) {
                      ToastService.success(`Blink ID copied: ${currentBlink.id}`);
                    } else {
                      ToastService.error('Failed to copy Blink ID');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Copy size={14} color={colors.textPrimary} />
                  <Text style={[styles.qrActionBtnSecondaryText, { color: colors.textPrimary }]}>Copy ID</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.qrActionBtnSecondary, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                  onPress={async () => {
                    const url = PhysicalBlinkRegistry.getShareableUrl(currentBlink);
                    const copied = await copyToClipboard(url);
                    if (copied) {
                      ToastService.success('Blink link copied to clipboard.');
                    } else {
                      ToastService.error('Failed to copy link to clipboard');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Share2 size={14} color={colors.textPrimary} />
                  <Text style={[styles.qrActionBtnSecondaryText, { color: colors.textPrimary }]}>Copy Link</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Transaction Receipt Modal */}
        <ReceiptModal
          visible={!!activeReceipt}
          receipt={activeReceipt}
          viewerAddress={activeAccount?.publicKey}
          onClose={() => setActiveReceipt(null)}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#07080B',
    zIndex: 9999,
  },
  modalContainer: {
    flex: 1,
    maxWidth: 680,
    width: '100%',
    marginHorizontal: 'auto',
    backgroundColor: '#07080B',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#141721',
  },
  iconBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#121520',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  navTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: 180,
  },
  navSub: {
    fontSize: 10,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  topRightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    marginTop: 4,
  },
  heroPrice: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.8,
  },
  heroCurrency: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
  },
  changeBadge: {
    marginTop: 3,
  },
  changeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  volBox: {
    alignItems: 'flex-end',
  },
  volNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  volLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: '#2A080C',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0D241C',
    borderColor: '#14F195',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  successTitle: {
    color: '#14F195',
    fontSize: 13,
    fontWeight: '800',
  },
  explorerLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  explorerText: {
    color: '#5B67F6',
    fontSize: 11,
    fontWeight: '600',
  },
  aboutCard: {
    backgroundColor: '#0F111A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 16,
  },
  aboutTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  aboutBody: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 19,
    marginBottom: 16,
  },
  metaTable: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#171B26',
    paddingTop: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaKey: {
    fontSize: 12,
    color: '#64748B',
  },
  metaVal: {
    fontSize: 12,
    color: '#E2E8F0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#14F195',
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    backgroundColor: '#07080B',
    borderTopWidth: 1,
    borderTopColor: '#141721',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#141824',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#242B3F',
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5B67F6', // Reference image periwinkle/indigo accent
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#5B67F6',
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  // Price editing styles
  successToastBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  successToastText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  heroPriceClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editPricePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(91, 103, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(91, 103, 246, 0.35)',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 12,
  },
  editPricePillText: {
    color: '#5B67F6',
    fontSize: 11,
    fontWeight: '700',
  },
  editPriceCard: {
    backgroundColor: '#0F111A',
    borderWidth: 1,
    borderColor: '#242838',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  editPriceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  editPriceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editPriceTagText: {
    color: '#5B67F6',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  closeEditBtn: {
    padding: 4,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#08090D',
    borderWidth: 1,
    borderColor: '#1D212E',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 10,
  },
  currencySymbol: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginRight: 4,
  },
  priceTextInput: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tokenLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  presetPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: '#161926',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222738',
  },
  presetPillText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  inputFieldLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  descTextInput: {
    backgroundColor: '#08090D',
    borderWidth: 1,
    borderColor: '#1D212E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 14,
  },
  editBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  savePriceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 10,
  },
  savePriceBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelPriceBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#161926',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPriceBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  aboutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  editActionSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(91, 103, 246, 0.1)',
  },
  editActionSmallBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5B67F6',
  },
  qrOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
    padding: 20,
  },
  qrModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  qrModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  qrModalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  qrCodeBox: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
  },
  qrBlinkName: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  qrBlinkSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 18,
    paddingHorizontal: 10,
  },
  qrActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  qrActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  qrActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  qrActionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  qrActionBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  fpModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 16,
  },
  fpModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  shieldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(20, 241, 149, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(20, 241, 149, 0.25)',
  },
  shieldBadgeText: {
    color: '#14F195',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  fpTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
    textAlign: 'center',
  },
  fpSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  fpAmountBox: {
    backgroundColor: 'rgba(91, 103, 246, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(91, 103, 246, 0.25)',
    marginBottom: 20,
  },
  fpAmountText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  fpTokenText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
  },
  balanceCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
  },
  balanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  balanceWalletLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  balanceRefreshBtn: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  balanceRefreshText: {
    fontSize: 11,
    fontWeight: '700',
  },
  balanceMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceSubTitle: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  balanceNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
  airdropBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  airdropBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
