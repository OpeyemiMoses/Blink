import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { X, Copy, Check, ExternalLink, QrCode, Send, ArrowDownLeft } from 'lucide-react-native';
import { UniversalQrCode } from './UniversalQrCode';
import { SolanaService } from '../services/solanaService';

interface ReceiveModalProps {
  visible: boolean;
  onClose: () => void;
  publicKey: string;
  onBalanceUpdated: () => void;
  onOpenSend?: () => void;
  onKeypairChanged?: () => void;
}

export const ReceiveModal: React.FC<ReceiveModalProps> = ({
  visible,
  onClose,
  publicKey,
  onOpenSend,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <ArrowDownLeft size={18} color="#5B67F6" strokeWidth={2.5} />
              <Text style={styles.title}>Receive SOL, USDC & SKR</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Scan QR code or copy your address to receive SOL, USDC, or SKR on the Solana network directly to this wallet.
          </Text>

          {/* Supported Tokens on Solana Network */}
          <View style={styles.tokensRow}>
            <View style={styles.tokenTag}>
              <View style={[styles.tokenDot, { backgroundColor: '#818CF8' }]} />
              <Text style={styles.tokenTagText}>SOL</Text>
            </View>
            <View style={styles.tokenTag}>
              <View style={[styles.tokenDot, { backgroundColor: '#2775CA' }]} />
              <Text style={styles.tokenTagText}>USDC</Text>
            </View>
            <View style={styles.tokenTag}>
              <View style={[styles.tokenDot, { backgroundColor: '#14F195' }]} />
              <Text style={styles.tokenTagText}>SKR</Text>
            </View>
          </View>

          {/* QR Code Container */}
          <View style={styles.qrContainer}>
            <View style={styles.qrBox}>
              <UniversalQrCode
                value={publicKey}
                size={180}
                bgColor="#FFFFFF"
                fgColor="#090A0F"
              />
            </View>
          </View>

          {/* Public Key Display */}
          <View style={styles.addressContainer}>
            <Text style={styles.addressLabel}>SOLANA PUBLIC RECIPIENT ADDRESS</Text>
            <TouchableOpacity style={styles.addressBox} onPress={handleCopy} activeOpacity={0.8}>
              <Text style={styles.addressText} numberOfLines={1}>{publicKey}</Text>
              {copied ? (
                <Check size={16} color="#10B981" />
              ) : (
                <Copy size={16} color="#5B67F6" />
              )}
            </TouchableOpacity>
          </View>
          {copied && <Text style={styles.copiedNotice}>Address copied to clipboard</Text>}

          {/* Switch to Send with QR Scan */}
          {onOpenSend && (
            <TouchableOpacity
              style={styles.switchToSendBtn}
              onPress={() => {
                onClose();
                onOpenSend();
              }}
              activeOpacity={0.8}
            >
              <Send size={15} color="#FFFFFF" />
              <Text style={styles.switchToSendText}>Send SOL, USDC or SKR with QR Scan</Text>
            </TouchableOpacity>
          )}

          {/* Official Faucet Link */}
          {typeof window !== 'undefined' && (
            <TouchableOpacity
              style={styles.faucetRow}
              onPress={() => window.open('https://faucet.solana.com', '_blank')}
              activeOpacity={0.7}
            >
              <Text style={styles.faucetText}>Official Devnet Faucet: faucet.solana.com</Text>
              <ExternalLink size={12} color="#5B67F6" />
            </TouchableOpacity>
          )}

          {/* View on Solana Explorer */}
          {typeof window !== 'undefined' && (
            <TouchableOpacity
              style={styles.explorerRow}
              onPress={() => window.open(SolanaService.getExplorerUrl(publicKey), '_blank')}
              activeOpacity={0.7}
            >
              <Text style={styles.explorerText}>View on Solana Explorer</Text>
              <ExternalLink size={13} color="#6B7280" />
            </TouchableOpacity>
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
    marginBottom: 6,
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
  subtitle: {
    color: '#94A3B8',
    fontSize: 10,
    marginBottom: 12,
    lineHeight: 17,
  },
  tokensRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tokenTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#161926',
    borderWidth: 1,
    borderColor: '#222638',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  tokenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tokenTagText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
  },
  addressContainer: {
    marginTop: 14,
  },
  addressLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#12141F',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1D212E',
  },
  addressText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'monospace',
    flex: 1,
    marginRight: 8,
  },
  copiedNotice: {
    color: '#10B981',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  switchToSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B67F6',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 14,
    gap: 8,
    shadowColor: '#5B67F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  switchToSendText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  faucetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 6,
  },
  faucetText: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '600',
  },
  explorerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 6,
  },
  explorerText: {
    color: '#64748B',
    fontSize: 10,
  },
});
