import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { X, Printer, Download, Copy, Check, QrCode } from 'lucide-react-native';
import { UniversalQrCode } from './UniversalQrCode';
import { PhysicalBlink, PhysicalBlinkRegistry } from '../services/physicalBlinkRegistry';
import { PrintableCardService } from '../services/printableCardService';
import { PriceService } from '../services/priceService';
import { ToastService } from '../services/toastService';
import { BlinkBrandMark, CoffeeShopLogo, HackerHouseLogo } from './BrandLogos';
import { useTheme } from '../theme/ThemeContext';

interface PrintableCardModalProps {
  visible: boolean;
  blink: PhysicalBlink | null;
  onClose: () => void;
}

export const PrintableCardModal: React.FC<PrintableCardModalProps> = ({
  visible,
  blink,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!blink) return null;

  const qrUrl = PhysicalBlinkRegistry.getShareableUrl(blink);
  const shortAddress = blink.recipient && blink.recipient.length > 12
    ? `${blink.recipient.slice(0, 6)}...${blink.recipient.slice(-6)}`
    : blink.recipient || '';

  const getBlinkLogo = (b: PhysicalBlink) => {
    if (b.imageUrl) {
      return (
        <Image
          source={{ uri: b.imageUrl }}
          style={{ width: 26, height: 26, borderRadius: 6 }}
          resizeMode="cover"
        />
      );
    }
    const id = b.id.toLowerCase();
    if (id.includes('coffee') || b.actionType === 'payment') return <CoffeeShopLogo size={26} />;
    if (id.includes('pass') || id.includes('event') || b.actionType === 'voucher') return <HackerHouseLogo size={26} />;
    return <BlinkBrandMark size={26} />;
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const ok = await PrintableCardService.downloadCard(blink);
      if (ok) {
        ToastService.success('Printable stand card downloaded (PNG).');
      } else {
        ToastService.error('Failed to download printable card.');
      }
    } catch (e) {
      ToastService.error('Error generating card image.');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    try {
      setPrinting(true);
      const ok = await PrintableCardService.printCard(blink);
      if (!ok) {
        ToastService.error('Could not open print window. Downloading image instead.');
        await handleDownload();
      }
    } catch (e) {
      ToastService.error('Error opening print dialog.');
    } finally {
      setPrinting(false);
    }
  };

  const handleCopyLink = () => {
    const url = PhysicalBlinkRegistry.getPhysicalUrl(blink.id);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      ToastService.success(`Paylink copied: /t/${blink.id}`);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.iconCircle}>
                <Printer size={16} color="#6366F1" />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Printable Countertop Stand</Text>
                <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                  High-resolution physical placard for counters, desks & stands
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.bgCardAlt }]}>
              <X size={15} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* The Physical Printable Placard Preview (Crisp White Stand) */}
            <View style={styles.placardOuter}>
              <View style={styles.placardCard}>
                {/* Crop Corner Marks for Physical Cut/Stand */}
                <View style={[styles.cropCorner, styles.cropTL]} />
                <View style={[styles.cropCorner, styles.cropTR]} />
                <View style={[styles.cropBL, styles.cropCorner]} />
                <View style={[styles.cropBR, styles.cropCorner]} />

                {/* Header Brandmark Bar */}
                <View style={styles.brandRow}>
                  <BlinkBrandMark size={24} />
                  <View>
                    <Text style={styles.brandTitle}>BLINK</Text>
                    <Text style={styles.brandSub}>SOLANA PHYSICAL ACTION</Text>
                  </View>
                </View>

                <View style={styles.placardDivider} />

                {/* Blink Name with Merchant/Action Logo Next to It */}
                <View style={styles.nameWithLogoRow}>
                  <View style={styles.logoBadgeWrap}>
                    {getBlinkLogo(blink)}
                  </View>
                  <Text style={styles.placardBlinkName} numberOfLines={2}>
                    {blink.name}
                  </Text>
                </View>

                {/* Amount Pill */}
                <View style={styles.pricePill}>
                  <Text style={styles.pricePillText}>
                    {PriceService.getLiveBlinkDetails(blink).displayString}
                  </Text>
                </View>

                {/* High-Resolution QR Code Box */}
                <View style={styles.qrBox}>
                  <UniversalQrCode
                    value={qrUrl}
                    size={140}
                  />
                </View>

                {/* Metadata Details */}
                <View style={styles.metaSection}>
                  <Text style={styles.metaActionType}>
                    ACTION TYPE: {(blink.actionType || 'PAYMENT').toUpperCase()}
                  </Text>
                  <Text style={styles.metaAddress}>
                    RECIPIENT: {shortAddress}
                  </Text>
                  {blink.verifiedDomain ? (
                    <Text style={styles.metaDomain}>
                      Verified Domain: {blink.verifiedDomain}
                    </Text>
                  ) : null}
                  <Text style={styles.metaId}>
                    ID: @{blink.id} • blink.so/t/{blink.id}
                  </Text>
                </View>

                {/* Footer Instructions Banner */}
                <View style={styles.placardFooter}>
                  <Text style={styles.footerInstructionTitle}>
                    Tap with Phone (NFC) or Scan QR with Camera
                  </Text>
                  <Text style={styles.footerInstructionSub}>
                    Non-custodial Solana transaction • Powered by Blink
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Refined Modern Action Buttons Bar */}
          <View style={[styles.modalActions, { borderTopColor: colors.border, backgroundColor: colors.bgCard }]}>
            <TouchableOpacity
              style={styles.printActionBtn}
              onPress={handlePrint}
              disabled={printing}
              activeOpacity={0.85}
            >
              {printing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Printer size={16} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.printActionBtnText}>Print Stand</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.downloadActionBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
              onPress={handleDownload}
              disabled={downloading}
              activeOpacity={0.8}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <>
                  <Download size={15} color={colors.textPrimary} strokeWidth={2} />
                  <Text style={[styles.downloadActionBtnText, { color: colors.textPrimary }]}>Save PNG</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.copyActionBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
              onPress={handleCopyLink}
              activeOpacity={0.8}
            >
              {copied ? (
                <>
                  <Check size={14} color="#10B981" strokeWidth={2.5} />
                  <Text style={[styles.copyActionBtnText, { color: '#10B981' }]}>Copied</Text>
                </>
              ) : (
                <>
                  <Copy size={14} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={[styles.copyActionBtnText, { color: colors.textSecondary }]}>Paylink</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSub: {
    fontSize: 9.5,
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 20,
    alignItems: 'center',
  },
  placardOuter: {
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  placardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    alignItems: 'center',
    position: 'relative',
  },
  cropCorner: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderColor: '#94A3B8',
  },
  cropTL: { top: 5, left: 5, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  cropTR: { top: 5, right: 5, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  cropBL: { bottom: 5, left: 5, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  cropBR: { bottom: 5, right: 5, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  brandTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.4,
  },
  brandSub: {
    fontSize: 7.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.7,
  },
  placardDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
  },
  nameWithLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  logoBadgeWrap: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placardBlinkName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'left',
    flexShrink: 1,
  },
  pricePill: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 3.5,
    borderRadius: 16,
    marginBottom: 8,
  },
  pricePillText: {
    color: '#4F46E5',
    fontWeight: '800',
    fontSize: 11,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  metaSection: {
    alignItems: 'center',
    gap: 2,
    marginBottom: 8,
  },
  metaActionType: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  metaAddress: {
    fontSize: 9.5,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#1E293B',
  },
  metaDomain: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#059669',
  },
  metaId: {
    fontSize: 8.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  placardFooter: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    width: '100%',
    alignItems: 'center',
  },
  footerInstructionTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  footerInstructionSub: {
    fontSize: 7.5,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 1,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  printActionBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#6366F1',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  printActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10.5,
  },
  downloadActionBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  downloadActionBtnText: {
    fontWeight: '700',
    fontSize: 10,
  },
  copyActionBtn: {
    flex: 0.9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  copyActionBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
