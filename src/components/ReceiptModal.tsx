import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import {
  X,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Download,
  Printer,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react-native';
import { TransactionReceipt } from '../types';
import { SolanaService } from '../services/solanaService';
import { ReceiptService } from '../services/receiptService';
import { ReceiptImageService } from '../services/receiptImageService';
import { ToastService } from '../services/toastService';
import { WalletProviderService } from '../services/walletProviderService';
import {
  BLINK_LOGO_CROPPED_BLACK_DATA_URI,
  BLINK_LOGO_CROPPED_WHITE_DATA_URI,
} from '../constants/brandLogoAssets';
import { useTheme } from '../theme/ThemeContext';

interface ReceiptModalProps {
  visible: boolean;
  receipt: TransactionReceipt | null;
  onClose: () => void;
  viewerAddress?: string | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  visible,
  receipt,
  onClose,
  viewerAddress,
}) => {
  const { colors, isDark } = useTheme();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<TransactionReceipt | null>(receipt);

  const activeWallet = viewerAddress || WalletProviderService.getActiveAccount()?.publicKey;

  React.useEffect(() => {
    setCurrentReceipt(receipt);
    if (receipt?.signature) {
      // If receipt is missing amount or sender/recipient details, resolve via cloud database or on-chain
      const isMissingData =
        !receipt.amount ||
        !receipt.payerAddress ||
        receipt.payerAddress.includes('External') ||
        !receipt.recipientAddress ||
        receipt.recipientAddress.includes('External');

      if (isMissingData) {
        ReceiptService.getReceiptAsync(receipt.signature, activeWallet || receipt.recipientAddress || receipt.payerAddress).then((upgraded: any) => {
          if (upgraded) {
            setCurrentReceipt(upgraded);
          }
        });
      }
    }
  }, [receipt?.signature, receipt?.amount, receipt?.payerAddress, receipt?.recipientAddress, activeWallet]);

  if (!receipt || !currentReceipt) return null;

  const copyToClipboard = async (text: string, field: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      ToastService.success(`${field} copied to clipboard.`);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleDownloadImage = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const ok = await ReceiptImageService.downloadReceipt(currentReceipt, activeWallet);
      if (ok) {
        ToastService.success('Receipt image saved successfully.');
      } else {
        ToastService.error('Failed to download receipt image.');
      }
    } catch (err) {
      console.error('Download receipt error:', err);
      ToastService.error('Could not save receipt image.');
    } finally {
      setIsDownloading(false);
    }
  };

  const formattedDate = new Date(currentReceipt.timestamp || Date.now()).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const amountNum = Number(currentReceipt.amount || 0);
  const formattedAmount = currentReceipt.token === 'SOL'
    ? `${amountNum.toFixed(4)} SOL`
    : currentReceipt.token === 'SKR'
    ? `${amountNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} SKR`
    : `$${amountNum.toFixed(2)} USDC`;

  const isSender = Boolean(
    activeWallet &&
    currentReceipt.payerAddress &&
    (currentReceipt.payerAddress === activeWallet || currentReceipt.payerAddress.toLowerCase() === activeWallet.toLowerCase())
  );
  const isRecipient = Boolean(
    activeWallet &&
    currentReceipt.recipientAddress &&
    (currentReceipt.recipientAddress === activeWallet || currentReceipt.recipientAddress.toLowerCase() === activeWallet.toLowerCase())
  );

  let isReceive = false;
  let isSend = false;

  if (isRecipient && !isSender) {
    isReceive = true;
    isSend = false;
  } else if (isSender && !isRecipient) {
    isSend = true;
    isReceive = false;
  } else {
    isReceive = currentReceipt.method === 'receive';
    isSend = currentReceipt.method === 'send';
  }

  let displayActionTitle = currentReceipt.blinkTitle || 'Solana Action Payment';
  if (isReceive && /outgoing/i.test(displayActionTitle)) {
    displayActionTitle = displayActionTitle.replace(/outgoing/i, 'Incoming');
  } else if (isSend && /incoming/i.test(displayActionTitle)) {
    displayActionTitle = displayActionTitle.replace(/incoming/i, 'Outgoing');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.78)' : 'rgba(15, 23, 42, 0.52)' }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <View style={[styles.receiptCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {/* Header Bar: Authentic Blink Logo & Wordmark */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Image
                source={{ uri: isDark ? BLINK_LOGO_CROPPED_WHITE_DATA_URI : BLINK_LOGO_CROPPED_BLACK_DATA_URI }}
                style={styles.brandLogo}
                resizeMode="contain"
              />
              <View>
                <Text style={[styles.brandWordmark, { color: colors.textPrimary }]}>BLINK</Text>
                <Text style={styles.brandBadge}>TRANSACTION RECEIPT</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Status Pill & Direction Badge */}
            <View style={styles.statusBox}>
              <View style={styles.statusRow}>
                <View style={styles.statusBadge}>
                  <CheckCircle2 size={14} color="#10B981" />
                  <Text style={styles.statusText}>Settled & Confirmed on Solana</Text>
                </View>

                {isSend ? (
                  <View style={styles.dirBadgeSend}>
                    <ArrowUpRight size={13} color="#EF4444" strokeWidth={2.5} />
                    <Text style={styles.dirBadgeSendText}>Sent</Text>
                  </View>
                ) : isReceive ? (
                  <View style={styles.dirBadgeReceive}>
                    <ArrowDownLeft size={13} color="#10B981" strokeWidth={2.5} />
                    <Text style={styles.dirBadgeReceiveText}>Received</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Prominent Amount */}
            <View style={styles.amountContainer}>
              <Text style={[styles.amountValue, { color: isSend ? '#EF4444' : isReceive ? '#10B981' : colors.textPrimary }]}>
                {isSend ? `-${formattedAmount}` : isReceive ? `+${formattedAmount}` : formattedAmount}
              </Text>
              <Text style={[styles.amountSub, { color: colors.textSecondary }]}>
                {isSend ? 'Total Amount Sent' : isReceive ? 'Total Amount Received' : currentReceipt.token === 'SOL' ? 'Solana Native Transfer' : currentReceipt.token === 'SKR' ? 'SPL Token • $SKR on Solana' : 'SPL Token • USDC on Solana'}
              </Text>
            </View>

            {/* What They Paid For (Item / Action) */}
            <View style={[styles.itemCard, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
              <Text style={styles.itemCardLabel}>PAYMENT FOR / ACTION</Text>
              <Text style={[styles.itemCardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                {displayActionTitle}
              </Text>
              {currentReceipt.verifiedDomain && (
                <View style={styles.domainBadge}>
                  <ShieldCheck size={12} color="#10B981" />
                  <Text style={styles.domainText}>{currentReceipt.verifiedDomain}</Text>
                </View>
              )}
            </View>

            {/* Structured Receipt Details */}
            <View style={[styles.table, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
              {/* Payer / Sender */}
              <View style={styles.tableRow}>
                <Text style={styles.tableLabel}>Payer (Sender)</Text>
                <TouchableOpacity
                  style={styles.valWithCopy}
                  onPress={() => currentReceipt.payerAddress && copyToClipboard(currentReceipt.payerAddress, 'Payer Address')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.monoText, { color: colors.textPrimary }]} numberOfLines={1}>
                    {currentReceipt.payerAddress && currentReceipt.payerAddress !== 'External Solana Address'
                      ? `${currentReceipt.payerAddress.slice(0, 6)}...${currentReceipt.payerAddress.slice(-6)}${isSender ? ' (You)' : ''}`
                      : isReceive
                      ? 'External Sender'
                      : 'Sender Wallet (You)'}
                  </Text>
                  {copiedField === 'Payer Address' ? (
                    <Check size={13} color="#10B981" />
                  ) : (
                    <Copy size={13} color={colors.accent} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Recipient / Receiver */}
              <View style={styles.tableRow}>
                <Text style={styles.tableLabel}>Recipient (Receiver)</Text>
                <TouchableOpacity
                  style={styles.valWithCopy}
                  onPress={() => currentReceipt.recipientAddress && copyToClipboard(currentReceipt.recipientAddress, 'Recipient Address')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.monoText, { color: colors.textPrimary }]} numberOfLines={1}>
                    {currentReceipt.recipientAddress && currentReceipt.recipientAddress !== 'External Solana Address'
                      ? `${currentReceipt.recipientAddress.slice(0, 6)}...${currentReceipt.recipientAddress.slice(-6)}${isRecipient ? ' (You)' : ''}`
                      : isReceive
                      ? 'Connected Wallet (You)'
                      : 'Recipient Wallet'}
                  </Text>
                  {copiedField === 'Recipient Address' ? (
                    <Check size={13} color="#10B981" />
                  ) : (
                    <Copy size={13} color={colors.accent} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Transaction Hash with Clickable External Link */}
              <View style={styles.tableRow}>
                <Text style={styles.tableLabel}>Transaction Hash</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    onPress={() => {
                      if (typeof window !== 'undefined' && currentReceipt.signature) {
                        window.open(SolanaService.getExplorerUrl(currentReceipt.signature, currentReceipt.token === 'SKR' ? 'mainnet-beta' : 'devnet'), '_blank');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.monoText,
                        {
                          color: colors.accent,
                          textDecorationLine: 'underline',
                          fontWeight: '700',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {`${currentReceipt.signature.slice(0, 6)}...${currentReceipt.signature.slice(-6)}`}
                    </Text>
                    <ExternalLink size={13} color={colors.accent} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => copyToClipboard(currentReceipt.signature, 'Transaction Hash')}
                    style={{ padding: 4 }}
                    activeOpacity={0.7}
                  >
                    {copiedField === 'Transaction Hash' ? (
                      <Check size={13} color="#10B981" />
                    ) : (
                      <Copy size={13} color={colors.textSecondary} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date & Time */}
              <View style={styles.tableRow}>
                <Text style={styles.tableLabel}>Timestamp</Text>
                <Text style={[styles.tableVal, { color: colors.textPrimary }]}>
                  {formattedDate}
                </Text>
              </View>

              {/* Network */}
              <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.tableLabel}>Network</Text>
                <View style={styles.networkTag}>
                  <View style={styles.greenDot} />
                  <Text style={[styles.tableVal, { color: colors.textPrimary }]}>
                    {currentReceipt.token === 'SKR' ? 'Solana Mainnet' : 'Solana Devnet'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              {/* Primary: Download Receipt as Image (PNG) */}
              <TouchableOpacity
                style={[styles.downloadBtn, { backgroundColor: colors.accent }]}
                onPress={handleDownloadImage}
                disabled={isDownloading}
                activeOpacity={0.8}
              >
                <Download size={16} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.downloadBtnText}>
                  {isDownloading ? 'Generating Receipt Image...' : 'Save Receipt as Image (PNG)'}
                </Text>
              </TouchableOpacity>

              {/* Secondary: View on Solana Explorer */}
              <TouchableOpacity
                style={[styles.explorerBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                onPress={() => {
                  if (typeof window !== 'undefined' && receipt.signature) {
                    window.open(SolanaService.getExplorerUrl(receipt.signature, receipt.token === 'SKR' ? 'mainnet-beta' : 'devnet'), '_blank');
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.explorerBtnText, { color: colors.textPrimary }]}>
                  View on Solana Explorer
                </Text>
                <ExternalLink size={13} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity
                style={[styles.closeModalBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={[styles.closeModalBtnText, { color: colors.textSecondary }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  receiptCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 26,
    height: 35,
  },
  brandWordmark: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  brandBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scrollBody: {
    width: '100%',
  },
  statusBox: {
    alignItems: 'center',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  statusText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  dirBadgeSend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  dirBadgeSendText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '800',
  },
  dirBadgeReceive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  dirBadgeReceiveText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  amountContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  amountValue: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  amountSub: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  itemCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 14,
    alignItems: 'center',
  },
  itemCardLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  itemCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  domainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  domainText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  table: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    marginBottom: 18,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  tableLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  tableVal: {
    fontSize: 10,
    fontWeight: '600',
  },
  valWithCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monoText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  networkTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  actionsContainer: {
    gap: 8,
    paddingBottom: 6,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#5B67F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  explorerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  explorerBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeModalBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 2,
  },
  closeModalBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
