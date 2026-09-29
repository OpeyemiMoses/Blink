import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Radio, Store, ArrowRight, ShieldCheck, Check } from 'lucide-react-native';

interface MerchantScreenProps {
  onBeamStarted?: (actionUrl: string) => void;
}

export const MerchantScreen: React.FC<MerchantScreenProps> = ({ onBeamStarted }) => {
  const [amount, setAmount] = useState('8.50');
  const [token, setToken] = useState<'USDC' | 'SOL'>('USDC');
  const [itemTitle, setItemTitle] = useState('Merchandise / Order #104');
  const [isBeaming, setIsBeaming] = useState(false);

  const actionUrl = `solana-action:https://api.blink.org/pay?amount=${amount}&token=${token}&title=${encodeURIComponent(itemTitle)}`;

  const toggleBeam = () => {
    const nextState = !isBeaming;
    setIsBeaming(nextState);
    if (nextState && onBeamStarted) {
      onBeamStarted(actionUrl);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Merchant Terminal</Text>
        <Text style={styles.subtitle}>
          Create on-demand payment actions. Broadcast via NFC or display QR.
        </Text>
      </View>

      {/* Amount Input */}
      <View style={styles.inputCard}>
        <Text style={styles.inputLabel}>AMOUNT</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#6B7280"
          />
        </View>

        {/* Token Selector */}
        <View style={styles.tokenRow}>
          {(['USDC', 'SOL'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tokenBtn, token === t && styles.tokenBtnActive]}
              onPress={() => setToken(t)}
            >
              <Text style={[styles.tokenBtnText, token === t && styles.tokenBtnTextActive]}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.inputLabel, { marginTop: 14 }]}>DESCRIPTION</Text>
        <TextInput
          style={styles.descInput}
          value={itemTitle}
          onChangeText={setItemTitle}
          placeholder="e.g. Order #104"
          placeholderTextColor="#6B7280"
        />
      </View>

      {/* NFC Beam Switch */}
      <TouchableOpacity
        style={[styles.beamCard, isBeaming && styles.beamCardActive]}
        onPress={toggleBeam}
        activeOpacity={0.8}
      >
        <View style={styles.beamIconBox}>
          <Radio size={20} color={isBeaming ? '#090A0F' : '#00F0FF'} />
        </View>
        <View style={styles.beamInfo}>
          <Text style={styles.beamTitle}>
            {isBeaming ? 'NFC Beam Active' : 'Broadcast via NFC'}
          </Text>
          <Text style={styles.beamSub}>
            {isBeaming ? 'Ready for customer device tap' : 'Emulate contactless payment beacon'}
          </Text>
        </View>
        <View style={[styles.statusDot, isBeaming && styles.statusDotActive]} />
      </TouchableOpacity>

      {/* Direct Payment Action Preview */}
      <View style={styles.previewCard}>
        <View style={styles.previewHeader}>
          <Store size={16} color="#00F0FF" />
          <Text style={styles.previewTitle}>Generated Action</Text>
        </View>

        <View style={styles.previewBody}>
          <Text style={styles.previewAmount}>
            {amount} {token}
          </Text>
          <Text style={styles.previewDesc}>{itemTitle}</Text>
          <Text style={styles.previewUrl} numberOfLines={1}>{actionUrl}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090A0F',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
  },
  inputCard: {
    backgroundColor: '#0F121C',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E2333',
    marginBottom: 16,
  },
  inputLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  currencySymbol: {
    color: '#00F0FF',
    fontSize: 32,
    fontWeight: '900',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    padding: 0,
  },
  tokenRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tokenBtn: {
    flex: 1,
    backgroundColor: '#151926',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#232A3D',
  },
  tokenBtnActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderColor: '#00F0FF',
  },
  tokenBtnText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
  tokenBtnTextActive: {
    color: '#00F0FF',
  },
  descInput: {
    backgroundColor: '#151926',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#232A3D',
  },
  beamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F121C',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E2333',
    marginBottom: 16,
    gap: 12,
  },
  beamCardActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    borderColor: '#00F0FF',
  },
  beamIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#151926',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beamInfo: {
    flex: 1,
  },
  beamTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  beamSub: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#232A3D',
  },
  statusDotActive: {
    backgroundColor: '#14F195',
  },
  previewCard: {
    backgroundColor: '#0F121C',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  previewTitle: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  previewBody: {
    backgroundColor: '#151926',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#232A3D',
    gap: 4,
  },
  previewAmount: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  previewDesc: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  previewUrl: {
    color: '#00F0FF',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 4,
  },
});
