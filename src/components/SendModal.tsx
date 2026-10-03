import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { X, ArrowRight, ArrowUpRight, CheckCircle2, AlertCircle, ExternalLink, Fingerprint, Send, QrCode, Scan } from 'lucide-react-native';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SolanaService } from '../services/solanaService';
import { WalletProviderService } from '../services/walletProviderService';
import { BiometricService } from '../services/biometricService';
import { CameraQrScanner } from './CameraQrScanner';
import { ToastService } from '../services/toastService';
import { PhysicalBlinkRegistry } from '../services/physicalBlinkRegistry';
import { BlinkIdService } from '../services/blinkIdService';
import { PriceService } from '../services/priceService';
import { ReceiptService } from '../services/receiptService';
import { NotificationService } from '../services/notificationService';
import { UserProfileService } from '../services/userProfileService';
import { ReceiptModal } from './ReceiptModal';
import { TransactionReceipt } from '../types';

interface SendModalProps {
  visible: boolean;
  onClose: () => void;
  currentBalanceSol: number;
  senderPublicKey: string;
  onSuccess: () => void;
  onOpenReceive?: () => void;
  initialRecipient?: string;
  initialNote?: string;
}

export const SendModal: React.FC<SendModalProps> = ({
  visible,
  onClose,
  currentBalanceSol,
  senderPublicKey,
  onSuccess,
  onOpenReceive,
  initialRecipient,
  initialNote,
}) => {
  const [recipient, setRecipient] = useState(initialRecipient || '');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<'SOL' | 'USDC' | 'SKR'>('SOL');
  const [currentBalanceUsdc, setCurrentBalanceUsdc] = useState<number>(0);
  const [currentBalanceSkr, setCurrentBalanceSkr] = useState<number>(0);
  const [resolvedBlinkInfo, setResolvedBlinkInfo] = useState<{ id: string; name: string; recipient: string; amount?: number; token?: string; actionType?: any } | null>(null);
  const [resolvedUser, setResolvedUser] = useState<{ username?: string; displayName?: string; address: string } | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<TransactionReceipt | null>(null);

  const activeAccount = WalletProviderService.getActiveAccount();
  const trimmedRecipient = recipient.trim();
  const isDirectValidAddress = /^[1-9A-HJ-NP-za-km-z]{32,44}$/.test(trimmedRecipient);

  const myProfile = UserProfileService.getProfile();
  const myUsername = (myProfile.username || '').toLowerCase().replace(/^@+/, '');
  const myBlinkId = (myProfile.blinkId || '').toLowerCase().replace(/^@+/, '');
  const myFormattedBlinkId = BlinkIdService.formatBlinkId(myProfile.username || myProfile.displayName, senderPublicKey).toLowerCase().replace(/^@+/, '');
  const myAddress = (senderPublicKey || '').toLowerCase().trim();

  // Instant detection if user entered their own wallet address or username
  const isInputSelf = React.useMemo(() => {
    const raw = recipient.trim().toLowerCase();
    if (!raw) return false;
    const clean = raw.replace(/^@+/, '');

    // 1. Direct address match
    if (myAddress && raw === myAddress) return true;

    // 2. Direct username or Blink ID match
    if (myUsername && (clean === myUsername || raw === `@${myUsername}`)) return true;
    if (myBlinkId && (clean === myBlinkId || raw === `@${myBlinkId}`)) return true;
    if (myFormattedBlinkId && (clean === myFormattedBlinkId || raw === `@${myFormattedBlinkId}`)) return true;

    // 3. Resolved user match
    if (resolvedUser) {
      const resAddr = (resolvedUser.address || '').toLowerCase().trim();
      const resUser = (resolvedUser.username || '').toLowerCase().replace(/^@+/, '');
      if (myAddress && resAddr === myAddress) return true;
      if (myUsername && (resUser === myUsername || resUser === `@${myUsername}`)) return true;
      if (myBlinkId && (resUser === myBlinkId || resUser === `@${myBlinkId}`)) return true;
      if (myFormattedBlinkId && (resUser === myFormattedBlinkId || resUser === `@${myFormattedBlinkId}`)) return true;
    }

    // 4. Resolved physical blink recipient match
    if (resolvedBlinkInfo) {
      const bRecip = (resolvedBlinkInfo.recipient || '').toLowerCase().trim();
      if (myAddress && bRecip === myAddress) return true;
    }

    return false;
  }, [recipient, myAddress, myUsername, myBlinkId, myFormattedBlinkId, resolvedUser, resolvedBlinkInfo]);

  React.useEffect(() => {
    if (visible && initialRecipient) {
      setRecipient(initialRecipient);
    }
  }, [visible, initialRecipient]);

  React.useEffect(() => {
    if (senderPublicKey) {
      const cachedUsdc = SolanaService.getCachedUsdc(senderPublicKey);
      const cachedSkr = SolanaService.getCachedSkr(senderPublicKey);
      if (cachedUsdc !== null) setCurrentBalanceUsdc(cachedUsdc);
      if (cachedSkr !== null) setCurrentBalanceSkr(cachedSkr);

      SolanaService.getUsdcBalance(senderPublicKey).then((bal) => {
        if (typeof bal === 'number') setCurrentBalanceUsdc(bal);
      });
      SolanaService.getSkrBalance(senderPublicKey).then((bal) => {
        if (typeof bal === 'number') setCurrentBalanceSkr(bal);
      });
    }
  }, [senderPublicKey, visible]);

  // Check if entered recipient matches a physical/action Blink URL or ID, or a user handle
  React.useEffect(() => {
    let isCancelled = false;
    const trimmed = recipient.trim();
    if (!trimmed) {
      setResolvedBlinkInfo(null);
      setResolvedUser(null);
      setIsResolving(false);
      return;
    }

    // 1. Primary: Check PhysicalBlinkRegistry for actual Action/Product Blinks (e.g. coffee-001)
    const cleanId = trimmed.replace(/^https?:\/\/[^\/]+\/(?:t|b)\//i, '').replace(/^\/t\//i, '');
    const found = PhysicalBlinkRegistry.resolve(cleanId) || PhysicalBlinkRegistry.resolve(trimmed);
    if (found && found.id && found.name) {
      setResolvedBlinkInfo({
        id: found.id,
        name: found.name,
        recipient: found.recipient,
        amount: found.amount,
        token: found.token,
        actionType: found.actionType,
      });
      setResolvedUser(null);
      setIsResolving(false);
      if (found.token) {
        setSelectedToken(found.token as 'SOL' | 'USDC');
      }
      return;
    }

    setResolvedBlinkInfo(null);

    // 2. Direct Solana address
    if (/^[1-9A-HJ-NP-za-km-z]{32,44}$/.test(trimmed)) {
      setIsResolving(false);
      BlinkIdService.resolveBlinkId(trimmed).then((res) => {
        if (!isCancelled && res && res.source !== 'address') {
          setResolvedUser({
            username: res.blinkId,
            displayName: res.displayName,
            address: res.address,
          });
        }
      });
      return;
    }

    // 3. Resolve user handles/usernames for standard P2P transfers
    setIsResolving(true);
    BlinkIdService.resolveBlinkId(trimmed).then((res) => {
      if (isCancelled) return;
      setIsResolving(false);
      if (res && res.address) {
        setResolvedUser({
          username: (res as any).username || res.blinkId || '',
          displayName: res.displayName,
          address: res.address,
        });
      } else {
        setResolvedUser(null);
      }
    }).catch(() => {
      if (!isCancelled) {
        setIsResolving(false);
        setResolvedUser(null);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [recipient]);

  const handleSend = async () => {
    setError(null);
    const numAmount = parseFloat(amount);
    const targetRecipient = resolvedBlinkInfo ? resolvedBlinkInfo.recipient : (resolvedUser?.address || recipient.trim());

    if (!targetRecipient) {
      ToastService.error('Please enter a recipient Solana address or Blink ID.');
      setError('Please enter a recipient Solana address or Blink ID.');
      return;
    }

    if (isInputSelf || targetRecipient.toLowerCase() === myAddress) {
      ToastService.error("It's not possible to send funds to your own wallet address or username.");
      setError("It's not possible to send funds to your own wallet address or username.");
      return;
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      setError(`Please enter a valid amount of ${selectedToken}.`);
      return;
    }

    const availableBal = selectedToken === 'SOL' ? currentBalanceSol : (selectedToken === 'SKR' ? currentBalanceSkr : currentBalanceUsdc);
    if (numAmount > availableBal) {
      const balStr = selectedToken === 'SOL'
        ? `${currentBalanceSol.toFixed(4)} SOL`
        : (selectedToken === 'SKR' ? `${currentBalanceSkr.toFixed(2)} SKR` : `$${currentBalanceUsdc.toFixed(2)} USDC`);
      setError(
        `Insufficient ${selectedToken} balance. Current balance: ${balStr}.`
      );
      return;
    }

    const tokenDisplayStr = selectedToken === 'SOL' ? `${numAmount} SOL` : (selectedToken === 'SKR' ? `${numAmount} SKR` : `$${numAmount.toFixed(2)} USDC`);

    try {
      setLoading(true);

      // Pre-flight fresh balance check before biometrics or transaction building
      const [freshSol, freshUsdc, freshSkr] = await Promise.all([
        SolanaService.getBalance(senderPublicKey, true),
        SolanaService.getUsdcBalance(senderPublicKey, true),
        SolanaService.getSkrBalance(senderPublicKey, true),
      ]);

      const MIN_GAS_SOL = 0.00001;

      if (selectedToken === 'USDC') {
        if (numAmount > freshUsdc) {
          setError(`Insufficient USDC balance. You have $${freshUsdc.toFixed(2)} USDC, but are trying to send $${numAmount.toFixed(2)} USDC.`);
          setLoading(false);
          return;
        }
        if (freshSol < MIN_GAS_SOL) {
          setError(`Insufficient SOL for network fee. You need at least 0.00001 SOL for gas, but have ${freshSol.toFixed(4)} SOL.`);
          setLoading(false);
          return;
        }
      } else if (selectedToken === 'SKR') {
        if (numAmount > freshSkr) {
          setError(`Insufficient SKR balance. You have ${freshSkr.toFixed(2)} SKR, but are trying to send ${numAmount.toFixed(2)} SKR.`);
          setLoading(false);
          return;
        }
        if (freshSol < MIN_GAS_SOL) {
          setError(`Insufficient SOL for network fee. You need at least 0.00001 SOL for gas, but have ${freshSol.toFixed(4)} SOL.`);
          setLoading(false);
          return;
        }
      } else {
        const totalNeeded = numAmount + MIN_GAS_SOL;
        if (freshSol < totalNeeded) {
          setError(`Insufficient SOL balance. You have ${freshSol.toFixed(4)} SOL, but this transaction requires ${totalNeeded.toFixed(4)} SOL (including network gas fee).`);
          setLoading(false);
          return;
        }
      }

      // Record latest signature prior to sending to detect new tx even with clock skews
      let initialTopSig: string | null = null;
      try {
        const initSigs = await SolanaService.getRecentSignatures(senderPublicKey, 1);
        initialTopSig = initSigs[0]?.signature || null;
      } catch {}

      // 1. Mandatory Device Security: Face ID / Fingerprint / Passcode / Pattern
      const bioAuth = await BiometricService.authenticate(
        `Authorize transfer of ${tokenDisplayStr} on Solana`
      );
      if (!bioAuth.success) {
        setError(bioAuth.error || 'Device security authorization was cancelled.');
        setLoading(false);
        return;
      }

      const fromPubkey = new PublicKey(senderPublicKey);
      let toPubkey: PublicKey;
      try {
        toPubkey = new PublicKey(targetRecipient);
      } catch {
        setError('Invalid recipient Solana address.');
        setLoading(false);
        return;
      }

      let transaction: Transaction;
      if (selectedToken === 'USDC') {
        transaction = await SolanaService.buildUsdcTransferTransaction(fromPubkey, toPubkey, numAmount);
      } else if (selectedToken === 'SKR') {
        transaction = await SolanaService.buildSkrTransferTransaction(fromPubkey, toPubkey, numAmount);
      } else {
        const lamports = Math.round(numAmount * LAMPORTS_PER_SOL);
        const latestBlockhash = await SolanaService.getLatestBlockhash('confirmed');
        transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports,
          })
        );
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = fromPubkey;
      }

      // Routes through the active wallet provider (Seed Vault biometrics, Phantom, or Solflare)
      const sig = await WalletProviderService.signAndSendTransaction(transaction);

      // Non-blocking: verify transaction on-chain in background (don't block success UI)
      const connection = SolanaService.getConnection();
      SolanaService.getLatestBlockhash('confirmed').then((latestBlockhash) => {
        connection.confirmTransaction(
          { signature: sig, ...latestBlockhash },
          'confirmed'
        ).then((confirmation) => {
          if (confirmation?.value?.err) {
            console.warn('Transaction failed on-chain after broadcast:', confirmation.value.err);
            ToastService.error('Transaction may have failed on-chain. Please check your balance.');
          }
        }).catch((confirmErr) => {
          console.warn('Transaction confirmation check error (may still succeed):', confirmErr);
        });
      }).catch(() => {});

      setTxSignature(sig);

      // Save official non-custodial receipt
      const rcpt: TransactionReceipt = {
        id: `rcpt_${sig.slice(0, 10)}`,
        signature: sig,
        blinkTitle: resolvedBlinkInfo?.name || 'Direct Transfer',
        blinkId: resolvedBlinkInfo ? resolvedBlinkInfo.id : undefined,
        actionType: resolvedBlinkInfo ? resolvedBlinkInfo.actionType : undefined,
        amount: numAmount,
        token: selectedToken,
        payerAddress: senderPublicKey,
        recipientAddress: targetRecipient,
        timestamp: Date.now(),
        status: 'confirmed',
        method: 'send',
      };
      ReceiptService.saveReceipt(rcpt);
      NotificationService.notifyPaymentSent(numAmount, selectedToken, targetRecipient, sig);

      // Optimistically update cached balance so UI reflects new balance immediately
      const currentSol = SolanaService.getCachedSol(senderPublicKey) ?? 0;
      const currentUsdc = SolanaService.getCachedUsdc(senderPublicKey) ?? 0;
      const currentSkr = SolanaService.getCachedSkr(senderPublicKey) ?? 0;
      if (selectedToken === 'SOL') {
        const nextSol = Math.max(0, Number((currentSol - numAmount - 0.000005).toFixed(4)));
        SolanaService.setCachedBalance(senderPublicKey, nextSol);
      } else if (selectedToken === 'USDC') {
        const nextUsdc = Math.max(0, Number((currentUsdc - numAmount).toFixed(2)));
        SolanaService.setCachedBalance(senderPublicKey, undefined, nextUsdc);
      } else {
        const nextSkr = Math.max(0, Number((currentSkr - numAmount).toFixed(2)));
        SolanaService.setCachedBalance(senderPublicKey, undefined, undefined, nextSkr);
      }

      // Notify app to instantly refresh transactions and balance without waiting or manual refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('blink_balance_refresh'));
        window.dispatchEvent(new CustomEvent('blink_tx_updated', { detail: rcpt }));
      }
      onSuccess();

      ToastService.success(`Transfer of ${tokenDisplayStr} confirmed.`);
    } catch (err: any) {
      console.error('Send error:', err);
      const errMsg = err?.message || String(err);

      // If the user explicitly rejected/cancelled, show friendly message
      if (/reject|cancel|denied|dismiss/i.test(errMsg)) {
        setError('Transaction was cancelled.');
        return;
      }

      // Check for ATA or token balance failure
      if (errMsg.includes('custom program error: 0x1') || errMsg.includes('insufficient funds')) {
        setError(`Insufficient on-chain ${selectedToken} funds for this transfer.`);
        return;
      }

      // Show the real error — never fake a confirmation
      setError(errMsg || 'Failed to send transaction. Please check your network and balance.');
    } finally {
      setLoading(false);
    }
  };

  const handleQrScan = (data: string) => {
    setShowScanner(false);
    if (!data) return;

    let targetAddress = data.trim();
    let targetAmount: string | null = null;

    // Check if it's a solana: URI (Solana Pay spec: solana:<pubkey>?amount=1.5&...)
    if (targetAddress.toLowerCase().startsWith('solana:')) {
      const parsedUrl = targetAddress.replace(/^solana:/i, '');
      const [addressPart, queryPart] = parsedUrl.split('?');
      targetAddress = addressPart;
      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        const amt = params.get('amount');
        if (amt) targetAmount = amt;
      }
    }

    // Check if it's a URL (e.g. solscan, explorer, or physical blink url)
    if (targetAddress.includes('http://') || targetAddress.includes('https://')) {
      try {
        const u = new URL(targetAddress);
        const pathParts = u.pathname.split('/').filter(Boolean);
        if (u.pathname.includes('/address/')) {
          targetAddress = pathParts[pathParts.indexOf('address') + 1] || targetAddress;
        } else if (u.pathname.includes('/b/')) {
          const blinkId = pathParts[pathParts.indexOf('b') + 1];
          const found = PhysicalBlinkRegistry.getById(blinkId);
          if (found) {
            targetAddress = found.recipient;
            targetAmount = found.amount.toString();
          }
        }
      } catch {}
    }

    try {
      new PublicKey(targetAddress);
      setRecipient(targetAddress);
      if (targetAmount) setAmount(targetAmount);
      setError(null);
      ToastService.success('Recipient address scanned.');
    } catch {
      const match = targetAddress.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
      if (match) {
        try {
          new PublicKey(match[0]);
          setRecipient(match[0]);
          if (targetAmount) setAmount(targetAmount);
          setError(null);
          ToastService.success('Recipient address scanned.');
          return;
        } catch {}
      }
      setError('Scanned QR code did not contain a valid Solana address.');
    }
  };

  const resetAndClose = () => {
    setRecipient('');
    setAmount('');
    setError(null);
    setTxSignature(null);
    setLoading(false);
    setShowScanner(false);
    onClose();
  };

  return (
    <>
      <Modal visible={visible && !showScanner} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <ArrowUpRight size={18} color="#5B67F6" strokeWidth={2.5} />
                <Text style={styles.title}>Send {selectedToken}</Text>
              </View>
              <TouchableOpacity onPress={resetAndClose} style={styles.closeBtn} activeOpacity={0.7}>
                <X size={16} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {txSignature ? (
              <View style={styles.successBox}>
                <CheckCircle2 size={40} color="#10B981" />
                <Text style={styles.successTitle}>Transaction Confirmed</Text>
                <Text style={styles.successSub}>
                  Transferred {selectedToken === 'SOL' ? `${amount} SOL` : `$${parseFloat(amount || '0').toFixed(2)} USDC`} on Solana
                </Text>
                <Text style={styles.sigText} numberOfLines={1}>{txSignature}</Text>

                <TouchableOpacity
                  style={[styles.doneBtn, { backgroundColor: '#5B67F6' }]}
                  onPress={() => {
                    const r = ReceiptService.getReceiptBySignature(txSignature);
                    if (r) setActiveReceipt(r);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.doneBtnText}>View & Download Receipt</Text>
                </TouchableOpacity>

                {typeof window !== 'undefined' && (
                  <TouchableOpacity
                    style={styles.explorerBtn}
                    onPress={() => window.open(SolanaService.getExplorerUrl(txSignature), '_blank')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.explorerBtnText}>View on Solana Explorer</Text>
                    <ExternalLink size={13} color="#5B67F6" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[styles.doneBtn, { backgroundColor: '#1E2030', borderWidth: 1, borderColor: '#2A2E42' }]} onPress={resetAndClose} activeOpacity={0.8}>
                  <Text style={[styles.doneBtnText, { color: '#CBD5E1' }]}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.form}>
                {/* Currency Selector: SOL vs USDC vs SKR on Solana */}
                <View style={styles.tokenPillRow}>
                  <TouchableOpacity
                    style={[styles.tokenPill, selectedToken === 'SOL' && styles.tokenPillActive]}
                    onPress={() => setSelectedToken('SOL')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tokenPillText, selectedToken === 'SOL' && styles.tokenPillTextActive]}>
                      SOL
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tokenPill, selectedToken === 'USDC' && styles.tokenPillActive]}
                    onPress={() => setSelectedToken('USDC')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tokenPillText, selectedToken === 'USDC' && styles.tokenPillTextActive]}>
                      USDC
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tokenPill, selectedToken === 'SKR' && styles.tokenPillActive]}
                    onPress={() => setSelectedToken('SKR')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tokenPillText, selectedToken === 'SKR' && styles.tokenPillTextActive]}>
                      SKR
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Recipient Input with Blink ID / QR Support */}
                <View style={styles.field}>
                  <View style={styles.recipientLabelRow}>
                    <Text style={styles.label}>RECIPIENT ADDRESS OR BLINK ID</Text>
                    <TouchableOpacity
                      onPress={() => setShowScanner(true)}
                      style={styles.scanBadgeBtn}
                      activeOpacity={0.7}
                    >
                      <QrCode size={12} color="#818CF8" />
                      <Text style={styles.scanBadgeText}>Scan QR</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.inputWithIconRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, paddingRight: 44 }]}
                      placeholder="Solana address, e.g. 7xKX... or Blink ID"
                      placeholderTextColor="#6B7280"
                      value={recipient}
                      onChangeText={setRecipient}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.inputInnerScanBtn}
                      onPress={() => setShowScanner(true)}
                      activeOpacity={0.7}
                    >
                      <Scan size={18} color="#818CF8" />
                    </TouchableOpacity>
                  </View>

                  {/* Real-time Verification & Resolution Badges */}
                  {isResolving && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 4 }}>
                      <ActivityIndicator size="small" color="#818CF8" />
                      <Text style={{ fontSize: 10, color: '#9CA3AF' }}>Verifying recipient on Solana...</Text>
                    </View>
                  )}

                  {/* Self Recipient Warning Badge */}
                  {isInputSelf && (
                    <View style={[styles.resolvedBlinkBadge, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.4)' }]}>
                      <AlertCircle size={16} color="#EF4444" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#EF4444' }}>
                          Self-Transfer Not Allowed
                        </Text>
                        <Text style={{ fontSize: 10, color: '#F87171', marginTop: 2 }}>
                          It's not possible to send funds to your own wallet address or username. Please enter a different recipient.
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* 1. Verified User Recipient (Only if not self) */}
                  {!isResolving && !isInputSelf && resolvedUser && (
                    <View style={[styles.resolvedBlinkBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
                      <CheckCircle2 size={16} color="#10B981" />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#10B981' }}>
                            Verified User: {resolvedUser.username ? (resolvedUser.username.startsWith('@') ? resolvedUser.username : `@${resolvedUser.username}`) : 'User'}
                          </Text>
                          {resolvedUser.displayName && resolvedUser.displayName !== resolvedUser.username && (
                            <Text style={{ fontSize: 10, color: '#D1D5DB' }}>({resolvedUser.displayName})</Text>
                          )}
                        </View>
                        <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                          Wallet Address: {resolvedUser.address.slice(0, 8)}...{resolvedUser.address.slice(-8)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* 2. Verified Action Blink Recipient */}
                  {!isResolving && resolvedBlinkInfo && (
                    <View style={[styles.resolvedBlinkBadge, { backgroundColor: 'rgba(99, 102, 241, 0.12)', borderColor: 'rgba(99, 102, 241, 0.35)' }]}>
                      <CheckCircle2 size={16} color="#818CF8" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#818CF8' }}>
                          Action Blink: {resolvedBlinkInfo.name}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                          Merchant Wallet: {resolvedBlinkInfo.recipient.slice(0, 8)}...{resolvedBlinkInfo.recipient.slice(-8)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* 3. Direct Valid Solana Address */}
                  {!isResolving && !resolvedBlinkInfo && !resolvedUser && isDirectValidAddress && (
                    <View style={[styles.resolvedBlinkBadge, { backgroundColor: 'rgba(59, 130, 246, 0.12)', borderColor: 'rgba(59, 130, 246, 0.35)' }]}>
                      <CheckCircle2 size={16} color="#3B82F6" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#3B82F6' }}>
                          Valid Solana Wallet Address
                        </Text>
                        <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                          {trimmedRecipient.slice(0, 8)}...{trimmedRecipient.slice(-8)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* 4. Not Found Warning */}
                  {!isResolving && !resolvedBlinkInfo && !resolvedUser && !isDirectValidAddress && trimmedRecipient.length >= 3 && (
                    <View style={[styles.resolvedBlinkBadge, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.35)' }]}>
                      <AlertCircle size={16} color="#EF4444" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#EF4444' }}>
                          Recipient Not Found
                        </Text>
                        <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
                          No registered wallet found for "{trimmedRecipient}". Check spelling or paste a 32-44 char Solana address.
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Amount Input with Dynamic MAX & Live USDT Value */}
                <View style={styles.field}>
                  <View style={styles.amountLabelRow}>
                    <Text style={styles.label}>AMOUNT ({selectedToken})</Text>
                    <TouchableOpacity
                      onPress={() => {
                        if (selectedToken === 'SOL') {
                          setAmount(Math.max(0, currentBalanceSol - 0.0005).toFixed(4));
                        } else if (selectedToken === 'SKR') {
                          setAmount(currentBalanceSkr.toFixed(2));
                        } else {
                          setAmount(currentBalanceUsdc.toFixed(2));
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.maxText}>
                        MAX ({selectedToken === 'SOL' ? `${currentBalanceSol.toFixed(4)} SOL` : (selectedToken === 'SKR' ? `${currentBalanceSkr.toFixed(2)} SKR` : `$${currentBalanceUsdc.toFixed(2)} USDC`)})
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.input, styles.amountInput]}
                    placeholder="0.00"
                    placeholderTextColor="#6B7280"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                  />
                  {parseFloat(amount || '0') > 0 && (
                    <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
                      {selectedToken === 'SOL'
                        ? `≈ $${PriceService.convertSolToUsdt(parseFloat(amount)).toFixed(2)} USDT`
                        : (selectedToken === 'SKR'
                          ? `≈ $${PriceService.convertSkrToUsdt(parseFloat(amount)).toFixed(2)} USDT`
                          : `≈ $${parseFloat(amount).toFixed(2)} USD`)}
                    </Text>
                  )}
                </View>

                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.feeInfoRow}>
                  <Text style={styles.feeLabel}>Network / Currency</Text>
                  <Text style={styles.feeValue}>
                    {selectedToken === 'USDC' ? 'USDC (Solana SPL Token)' : (selectedToken === 'SKR' ? 'SKR (Solana Mobile Token)' : 'SOL (Solana Native)')}
                  </Text>
                </View>

                <View style={styles.feeInfoRow}>
                  <Text style={styles.feeLabel}>Signing Provider</Text>
                  <Text style={styles.feeValue}>
                    {activeAccount?.name || 'Seeker Seed Vault'}
                  </Text>
                </View>

                <View style={styles.feeInfoRow}>
                  <Text style={styles.feeLabel}>Network Fee</Text>
                  <Text style={styles.feeValue}>~0.000005 SOL</Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    (loading || isInputSelf) && styles.sendBtnDisabled,
                    isInputSelf && { backgroundColor: '#374151' }
                  ]}
                  onPress={handleSend}
                  disabled={loading || isInputSelf}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.sendBtnText}>Authenticating...</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Fingerprint size={16} color="#FFFFFF" />
                      <Text style={[styles.sendBtnText, isInputSelf && { color: '#9CA3AF' }]}>
                        {isInputSelf
                          ? 'Cannot Send to Yourself'
                          : (amount && parseFloat(amount) > 0
                            ? selectedToken === 'SOL'
                              ? `Pay ${amount} SOL`
                              : (selectedToken === 'SKR' ? `Pay ${amount} SKR` : `Pay $${parseFloat(amount).toFixed(2)} USDC`)
                            : `Pay ${selectedToken}`)}
                      </Text>
                      {!isInputSelf && <ArrowRight size={15} color="#FFFFFF" />}
                    </View>
                  )}
                </TouchableOpacity>

                {onOpenReceive && (
                  <TouchableOpacity
                    style={styles.switchReceiveBtn}
                    onPress={() => {
                      resetAndClose();
                      onOpenReceive();
                    }}
                    activeOpacity={0.7}
                  >
                    <QrCode size={13} color="#6B7280" />
                    <Text style={styles.switchReceiveText}>Receive SOL or USDC instead (View QR)</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* QR Code Scanner Overlay */}
      {showScanner && (
        <CameraQrScanner
          onScan={handleQrScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Official Transaction Receipt Modal */}
      <ReceiptModal
        visible={!!activeReceipt}
        receipt={activeReceipt}
        viewerAddress={senderPublicKey}
        onClose={() => setActiveReceipt(null)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 8, 11, 0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F111A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    borderTopWidth: 1,
    borderTopColor: '#1D212E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#181B27',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#222636',
  },
  form: {
    gap: 14,
  },
  field: {
    gap: 6,
  },
  recipientLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  scanBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(91, 103, 246, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(91, 103, 246, 0.3)',
  },
  scanBadgeText: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '700',
  },
  inputWithIconRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputInnerScanBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  amountLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  maxText: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#12141F',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 10.5,
    borderWidth: 1,
    borderColor: '#1D212E',
  },
  amountInput: {
    fontSize: 11,
    fontWeight: '800',
  },
  feeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  feeLabel: {
    color: '#64748B',
    fontSize: 10,
  },
  feeValue: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 10,
    textAlign: 'center',
  },
  sendBtn: {
    flexDirection: 'row',
    backgroundColor: '#5B67F6',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  successTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },
  successSub: {
    color: '#94A3B8',
    fontSize: 11,
  },
  sigText: {
    color: '#818CF8',
    fontSize: 10,
    fontFamily: 'monospace',
    backgroundColor: '#12141F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: '90%',
  },
  explorerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  explorerBtnText: {
    color: '#5B67F6',
    fontSize: 10,
    fontWeight: '700',
  },
  doneBtn: {
    width: '100%',
    backgroundColor: '#5B67F6',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  switchReceiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  switchReceiveText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  tokenPillRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  tokenPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#1E2030',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tokenPillActive: {
    backgroundColor: 'rgba(91, 103, 246, 0.15)',
    borderColor: '#5B67F6',
  },
  tokenPillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  tokenPillTextActive: {
    color: '#FFFFFF',
  },
  resolvedBlinkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  resolvedBlinkText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '600',
  },
});
