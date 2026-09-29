import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Zap, Award, MapPin } from 'lucide-react-native';
import { SkrService, SKR_TIERS } from '../services/skrService';
import { WalletState } from '../services/walletService';

interface SkrVaultScreenProps {
  walletState: WalletState;
  onClaimBounty: () => void;
}

export const SkrVaultScreen: React.FC<SkrVaultScreenProps> = ({
  walletState,
  onClaimBounty,
}) => {
  const currentTier = SkrService.getCurrentTier();
  const [staked, setStaked] = useState(SkrService.getStakedAmount());

  const handleStakeMore = () => {
    if (SkrService.stakeSkr(500)) {
      setStaked(SkrService.getStakedAmount());
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Tier Status Hero */}
      <View style={[styles.tierHero, { borderColor: currentTier.color }]}>
        <View style={styles.tierTopRow}>
          <Text style={styles.tierKicker}>RADIANTS LOYALTY TIER</Text>
          <Text style={[styles.tierBadgeName, { color: currentTier.color }]}>
            {currentTier.badge}
          </Text>
        </View>

        <Text style={styles.tierTitle}>{currentTier.tier} Status</Text>
        <Text style={styles.tierSubtitle}>
          Earn {currentTier.cashbackPercent}% instant cashback on all physical NFC taps and enjoy {currentTier.merchantFeePercent}% merchant fees.
        </Text>

        <View style={styles.tierStatsRow}>
          <View style={styles.tierStat}>
            <Text style={styles.tierStatLabel}>Current Cashback</Text>
            <Text style={styles.tierStatValue}>{currentTier.cashbackPercent}%</Text>
          </View>
          <View style={styles.tierStatDivider} />
          <View style={styles.tierStat}>
            <Text style={styles.tierStatLabel}>Merchant Fee</Text>
            <Text style={styles.tierStatValue}>{currentTier.merchantFeePercent}%</Text>
          </View>
          <View style={styles.tierStatDivider} />
          <View style={styles.tierStat}>
            <Text style={styles.tierStatLabel}>Total Staked</Text>
            <Text style={[styles.tierStatValue, styles.purpleText]}>{staked} SKR</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.stakeBtn}
          onPress={handleStakeMore}
          activeOpacity={0.8}
        >
          <Zap size={14} color="#000000" strokeWidth={2.5} style={{ marginRight: 6 }} />
          <Text style={styles.stakeBtnText}>Stake +500 SKR for Higher Tier</Text>
        </TouchableOpacity>
      </View>

      {/* Tier Roadmap Grid */}
      <View style={styles.sectionHeader}>
        <Award size={16} color="#FFD700" style={{ marginRight: 6 }} />
        <Text style={styles.sectionTitle}>All Radiants Tiers</Text>
      </View>

      <View style={styles.tiersGrid}>
        {Object.values(SKR_TIERS).map((t) => (
          <View
            key={t.tier}
            style={[
              styles.tierCard,
              currentTier.tier === t.tier && styles.tierCardActive,
            ]}
          >
            <Text style={[styles.tierCardBadge, { color: t.color }]}>{t.badge}</Text>
            <Text style={styles.tierCardReq}>{t.minSkr.toLocaleString()} SKR staked</Text>
            <Text style={styles.tierCardBenefit}>
              {t.cashbackPercent}% Cashback • {t.merchantFeePercent}% Fee
            </Text>
          </View>
        ))}
      </View>

      {/* Nearby Physical Drops Section */}
      <View style={styles.sectionHeader}>
        <MapPin size={16} color="#00F0FF" style={{ marginRight: 6 }} />
        <Text style={styles.sectionTitle}>Nearby Physical Drop Beacons</Text>
      </View>

      <View style={styles.beaconCard}>
        <View style={styles.beaconIconBox}>
          <Zap size={18} color="#00F0FF" />
        </View>
        <View style={styles.beaconInfo}>
          <Text style={styles.beaconTitle}>Clock In Hackathon Desk Beacon</Text>
          <Text style={styles.beaconDistance}>1.5m away • Physical Desk Tag</Text>
          <Text style={styles.beaconReward}>Reward: 100 $SKR Bounty</Text>
        </View>
        <TouchableOpacity
          style={styles.beaconClaimBtn}
          onPress={onClaimBounty}
          activeOpacity={0.8}
        >
          <Text style={styles.beaconClaimText}>Claim</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0C14',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  tierHero: {
    backgroundColor: '#0F121C',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  tierTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierKicker: {
    color: '#8E9BB0',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tierBadgeName: {
    fontSize: 11,
    fontWeight: '800',
  },
  tierTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  tierSubtitle: {
    color: '#8E9BB0',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
  },
  tierStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#161B29',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  tierStat: {
    flex: 1,
    alignItems: 'center',
  },
  tierStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#242C40',
  },
  tierStatLabel: {
    color: '#8E9BB0',
    fontSize: 10,
    marginBottom: 3,
  },
  tierStatValue: {
    color: '#00F0FF',
    fontSize: 15,
    fontWeight: '800',
  },
  purpleText: {
    color: '#C084FC',
  },
  stakeBtn: {
    backgroundColor: 'rgba(153, 69, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#9945FF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  stakeBtnText: {
    color: '#C084FC',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  tiersGrid: {
    gap: 8,
    marginBottom: 24,
  },
  tierCard: {
    backgroundColor: '#0F121C',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  tierCardActive: {
    borderColor: '#00F0FF',
    backgroundColor: 'rgba(0, 240, 255, 0.05)',
  },
  tierCardBadge: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  tierCardReq: {
    color: '#8E9BB0',
    fontSize: 11,
    marginBottom: 4,
  },
  tierCardBenefit: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  beaconCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F121C',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  beaconIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(153, 69, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#9945FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  beaconIcon: {
    fontSize: 22,
  },
  beaconInfo: {
    flex: 1,
  },
  beaconTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  beaconDistance: {
    color: '#8E9BB0',
    fontSize: 11,
    marginBottom: 2,
  },
  beaconReward: {
    color: '#14F195',
    fontSize: 11,
    fontWeight: '700',
  },
  beaconClaimBtn: {
    backgroundColor: '#9945FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  beaconClaimText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
