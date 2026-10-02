import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import {
  Plus,
  Search,
  X,
  ArrowDownLeft,
  Printer,
  Copy,
  QrCode,
  Radio,
  CheckCircle2,
} from 'lucide-react-native';
import { BlinkBrandMark, CoffeeShopLogo, HackerHouseLogo } from '../components/BrandLogos';
import { PhysicalBlink, PhysicalBlinkRegistry } from '../services/physicalBlinkRegistry';
import { PrintableCardModal } from '../components/PrintableCardModal';
import { WalletAccount } from '../services/walletProviderService';
import { PriceService } from '../services/priceService';
import { ToastService } from '../services/toastService';
import { useTheme } from '../theme/ThemeContext';

interface MarketsScreenProps {
  activeAccount: WalletAccount | null;
  balanceSol: number;
  balanceUsdc?: number;
  network: string;
  onToggleNetwork: () => void;
  onOpenWalletConnect: () => void;
  onOpenDeposit: () => void;
  onSelectBlink: (blink: PhysicalBlink) => void;
  onOpenStudioCreate: () => void;
  hideBrandLogo?: boolean;
  refreshTrigger?: number;
  onOpenProfile?: () => void;
  avatarUrl?: string;
}

export const MarketsScreen: React.FC<MarketsScreenProps> = ({
  activeAccount,
  balanceSol,
  balanceUsdc = 0,
  onOpenDeposit,
  onSelectBlink,
  onOpenStudioCreate,
  refreshTrigger = 0,
}) => {
  const { colors, isDark } = useTheme();
  const [activeFilter, setActiveFilter] = useState<'none' | 'most_tapped' | 'top_settled'>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [solPrice, setSolPrice] = useState<number>(() => PriceService.getSolPriceSync());
  const [printableBlink, setPrintableBlink] = useState<PhysicalBlink | null>(null);
  const [, setPriceTick] = useState(0);

  React.useEffect(() => {
    const unsub = PriceService.subscribe((p) => {
      setSolPrice(p.sol);
      setPriceTick(prev => prev + 1);
    });
    return () => unsub();
  }, []);

  const [allBlinks, setAllBlinks] = useState<PhysicalBlink[]>(() => PhysicalBlinkRegistry.loadRegistry(true));

  const reloadBlinks = () => {
    setAllBlinks([...PhysicalBlinkRegistry.loadRegistry(true)]);
    PhysicalBlinkRegistry.syncFromCloud().then(() => {
      setAllBlinks([...PhysicalBlinkRegistry.loadRegistry(true)]);
    });
  };

  React.useEffect(() => {
    reloadBlinks();
  }, [refreshTrigger]);

  React.useEffect(() => {
    const handleUpdate = (e?: any) => {
      if (e?.type === 'blink_deleted' || e?.type === 'tapblink_blink_deleted') {
        const delId = (e.detail?.id || '').toLowerCase();
        if (delId) {
          setAllBlinks(prev => prev.filter(b => b.id.toLowerCase() !== delId));
        }
        return;
      }
      reloadBlinks();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('blink_created', handleUpdate);
      window.addEventListener('blink_registered', handleUpdate);
      window.addEventListener('tapblink_blink_registered', handleUpdate);
      window.addEventListener('blink_registry_updated', handleUpdate);
      window.addEventListener('blink_database_updated', handleUpdate);
      window.addEventListener('blink_updated', handleUpdate);
      window.addEventListener('blink_deleted', handleUpdate);
      window.addEventListener('tapblink_blink_deleted', handleUpdate);
      return () => {
        window.removeEventListener('blink_created', handleUpdate);
        window.removeEventListener('blink_registered', handleUpdate);
        window.removeEventListener('tapblink_blink_registered', handleUpdate);
        window.removeEventListener('blink_registry_updated', handleUpdate);
        window.removeEventListener('blink_database_updated', handleUpdate);
        window.removeEventListener('blink_updated', handleUpdate);
        window.removeEventListener('blink_deleted', handleUpdate);
        window.removeEventListener('tapblink_blink_deleted', handleUpdate);
      };
    }
  }, []);

  // Filter blinks strictly to those created by the current user / active wallet
  const userAddress = (activeAccount?.publicKey || '').toLowerCase();
  const myBlinks = allBlinks.filter((b) => {
    if (!userAddress) return false; // Unauthenticated/guest mode has 0 created blinks
    const recip = (b.recipient || '').toLowerCase();
    const creator = ((b as any).creatorAddress || (b as any).owner || '').toLowerCase();
    return recip === userAddress || creator === userAddress;
  });

  // Calculate live USD balance
  const totalUsdValue = (balanceSol * solPrice) + (balanceUsdc || 0);

  const copyPaylink = (blink: PhysicalBlink, e?: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const url = PhysicalBlinkRegistry.getPhysicalUrl(blink.id);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      ToastService.success(`Paylink copied: /t/${blink.id}`);
    }
  };

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

  const filteredBlinks = myBlinks
    .filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q) ||
        (b.description && b.description.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (activeFilter === 'top_settled') {
        return (b.stats?.volumeUsdc || 0) - (a.stats?.volumeUsdc || 0) || (b.stats?.completed || 0) - (a.stats?.completed || 0);
      }
      if (activeFilter === 'most_tapped') {
        return (b.stats?.taps || 0) - (a.stats?.taps || 0);
      }
      return b.createdAt - a.createdAt;
    });

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Balance Row */}
      <View style={styles.balanceRow}>
        <Text style={[styles.balanceText, { color: colors.textPrimary }]}>
          ${(totalUsdValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>

        <TouchableOpacity
          style={styles.depositBtn}
          onPress={onOpenDeposit}
          activeOpacity={0.8}
        >
          <ArrowDownLeft size={15} color="#FFFFFF" strokeWidth={2.4} style={{ marginRight: 6 }} />
          <Text style={styles.depositBtnText}>Deposit</Text>
        </TouchableOpacity>
      </View>

      {/* Section Header: All Blinks (no physical taps / merchants tabs) */}
      <View style={styles.sectionTabRow}>
        <View style={styles.activeTabIndicator}>
          <Text style={[styles.activeTabText, { color: colors.textPrimary }]}>All Blinks</Text>
          <View style={styles.activeTabUnderline} />
        </View>
      </View>

      {/* Search and Filters Section */}
      <View style={styles.searchContainer}>
        {/* Full-width Search Input with overflow protection */}
        <View style={[styles.searchBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Search size={14} color={colors.textMuted} style={{ marginRight: 8, flexShrink: 0 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search by name, ID or domain..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ padding: 4 }}
            >
              <X size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Scrollable Category Filter Pills Row (Never overlaps search input) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}
          style={styles.filterScrollView}
        >
          <TouchableOpacity
            style={[
              styles.filterPill,
              { borderColor: activeFilter === 'none' ? '#4F46E5' : colors.border },
              activeFilter === 'none' && styles.filterPillActive,
            ]}
            onPress={() => setActiveFilter('none')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: activeFilter === 'none' ? '#4F46E5' : colors.textSecondary },
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              { borderColor: activeFilter === 'most_tapped' ? '#4F46E5' : colors.border },
              activeFilter === 'most_tapped' && styles.filterPillActive,
            ]}
            onPress={() => setActiveFilter(activeFilter === 'most_tapped' ? 'none' : 'most_tapped')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: activeFilter === 'most_tapped' ? '#4F46E5' : colors.textSecondary },
              ]}
            >
              Most Taps
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              { borderColor: activeFilter === 'top_settled' ? '#4F46E5' : colors.border },
              activeFilter === 'top_settled' && styles.filterPillActive,
            ]}
            onPress={() => setActiveFilter(activeFilter === 'top_settled' ? 'none' : 'top_settled')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: activeFilter === 'top_settled' ? '#4F46E5' : colors.textSecondary },
              ]}
            >
              Top Settled
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {filteredBlinks.length === 0 ? (
        <View style={[styles.dashedEmptyCard, { borderColor: isDark ? 'rgba(91,103,246,0.3)' : '#CBD5E1', backgroundColor: colors.bgCard }]}>
          <View style={[styles.emptyLogoWrap, { backgroundColor: 'rgba(91,103,246,0.1)', borderColor: 'rgba(91,103,246,0.25)', width: 80, height: 80, borderRadius: 40, borderWidth: 2 }]}>
            <BlinkBrandMark size={40} />
          </View>

          <Text style={[styles.emptyCardTitle, { color: colors.textPrimary, fontSize: 18, fontWeight: '900' }]}>
            Create your first Blink
          </Text>

          <Text style={[styles.emptyCardSub, { color: colors.textSecondary }]}>
            A Blink is your on-chain storefront. Set a price, choose a token, and share a link or NFC tag — anyone can tap to pay instantly.
          </Text>

          <TouchableOpacity
            style={styles.createPhysicalBtn}
            onPress={onOpenStudioCreate}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#FFFFFF" strokeWidth={2.4} style={{ marginRight: 6 }} />
            <Text style={styles.createPhysicalBtnText}>Create Your First Blink</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* List of Created Physical Blinks */
        <View style={styles.blinksList}>
          {filteredBlinks.map((blink) => (
            <TouchableOpacity
              key={blink.id}
              style={[styles.blinkCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
              onPress={() => onSelectBlink(blink)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.cardBrandWrap}>
                  {getBlinkIcon(blink)}
                </View>

                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.blinkCardName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {blink.name}
                  </Text>
                  <Text style={[styles.blinkCardId, { color: colors.textSecondary }]} numberOfLines={1}>
                    ID: @{blink.id}
                  </Text>
                </View>

                <View style={[styles.priceTag, { alignItems: 'flex-end' }]}>
                  <Text style={[styles.priceTagValue, { color: colors.accent }]}>
                    {PriceService.getLiveBlinkDetails(blink).displayString}
                  </Text>
                  {blink.token === 'SKR' && (
                    <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4, marginTop: 2 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#10B981' }}>10% OFF</Text>
                    </View>
                  )}
                </View>
              </View>

              {blink.description ? (
                <Text style={[styles.blinkCardDesc, { color: colors.textMuted }]} numberOfLines={2}>
                  {blink.description}
                </Text>
              ) : null}

              {/* Card Footer / Stats & Actions */}
              <View style={[styles.cardFooterRow, { borderTopColor: colors.border }]}>
                <View style={styles.cardStatsLeft}>
                  <View style={styles.badgeItem}>
                    <Radio size={10} color={colors.accent} />
                    <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                      {blink.stats?.taps || 0} taps
                    </Text>
                  </View>
                  <View style={styles.badgeItem}>
                    <CheckCircle2 size={10} color="#10B981" />
                    <Text style={[styles.badgeText, { color: '#10B981' }]}>
                      ${(blink.stats?.volumeUsdc || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActionsRight}>
                  <TouchableOpacity
                    style={[styles.actionBtnIcon, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                    onPress={(e) => {
                      if (e && e.stopPropagation) e.stopPropagation();
                      setPrintableBlink(blink);
                    }}
                    activeOpacity={0.7}
                  >
                    <Printer size={11} color={colors.textSecondary} />
                    <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Stand</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtnIcon, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                    onPress={(e) => copyPaylink(blink, e)}
                    activeOpacity={0.7}
                  >
                    <Copy size={11} color={colors.textSecondary} />
                    <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Link</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtnPrimary, { backgroundColor: '#4F46E5' }]}
                    onPress={() => onSelectBlink(blink)}
                    activeOpacity={0.8}
                  >
                    <QrCode size={11} color="#FFFFFF" />
                    <Text style={styles.actionBtnPrimaryText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* Create More Button */}
          <TouchableOpacity
            style={styles.createPhysicalBtnFloating}
            onPress={onOpenStudioCreate}
            activeOpacity={0.8}
          >
            <Plus size={15} color="#FFFFFF" strokeWidth={2.4} style={{ marginRight: 6 }} />
            <Text style={styles.createPhysicalBtnText}>Create Another Physical Blink</Text>
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
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 8,
  },
  balanceText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  depositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  depositBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
    paddingBottom: 4,
  },
  activeTabIndicator: {
    position: 'relative',
    paddingBottom: 8,
  },
  activeTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeTabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: '#4F46E5',
    borderRadius: 2,
  },
  searchContainer: {
    width: '100%',
    marginBottom: 16,
  },
  searchBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    fontSize: 12,
    padding: 0,
    margin: 0,
    outlineStyle: 'none',
  } as any,
  filterScrollView: {
    marginTop: 10,
    width: '100%',
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  filterPillActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dashedEmptyCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  emptyLogoWrap: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyCardSub: {
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 16,
    marginBottom: 20,
  },
  createPhysicalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  createPhysicalBtnFloating: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 20,
    marginTop: 8,
    alignSelf: 'center',
  },
  createPhysicalBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  blinksList: {
    gap: 10,
  },
  blinkCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardBrandWrap: {
    marginRight: 10,
  },
  blinkCardName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  blinkCardId: {
    fontSize: 10,
  },
  priceTag: {
    alignItems: 'flex-end',
  },
  priceTagValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  blinkCardDesc: {
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 10,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    flexWrap: 'wrap',
    gap: 6,
  },
  cardStatsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  cardActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtnIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    gap: 4,
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
