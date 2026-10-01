import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ArrowUpRight, Zap } from 'lucide-react-native';
import { SolanaActionMetadata, LinkedAction } from '../types';

interface BlinkCardProps {
  action: SolanaActionMetadata;
  onExecute: (action: SolanaActionMetadata, link: LinkedAction) => void;
}

export const BlinkCard: React.FC<BlinkCardProps> = ({ action, onExecute }) => {
  const actionsList = action.links?.actions || [
    { label: action.label, href: '#' }
  ];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconBox}>
          <Zap size={18} color="#00F0FF" />
        </View>
        <View style={styles.headerInfo}>
          {action.merchantName && (
            <Text style={styles.merchant}>{action.merchantName}</Text>
          )}
          <Text style={styles.title} numberOfLines={2}>
            {action.title}
          </Text>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={3}>
        {action.description}
      </Text>

      <View style={styles.buttonGroup}>
        {actionsList.map((link, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.actionBtn,
              idx === 0 ? styles.actionBtnPrimary : styles.actionBtnSecondary,
            ]}
            onPress={() => onExecute(action, link)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.actionBtnText,
                idx === 0 ? styles.actionBtnTextPrimary : styles.actionBtnTextSecondary,
              ]}
            >
              {link.label}
            </Text>
            <ArrowUpRight
              size={14}
              color={idx === 0 ? '#090A0F' : '#00F0FF'}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0F121C',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2333',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
  },
  headerInfo: {
    flex: 1,
  },
  merchant: {
    color: '#14F195',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  description: {
    color: '#9CA3AF',
    fontSize: 10,
    lineHeight: 17,
    marginBottom: 14,
  },
  buttonGroup: {
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnPrimary: {
    backgroundColor: '#5B67F6',
  },
  actionBtnSecondary: {
    backgroundColor: '#12141F',
    borderWidth: 1,
    borderColor: '#1D212E',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtnTextPrimary: {
    color: '#FFFFFF',
  },
  actionBtnTextSecondary: {
    color: '#818CF8',
  },
});
