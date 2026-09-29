import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import {
  Store,
  Plus,
  Radio,
  QrCode,
  ExternalLink,
  Edit3,
  Save,
  X,
  Copy,
  Check,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Tag,
  DollarSign,
  Layers,
  Printer,
  Download,
  Lock,
  ArrowRight,
  Users,
} from 'lucide-react-native';
import { QRCodeSVG } from 'qrcode.react';
import {
  PhysicalBlinkRegistry,
  PhysicalBlink,
  ActionType,
} from '../services/physicalBlinkRegistry';
import { NfcService } from '../services/nfcService';
import { ToastService } from '../services/toastService';
import { PrintableCardService } from '../services/printableCardService';
import { WalletAccount } from '../services/walletProviderService';
import {
  BlinkBrandMark,
  CoffeeShopLogo,
  MusicianLogo,
  HackerHouseLogo,
} from '../components/BrandLogos';
import { useTheme } from '../theme/ThemeContext';

interface StudioScreenProps {
  activeAccount: WalletAccount | null;
  onOpenWalletConnect: () => void;
  onOpenCreateBlinkModal?: () => void;
  onSelectBlink?: (blink: PhysicalBlink) => void;
  onOpenSend?: (recipientAddress?: string) => void;
}

export const StudioScreen: React.FC<StudioScreenProps> = ({
  activeAccount,
  onOpenWalletConnect,
  onOpenCreateBlinkModal,
  onSelectBlink,
  onOpenSend,
}) => {
  const { colors, isDark } = useTheme();
  const [blinks, setBlinks] = useState<PhysicalBlink[]>(() =>
    PhysicalBlinkRegistry.loadRegistry()
  );
  const [showCreateForm, setShowCreateForm] = useState(false);

  // New Blink Form State
  const [formName, setFormName] = useState('');
  const [formActionType, setFormActionType] = useState<ActionType>('payment');
  const [formAmount, setFormAmount] = useState('5.00');
  const [formToken, setFormToken] = useState<'USDC' | 'SOL'>('USDC');
  const [formPhysicalId, setFormPhysicalId] = useState('');
  const [formRecipient, setFormRecipient] = useState(activeAccount?.publicKey || '');
  const [formDomain, setFormDomain] = useState('');
  const [formDesc, setFormDesc] = useState('');

  // Editing state for live Action updates
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // QR Modal
  const [selectedBlinkForQr, setSelectedBlinkForQr] = useState<PhysicalBlink | null>(null);
  const [isDownloadingCard, setIsDownloadingCard] = useState(false);
  const [cardCopied, setCardCopied] = useState(false);

  // Feedback states
  const [beamingId, setBeamingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Removed local successToast; using global ToastService

  useEffect(() => {
    setBlinks(PhysicalBlinkRegistry.loadRegistry(true));
    PhysicalBlinkRegistry.syncFromCloud().then(() => {
      setBlinks([...PhysicalBlinkRegistry.loadRegistry(true)]);
    });

    const handleUpdate = (e?: any) => {
      const updatedItem = e?.detail;
      if (updatedItem && updatedItem.id && !Array.isArray(updatedItem)) {
        setBlinks(prev =>
          prev.map(b => (b.id.toLowerCase() === updatedItem.id.toLowerCase() ? { ...b, ...updatedItem } : b))
        );
      } else {
        setBlinks([...PhysicalBlinkRegistry.loadRegistry(true)]);
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

  useEffect(() => {
    if (activeAccount?.publicKey && !formRecipient) {
      setFormRecipient(activeAccount.publicKey);
    }
  }, [activeAccount]);

  const showToast = (msg: string) => {
    ToastService.show(msg);
  };

  // Compute aggregate analytics
  const totalBlinks = blinks.length;
  const totalInteractions = blinks.reduce((sum, b) => sum + b.stats.taps, 0);
  const totalCompleted = blinks.reduce((sum, b) => sum + b.stats.completed, 0);
  const totalVolume = blinks.reduce((sum, b) => sum + b.stats.volumeUsdc, 0);

  const handleCreateBlink = () => {
    if (!activeAccount?.publicKey) {
      ToastService.error('Please sign in with Privy to create and deploy Blinks.');
      onOpenWalletConnect();
      return;
    }

    if (!formName.trim()) {
      showToast('Please provide a name for this Physical Blink.');
      return;
    }
    const cleanId =
      formPhysicalId.trim() ||
      formName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
    const amountVal = parseFloat(formAmount) || 0;
    const recipientVal =
      formRecipient.trim() ||
      activeAccount.publicKey;

    const created = PhysicalBlinkRegistry.createBlink({
      id: cleanId,
      name: formName.trim(),
      actionType: formActionType,
      amount: amountVal,
      token: formToken,
      recipient: recipientVal,
      creatorAddress: activeAccount.publicKey,
      description: formDesc.trim() || `${formActionType.toUpperCase()} interaction`,
      verifiedDomain: formDomain.trim() || undefined,
      visibility: 'global',
    });

    setBlinks(PhysicalBlinkRegistry.loadRegistry());
    setShowCreateForm(false);
    showToast(`Physical Blink "${created.name}" deployed!`);

    // Reset Form
    setFormName('');
    setFormPhysicalId('');
    setFormAmount('5.00');
    setFormDomain('');
    setFormDesc('');
  };

  const startEdit = (b: PhysicalBlink) => {
    setEditingId(b.id);
    setEditAmount(b.amount.toString());
    setEditDesc(b.description);
  };

  const saveEdit = (id: string) => {
    const sanitized = editAmount.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(sanitized);
    if (isNaN(parsed) || parsed <= 0) {
      showToast('Please enter a valid price greater than $0.00');
      return;
    }
    const updated = PhysicalBlinkRegistry.updateAction(id, {
      amount: parsed,
      description: editDesc.trim(),
    });
    if (updated) {
      setBlinks(prev =>
        prev.map(b => (b.id.toLowerCase() === id.toLowerCase() ? { ...b, ...updated } : b))
      );
      showToast(`Price updated to $${updated.amount.toFixed(2)} ${updated.token}`);
    } else {
      showToast('Failed to update Blink price.');
    }
    setEditingId(null);
  };

  const handleBeamToTag = async (b: PhysicalBlink) => {
    setBeamingId(b.id);
    const targetUrl = `https://blink.so/t/${b.id}`;

    const res = await NfcService.writeTag({
      url: targetUrl,
      title: b.name,
      id: b.id,
    });

    setBeamingId(null);
    if (res.success) {
      showToast(`Wrote "${b.name}" to physical NFC tag!`);
    } else {
      showToast(res.message);
    }
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (success) return true;
      }
    } catch {}
    return false;
  };

  const handleCopyLink = async (blinkOrId: PhysicalBlink | string) => {
    let url: string;
    let id: string;
    if (typeof blinkOrId === 'string') {
      id = blinkOrId;
      const b = blinks.find(x => x.id === id);
      url = b ? PhysicalBlinkRegistry.getShareableUrl(b) : (typeof window !== 'undefined' ? `${window.location.origin}/t/${id}` : `https://blink.so/t/${id}`);
    } else {
      id = blinkOrId.id;
      url = PhysicalBlinkRegistry.getShareableUrl(blinkOrId);
    }
    const copied = await copyToClipboard(url);
    if (copied) {
      setCopiedId(id);
      ToastService.success(`Blink link copied to clipboard.`);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      ToastService.error('Failed to copy link to clipboard');
    }
  };

  const getBlinkLogo = (id: string) => {
    if (id.includes('coffee')) return <CoffeeShopLogo size={42} />;
    if (id.includes('tip') || id.includes('music')) return <MusicianLogo size={42} />;
    if (id.includes('pass') || id.includes('event')) return <HackerHouseLogo size={42} />;
    return <BlinkBrandMark size={42} />;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Studio Header Card */}
      <View style={[styles.introCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.introTopRow}>
          <View style={styles.introTag}>
            <Store size={12} color={colors.accent} />
            <Text style={[styles.introTagText, { color: colors.accent }]}>PROGRAMMABLE PHYSICAL LAYER</Text>
          </View>
        </View>
        <Text style={[styles.introTitle, { color: colors.textPrimary }]}>Blink Studio</Text>
        <Text style={[styles.introSubtitle, { color: colors.textSecondary }]}>
          Program physical objects as interfaces for Solana Actions. The physical NFC or QR tag never needs replacement — the Action behind it updates instantly on-chain.
        </Text>
      </View>

      {/* Toast Notification */}
      {/* Toast handled globally via ToastService */}

      {/* Studio Analytics Grid matching Markets Screen numbers */}
      <View style={[styles.analyticsCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.analyticsHeader}>
          <TrendingUp size={14} color={colors.textSecondary} />
          <Text style={[styles.analyticsTitle, { color: colors.textSecondary }]}>STUDIO METRICS</Text>
        </View>
        <View style={styles.analyticsGrid}>
          <View style={styles.metricBox}>
            <Text style={[styles.metricNumber, { color: colors.textPrimary }]}>{totalBlinks}</Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Active Blinks</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={[styles.metricNumber, { color: colors.textPrimary }]}>{totalInteractions}</Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Total Taps</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={[styles.metricNumber, { color: colors.textPrimary }]}>{totalCompleted}</Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Completed</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={[styles.metricNumber, { color: '#10B981' }]}>
              ${totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Volume (USDC)</Text>
          </View>
        </View>
      </View>

      {/* Guest Mode Warning Banner */}
      {!activeAccount?.publicKey && (
        <TouchableOpacity
          style={[styles.guestBanner, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
          onPress={onOpenWalletConnect}
          activeOpacity={0.8}
        >
          <Lock size={16} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.guestBannerTitle, { color: colors.accent }]}>Guest Mode Active</Text>
            <Text style={[styles.guestBannerSub, { color: colors.textSecondary }]}>
              Sign in with Privy to create, deploy, and manage your Physical Blinks across all devices.
            </Text>
          </View>
          <ArrowRight size={14} color={colors.accent} />
        </TouchableOpacity>
      )}

      {/* Action Row & Create Form Toggle */}
      <View style={styles.actionBar}>
        <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>DEPLOYED PHYSICAL BLINKS</Text>
        <TouchableOpacity
          style={styles.createToggleBtn}
          onPress={() => {
            if (!activeAccount?.publicKey) {
              ToastService.error('Please sign in or connect your wallet to create a Blink.');
              onOpenWalletConnect();
              return;
            }
            if (onOpenCreateBlinkModal) {
              onOpenCreateBlinkModal();
            } else {
              setShowCreateForm(!showCreateForm);
            }
          }}
          activeOpacity={0.8}
        >
          {showCreateForm && !onOpenCreateBlinkModal ? (
            <>
              <X size={14} color="#FFFFFF" />
              <Text style={styles.createToggleText}>Cancel</Text>
            </>
          ) : (
            <>
              <Plus size={14} color="#FFFFFF" />
              <Text style={styles.createToggleText}>New Physical Blink</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Create Form */}
      {showCreateForm && (
        <View style={[styles.formCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.formHeader}>
            <Sparkles size={16} color={colors.accent} />
            <Text style={[styles.formTitle, { color: colors.textPrimary }]}>Register Physical Blink</Text>
          </View>

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>BLINK NAME</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.textPrimary }]}
            value={formName}
            onChangeText={(text) => {
              setFormName(text);
              if (!formPhysicalId) {
                setFormPhysicalId(text.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 24));
              }
            }}
            placeholder="e.g. Dean's Artisan Espresso"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>ACTION TYPE</Text>
          <View style={styles.actionTypeGrid}>
            {(['payment', 'tip', 'donation', 'event-pass', 'voting'] as ActionType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.actionTypeBtn,
                  { backgroundColor: colors.bgCardAlt, borderColor: colors.border },
                  formActionType === t && styles.actionTypeBtnActive,
                ]}
                onPress={() => setFormActionType(t)}
              >
                <Text
                  style={[
                    styles.actionTypeBtnText,
                    { color: colors.textSecondary },
                    formActionType === t && styles.actionTypeBtnTextActive,
                  ]}
                >
                  {t.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.splitRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>AMOUNT</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.textPrimary }]}
                value={formAmount}
                onChangeText={setFormAmount}
                keyboardType="decimal-pad"
                placeholder="5.00"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={{ width: 110 }}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>CURRENCY</Text>
              <View style={[styles.tokenPillRow, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.tokenPill, formToken === 'USDC' && styles.tokenPillActive]}
                  onPress={() => setFormToken('USDC')}
                >
                  <Text style={[styles.tokenPillText, { color: colors.textSecondary }, formToken === 'USDC' && styles.tokenPillTextActive]}>
                    USDC
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tokenPill, formToken === 'SOL' && styles.tokenPillActive]}
                  onPress={() => setFormToken('SOL')}
                >
                  <Text style={[styles.tokenPillText, { color: colors.textSecondary }, formToken === 'SOL' && styles.tokenPillTextActive]}>
                    SOL
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>UNIQUE PHYSICAL IDENTIFIER</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.textPrimary }]}
            value={formPhysicalId}
            onChangeText={setFormPhysicalId}
            placeholder="e.g. coffee-counter-01"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>VERIFIED DOMAIN (OPTIONAL)</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.textPrimary }]}
            value={formDomain}
            onChangeText={setFormDomain}
            placeholder="e.g. deanscoffee.xyz"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />

          <TouchableOpacity style={styles.submitBtn} onPress={handleCreateBlink} activeOpacity={0.8}>
            <Check size={16} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>Deploy Physical Blink</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Deployed Blinks List */}
      <View style={styles.blinksList}>
        {blinks.length > 0 ? (
          blinks.map((blink) => {
          const isEditing = editingId === blink.id;
          const isBeaming = beamingId === blink.id;

          return (
            <View key={blink.id} style={[styles.blinkCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              {/* Card Top Row */}
              <View style={styles.cardTopRow}>
                <View style={styles.cardLogoWrap}>
                  {getBlinkLogo(blink.id)}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{blink.name}</Text>
                  <View style={styles.cardTagRow}>
                    <Text style={[styles.idTagText, { color: colors.textSecondary }]}>/t/{blink.id}</Text>
                    {blink.visibility === 'global' ? (
                      <View style={[styles.verifiedBadge, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.accent }}>Global</Text>
                      </View>
                    ) : (
                      <View style={[styles.verifiedBadge, { backgroundColor: '#F59E0B22', borderColor: '#F59E0B' }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#F59E0B' }}>In-Person</Text>
                      </View>
                    )}
                    {blink.verifiedDomain && (
                      <View style={styles.verifiedBadge}>
                        <ShieldCheck size={11} color="#10B981" />
                        <Text style={styles.verifiedText}>{blink.verifiedDomain}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Amount Display with tap-to-edit */}
                <TouchableOpacity
                  style={styles.cardAmountCol}
                  onPress={() => startEdit(blink)}
                  activeOpacity={0.7}
                  accessibilityLabel="Edit Blink price"
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.cardAmount, { color: colors.textPrimary }]}>${blink.amount.toFixed(2)}</Text>
                    <Edit3 size={12} color={colors.accent} />
                  </View>
                  <Text style={[styles.cardToken, { color: colors.textMuted }]}>{blink.token}</Text>
                </TouchableOpacity>
              </View>

              {/* Editable Description & Price Form */}
              {!isEditing ? (
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{blink.description}</Text>
              ) : (
                <View style={[styles.editSection, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
                  <View style={styles.editSectionHeader}>
                    <Edit3 size={12} color={colors.accent} />
                    <Text style={[styles.editSectionTitle, { color: colors.textPrimary }]}>EDIT PRICE & ACTION</Text>
                  </View>

                  <Text style={[styles.editFieldLabel, { color: colors.textSecondary }]}>PRICE ({blink.token})</Text>
                  <View style={[styles.editPriceInputRow, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
                    <Text style={[styles.editDollarSign, { color: colors.textPrimary }]}>$</Text>
                    <TextInput
                      style={[styles.editPriceField, { backgroundColor: 'transparent', color: colors.textPrimary }]}
                      value={editAmount}
                      onChangeText={setEditAmount}
                      keyboardType="decimal-pad"
                      onSubmitEditing={() => saveEdit(blink.id)}
                      returnKeyType="done"
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                    />
                    <View style={styles.editPresets}>
                      {[-1, 1, 5].map((delta) => (
                        <TouchableOpacity
                          key={delta}
                          style={[styles.editPresetPill, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                          onPress={() => {
                            const cur = parseFloat(editAmount) || blink.amount;
                            setEditAmount(Math.max(0.5, cur + delta).toFixed(2));
                          }}
                        >
                          <Text style={[styles.editPresetText, { color: colors.textPrimary }]}>{delta > 0 ? `+${delta}` : `${delta}`}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <Text style={[styles.editFieldLabel, { color: colors.textSecondary }]}>DESCRIPTION</Text>
                  <TextInput
                    style={[styles.editDescInput, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.textPrimary }]}
                    value={editDesc}
                    onChangeText={setEditDesc}
                    placeholder="Action description"
                    placeholderTextColor={colors.textMuted}
                  />

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <TouchableOpacity style={styles.saveEditBtn} onPress={() => saveEdit(blink.id)}>
                      <Check size={14} color="#FFFFFF" />
                      <Text style={styles.saveEditText}>Save Price</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.cancelEditBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={() => setEditingId(null)}>
                      <Text style={[styles.cancelEditText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Stats Bar */}
              <View style={[styles.statsBar, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{blink.stats.taps}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Taps</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{blink.stats.completed}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Completed</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: '#10B981' }]}>
                    ${blink.stats.volumeUsdc.toFixed(2)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Volume</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.cardActionRow}>
                <TouchableOpacity
                  style={styles.actionBtnPrimary}
                  onPress={() => handleBeamToTag(blink)}
                  activeOpacity={0.8}
                >
                  <Radio size={14} color="#FFFFFF" />
                  <Text style={styles.actionBtnPrimaryText}>
                    {isBeaming ? 'Writing...' : 'Write NFC'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtnSecondary, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                  onPress={() => setSelectedBlinkForQr(blink)}
                  activeOpacity={0.8}
                >
                  <QrCode size={14} color={colors.textPrimary} />
                  <Text style={[styles.actionBtnSecondaryText, { color: colors.textPrimary }]}>QR Code</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtnSecondary, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                  onPress={async () => {
                    const ok = await PrintableCardService.downloadCard(blink);
                    if (ok) {
                      ToastService.success('Printable placard downloaded.');
                    } else {
                      ToastService.error('Failed to download card.');
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Printer size={14} color={colors.textPrimary} />
                  <Text style={[styles.actionBtnSecondaryText, { color: colors.textPrimary }]}>Print Card</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtnSecondary, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
                  onPress={() => onSelectBlink?.(blink)}
                  activeOpacity={0.8}
                >
                  <Users size={14} color={colors.accent} />
                  <Text style={[styles.actionBtnSecondaryText, { color: colors.accent, fontWeight: '700' }]}>
                    Payers
                  </Text>
                </TouchableOpacity>

                {/* Edit Price: Only show for the creator of this Blink */}
                {Boolean(activeAccount?.publicKey && (activeAccount.publicKey === blink.recipient || (blink as any).creatorAddress === activeAccount.publicKey)) && !isEditing && (
                  <TouchableOpacity
                    style={styles.actionBtnEditPrice}
                    onPress={() => startEdit(blink)}
                    activeOpacity={0.8}
                  >
                    <Edit3 size={13} color="#5B67F6" />
                    <Text style={styles.actionBtnEditPriceText}>Edit Price</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionBtnIcon, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                  onPress={() => handleCopyLink(blink.id)}
                  activeOpacity={0.8}
                >
                  {copiedId === blink.id ? (
                    <Check size={14} color="#10B981" />
                  ) : (
                    <Copy size={14} color={colors.textPrimary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })
        ) : (
          <View style={[styles.emptyBox, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
            <BlinkBrandMark size={48} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Physical Blinks Deployed</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Create your first physical blink to encode an NFC tag or generate a printable QR code linked to on-chain Solana Actions.
            </Text>
            <TouchableOpacity
              style={[styles.emptyCreateBtn, { backgroundColor: colors.accent }]}
              onPress={() => {
                if (!activeAccount?.publicKey) {
                  ToastService.error('Please sign in or connect your wallet to create a Blink.');
                  onOpenWalletConnect();
                  return;
                }
                if (onOpenCreateBlinkModal) {
                  onOpenCreateBlinkModal();
                } else {
                  setShowCreateForm(true);
                }
              }}
              activeOpacity={0.8}
            >
              <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.emptyCreateBtnText}>Create Physical Blink</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* QR Code Modal with Printable Placard Download Option */}
      <Modal
        visible={!!selectedBlinkForQr}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBlinkForQr(null)}
      >
        <View style={[styles.qrModalOverlay, { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.78)' : 'rgba(15, 23, 42, 0.52)' }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setSelectedBlinkForQr(null)}
          />
          {selectedBlinkForQr && (
            <View style={[styles.qrModalCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              {/* Header with Badges & Close Button */}
              <View style={styles.qrModalHeader}>
                <View style={styles.qrBadgeRow}>
                  <View style={[styles.qrActionBadge, { backgroundColor: 'rgba(91, 103, 246, 0.12)', borderColor: 'rgba(91, 103, 246, 0.25)' }]}>
                    <Text style={styles.qrActionBadgeText}>
                      {(selectedBlinkForQr.actionType || 'PAYMENT').toUpperCase()}
                    </Text>
                  </View>
                  <View style={[styles.qrPriceBadge, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
                    <Text style={[styles.qrPriceBadgeText, { color: colors.textPrimary }]}>
                      {selectedBlinkForQr.token === 'SOL'
                        ? `${selectedBlinkForQr.amount} SOL`
                        : `$${selectedBlinkForQr.amount.toFixed(2)} USDC`}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedBlinkForQr(null)}
                  style={[styles.closeBtnCircle, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <X size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Title & Domain/Recipient info */}
              <Text style={[styles.qrModalTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                {selectedBlinkForQr.name}
              </Text>

              {selectedBlinkForQr.verifiedDomain ? (
                <View style={styles.domainRow}>
                  <ShieldCheck size={13} color="#10B981" />
                  <Text style={styles.domainText}>{selectedBlinkForQr.verifiedDomain}</Text>
                </View>
              ) : (
                <Text style={[styles.qrModalRecipient, { color: colors.textSecondary }]}>
                  {selectedBlinkForQr.recipient.slice(0, 6)}...{selectedBlinkForQr.recipient.slice(-6)}
                </Text>
              )}

              {/* High-Resolution QR Box */}
              <View style={styles.qrBox}>
                <QRCodeSVG
                  value={PhysicalBlinkRegistry.getShareableUrl(selectedBlinkForQr)}
                  size={200}
                  level="H"
                  bgColor="#FFFFFF"
                  fgColor="#0A0C10"
                />
              </View>

              {/* Shareable Link Pill with Copy */}
              <TouchableOpacity
                style={[styles.qrLinkPill, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                onPress={async () => {
                  const url = PhysicalBlinkRegistry.getShareableUrl(selectedBlinkForQr);
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    await navigator.clipboard.writeText(url);
                    setCardCopied(true);
                    ToastService.success('Blink URL copied to clipboard.');
                    setTimeout(() => setCardCopied(false), 2000);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.qrLinkPillText, { color: colors.textSecondary }]} numberOfLines={1}>
                  blink.so/t/{selectedBlinkForQr.id}
                </Text>
                {cardCopied ? (
                  <Check size={14} color="#10B981" />
                ) : (
                  <Copy size={14} color={colors.accent} />
                )}
              </TouchableOpacity>

              <Text style={[styles.qrModalSub, { color: colors.textSecondary }]}>
                Scan with device camera or tap physical NFC tag to execute on Solana.
              </Text>

              {/* Save Printable Card Placard Button */}
              <TouchableOpacity
                style={[styles.qrModalDownloadBtn, { backgroundColor: colors.accent }]}
                onPress={async () => {
                  if (isDownloadingCard) return;
                  setIsDownloadingCard(true);
                  try {
                    const ok = await PrintableCardService.downloadCard(selectedBlinkForQr);
                    if (ok) ToastService.success('Printable card downloaded.');
                    else ToastService.error('Failed to download printable card.');
                  } finally {
                    setIsDownloadingCard(false);
                  }
                }}
                disabled={isDownloadingCard}
                activeOpacity={0.8}
              >
                <Printer size={16} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.qrModalDownloadText}>
                  {isDownloadingCard ? 'Generating High-Res Card...' : 'Save Printable Card Image (PNG)'}
                </Text>
              </TouchableOpacity>

              {/* Done Button */}
              <TouchableOpacity
                style={[styles.qrModalDoneBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}
                onPress={() => setSelectedBlinkForQr(null)}
                activeOpacity={0.8}
              >
                <Text style={[styles.qrModalDoneText, { color: colors.textPrimary }]}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080B',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxWidth: 680,
    width: '100%',
    marginHorizontal: 'auto',
  },
  introCard: {
    backgroundColor: '#0F111A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 18,
    marginBottom: 16,
  },
  introTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  introTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(91, 103, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  introTagText: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  introTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  introSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F111A',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  analyticsCard: {
    backgroundColor: '#0F111A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 18,
    marginBottom: 20,
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  analyticsTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  analyticsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricBox: {
    alignItems: 'center',
  },
  metricNumber: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionHeading: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  createToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#5B67F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  createToggleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: '#0F111A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 18,
    marginBottom: 20,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  inputLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#12141F',
    borderWidth: 1,
    borderColor: '#1D212E',
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionTypeBtn: {
    backgroundColor: '#12141F',
    borderWidth: 1,
    borderColor: '#1D212E',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionTypeBtnActive: {
    backgroundColor: '#5B67F6',
    borderColor: '#5B67F6',
  },
  actionTypeBtnText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  actionTypeBtnTextActive: {
    color: '#FFFFFF',
  },
  splitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tokenPillRow: {
    flexDirection: 'row',
    backgroundColor: '#12141F',
    borderWidth: 1,
    borderColor: '#1D212E',
    borderRadius: 12,
    padding: 3,
    height: 42,
    alignItems: 'center',
  },
  tokenPill: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  tokenPillActive: {
    backgroundColor: '#5B67F6',
  },
  tokenPillText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  tokenPillTextActive: {
    color: '#FFFFFF',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#5B67F6',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 18,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  blinksList: {
    gap: 14,
  },
  blinkCard: {
    backgroundColor: '#0F111A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 18,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLogoWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  cardTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  idTagText: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  verifiedText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  cardAmountCol: {
    alignItems: 'flex-end',
  },
  cardAmount: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  cardToken: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
  },
  cardDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  editSection: {
    marginTop: 12,
    gap: 8,
  },
  editInput: {
    backgroundColor: '#12141F',
    borderWidth: 1,
    borderColor: '#1D212E',
    borderRadius: 10,
    color: '#FFFFFF',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#5B67F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveEditText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelEditBtn: {
    backgroundColor: '#181B27',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cancelEditText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#12141F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1D212E',
    paddingVertical: 10,
    paddingHorizontal: 14,
    justifyContent: 'space-around',
    marginTop: 14,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 1,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  actionBtnPrimary: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#5B67F6',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#12141F',
    borderWidth: 1,
    borderColor: '#1D212E',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  actionBtnSecondaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtnIcon: {
    backgroundColor: '#12141F',
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 9,
    borderRadius: 10,
  },
  actionBtnEditPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(91, 103, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(91, 103, 246, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
  },
  actionBtnEditPriceText: {
    color: '#5B67F6',
    fontSize: 12,
    fontWeight: '700',
  },
  editSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  editSectionTitle: {
    color: '#5B67F6',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  editFieldLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  editPriceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#08090D',
    borderWidth: 1,
    borderColor: '#1D212E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editDollarSign: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginRight: 4,
  },
  editPriceField: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  editPresets: {
    flexDirection: 'row',
    gap: 4,
  },
  editPresetPill: {
    backgroundColor: '#161926',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#242B3F',
  },
  editPresetText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  editDescInput: {
    backgroundColor: '#08090D',
    borderWidth: 1,
    borderColor: '#1D212E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 13,
  },
  qrModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  qrModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  qrBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qrActionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  qrActionBadgeText: {
    color: '#5B67F6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  qrPriceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  qrPriceBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  closeBtnCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  domainText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  qrModalRecipient: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrLinkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
    maxWidth: '90%',
  },
  qrLinkPillText: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  qrModalSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  qrModalDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#5B67F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  qrModalDownloadText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  qrModalDoneBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 10,
  },
  qrModalDoneText: {
    fontSize: 14,
    fontWeight: '700',
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
    maxWidth: 340,
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
