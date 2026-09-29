import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { ToastService } from '../services/toastService';
import {
  Bookmark,
  Share2,
  ExternalLink,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  Radio,
  Plus,
} from 'lucide-react-native';
import { PhysicalBlink, PhysicalBlinkRegistry } from '../services/physicalBlinkRegistry';
import { DatabaseService } from '../services/databaseService';
import { useTheme } from '../theme/ThemeContext';
import {
  BlinkBrandMark,
  CoffeeShopLogo,
  MusicianLogo,
  HackerHouseLogo,
} from '../components/BrandLogos';

interface SavedBlinksScreenProps {
  onSelectBlink: (blink: PhysicalBlink) => void;
  onExploreMarkets: () => void;
  onOpenCreateBlink: () => void;
  refreshTrigger?: number;
}

export const SavedBlinksScreen: React.FC<SavedBlinksScreenProps> = ({
  onSelectBlink,
  onExploreMarkets,
  onOpenCreateBlink,
  refreshTrigger = 0,
}) => {
  const { colors, isDark } = useTheme();
  const [savedBlinks, setSavedBlinks] = useState<PhysicalBlink[]>(() =>
    DatabaseService.getBookmarkedBlinks()
  );
  // Subscribe to global ToastService
  const [toast, setToast] = useState<import('../services/toastService').ToastMessage | null>(null);
  useEffect(() => {
    const unsubscribe = ToastService.subscribe(setToast);
    return unsubscribe;
  }, []);

  const showToast = (msg: string) => {
    ToastService.show(msg);
  };

  const reloadBookmarks = (e?: any) => {
    const detail = e?.detail;
    if (detail && detail.id && !Array.isArray(detail)) {
      setSavedBlinks(prev =>
        prev.map(b => (b.id.toLowerCase() === detail.id.toLowerCase() ? { ...b, ...detail } : b))
      );
    } else {
      setSavedBlinks(DatabaseService.getBookmarkedBlinks());
    }
  };

  useEffect(() => {
    reloadBookmarks();
  }, [refreshTrigger]);

  useEffect(() => {
    reloadBookmarks();

    if (typeof window !== 'undefined') {
      window.addEventListener('blink_bookmarks_updated', reloadBookmarks);
      window.addEventListener('blink_database_updated', reloadBookmarks);
      window.addEventListener('blink_registry_updated', reloadBookmarks);
      window.addEventListener('blink_updated', reloadBookmarks);
      return () => {
        window.removeEventListener('blink_bookmarks_updated', reloadBookmarks);
        window.removeEventListener('blink_database_updated', reloadBookmarks);
        window.removeEventListener('blink_registry_updated', reloadBookmarks);
        window.removeEventListener('blink_updated', reloadBookmarks);
      };
    }
  }, []);

  const handleRemoveBookmark = (id: string, name: string) => {
    DatabaseService.toggleBookmark(id);
    reloadBookmarks();
    showToast(`Removed "${name}" from Saved`);
  };

  const handleShare = async (blink: PhysicalBlink) => {
    const url = PhysicalBlinkRegistry.getPhysicalUrl(blink.id);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: blink.name,
          text: blink.description,
          url,
        });
        showToast('Shared successfully!');
        return;
      } catch {}
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard!');
    }
  };

  const getBlinkIcon = (id: string) => {
    if (id.includes('coffee')) return <CoffeeShopLogo size={40} />;
    if (id.includes('tip') || id.includes('music')) return <MusicianLogo size={40} />;
    if (id.includes('pass') || id.includes('event')) return <HackerHouseLogo size={40} />;
    return <BlinkBrandMark size={40} />;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Toast */}
      {toast && (
        <View style={styles.toastBar}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}

      {/* Header Row */}
      <View style={styles.headerSection}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIconWrap, { backgroundColor: colors.accentSoft }]}>
            <Bookmark size={20} color={colors.accent} />
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text style={[styles.heading, { color: colors.textPrimary }]}>Saved / Bookmarks</Text>
            <Text style={[styles.subheading, { color: colors.textSecondary }]}>
              Quick access to your saved Physical Blinks
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.createPillBtn, { backgroundColor: colors.accent }]}
          onPress={onOpenCreateBlink}
          activeOpacity={0.8}
        >
          <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.createPillBtnText}>New Blink</Text>
        </TouchableOpacity>
      </View>

      {/* Bookmarked Items or Empty State */}
      {savedBlinks.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.bgCardAlt }]}>
            <Bookmark size={32} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Saved Blinks Yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Save any Physical Blink from the Markets or after scanning an NFC tag to quickly access and execute it here.
          </Text>
          <View style={styles.emptyActionsRow}>
            <TouchableOpacity
              style={[styles.exploreBtn, { backgroundColor: colors.accent }]}
              onPress={onExploreMarkets}
              activeOpacity={0.8}
            >
              <Text style={styles.exploreBtnText}>Explore Markets</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryCreateBtn, { borderColor: colors.border }]}
              onPress={onOpenCreateBlink}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryCreateBtnText, { color: colors.textPrimary }]}>Create Blink</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {savedBlinks.map((blink) => (
            <View
              key={blink.id}
              style={[styles.blinkCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            >
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => onSelectBlink(blink)}
                activeOpacity={0.8}
              >
                <View style={styles.cardLeft}>
                  {getBlinkIcon(blink.id)}
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {blink.name}
                      </Text>
                      {blink.verifiedDomain && (
                        <View style={styles.verifiedDomainBadge}>
                          <ShieldCheck size={10} color="#10B981" />
                          <Text style={styles.verifiedDomainText}>{blink.verifiedDomain}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                      {blink.description}
                    </Text>
                    <View style={styles.metaRow}>
                      <View style={[styles.actionTag, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
                        <Text style={[styles.actionTagText, { color: colors.textMuted }]}>
                          {blink.actionType.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.slugText, { color: colors.textMuted }]}>/{blink.id}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardRight}>
                  <Text style={[styles.priceText, { color: colors.textPrimary }]}>
                    {blink.token === 'SOL' ? `${blink.amount} SOL` : `$${blink.amount.toFixed(2)}`}
                  </Text>
                  {blink.token !== 'SOL' && (
                    <Text style={[styles.tokenSubtext, { color: colors.accent }]}>{blink.token}</Text>
                  )}
                </View>
              </TouchableOpacity>

              {/* Card Action Bar */}
              <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.footerActionBtn, { borderColor: colors.border }]}
                  onPress={() => onSelectBlink(blink)}
                  activeOpacity={0.7}
                >
                  <ArrowUpRight size={13} color={colors.accent} />
                  <Text style={[styles.footerActionText, { color: colors.accent }]}>Execute Blink</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.iconActionBtn, { backgroundColor: colors.bgCardAlt }]}
                    onPress={() => handleShare(blink)}
                    activeOpacity={0.7}
                    accessibilityLabel="Share Blink"
                  >
                    <Share2 size={14} color={colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.iconActionBtn, { backgroundColor: colors.accentSoft }]}
                    onPress={() => handleRemoveBookmark(blink.id, blink.name)}
                    activeOpacity={0.7}
                    accessibilityLabel="Remove from Saved"
                  >
                    <Bookmark size={14} color={colors.accent} fill={colors.accent} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: 720,
    width: '100%',
    marginHorizontal: 'auto',
  },
  toastBar: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    backgroundColor: '#0F1117',
    borderColor: '#5B67F6',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 999,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: 12,
    marginTop: 2,
  },
  createPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  createPillBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  exploreBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryCreateBtn: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryCreateBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContainer: {
    gap: 12,
  },
  blinkCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  cardLeft: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  verifiedDomainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verifiedDomainText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  actionTag: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  actionTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  slugText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
  },
  tokenSubtext: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  footerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  footerActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
