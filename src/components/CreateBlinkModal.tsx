import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import {
  X,
  Plus,
  Radio,
  Sparkles,
  Shield,
  CheckCircle2,
  DollarSign,
  Tag,
  Globe,
  Wallet,
  Download,
  Printer,
  Lock,
  Camera,
} from 'lucide-react-native';
import {
  PhysicalBlinkRegistry,
  PhysicalBlink,
  ActionType,
} from '../services/physicalBlinkRegistry';
import { DatabaseService } from '../services/databaseService';
import { WalletProviderService } from '../services/walletProviderService';
import { PrintableCardService } from '../services/printableCardService';
import { ToastService } from '../services/toastService';
import { PriceService } from '../services/priceService';
import { ImagePickerService } from '../services/imagePickerService';
import { SolanaService } from '../services/solanaService';
import { useTheme } from '../theme/ThemeContext';
import { BlinkBrandMark } from './BrandLogos';

interface CreateBlinkModalProps {
  visible: boolean;
  onClose: () => void;
  onBlinkCreated?: (blink: PhysicalBlink) => void;
  defaultRecipient?: string;
  onOpenWalletConnect?: () => void;
}

const ACTION_TYPES: { type: ActionType; label: string; desc: string }[] = [
  { type: 'tip', label: 'Creator Tip Jar', desc: 'Direct tipping with custom notes' },
  { type: 'payment', label: 'Point-of-Sale / Retail', desc: 'Accept payments for goods & services' },
  { type: 'voucher', label: 'Digital Voucher / Ticket', desc: 'Pre-orders & event admission passes' },
  { type: 'mint', label: 'NFT / POAP Mint', desc: 'Commemorative digital collectibles' },
  { type: 'donation', label: 'Charity / Donation', desc: 'Fundraising for campaigns & causes' },
  { type: 'checkin', label: 'Venue Check-In', desc: 'Attendance & access verification' },
];

