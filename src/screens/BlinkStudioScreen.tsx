import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import {
  Sparkles,
  Radio,
  Layers,
  Award,
  Plus,
  Search,
  Printer,
  Copy,
  QrCode,
  TrendingUp,
} from 'lucide-react-native';
import { BlinkBrandMark, CoffeeShopLogo, HackerHouseLogo } from '../components/BrandLogos';
import { PhysicalBlink, PhysicalBlinkRegistry } from '../services/physicalBlinkRegistry';
import { PrintableCardModal } from '../components/PrintableCardModal';
import { WalletAccount } from '../services/walletProviderService';
import { PriceService } from '../services/priceService';
import { ToastService } from '../services/toastService';
import { useTheme } from '../theme/ThemeContext';

interface BlinkStudioScreenProps {
  activeAccount: WalletAccount | null;
  balanceSol: number;
  balanceUsdc?: number;
  network: string;
  onToggleNetwork: () => void;
  onOpenWalletConnect: () => void;
  onOpenDeposit: () => void;
  onSelectBlink: (blink: PhysicalBlink) => void;
  onOpenStudioCreate: () => void;
  refreshTrigger?: number;
  onOpenProfile?: () => void;
  avatarUrl?: string;
}

export const BlinkStudioScreen: React.FC<BlinkStudioScreenProps> = ({
  activeAccount,
  onSelectBlink,
  onOpenStudioCreate,
  refreshTrigger = 0,
}) => {
  const { colors, isDark } = useTheme();
  const [activeFilter, setActiveFilter] = useState<'top_earners' | 'most_tapped' | 'all'>('top_earners');
  const [searchQuery, setSearchQuery] = useState('');
  const [solPrice, setSolPrice] = useState<number>(() => PriceService.getSolPriceSync());
  const [printableBlink, setPrintableBlink] = useState<PhysicalBlink | null>(null);

  React.useEffect(() => {
    const unsub = PriceService.subscribe((p) => setSolPrice(p.sol));
    return () => unsub();
  }, []);

  const [allBlinks, setAllBlinks] = useState<PhysicalBlink[]>(() => PhysicalBlinkRegistry.loadRegistry());

  const reloadBlinks = () => {
    setAllBlinks(PhysicalBlinkRegistry.loadRegistry());
    PhysicalBlinkRegistry.syncFromCloud().then(() => {
      setAllBlinks(PhysicalBlinkRegistry.loadRegistry());
    });
  };

  React.useEffect(() => {
    reloadBlinks();
  }, [refreshTrigger]);

  React.useEffect(() => {
    const handleUpdate = () => reloadBlinks();
    if (typeof window !== 'undefined') {
      window.addEventListener('blink_registry_updated', handleUpdate);
      window.addEventListener('blink_database_updated', handleUpdate);
      window.addEventListener('blink_updated', handleUpdate);
      window.addEventListener('blink_deleted', handleUpdate);
      return () => {
        window.removeEventListener('blink_registry_updated', handleUpdate);
        window.removeEventListener('blink_database_updated', handleUpdate);
        window.removeEventListener('blink_updated', handleUpdate);
        window.removeEventListener('blink_deleted', handleUpdate);
      };
    }
  }, []);

  const userAddress = (activeAccount?.publicKey || '').toLowerCase();
  const myBlinks = allBlinks.filter((b) => {
    if (!userAddress) return true;
    const recip = (b.recipient || '').toLowerCase();
    const creator = ((b as any).creatorAddress || (b as any).owner || '').toLowerCase();
    return recip === userAddress || creator === userAddress;
  });

  const totalVolume = myBlinks.reduce((sum, b) => sum + (b.stats?.volumeUsdc || 0), 0);
  const totalTaps = myBlinks.reduce((sum, b) => sum + (b.stats?.taps || 0), 0);
  const totalCompleted = myBlinks.reduce((sum, b) => sum + (b.stats?.completed || 0), 0);
  const topPerformer = [...myBlinks].sort((a, b) => (b.stats?.volumeUsdc || 0) - (a.stats?.volumeUsdc || 0))[0];

  const getBlinkIcon = (blink: PhysicalBlink) => {
    if (blink.imageUrl) {
      return (
        <Image
          source={{ uri: blink.imageUrl }}
          style={{ width: 36, height: 36, borderRadius: 10 }}
          resizeMode="cover"
        />
      );
    }
    const id = blink.id.toLowerCase();
    if (id.includes('coffee') || blink.actionType === 'payment') return <CoffeeShopLogo size={36} />;
    if (id.includes('pass') || id.includes('event') || blink.actionType === 'voucher') return <HackerHouseLogo size={36} />;
    return <BlinkBrandMark size={32} />;
  };

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case 'tip': return 'Tip Jar';
      case 'payment': return 'Point of Sale';
      case 'voucher': return 'Ticket / Pass';
      case 'mint': return 'NFT Mint';
      case 'donation': return 'Donation';
      case 'checkin': return 'Check-In';
      default: return 'Blink Action';
    }
  };

  const copyPaylink = (blink: PhysicalBlink, e?: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const url = PhysicalBlinkRegistry.getPhysicalUrl(blink.id);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      ToastService.success(`Paylink copied: /t/${blink.id}`);
    }
  };

  const filteredBlinks = myBlinks
    .filter((b) => {
      const q = searchQuery.toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q) ||
        (b.description && b.description.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (activeFilter === 'top_earners') {
        return (b.stats?.volumeUsdc || 0) - (a.stats?.volumeUsdc || 0) || (b.stats?.completed || 0) - (a.stats?.completed || 0);
      }
      if (activeFilter === 'most_tapped') {
        return (b.stats?.taps || 0) - (a.stats?.taps || 0);
      }
      return b.createdAt - a.createdAt;
    });

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Studio Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <TrendingUp size={20} color={colors.accent} style={{ marginRight: 8 }} />
            <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Blink Studio</Text>
          </View>
          <Text style={[styles.screenSub, { color: colors.textSecondary }]}>
            Live performance analytics, revenue tracking & rankings.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.createMainBtn, { backgroundColor: colors.accent }]}
          onPress={onOpenStudioCreate}
          activeOpacity={0.8}
        >
          <Plus size={15} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={styles.createMainBtnText}>Create Blink</Text>
        </TouchableOpacity>
      </View>

      {/* Analytics Dashboard Grid */}
      <View style={styles.analyticsGrid}>
        <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Total Revenue</Text>
            <Sparkles size={13} color="#10B981" />
          </View>
          <Text style={[styles.metricValue, { color: '#10B981' }]}>
            ${totalVolume.toFixed(2)}
          </Text>
          <Text style={[styles.metricSub, { color: colors.textSecondary }]}>
            {totalCompleted} completed sales
          </Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Taps & Scans</Text>
            <Radio size={13} color="#818CF8" />
          </View>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {totalTaps}
          </Text>
          <Text style={[styles.metricSub, { color: colors.textSecondary }]}>
            NFC & QR interactions
          </Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Active Blinks</Text>
            <Layers size={13} color="#F59E0B" />
          </View>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {myBlinks.length}
          </Text>
          <Text style={[styles.metricSub, { color: colors.textSecondary }]}>
            Personal Actions
          </Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Top Performer</Text>
            <Award size={13} color="#EC4899" />
          </View>
          <Text style={[styles.metricValueSmall, { color: colors.textPrimary }]} numberOfLines={1}>
            {topPerformer ? topPerformer.name : 'None yet'}
          </Text>
          <Text style={[styles.metricSub, { color: colors.textSecondary }]}>
            {topPerformer ? `$${(topPerformer.stats?.volumeUsdc || 0).toFixed(2)} earned` : 'Create your first'}
          </Text>
        </View>
      </View>

      {/* Filter / Ranking Tabs */}
      <View style={styles.filterSection}>
        <View style={[styles.tabCapsule, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.tabItem, activeFilter === 'top_earners' && { backgroundColor: colors.accent }]}
            onPress={() => setActiveFilter('top_earners')}
            activeOpacity={0.7}
          >
            <Award size={12} color={activeFilter === 'top_earners' ? '#FFFFFF' : colors.textMuted} />
            <Text style={[styles.tabText, { color: activeFilter === 'top_earners' ? '#FFFFFF' : colors.textSecondary }]}>
              Top Earners
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeFilter === 'most_tapped' && { backgroundColor: colors.accent }]}
            onPress={() => setActiveFilter('most_tapped')}
            activeOpacity={0.7}
          >
            <Radio size={12} color={activeFilter === 'most_tapped' ? '#FFFFFF' : colors.textMuted} />
            <Text style={[styles.tabText, { color: activeFilter === 'most_tapped' ? '#FFFFFF' : colors.textSecondary }]}>
              Most Tapped
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeFilter === 'all' && { backgroundColor: colors.accent }]}
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.7}
          >
            <Layers size={12} color={activeFilter === 'all' ? '#FFFFFF' : colors.textMuted} />
            <Text style={[styles.tabText, { color: activeFilter === 'all' ? '#FFFFFF' : colors.textSecondary }]}>
              All ({myBlinks.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        {myBlinks.length > 2 && (
          <View style={[styles.searchBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Search size={13} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search your blinks..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        )}
      </View>

      {/* Blinks Performance List */}
      {filteredBlinks.length > 0 ? (
        <View style={styles.blinksList}>
          {filteredBlinks.map((blink, index) => {
            const isFirst = index === 0 && (blink.stats?.volumeUsdc || 0) > 0;
            const isSecond = index === 1 && (blink.stats?.volumeUsdc || 0) > 0;
            const isThird = index === 2 && (blink.stats?.volumeUsdc || 0) > 0;

            const rankColor = isFirst ? '#F59E0B' : isSecond ? '#94A3B8' : isThird ? '#D97706' : colors.textMuted;
            const rankLabel = isFirst ? '#1 Top Earner' : isSecond ? '#2 Runner Up' : isThird ? '#3 Rising' : `#${index + 1}`;

            return (
              <TouchableOpacity
                key={blink.id}
                style={[
                  styles.blinkCard,
                  { backgroundColor: colors.bgCard, borderColor: isFirst ? 'rgba(245, 158, 11, 0.4)' : colors.border },
                ]}
                onPress={() => onSelectBlink(blink)}
                activeOpacity={0.85}
              >
                {/* Top Row: Rank Badge & Action Type */}
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.rankBadge, { backgroundColor: isFirst ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.12)', borderColor: isFirst ? 'rgba(245, 158, 11, 0.4)' : 'rgba(99, 102, 241, 0.3)' }]}>
                    <Award size={11} color={rankColor} />
                    <Text style={[styles.rankBadgeText, { color: rankColor }]}>{rankLabel}</Text>
                  </View>

                  <View style={styles.actionTypeBadge}>
                    <Text style={styles.actionTypeBadgeText}>{getActionTypeLabel(blink.actionType)}</Text>
                  </View>
                </View>

                {/* Main Card Content */}
                <View style={styles.cardMainRow}>
                  <View style={styles.iconContainer}>
                    {getBlinkIcon(blink)}
                  </View>

                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.blinkName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {blink.name}
                    </Text>
                    <Text style={[styles.blinkSub, { color: colors.textSecondary }]} numberOfLines={1}>
                      ID: @{blink.id}
                    </Text>
                    {blink.description ? (
                      <Text style={[styles.blinkDesc, { color: colors.textMuted }]} numberOfLines={2}>
                        {blink.description}
                      </Text>
                    ) : null}
                  </View>

                  {/* Price Block */}
                  <View style={styles.priceBlock}>
                    <Text style={[styles.priceValue, { color: colors.accent }]}>
                      {PriceService.getLiveBlinkDetails(blink).displayString}
                    </Text>
                    <Text style={[styles.priceFiat, { color: colors.textMuted }]}>
                      {blink.token === 'SOL'
                        ? `≈ $${(blink.amount * solPrice).toFixed(2)}`
                        : (blink.token === 'SKR'
                          ? `≈ $${(PriceService.getLiveBlinkDetails(blink).baseUsdc * 0.9).toFixed(2)}`
                          : `$${blink.amount.toFixed(2)}`)}
                    </Text>
                  </View>
                </View>

                {/* Stats Footer Row */}
                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <View style={styles.statsRow}>
                    <Text style={[styles.statItemText, { color: colors.textSecondary }]}>
                      <Text style={{ fontWeight: '800', color: '#10B981' }}>${(blink.stats?.volumeUsdc || 0).toFixed(2)}</Text> volume
                    </Text>
                    <Text style={[styles.statDot, { color: colors.textMuted }]}>•</Text>
                    <Text style={[styles.statItemText, { color: colors.textSecondary }]}>
                      <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{blink.stats?.completed || 0}</Text> sales
                    </Text>
                    <Text style={[styles.statDot, { color: colors.textMuted }]}>•</Text>
                    <Text style={[styles.statItemText, { color: colors.textSecondary }]}>
                      <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{blink.stats?.taps || 0}</Text> taps
                    </Text>
                  </View>

                  {/* Quick Action Buttons */}
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={[styles.smallActionBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                      onPress={(e) => {
                        if (e && e.stopPropagation) e.stopPropagation();
                        setPrintableBlink(blink);
                      }}
                      activeOpacity={0.7}
                    >
                      <Printer size={11} color={colors.textSecondary} />
                      <Text style={[styles.smallActionBtnText, { color: colors.textSecondary }]}>Print Stand</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.smallActionBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                      onPress={(e) => copyPaylink(blink, e)}
                      activeOpacity={0.7}
                    >
                      <Copy size={11} color={colors.textSecondary} />
                      <Text style={[styles.smallActionBtnText, { color: colors.textSecondary }]}>Paylink</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.smallActionBtnPrimary, { backgroundColor: colors.accent }]}
                      onPress={() => onSelectBlink(blink)}
                      activeOpacity={0.8}
                    >
                      <QrCode size={11} color="#FFFFFF" />
                      <Text style={styles.smallActionBtnPrimaryText}>Accept Pay</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.emptyIconWrap}>
            <Layers size={28} color={colors.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Blinks to Analyze Yet</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Create your first personal Blink to accept one-tap crypto payments and track performance analytics here.
          </Text>
          <TouchableOpacity
            style={[styles.createMainBtn, { backgroundColor: colors.accent, marginTop: 14 }]}
            onPress={onOpenStudioCreate}
            activeOpacity={0.8}
          >
            <Plus size={15} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.createMainBtnText}>Create Physical Blink</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Printable Countertop Stand Modal */}
      {printableBlink && (
        <PrintableCardModal
          blink={printableBlink}
          visible={Boolean(printableBlink)}
          onClose={() => setPrintableBlink(null)}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 90,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  screenSub: {
    fontSize: 11,
    marginTop: 3,
  },
  createMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    gap: 6,
  },
  createMainBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricValueSmall: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  metricSub: {
    fontSize: 9,
    fontWeight: '500',
  },
  filterSection: {
    marginBottom: 12,
    gap: 8,
  },
  tabCapsule: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 9,
    gap: 5,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    padding: 0,
  },
  blinksList: {
    gap: 10,
  },
  blinkCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    gap: 4,
  },
  rankBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  actionTypeBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actionTypeBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#818CF8',
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    marginRight: 10,
  },
  blinkName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  blinkSub: {
    fontSize: 10,
    fontWeight: '500',
  },
  blinkDesc: {
    fontSize: 10,
    marginTop: 2,
  },
  priceBlock: {
    alignItems: 'flex-end',
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  priceFiat: {
    fontSize: 9,
    marginTop: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statItemText: {
    fontSize: 10,
  },
  statDot: {
    fontSize: 10,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    gap: 4,
  },
  smallActionBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  smallActionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    gap: 4,
  },
  smallActionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 16,
  },
});
