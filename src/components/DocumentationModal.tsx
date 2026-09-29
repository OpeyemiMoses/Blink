import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  useWindowDimensions,
  Platform,
} from 'react-native';
import {
  X,
  Search,
  Radio,
  Zap,
  Shield,
  HelpCircle,
  Code,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Smartphone,
  ArrowRight,
  CheckCircle2,
  Copy,
  Wallet,
  Globe,
  Tag,
  Key,
  Flame,
  Store,
  Share2,
  Bookmark,
  Check,
  Terminal,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { BlinkBrandMark } from './BrandLogos';
import { SolanaCoinLogo } from './BrandLogos';

interface DocumentationModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenStudio?: () => void;
  onOpenPocket?: () => void;
  initialSection?: string;
}

type DocSectionId =
  | 'overview'
  | 'tap_scan'
  | 'studio'
  | 'wallets_devnet'
  | 'saved_share'
  | 'faq';

interface DocSectionNav {
  id: DocSectionId;
  label: string;
  icon: any;
  badge?: string;
}

interface SearchableItem {
  id: string;
  sectionId: DocSectionId;
  title: string;
  snippet: string;
  category: string;
  badge?: string;
}

export const DocumentationModal: React.FC<DocumentationModalProps> = ({
  visible,
  onClose,
  onOpenStudio,
  onOpenPocket,
  initialSection = 'overview',
}) => {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [activeSection, setActiveSection] = useState<DocSectionId>(initialSection as DocSectionId);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const sections: DocSectionNav[] = [
    { id: 'overview', label: 'Overview & Philosophy', icon: Sparkles },
    { id: 'tap_scan', label: 'How to Tap & Scan', icon: Radio, badge: 'NFC' },
    { id: 'studio', label: 'Blink Studio Guide', icon: Store, badge: 'Creator' },
    { id: 'wallets_devnet', label: 'Wallets & Devnet', icon: Shield },
    { id: 'saved_share', label: 'Saved & Sharing', icon: Bookmark },
    { id: 'faq', label: 'FAQ & Troubleshooting', icon: HelpCircle },
  ];

  const searchableDocItems = useMemo<SearchableItem[]>(() => [
    {
      id: 'overview-1',
      sectionId: 'overview',
      title: 'Physical Interface for Solana Actions',
      snippet: 'Blink turns physical objects like coffee cups, merch, and event badges into instant atomic Solana Actions.',
      category: 'Architecture',
      badge: 'Overview',
    },
    {
      id: 'overview-2',
      sectionId: 'overview',
      title: 'Keyless Embedded Wallets',
      snippet: 'Powered by Privy non-custodial MPC infrastructure. Onboard instantly with Google, Twitter, or Email OTP.',
      category: 'Security',
      badge: 'Privy MPC',
    },
    {
      id: 'tap-nfc',
      sectionId: 'tap_scan',
      title: 'How to Tap & Scan NFC Tags',
      snippet: 'Hardware antenna locations for iPhone (top rim) and Android / Seeker (rear center). Supported chips: NTAG213, NTAG215, NTAG216.',
      category: 'Hardware',
      badge: 'NFC Guide',
    },
    {
      id: 'studio-create',
      sectionId: 'studio',
      title: 'Deploying Actions in Blink Studio',
      snippet: 'Create merchant checkout links, tip jars, POAP mints, or vouchers and program NFC tags in under 60 seconds.',
      category: 'Creator',
      badge: 'Studio',
    },
    {
      id: 'studio-edit',
      sectionId: 'studio',
      title: 'Live Price Modifications',
      snippet: 'Update prices or beneficiary wallets live in Studio without reprinting or replacing physical tags.',
      category: 'Creator',
      badge: 'Live State',
    },
    {
      id: 'wallet-privy',
      sectionId: 'wallets_devnet',
      title: 'Privy Embedded Wallets & MPC Security',
      snippet: 'Isolated Solana keypair provisioned automatically via Privy MPC sharding without seed phrase friction.',
      category: 'Security',
      badge: 'MPC Keypair',
    },
    {
      id: 'wallet-devnet',
      sectionId: 'wallets_devnet',
      title: 'Solana Devnet Test Network',
      snippet: 'All transactions in Blink execute on Solana Devnet with zero financial risk.',
      category: 'Devnet',
      badge: 'Solana',
    },
    {
      id: 'faq-google-popup',
      sectionId: 'faq',
      title: 'Google Sign In Popup Troubleshooting',
      snippet: 'How to handle popup blockers in Safari, Chrome, and Brave, or use Email OTP fallback.',
      category: 'FAQ',
      badge: 'Auth',
    },
    {
      id: 'faq-nfc-metal',
      sectionId: 'faq',
      title: 'NFC Tag Surface Troubleshooting',
      snippet: 'Avoid placing NFC tags directly on raw metal surfaces unless using anti-metal ferrite tags.',
      category: 'FAQ',
      badge: 'Hardware',
    },
  ], []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return searchableDocItems.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.snippet.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.badge && item.badge.toLowerCase().includes(q))
    );
  }, [searchQuery, searchableDocItems]);

  const handleCopy = (code: string, id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2000);
    }
  };

  const toggleFaq = (index: number) => {
    setExpandedFaqIndex(expandedFaqIndex === index ? null : index);
  };

  const jumpToSearchResult = (sectionId: DocSectionId) => {
    setActiveSection(sectionId);
    setSearchQuery('');
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View
        style={[
          styles.modalContainer,
          {
            backgroundColor: colors.bg,
            borderColor: colors.border,
          },
          isDesktop ? styles.modalContainerDesktop : styles.modalContainerMobile,
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.bgCard }]}>
          <View style={styles.headerLeft}>
            <BlinkBrandMark size={32} />
            <View style={{ marginLeft: 10 }}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Documentation & Help Centre</Text>
                <View style={[styles.versionPill, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.versionText, { color: colors.accent }]}>v2.4 • Devnet</Text>
                </View>
              </View>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                The Complete Guide to Physical Blinks, NFC Actions & Embedded Wallets
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.bgPill, borderColor: colors.border }]}
            accessibilityLabel="Close documentation"
          >
            <X size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBarRow, { backgroundColor: colors.bgCardAlt, borderBottomColor: colors.border }]}>
          <View style={[styles.searchInputWrapper, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <Search size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search guides, NFC troubleshooting, API payloads, Google login..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={15} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Live Search Results Overlay View */}
        {searchQuery.trim().length > 0 && (
          <View style={[styles.searchResultsContainer, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
            <View style={styles.searchResultsHeader}>
              <Text style={[styles.searchResultsTitle, { color: colors.textPrimary }]}>
                Search Results ({searchResults.length})
              </Text>
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '700' }}>Clear Search</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={true}>
              {searchResults.length > 0 ? (
                searchResults.map((res) => (
                  <TouchableOpacity
                    key={res.id}
                    style={[styles.searchResultCard, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                    onPress={() => jumpToSearchResult(res.sectionId)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.searchResultMeta}>
                      <Text style={[styles.searchResultCategory, { color: colors.accent }]}>{res.category}</Text>
                      {res.badge && (
                        <View style={[styles.badgePill, { backgroundColor: colors.accentSoft }]}>
                          <Text style={[styles.badgeText, { color: colors.accent }]}>{res.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.searchResultItemTitle, { color: colors.textPrimary }]}>{res.title}</Text>
                    <Text style={[styles.searchResultSnippet, { color: colors.textSecondary }]} numberOfLines={2}>
                      {res.snippet}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                    No matching articles found for "{searchQuery}". Try searching for "NFC", "Privy", "API", or "Faucet".
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* Content Body: Sidebar + Main Content */}
        <View style={[styles.bodyWrapper, !isDesktop && styles.bodyWrapperMobile]}>
          {/* Section Navigation Tabs */}
          <View
            style={[
              isDesktop ? styles.sidebar : styles.horizontalNav,
              { borderRightColor: colors.border, borderBottomColor: colors.border, backgroundColor: colors.bgCard },
            ]}
          >
            <ScrollView
              horizontal={!isDesktop}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={isDesktop ? styles.sidebarContent : styles.horizontalNavContent}
            >
              {sections.map((sec) => {
                const Icon = sec.icon;
                const isActive = activeSection === sec.id;
                return (
                  <TouchableOpacity
                    key={sec.id}
                    style={[
                      isDesktop ? styles.navItemDesktop : styles.navItemMobile,
                      isActive && [styles.navItemActive, { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder }],
                    ]}
                    onPress={() => setActiveSection(sec.id)}
                    activeOpacity={0.7}
                  >
                    <Icon size={16} color={isActive ? colors.accent : colors.textSecondary} />
                    <Text
                      style={[
                        styles.navItemText,
                        { color: isActive ? colors.textPrimary : colors.textSecondary },
                        isActive && { fontWeight: '700' },
                      ]}
                    >
                      {sec.label}
                    </Text>
                    {sec.badge && (
                      <View
                        style={[
                          styles.badgePill,
                          {
                            backgroundColor: isActive ? colors.accent : colors.bgPill,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            { color: isActive ? '#FFFFFF' : colors.textMuted },
                          ]}
                        >
                          {sec.badge}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Main Article Content */}
          <ScrollView
            style={[styles.mainScroll, { backgroundColor: colors.bg }]}
            contentContainerStyle={styles.mainScrollContent}
            showsVerticalScrollIndicator={true}
          >
            {/* SECTION 1: OVERVIEW & PHILOSOPHY */}
            {activeSection === 'overview' && (
              <View style={styles.sectionContainer}>
                <View style={[styles.heroCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={[styles.heroIconBox, { backgroundColor: colors.accentSoft }]}>
                    <Sparkles size={28} color={colors.accent} />
                  </View>
                  <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
                    The Physical Interface for Solana Actions
                  </Text>
                  <Text style={[styles.heroBody, { color: colors.textSecondary }]}>
                    Blink revolutionizes how humans interact with decentralized applications. Instead of forcing users to navigate URLs, scan manual QR dumps, or remember domain addresses, Blink turns any real-world object—coffee cups, musician merch, event badges, tip jars, or retail shelves—into an instant, atomic Solana Action.
                  </Text>
                </View>

                {/* The Core Paradigm Shift Table */}
                <Text style={[styles.blockHeading, { color: colors.textPrimary }]}>The Core Paradigm Shift</Text>
                <View style={[styles.paradigmBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={styles.paradigmRow}>
                    <View style={styles.paradigmLeft}>
                      <Globe size={18} color="#94A3B8" />
                      <Text style={[styles.paradigmTag, { color: colors.textSecondary }]}>TRADITIONAL WEB3 BLINK</Text>
                    </View>
                    <Text style={[styles.paradigmCode, { color: colors.textSecondary }]}>
                      Twitter / Discord URL → Web Click → Wallet Extension Popup → Confirm
                    </Text>
                  </View>

                  <View style={[styles.paradigmDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.paradigmRow}>
                    <View style={styles.paradigmLeft}>
                      <Radio size={18} color={colors.accent} />
                      <Text style={[styles.paradigmTag, { color: colors.accent }]}>PHYSICAL BLINK (TAP & GO)</Text>
                    </View>
                    <Text style={[styles.paradigmCode, { color: colors.accent, fontWeight: '800' }]}>
                      Physical Object (Physical NFC Tag / Terminal) → 1 Tap → Immediate Solana Settlement
                    </Text>
                  </View>
                </View>

                {/* 3 Architectural Pillars */}
                <Text style={[styles.blockHeading, { color: colors.textPrimary }]}>The 3 Architectural Pillars</Text>
                <View style={styles.gridCards}>
                  <View style={[styles.featureCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <View style={[styles.featureIcon, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                      <Radio size={20} color="#10B981" />
                    </View>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>1. Immutable Physical Identity</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                      Each physical tag carries an invariant NDEF record pointing to <Text style={{ fontFamily: 'monospace' }}>/t/[blinkId]</Text>. It never needs rewriting or replacing once deployed to the physical world.
                    </Text>
                  </View>

                  <View style={[styles.featureCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <View style={[styles.featureIcon, { backgroundColor: colors.accentSoft }]}>
                      <Zap size={20} color={colors.accent} />
                    </View>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>2. Dynamic On-Chain Logic</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                      Merchants and creators can update prices, beneficiary wallets, action types, or descriptions in real time from Blink Studio. The tag immediately reflects new prices on the next tap!
                    </Text>
                  </View>

                  <View style={[styles.featureCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <View style={[styles.featureIcon, { backgroundColor: 'rgba(236, 72, 153, 0.12)' }]}>
                      <Wallet size={20} color="#EC4899" />
                    </View>
                    <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>3. Keyless Embedded Wallets</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                      Powered by Privy non-custodial MPC infrastructure. Users onboard instantly with Google, Twitter, or Email OTP without seed phrase friction, fully equipped with Solana Devnet balances.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* SECTION 2: HOW TO TAP & SCAN */}
            {activeSection === 'tap_scan' && (
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>How to Tap & Scan Physical Blinks</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Everything you need to know about NFC antenna locations, tag compatibility, and in-app camera scanning.
                </Text>

                {/* NFC Guide Card */}
                <View style={[styles.guideCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={styles.guideCardHeader}>
                    <Radio size={22} color={colors.accent} />
                    <Text style={[styles.guideCardTitle, { color: colors.textPrimary }]}>NFC (Near Field Communication) Tapping</Text>
                  </View>
                  <Text style={[styles.guideText, { color: colors.textSecondary }]}>
                    Physical Blinks use standard high-frequency NFC tags (ISO 14443 Type A, 13.56 MHz).
                  </Text>

                  <View style={[styles.calloutBox, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
                    <Text style={[styles.calloutTitle, { color: colors.textPrimary }]}>Where is your phone's NFC Antenna?</Text>
                    <View style={styles.antennaRow}>
                      <Smartphone size={18} color="#10B981" />
                      <Text style={[styles.antennaText, { color: colors.textSecondary }]}>
                        <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Apple iPhone (XS and newer):</Text> Located at the very TOP EDGE of the device. Hold the top rim flat against the tag for 0.5 seconds.
                      </Text>
                    </View>
                    <View style={styles.antennaRow}>
                      <Smartphone size={18} color={colors.accent} />
                      <Text style={[styles.antennaText, { color: colors.textSecondary }]}>
                        <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Solana Seeker & Android:</Text> Located on the UPPER/CENTER REAR of the phone. Align the back center against the physical tag.
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.stepItemTitle, { color: colors.textPrimary }]}>Supported NFC Hardware Chips Table:</Text>
                  <View style={styles.chipPillGroup}>
                    {['NTAG213 (144 bytes)', 'NTAG215 (504 bytes)', 'NTAG216 (888 bytes)', 'Mifare Ultralight EV1', 'FeliCa'].map((chip) => (
                      <View key={chip} style={[styles.chipPill, { backgroundColor: colors.bgPill, borderColor: colors.border }]}>
                        <Text style={[styles.chipText, { color: colors.textSecondary }]}>{chip}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* QR Code Scanning Card */}
                <View style={[styles.guideCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={styles.guideCardHeader}>
                    <Tag size={22} color="#10B981" />
                    <Text style={[styles.guideCardTitle, { color: colors.textPrimary }]}>High-Density Dynamic QR Scanning</Text>
                  </View>
                  <Text style={[styles.guideText, { color: colors.textSecondary }]}>
                    When NFC is unavailable (or on desktop / laptops), every Physical Blink features a high-contrast vector QR code. You can scan it directly using the built-in camera scanner in the <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Tap & Scan</Text> tab, or with standard iOS/Android native camera apps.
                  </Text>
                </View>
              </View>
            )}

            {/* SECTION 3: BLINK STUDIO GUIDE */}
            {activeSection === 'studio' && (
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Blink Studio: Creator & Merchant Guide</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Deploy your physical touchpoints, update prices live, and write NFC tags in under 60 seconds.
                </Text>

                {/* Step 1: Create */}
                <View style={[styles.studioStepCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={styles.studioStepHeader}>
                    <View style={[styles.stepBadge, { backgroundColor: colors.accent }]}>
                      <Text style={styles.stepBadgeText}>1</Text>
                    </View>
                    <Text style={[styles.studioStepTitle, { color: colors.textPrimary }]}>Design Your Physical Action</Text>
                  </View>
                  <Text style={[styles.studioStepBody, { color: colors.textSecondary }]}>
                    Open Blink Studio and choose an action type:
                  </Text>
                  <View style={styles.actionTypeGrid}>
                    <View style={[styles.actionTypeBox, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
                      <Store size={18} color="#F59E0B" />
                      <Text style={[styles.actionTypeTitle, { color: colors.textPrimary }]}>Merchant Payment</Text>
                      <Text style={[styles.actionTypeDesc, { color: colors.textSecondary }]}>Fixed-amount checkout in USDC or SOL for physical goods (coffee, bakery, books).</Text>
                    </View>
                    <View style={[styles.actionTypeBox, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
                      <Flame size={18} color="#EC4899" />
                      <Text style={[styles.actionTypeTitle, { color: colors.textPrimary }]}>Creator Tip Jar</Text>
                      <Text style={[styles.actionTypeDesc, { color: colors.textSecondary }]}>Preset or variable tips for buskers, live bands, podcasters, and venues.</Text>
                    </View>
                    <View style={[styles.actionTypeBox, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
                      <Sparkles size={18} color={colors.accent} />
                      <Text style={[styles.actionTypeTitle, { color: colors.textPrimary }]}>Token & NFT Drops</Text>
                      <Text style={[styles.actionTypeDesc, { color: colors.textSecondary }]}>Tap-to-mint commemorative poaps, loyalty tokens, or community collectibles.</Text>
                    </View>
                  </View>
                </View>

                {/* Step 2: Live Price Updates */}
                <View style={[styles.studioStepCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={styles.studioStepHeader}>
                    <View style={[styles.stepBadge, { backgroundColor: '#10B981' }]}>
                      <Text style={styles.stepBadgeText}>2</Text>
                    </View>
                    <Text style={[styles.studioStepTitle, { color: colors.textPrimary }]}>Live Price Modification</Text>
                  </View>
                  <Text style={[styles.studioStepBody, { color: colors.textSecondary }]}>
                    Unlike Web2 QR menus that require reprinting physical items when prices change, Blink decouples the physical hardware tag from the on-chain action state.
                  </Text>
                  <View style={[styles.tipBanner, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                    <CheckCircle2 size={18} color="#10B981" />
                    <Text style={[styles.tipBannerText, { color: colors.textPrimary }]}>
                      To update a price, simply click the <Text style={{ fontWeight: '700' }}>Edit Price</Text> button in your Studio dashboard. Changes take effect on the very next tap worldwide!
                    </Text>
                  </View>
                </View>

                {/* Step 3: NFC Writing */}
                <View style={[styles.studioStepCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={styles.studioStepHeader}>
                    <View style={[styles.stepBadge, { backgroundColor: '#8B5CF6' }]}>
                      <Text style={styles.stepBadgeText}>3</Text>
                    </View>
                    <Text style={[styles.studioStepTitle, { color: colors.textPrimary }]}>Writing the Physical Tag</Text>
                  </View>
                  <Text style={[styles.studioStepBody, { color: colors.textSecondary }]}>
                    Click <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Write Tag</Text> in Blink Studio. If using a mobile phone with WebNFC support, hold the blank NFC tag to the rear. Alternatively, copy the generated NDEF URL (e.g. <Text style={{ fontFamily: 'monospace' }}>https://blink.sol/t/demo-blink-001</Text>) and write it using standard apps like <Text style={{ fontWeight: '700', color: colors.textPrimary }}>NFC Tools</Text> or <Text style={{ fontWeight: '700', color: colors.textPrimary }}>NXP TagWriter</Text>.
                  </Text>
                </View>

                {onOpenStudio && (
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: colors.accent }]}
                    onPress={() => {
                      onClose();
                      onOpenStudio();
                    }}
                  >
                    <Text style={styles.primaryActionText}>Launch Blink Studio</Text>
                    <ArrowRight size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* SECTION 4: WALLETS & DEVNET */}
            {activeSection === 'wallets_devnet' && (
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Wallets, Security & Solana Devnet</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  How non-custodial embedded keypairs and biometrics work together.
                </Text>

                {/* Privy Embedded Wallet */}
                <View style={[styles.guideCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={styles.guideCardHeader}>
                    <Key size={22} color={colors.accent} />
                    <Text style={[styles.guideCardTitle, { color: colors.textPrimary }]}>Privy Non-Custodial Embedded Wallets</Text>
                  </View>
                  <Text style={[styles.guideText, { color: colors.textSecondary }]}>
                    Blink integrates Privy embedded wallet technology. When you sign in with Google, Twitter, GitHub, Discord, or Email OTP, an isolated Solana keypair is automatically provisioned for you.
                  </Text>
                  <View style={styles.bulletList}>
                    <View style={styles.bulletRow}>
                      <CheckCircle2 size={16} color="#10B981" />
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                        <Text style={{ fontWeight: '700', color: colors.textPrimary }}>MPC Key Sharding:</Text> No single party holds your full private key. Keys are securely split and authorized on-device.
                      </Text>
                    </View>
                    <View style={styles.bulletRow}>
                      <CheckCircle2 size={16} color="#10B981" />
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                        <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Seedless Experience:</Text> Users never have to back up a 24-word recovery phrase, yet maintain full cryptographic ownership.
                      </Text>
                    </View>
                    <View style={styles.bulletRow}>
                      <CheckCircle2 size={16} color="#10B981" />
                      <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                        <Text style={{ fontWeight: '700', color: colors.textPrimary }}>External Wallets:</Text> Phantom, Solflare, Backpack, and Coinbase Wallet are also natively supported.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Solana Devnet */}
                <View style={[styles.guideCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={styles.guideCardHeader}>
                    <SolanaCoinLogo size={22} />
                    <Text style={[styles.guideCardTitle, { color: colors.textPrimary }]}>Solana Devnet Architecture</Text>
                  </View>
                  <Text style={[styles.guideText, { color: colors.textSecondary }]}>
                    All transactions in Blink currently execute on <Text style={{ fontWeight: '700', color: colors.accent }}>Solana Devnet</Text>, allowing creators and testers to experience real physical blinks with zero financial risk.
                  </Text>
                </View>

                {onOpenPocket && (
                  <TouchableOpacity
                    style={[styles.secondaryActionBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                    onPress={() => {
                      onClose();
                      onOpenPocket();
                    }}
                  >
                    <Wallet size={16} color={colors.accent} />
                    <Text style={[styles.secondaryActionText, { color: colors.textPrimary }]}>View Wallet & Account</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* SECTION 5: SAVED & SHARING */}
            {activeSection === 'saved_share' && (
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Bookmarking & Social Sharing</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Keep track of frequently visited merchants, favorite musicians, and share physical blinks.
                </Text>

                <View style={[styles.guideCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={styles.guideCardHeader}>
                    <Bookmark size={22} color={colors.accent} />
                    <Text style={[styles.guideCardTitle, { color: colors.textPrimary }]}>Saved Blinks (Bookmarks)</Text>
                  </View>
                  <Text style={[styles.guideText, { color: colors.textSecondary }]}>
                    When viewing any Blink in the Explore feed or after tapping a physical tag, tap the <Text style={{ fontWeight: '700', color: colors.accent }}>Save Blink</Text> button.
                  </Text>
                  <Text style={[styles.guideText, { color: colors.textSecondary, marginTop: 8 }]}>
                    Your saved items are securely stored in your personal bookmarks page (<Text style={{ fontWeight: '700', color: colors.textPrimary }}>Saved</Text> tab). This lets you quickly execute recurring morning coffees, tip your local baristas, or re-access token gated content without needing the physical tag in hand.
                  </Text>
                </View>

                <View style={[styles.guideCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                  <View style={styles.guideCardHeader}>
                    <Share2 size={22} color="#10B981" />
                    <Text style={[styles.guideCardTitle, { color: colors.textPrimary }]}>1-Click Social Sharing</Text>
                  </View>
                  <Text style={[styles.guideText, { color: colors.textSecondary }]}>
                    Click <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Share Blink</Text> to copy the direct URL or share directly to Twitter/X, Telegram, or WhatsApp. The link unwraps into a native dialect preview on any Solana Action compatible client!
                  </Text>
                </View>
              </View>
            )}

            {/* SECTION 6: FAQ & TROUBLESHOOTING */}
            {activeSection === 'faq' && (
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Frequently Asked Questions & Troubleshooting</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  Quick solutions to the most common questions and device issues.
                </Text>

                {[
                  {
                    q: 'I clicked "Sign in with Google" and nothing happened. How do I fix it?',
                    a: 'Modern browsers like Safari, Chrome, and Brave sometimes block popups automatically. To fix this, look at your address bar for a "Pop-up blocked" icon and choose "Always allow pop-ups for this site". We have also enabled direct OAuth redirection so clicking Google will navigate directly to the Google account chooser if a popup cannot be opened. You can also sign in via Email OTP with zero popups needed!',
                  },
                  {
                    q: 'Why does the logo stay black in light mode and white in dark mode?',
                    a: 'The Blink logo is dynamically styled according to your theme preference: in Dark Mode it shines in high-contrast crisp white, while in Light Mode it transforms into solid jet-black silhouette for maximum legibility against light backgrounds. You can switch themes at any time using the Sun/Moon toggle.',
                  },
                  {
                    q: 'My phone is not reading the NFC tag when I tap it. What should I check?',
                    a: '1. Ensure NFC is enabled in your device settings (Android: Settings > Connected devices > NFC. On iPhone XS or later, background tag reading is on by default).\n2. Tap the correct antenna spot: on iPhone, it is the top rim; on Android and Solana Seeker, it is the center back.\n3. Make sure your phone screen is turned ON and unlocked.\n4. Avoid placing NFC tags on raw metal surfaces (which detunes the RF field) unless you use anti-metal ferrite tags.',
                  },
                  {
                    q: 'Can I change my Blink price after deploying the tag on a counter or table?',
                    a: 'Yes, 100%! That is the superpower of Blink. The physical tag only holds the invariant redirect ID. When a customer taps, Blink fetches the live price directly from the database and Solana Action API in real time. You can change a $5 coffee to $4.50 in Studio, and the very next tap will charge $4.50 without touching the physical tag!',
                  },
                  {
                    q: 'How do network fees work on Blink?',
                    a: 'Blink operates on Solana Devnet where transactions require minimal network fees. You can view your wallet status directly in your Pocket tab.',
                  },
                  {
                    q: 'Are transactions on Blink non-custodial?',
                    a: 'Yes! Whether you connect via an external wallet (Phantom, Backpack, Solflare) or use Privy social login, your private keys are secured non-custodially via Multi-Party Computation (MPC). Neither Blink nor any server has custody of your funds.',
                  },
                ].map((item, idx) => {
                  const isExpanded = expandedFaqIndex === idx;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.faqCard,
                        { backgroundColor: colors.bgCard, borderColor: colors.border },
                        isExpanded && { borderColor: colors.accentBorder },
                      ]}
                      onPress={() => toggleFaq(idx)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.faqHeader}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <HelpCircle size={18} color={isExpanded ? colors.accent : colors.textMuted} />
                          <Text style={[styles.faqQuestion, { color: colors.textPrimary }]}>{item.q}</Text>
                        </View>
                        {isExpanded ? (
                          <ChevronUp size={18} color={colors.accent} />
                        ) : (
                          <ChevronDown size={18} color={colors.textMuted} />
                        )}
                      </View>
                      {isExpanded && (
                        <View style={[styles.faqAnswerBox, { borderTopColor: colors.border }]}>
                          <Text style={[styles.faqAnswerText, { color: colors.textSecondary }]}>{item.a}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.bgCard }]}>
          <Text style={[styles.footerHelpText, { color: colors.textMuted }]}>
            Need additional assistance or custom developer integration?
          </Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity
              style={[styles.footerLinkBtn, { backgroundColor: colors.bgPill, borderColor: colors.border }]}
              onPress={() => {
                if (typeof window !== 'undefined') window.open('https://solana.com/docs/advanced/actions', '_blank');
              }}
            >
              <ExternalLink size={13} color={colors.accent} />
              <Text style={[styles.footerLinkText, { color: colors.accent }]}>Solana Actions Spec</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.footerDoneBtn, { backgroundColor: colors.accent }]}
              onPress={onClose}
            >
              <Text style={styles.footerDoneText}>Back to App</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  modalContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalContainerDesktop: {
    height: '94%',
    maxHeight: 840,
    maxWidth: 990,
    borderRadius: 20,
    borderWidth: 1,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },
  modalContainerMobile: {
    height: '100%',
    maxHeight: '100%',
    borderRadius: 0,
    borderWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  versionPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  versionText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  searchBarRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    outlineStyle: 'none' as any,
  },
  searchResultsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  searchResultsTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  searchResultCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  searchResultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  searchResultCategory: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  searchResultItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  searchResultSnippet: {
    fontSize: 12,
    lineHeight: 16,
  },
  bodyWrapper: {
    flex: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  bodyWrapperMobile: {
    flexDirection: 'column',
  },
  sidebar: {
    width: 220,
    borderRightWidth: 1,
  },
  sidebarContent: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 4,
  },
  horizontalNav: {
    width: '100%',
    borderBottomWidth: 1,
  },
  horizontalNavContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  navItemDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navItemMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navItemActive: {},
  navItemText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionContainer: {
    gap: 18,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  heroBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  blockHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  paradigmBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  paradigmRow: {
    gap: 6,
  },
  paradigmLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paradigmTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  paradigmCode: {
    fontSize: 12,
    lineHeight: 18,
  },
  paradigmDivider: {
    height: 1,
    marginVertical: 4,
  },
  gridCards: {
    gap: 12,
  },
  featureCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  featureDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  guideCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  guideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  guideCardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  guideText: {
    fontSize: 13,
    lineHeight: 19,
  },
  calloutBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  calloutTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  antennaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  antennaText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  stepItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  chipPillGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  studioStepCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  studioStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  studioStepTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  studioStepBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  actionTypeGrid: {
    gap: 10,
    marginTop: 4,
  },
  actionTypeBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  actionTypeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionTypeDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  tipBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 6,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bulletList: {
    gap: 8,
    marginTop: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  faucetBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  faucetTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  faucetDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  codeSnippetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  codeSnippetText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    flex: 1,
  },
  copyBtn: {
    padding: 4,
    marginLeft: 8,
  },
  faqCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  faqAnswerBox: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  faqAnswerText: {
    fontSize: 13,
    lineHeight: 19,
  },
  codeBlockLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  codeBlock: {
    borderRadius: 12,
    padding: 14,
  },
  codeBlockContent: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#38BDF8',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerHelpText: {
    fontSize: 12,
    flex: 1,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  footerLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  footerDoneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  footerDoneText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
