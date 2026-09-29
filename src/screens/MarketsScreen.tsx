import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import {
  TrendingUp,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Shield,
  Radio,
  Plus,
  Sun,
  Moon,
  User,
  HelpCircle,
  BookOpen,
} from 'lucide-react-native';
import { BlinkBrandMark, CoffeeShopLogo, MusicianLogo, HackerHouseLogo, UsdcCoinLogo, SolanaCoinLogo } from '../components/BrandLogos';
import { PhantomIcon, SolflareIcon, BackpackIcon, CoinbaseIcon } from '../components/WalletIcons';
import { PrivyIcon } from '../components/PrivyIcon';
import { PhysicalBlink, PhysicalBlinkRegistry } from '../services/physicalBlinkRegistry';
import { WalletAccount } from '../services/walletProviderService';
import { PriceService } from '../services/priceService';
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
  onOpenAbout?: () => void;
  hideBrandLogo?: boolean;
  refreshTrigger?: number;
  onOpenProfile?: () => void;
  avatarUrl?: string;
}

export const MarketsScreen: React.FC<MarketsScreenProps> = ({
  activeAccount,
  balanceSol,
  balanceUsdc = 0,
  network,
  onToggleNetwork,
  onOpenWalletConnect,
  onOpenDeposit,
  onSelectBlink,
  onOpenStudioCreate,
  onOpenAbout,
  hideBrandLogo = false,
  refreshTrigger = 0,
  onOpenProfile,
  avatarUrl,
}) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const [mainTab, setMainTab] = useState<'all' | 'taps' | 'merchants'>('all');
  const [activeFilter, setActiveFilter] = useState<'trending' | 'completed' | 'volume'>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [solPrice, setSolPrice] = useState<number>(() => PriceService.getSolPriceSync());

  React.useEffect(() => {
    const unsub = PriceService.subscribe((p) => setSolPrice(p.sol));
    return () => unsub();
  }, []);

  const [blinks, setBlinks] = useState<PhysicalBlink[]>(() => PhysicalBlinkRegistry.getGlobalBlinks());

  React.useEffect(() => {
    setBlinks(PhysicalBlinkRegistry.getGlobalBlinks());
    PhysicalBlinkRegistry.syncFromCloud().then(cloudBlinks => {
      if (cloudBlinks && cloudBlinks.length > 0) {
        setBlinks(PhysicalBlinkRegistry.getGlobalBlinks());
      }
    });
  }, [refreshTrigger]);

  React.useEffect(() => {
    const handleUpdate = (e?: any) => {
      const detail = e?.detail;
      if (detail && detail.id && !Array.isArray(detail)) {
        setBlinks(prev =>
          prev.map(b => (b.id.toLowerCase() === detail.id.toLowerCase() ? { ...b, ...detail } : b))
        );
      } else {
        setBlinks(PhysicalBlinkRegistry.getGlobalBlinks());
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('blink_registry_updated', handleUpdate);
      window.addEventListener('blink_database_updated', handleUpdate);
      window.addEventListener('blink_updated', handleUpdate);
      return () => {
        window.removeEventListener('blink_registry_updated', handleUpdate);
        window.removeEventListener('blink_database_updated', handleUpdate);
        window.removeEventListener('blink_updated', handleUpdate);
      };
    }
  }, []);

  // Aggregate balance / display
  const totalVolume = blinks.reduce((sum, b) => sum + b.stats.volumeUsdc, 0);

  const getBlinkIcon = (id: string) => {
    if (id.includes('coffee')) return <CoffeeShopLogo size={42} />;
    if (id.includes('tip') || id.includes('music')) return <MusicianLogo size={42} />;
    if (id.includes('pass') || id.includes('event')) return <HackerHouseLogo size={42} />;
    return <BlinkBrandMark size={42} />;
  };

  const filteredBlinks = blinks
    .filter((b) => {
      const matchesSearch =
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.verifiedDomain ? b.verifiedDomain.toLowerCase().includes(searchQuery.toLowerCase()) : false);
      if (!matchesSearch) return false;

      if (mainTab === 'taps') return b.actionType === 'tip' || b.actionType === 'mint' || b.actionType === 'donation';
      if (mainTab === 'merchants') return !!b.verifiedDomain || b.actionType === 'voucher';
      return true;
    })
    .sort((a, b) => {
      if (activeFilter === 'trending') return b.stats.taps - a.stats.taps;
      if (activeFilter === 'completed') return b.stats.completed - a.stats.completed;
      if (activeFilter === 'volume') return b.stats.volumeUsdc - a.stats.volumeUsdc;
      return 0;
    });

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Top Bar: shows logo on mobile; on desktop where nav bar has the logo, only 1 logo is shown */}
      <View style={[styles.topBar, hideBrandLogo && styles.topBarRightOnly]}>
        {!hideBrandLogo && (
          <View style={styles.topBarLeft}>
            <BlinkBrandMark size={36} />
          </View>
        )}

        <View style={styles.topBarRight}>
          {/* Theme Toggle Button */}
          <TouchableOpacity
            style={[styles.themeToggleBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={toggleTheme}
            activeOpacity={0.8}
            accessibilityLabel="Toggle Light / Dark mode"
          >
            {isDark ? <Sun size={15} color="#F1F5F9" /> : <Moon size={15} color="#0F1117" />}
          </TouchableOpacity>

          {/* Profile Avatar Button */}
          {onOpenProfile && (
            <TouchableOpacity
              style={[styles.profileAvatarBtn, { borderColor: colors.border }]}
              onPress={onOpenProfile}
              activeOpacity={0.8}
              accessibilityLabel="Open Profile and Identity"
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: colors.accentSoft }]}>
                  <User size={15} color={colors.accent} />
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Hero Balance & Action Buttons */}
      <View style={styles.heroSection}>
        <View>
          <Text style={[styles.heroAmount, { color: colors.textPrimary }]}>
            ${activeAccount ? PriceService.calculateTotalPortfolioUsdt(balanceSol || 0, balanceUsdc || 0, 0).toFixed(2) : '0.00'}
          </Text>

        </View>

        <TouchableOpacity
          style={styles.depositBtn}
          onPress={onOpenDeposit}
          activeOpacity={0.8}
          accessibilityLabel="Deposit funds"
        >
          <ArrowDownLeft size={15} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.depositBtnText}>Deposit</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal Carousel: "Top physical blinks" */}
      {blinks.length > 0 && (
        <View style={styles.carouselSection}>
          <View style={styles.sectionHeaderRow}>
            <TrendingUp size={14} color={colors.textSecondary} />
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Top Physical Blinks</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselScroll}>
            {blinks.map((blink) => (
              <TouchableOpacity
                key={blink.id}
                style={[styles.moverCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                onPress={() => onSelectBlink(blink)}
                activeOpacity={0.8}
              >
                <View style={styles.moverCardTop}>
                  {getBlinkIcon(blink.id)}
                  <Text style={[styles.moverSymbol, { color: colors.textPrimary }]}>
                    {blink.id.split('-')[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.moverGain, { color: colors.accent }]}>
                  {blink.token === 'SOL' ? `${blink.amount} SOL` : `$${blink.amount.toFixed(2)} USDC`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Segmented Main Navigation Tabs (All | Physical Taps | Merchants) */}
      <View style={[styles.segmentNav, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.segmentTab}
          onPress={() => setMainTab('all')}
        >
          <Text style={[styles.segmentLabel, { color: colors.textMuted }, mainTab === 'all' && [styles.segmentLabelActive, { color: colors.textPrimary }]]}>
            All Blinks
          </Text>
          {mainTab === 'all' && <View style={[styles.segmentUnderline, { backgroundColor: colors.accent }]} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.segmentTab}
          onPress={() => setMainTab('taps')}
        >
          <Text style={[styles.segmentLabel, { color: colors.textMuted }, mainTab === 'taps' && [styles.segmentLabelActive, { color: colors.textPrimary }]]}>
            Physical Taps
          </Text>
          {mainTab === 'taps' && <View style={[styles.segmentUnderline, { backgroundColor: colors.accent }]} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.segmentTab}
          onPress={() => setMainTab('merchants')}
        >
          <Text style={[styles.segmentLabel, { color: colors.textMuted }, mainTab === 'merchants' && [styles.segmentLabelActive, { color: colors.textPrimary }]]}>
            Merchants
          </Text>
          {mainTab === 'merchants' && <View style={[styles.segmentUnderline, { backgroundColor: colors.accent }]} />}
        </TouchableOpacity>
      </View>

      {/* Search & Category Pills */}
      <View style={styles.filterBar}>
        <View style={[styles.searchIconBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Search size={14} color={colors.textMuted} />
        </View>

        <TextInput
          style={{
            flex: 1,
            color: colors.textPrimary,
            fontSize: 13,
            paddingVertical: 4,
            paddingHorizontal: 6,
          }}
          placeholder="Search by name, ID or domain..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {(['trending', 'completed', 'volume'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterPill,
              { backgroundColor: colors.bgCard, borderColor: colors.border },
              activeFilter === filter && { backgroundColor: isDark ? '#1E2333' : '#E0E7FF', borderColor: colors.accent }
            ]}
            onPress={() => setActiveFilter(filter)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.filterPillText,
              { color: colors.textMuted },
              activeFilter === filter && { color: isDark ? '#FFFFFF' : colors.accent, fontWeight: '800' }
            ]}>
              {filter === 'trending' ? 'Most Taps' : filter === 'completed' ? 'Top Settled' : 'High Volume'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Rich List Items with real data */}
      <View style={styles.listSection}>
        {filteredBlinks.length > 0 ? (
          filteredBlinks.map((blink) => (
            <TouchableOpacity
              key={blink.id}
              style={styles.listItem}
              onPress={() => onSelectBlink(blink)}
              activeOpacity={0.7}
            >
              {/* Left Circular Avatar */}
              <View style={styles.itemAvatar}>
                {getBlinkIcon(blink.id)}
              </View>

              {/* Middle Info */}
              <View style={styles.itemMiddle}>
                <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{blink.name}</Text>
                <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                  ${blink.stats.volumeUsdc.toLocaleString('en-US', { minimumFractionDigits: 0 })} vol.
                  {blink.verifiedDomain ? ` • ${blink.verifiedDomain}` : ''}
                </Text>
              </View>

              {/* Right Value & Stats */}
              <View style={styles.itemRight}>
                <Text style={[styles.itemPrice, { color: colors.textPrimary }]}>
                  {blink.token === 'SOL' ? `${blink.amount} SOL` : `$${blink.amount.toFixed(2)} USDC`}
                </Text>
                <Text style={styles.itemGain}>
                  {blink.stats.taps} taps • {blink.stats.completed} settled
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={[styles.emptyBox, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <BlinkBrandMark size={48} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {blinks.length === 0 ? 'No Physical Blinks Yet' : 'No Matching Blinks Found'}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              {blinks.length === 0
                ? 'Your Blink store and registry are clean and ready. Tap below to create your first on-chain Physical Blink!'
                : 'Try adjusting your search query or filter settings.'}
            </Text>
            {blinks.length === 0 && (
              <TouchableOpacity
                style={[styles.emptyCreateBtn, { backgroundColor: colors.accent }]}
                onPress={onOpenStudioCreate}
                activeOpacity={0.8}
              >
                <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.emptyCreateBtnText}>Create Physical Blink</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  themeToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 110, // Avoid overlap with floating bottom dock
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  topBarRightOnly: {
    justifyContent: 'flex-end',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  helpPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  helpPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  docsBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  docsBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  docsBannerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docsBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  docsBannerDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  docsBannerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  docsBannerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#131620',
    borderWidth: 1,
    borderColor: '#242938',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 18,
  },
  walletPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  walletPillConnect: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  heroAmount: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1.2,
  },
  gainRow: {
    marginTop: 2,
  },
  gainText: {
    color: '#10B981', // Clean Emerald Green from screenshot
    fontSize: 13,
    fontWeight: '700',
  },
  depositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#5B67F6',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 18,
    shadowColor: '#5B67F6',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  depositBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  carouselSection: {
    marginBottom: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  carouselScroll: {
    gap: 10,
    paddingRight: 16,
  },
  moverCard: {
    backgroundColor: '#0F1118',
    borderWidth: 1,
    borderColor: '#1D212E',
    borderRadius: 16,
    padding: 12,
    width: 125,
  },
  moverCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  moverSymbol: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  moverGain: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
  },
  segmentNav: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#171A24',
    marginBottom: 16,
  },
  segmentTab: {
    paddingVertical: 10,
    marginRight: 24,
    position: 'relative',
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentLabelActive: {
    color: '#FFFFFF',
  },
  segmentUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: '#5B67F6',
    borderRadius: 2,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  searchIconBox: {
    backgroundColor: '#0F1118',
    borderWidth: 1,
    borderColor: '#1D212E',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPill: {
    backgroundColor: '#0F1118',
    borderWidth: 1,
    borderColor: '#1D212E',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  filterPillActive: {
    backgroundColor: '#1E2333',
    borderColor: '#2F374F',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  listSection: {
    gap: 14,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemAvatar: {
    marginRight: 12,
  },
  itemMiddle: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  itemSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  itemGain: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  profileAvatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createBlinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  createBlinkBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 20,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  emptyCreateBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
