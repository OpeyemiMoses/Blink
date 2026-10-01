import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Radio, X, CheckCircle2, Copy, AlertCircle, Sparkles, ExternalLink, Cpu } from 'lucide-react-native';
import { NfcService } from '../services/nfcService';
import { ToastService } from '../services/toastService';
import { useTheme } from '../theme/ThemeContext';

interface NfcWriterModalProps {
  visible: boolean;
  onClose: () => void;
  url: string;
  title: string;
  id?: string;
}

export const NfcWriterModal: React.FC<NfcWriterModalProps> = ({
  visible,
  onClose,
  url,
  title,
  id,
}) => {
  const { colors, isDark } = useTheme();
  const [status, setStatus] = useState<'idle' | 'writing' | 'success' | 'error' | 'unsupported'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (!NfcService.isHardwareSupported()) {
        setStatus('unsupported');
      } else {
        startNfcWrite();
      }
    } else {
      setStatus('idle');
      setErrorMessage(null);
    }
  }, [visible]);

  const startNfcWrite = async () => {
    setStatus('writing');
    setErrorMessage(null);
    try {
      const res = await NfcService.writeTag({ url, title, id });
      if (res.success) {
        setStatus('success');
        ToastService.success(`Programmed "${title}" onto physical NFC tag!`);
      } else if (res.isUnsupported) {
        setStatus('unsupported');
        setErrorMessage(res.message);
      } else {
        setStatus('error');
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.message || 'NFC tag write failed');
    }
  };

  const handleCopyUrl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      ToastService.success('Blink URL copied! Paste into NFC Tools or NXP TagWriter to program tags on iOS.');
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Radio size={20} color={colors.accent} />
              <Text style={[styles.title, { color: colors.textPrimary }]}>Program Physical NFC Tag</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.bgCardAlt }]} activeOpacity={0.7}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Blink Name & URL */}
          <View style={[styles.blinkInfoBox, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
            <Text style={[styles.blinkName, { color: colors.textPrimary }]}>{title}</Text>
            <Text style={[styles.blinkUrl, { color: colors.textMuted }]} numberOfLines={1}>{url}</Text>
          </View>

          {/* Status Display */}
          {status === 'writing' && (
            <View style={styles.statusBox}>
              <View style={[styles.radarCircle, { borderColor: colors.accent }]}>
                <Radio size={42} color={colors.accent} />
              </View>
              <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>Hold Tag Near Device</Text>
              <Text style={[styles.statusSub, { color: colors.textSecondary }]}>
                Hold a blank physical NFC tag (NTAG213, NTAG215, or NTAG216) firmly against the back of your phone now...
              </Text>
              <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 10 }} />
            </View>
          )}

          {status === 'success' && (
            <View style={styles.statusBox}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <CheckCircle2 size={42} color="#10B981" />
              </View>
              <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>NFC Tag Programmed!</Text>
              <Text style={[styles.statusSub, { color: colors.textSecondary }]}>
                Anyone who taps their phone to this physical NFC tag will instantly trigger this Blink checkout!
              </Text>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#10B981', marginTop: 14 }]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'error' && (
            <View style={styles.statusBox}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <AlertCircle size={42} color="#EF4444" />
              </View>
              <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>Write Failed</Text>
              <Text style={[styles.statusSub, { color: colors.textSecondary }]}>
                {errorMessage || 'Hold the NFC tag closer to the NFC sensor area on the back of your phone and try again.'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, width: '100%' }}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.accent, flex: 1 }]}
                  onPress={startNfcWrite}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtnSecondary, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                  onPress={handleCopyUrl}
                  activeOpacity={0.8}
                >
                  <Copy size={14} color={colors.textPrimary} />
                  <Text style={[styles.actionBtnSecondaryText, { color: colors.textPrimary }]}>Copy URL</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {status === 'unsupported' && (
            <View style={styles.statusBox}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Cpu size={36} color="#F59E0B" />
              </View>
              <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>Browser NFC Write Limited</Text>
              <Text style={[styles.statusSub, { color: colors.textSecondary }]}>
                Direct Web NFC writing requires Chrome on Android or a Solana Seeker device.
              </Text>
              <View style={[styles.iosNoteBox, { backgroundColor: 'rgba(91, 103, 246, 0.1)', borderColor: 'rgba(91, 103, 246, 0.3)' }]}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.accent, marginBottom: 4 }}>
                  Writing NFC Tags on iPhone / iOS
                </Text>
                <Text style={{ fontSize: 10, color: colors.textSecondary, lineHeight: 16 }}>
                  Apple limits browser NFC writing. Copy this Blink URL, open any free app like <Text style={{ fontWeight: '700', color: colors.textPrimary }}>NFC Tools</Text> or <Text style={{ fontWeight: '700', color: colors.textPrimary }}>NXP TagWriter</Text>, choose "Write URL", and tap your NFC tag!
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.accent, marginTop: 14 }]}
                onPress={handleCopyUrl}
                activeOpacity={0.8}
              >
                <Copy size={15} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Copy Blink URL for NFC Tools</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 8, 11, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blinkInfoBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 16,
  },
  blinkName: {
    fontSize: 12,
    fontWeight: '700',
  },
  blinkUrl: {
    fontSize: 10,
    marginTop: 2,
  },
  statusBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  radarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  statusSub: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 18,
  },
  iosNoteBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 14,
    width: '100%',
  },
  actionBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionBtnSecondaryText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