export const CreateBlinkModal: React.FC<CreateBlinkModalProps> = ({
  visible,
  onClose,
  onBlinkCreated,
  defaultRecipient,
  onOpenWalletConnect,
}) => {
  const { colors, isDark } = useTheme();

  const [name, setName] = useState('');
  const [blinkImage, setBlinkImage] = useState<string | null>(null);
  const [actionType, setActionType] = useState<ActionType>('tip');
  const [amount, setAmount] = useState('5.00');
  const [token, setToken] = useState<'USDC' | 'SOL' | 'SKR'>('USDC');
  const [recipient, setRecipient] = useState('');
  const [description, setDescription] = useState('');
  const [physicalId, setPhysicalId] = useState('');
  const [verifiedDomain, setVerifiedDomain] = useState('');
  const [customVisibility, setCustomVisibility] = useState<'global' | 'physical'>('global');
  const [error, setError] = useState<string | null>(null);
  const [successBlink, setSuccessBlink] = useState<PhysicalBlink | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handlePickBlinkImage = async () => {
    const uri = await ImagePickerService.pickBlinkImage();
    if (uri) {
      setBlinkImage(uri);
    }
  };

  useEffect(() => {
    if (visible) {
      const active = WalletProviderService.getActiveAccount();
      const initialRecipient = defaultRecipient || active?.publicKey || '';
      setRecipient(initialRecipient);
      setError(null);
      setSuccessBlink(null);
    }
  }, [visible, defaultRecipient]);

  const handleCreate = () => {
    setError(null);

    const active = WalletProviderService.getActiveAccount();
    if (!active?.publicKey) {
      setError('Guest mode active: You must sign in to create a Blink.');
      ToastService.error('Please sign in or connect your wallet to create a Blink.');
      onOpenWalletConnect?.();
      return;
    }

    if (!name.trim()) {
      setError('Please provide a name for this Blink.');
      return;
    }

    const cleanAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (isNaN(cleanAmount) || (actionType === 'payment' && cleanAmount <= 0)) {
      setError('Please enter a valid amount greater than $0.00');
      return;
    }

    const cleanRecipient = recipient.trim() || active.publicKey;
    if (!cleanRecipient || cleanRecipient.length < 32) {
      setError('Please provide a valid Solana Devnet recipient address.');
      return;
    }

    const chosenId =
      physicalId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') ||
      name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 18) + '-' + Math.floor(Math.random() * 900 + 100);

    let finalId = chosenId;
    if (PhysicalBlinkRegistry.isIdTakenByOther(chosenId, active.publicKey)) {
      if (physicalId.trim()) {
        const shortPk = active.publicKey.slice(-4).toLowerCase();
        setError(`Blink ID "${chosenId}" is already registered by another creator. Try "${chosenId}-${shortPk}" instead.`);
        return;
      } else {
        finalId = `${chosenId}-${active.publicKey.slice(-4).toLowerCase()}`;
      }
    }

    const skrDetails = token === 'SKR' ? PriceService.getSkrPaymentDetails(cleanAmount) : null;

    const newBlink = PhysicalBlinkRegistry.createBlink({
      id: finalId,
      name: name.trim(),
      actionType,
      amount: skrDetails ? skrDetails.skrAmount : cleanAmount,
      baseUsdcAmount: cleanAmount,
      token,
      recipient: cleanRecipient,
      creatorAddress: active.publicKey,
      description: description.trim() || `${actionType.toUpperCase()} interaction powered by Solana Actions`,
      verifiedDomain: verifiedDomain.trim() || undefined,
      visibility: customVisibility,
      imageUrl: blinkImage || undefined,
    });

    DatabaseService.saveBlink(newBlink);
    setSuccessBlink(newBlink);
    onBlinkCreated?.(newBlink);
    ToastService.success(`Blink "${newBlink.name}" created successfully.`);
  };

  const handleDownloadCard = async () => {
    if (!successBlink) return;
    setIsDownloading(true);
    try {
      const ok = await PrintableCardService.downloadCard(successBlink);
      if (ok) {
        ToastService.success('Printable placard downloaded. Ready to print out.');
      } else {
        ToastService.error('Could not download card image.');
      }
    } catch {
      ToastService.error('Failed to generate printable card.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCloseAndReset = () => {
    setName('');
    setBlinkImage(null);
    setAmount('5.00');
    setDescription('');
    setPhysicalId('');
    setVerifiedDomain('');
    setSuccessBlink(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <BlinkBrandMark size={28} />
              <View>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Create Blink</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Program an on-chain Solana Blink Action</Text>
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

          {successBlink ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <View style={[styles.successIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <CheckCircle2 size={42} color="#10B981" />
              </View>
              <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Blink Deployed On-Chain</Text>
              <Text style={[styles.successSub, { color: colors.textSecondary }]}>
                "{successBlink.name}" is live on Solana Devnet and ready for instant tap & QR execution.
              </Text>

              <TouchableOpacity
                style={[styles.doneBtn, { borderColor: colors.border, backgroundColor: colors.accent, marginTop: 16 }]}
                onPress={handleCloseAndReset}
                activeOpacity={0.8}
              >
                <Text style={[styles.doneBtnText, { color: '#FFFFFF', fontWeight: '800' }]}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
                {error && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Blink Name */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>BLINK / MERCHANT NAME *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.bgCardAlt, borderColor: colors.border, color: colors.textPrimary }]}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Dean's Cold Brew Station"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                {/* Blink Image (Optional) */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>BLINK IMAGE (OPTIONAL)</Text>
                  <TouchableOpacity
                    style={[
                      styles.imagePicker,
                      { backgroundColor: colors.bgCardAlt, borderColor: blinkImage ? colors.accent : colors.border },
                    ]}
                    onPress={handlePickBlinkImage}
                    activeOpacity={0.7}
                  >
                    {blinkImage ? (
                      <Image
                        source={{ uri: blinkImage }}
                        style={styles.imagePreview}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.imagePickerPlaceholder}>
                        <Camera size={18} color={colors.textMuted} />
                        <Text style={[styles.imagePickerText, { color: colors.textMuted }]}>Tap to add image</Text>
                      </View>
                    )}
                    {blinkImage && (
                      <TouchableOpacity
                        style={[styles.imageRemoveBtn, { backgroundColor: colors.bgCard }]}
                        onPress={() => setBlinkImage(null)}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      >
                        <X size={10} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Action Type Selector */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>ACTION TYPE</Text>
                  <View style={styles.actionTypeRow}>
                    {ACTION_TYPES.map((item) => {
                      const isSelected = actionType === item.type;
                      return (
                        <TouchableOpacity
                          key={item.type}
                          style={[
                            styles.actionTypePill,
                            { backgroundColor: colors.bgCardAlt, borderColor: colors.border },
                            isSelected && [styles.actionTypePillSelected, { borderColor: colors.accent, backgroundColor: colors.accentSoft }],
                          ]}
                          onPress={() => {
                            setActionType(item.type);
                            // Auto-set visibility preference based on type if user hasn't explicitly changed it
                            if (['payment', 'checkin'].includes(item.type)) {
                              setCustomVisibility('physical');
                            } else {
                              setCustomVisibility('global');
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.actionTypeLabel,
                              { color: colors.textSecondary },
                              isSelected && { color: colors.accent, fontWeight: '700' },
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>



                {/* Amount & Token Row */}
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldGroup, { flex: 1.4 }]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>PRICE / AMOUNT *</Text>
                    <View style={[styles.inputWithPrefix, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
                      <Text style={[styles.prefixText, { color: colors.textMuted }]}>$</Text>
                      <TextInput
                        style={[styles.inputBare, { color: colors.textPrimary }]}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="decimal-pad"
                        placeholder="5.00"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>TOKEN</Text>
                    <View style={styles.tokenToggleRow}>
                      <TouchableOpacity
                        style={[
                          styles.tokenToggleBtn,
                          { borderColor: colors.border, backgroundColor: colors.bgCardAlt },
                          token === 'USDC' && [styles.tokenToggleBtnActive, { backgroundColor: colors.accent, borderColor: colors.accent }],
                        ]}
                        onPress={() => setToken('USDC')}
                      >
                        <Text style={[styles.tokenToggleText, { color: token === 'USDC' ? '#FFFFFF' : colors.textMuted }]}>USDC</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.tokenToggleBtn,
                          { borderColor: colors.border, backgroundColor: colors.bgCardAlt },
                          token === 'SOL' && [styles.tokenToggleBtnActive, { backgroundColor: colors.accent, borderColor: colors.accent }],
                        ]}
                        onPress={() => setToken('SOL')}
                      >
                        <Text style={[styles.tokenToggleText, { color: token === 'SOL' ? '#FFFFFF' : colors.textMuted }]}>SOL</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.tokenToggleBtn,
                          { borderColor: colors.border, backgroundColor: colors.bgCardAlt },
                          token === 'SKR' && [styles.tokenToggleBtnActive, { backgroundColor: colors.accent, borderColor: colors.accent }],
                        ]}
                        onPress={() => setToken('SKR')}
                      >
                        <Text style={[styles.tokenToggleText, { color: token === 'SKR' ? '#FFFFFF' : colors.textMuted }]}>SKR</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {token === 'SKR' && (
                  <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981', borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 4, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={16} color="#10B981" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#10B981' }}>10% SKR Discount Active</Text>
                      <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2, lineHeight: 15 }}>
                        Payers using SKR automatically get 10% off!
                      </Text>
                    </View>
                  </View>
                )}

                {/* Recipient Solana Address */}
                <View style={styles.fieldGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>RECIPIENT DEVNET ADDRESS *</Text>
                    <TouchableOpacity
                      onPress={() => {
                        const active = WalletProviderService.getActiveAccount();
                        if (active?.publicKey) setRecipient(active.publicKey);
                      }}
                    >
                      <Text style={[styles.useWalletHint, { color: colors.accent }]}>Use My Wallet</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.input, styles.monoInput, { backgroundColor: colors.bgCardAlt, borderColor: colors.border, color: colors.textPrimary }]}
                    value={recipient}
                    onChangeText={setRecipient}
                    placeholder="Solana address (base58)"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                  />
                </View>

                {/* Description / Memo */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>DESCRIPTION / MEMO</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: colors.bgCardAlt, borderColor: colors.border, color: colors.textPrimary }]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="e.g. Tap NFC tag on barista counter for instant payment"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                {/* Optional Verified Domain / Tag Slug */}
                <View style={styles.fieldRow}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>VERIFIED DOMAIN (OPTIONAL)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.bgCardAlt, borderColor: colors.border, color: colors.textPrimary }]}
                      value={verifiedDomain}
                      onChangeText={setVerifiedDomain}
                      placeholder="e.g. mycafe.sol"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>CUSTOM SLUG ID</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.bgCardAlt, borderColor: colors.border, color: colors.textPrimary }]}
                      value={physicalId}
                      onChangeText={setPhysicalId}
                      placeholder="e.g. coldbrew-01"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </ScrollView>

              {/* Footer Action */}
              <View style={[styles.footerRow, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.accent }]}
                  onPress={handleCreate}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.submitBtnText}>Create Blink</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 9.5,
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    maxHeight: 460,
  },
  scrollContent: {
    padding: 16,
    gap: 10,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 9.5,
    fontWeight: '600',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  successText: {
    color: '#10B981',
    fontSize: 9.5,
    fontWeight: '700',
  },
  fieldGroup: {
    gap: 4,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 8,
  },
  imagePicker: {
    height: 72,
    borderWidth: 1,
    borderRadius: 10,
    borderStyle: 'dashed',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imagePickerPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  imagePickerText: {
    fontSize: 10,
    fontWeight: '600',
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  label: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  useWalletHint: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
    fontSize: 11,
  },
  monoInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
  },
  textArea: {
    height: 52,
    textAlignVertical: 'top',
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  prefixText: {
    fontSize: 11,
    fontWeight: '700',
    marginRight: 3,
  },
  inputBare: {
    flex: 1,
    paddingVertical: 7,
    fontSize: 11,
    fontWeight: '700',
  },
  tokenToggleRow: {
    flexDirection: 'row',
    gap: 5,
  },
  tokenToggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  tokenToggleBtnActive: {
    borderColor: 'transparent',
  },
  tokenToggleText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  actionTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionTypePill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  actionTypePillSelected: {
    borderWidth: 1.5,
  },
  actionTypeLabel: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
  },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
  },
  visibilityCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
  },
  visibilityCardTitle: {
    fontSize: 10,
    fontWeight: '700',
  },
  visibilityCardSub: {
    fontSize: 10,
    lineHeight: 14,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 16,
  },
  placardPreviewCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  placardBadge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  placardPrice: {
    fontSize: 12,
    fontWeight: '800',
  },
  placardTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  placardDesc: {
    fontSize: 10,
    lineHeight: 16,
    marginBottom: 8,
  },
  placardRecipient: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  downloadCardBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  downloadCardBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  doneBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  doneBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
