import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Sparkles, Check, ArrowRight, User, AtSign, Shield, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { UserProfileService } from '../services/userProfileService';
import { DatabaseService } from '../services/databaseService';
import { ToastService } from '../services/toastService';
import { BlinkBrandMark } from './BrandLogos';
import { BlinkIdService } from '../services/blinkIdService';

import { MASCOT_AVATARS } from '../constants/mascotAvatars';

interface PickUsernameModalProps {
  visible: boolean;
  onClose: () => void;
  publicKey: string;
  initialSuggestedName?: string;
  initialAvatarUrl?: string;
}

export const PickUsernameModal: React.FC<PickUsernameModalProps> = ({
  visible,
  onClose,
  publicKey,
  initialSuggestedName,
  initialAvatarUrl,
}) => {
  const { colors, isDark } = useTheme();

  const defaultSuggest = initialSuggestedName || (publicKey ? `User_${publicKey.slice(-4)}` : 'Seeker Pioneer');
  const defaultUsername = (initialSuggestedName || (publicKey ? `user_${publicKey.slice(0, 6)}` : 'sol_builder'))
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');

  const [displayName, setDisplayName] = useState(defaultSuggest);
  const [username, setUsername] = useState(defaultUsername);
  const [selectedAvatar, setSelectedAvatar] = useState(initialAvatarUrl || UserProfileService.getRandomMascot());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [suggestedAlternative, setSuggestedAlternative] = useState<string | null>(null);

  // Debounced live username availability check
  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!visible) return;

    const cleanUser = username.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!cleanUser || cleanUser.length < 2) {
      setIsChecking(false);
      setIsAvailable(false);
      setErrorMsg('Username must be at least 2 characters.');
      setSuggestedAlternative(null);
      return;
    }

    setIsChecking(true);
    setErrorMsg(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await BlinkIdService.isUsernameAvailable(cleanUser, publicKey);
        setIsChecking(false);
        if (res.available) {
          setIsAvailable(true);
          setErrorMsg(null);
          setSuggestedAlternative(null);
        } else {
          setIsAvailable(false);
          setErrorMsg(res.reason || `@${cleanUser} is already claimed by another user.`);
          setSuggestedAlternative(res.suggested || null);
        }
      } catch (err) {
        setIsChecking(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [username, visible, publicKey]);

  if (!visible) return null;

  const handleConfirm = async () => {
    const cleanUser = username.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanDisplay = displayName.trim() || cleanUser || 'Seeker Pioneer';

    if (!cleanUser || cleanUser.length < 2) {
      setErrorMsg('Username must be at least 2 characters (letters, numbers, underscores).');
      return;
    }

    setIsChecking(true);
    const check = await BlinkIdService.isUsernameAvailable(cleanUser, publicKey);
    setIsChecking(false);

    if (!check.available && !check.isOwner) {
      setIsAvailable(false);
      setErrorMsg(check.reason || `Username @${cleanUser} is already taken by another user.`);
      if (check.suggested) setSuggestedAlternative(check.suggested);
      ToastService.error(`Username @${cleanUser} is taken by another user.`);
      return;
    }

    const updated = UserProfileService.setCustomIdentity(cleanDisplay, cleanUser, selectedAvatar);

    if (publicKey) {
      DatabaseService.saveUserAccount({
        id: publicKey,
        address: publicKey,
        publicKey,
        displayName: cleanDisplay,
        username: cleanUser,
        name: cleanDisplay,
        avatarUrl: updated.avatarUrl,
      });

      // Synchronize unique Blink ID to server
      BlinkIdService.registerBlinkId(`@${cleanUser}`, publicKey, cleanDisplay, updated.avatarUrl);
    }

    ToastService.success(`Welcome to Blink, @${cleanUser}!`);
    onClose();
  };

  return (
    <View style={styles.overlay}>
      <View
        style={[
          styles.modalCard,
          {
            backgroundColor: isDark ? '#0D0F19' : '#FFFFFF',
            borderColor: colors.border,
          },
        ]}
      >
        {/* Top Glow & Brand Header */}
        <View style={styles.header}>
          <View style={[styles.avatarBox, { backgroundColor: colors.accentSoft }]}>
            <Image source={{ uri: selectedAvatar }} style={styles.avatarImg} />
          </View>
          <View style={styles.titleGroup}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Choose Your Identity</Text>
              <Sparkles size={16} color={colors.accent} />
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Your random 3D mascot has been assigned! Tap any mascot to switch or keep it.
            </Text>
          </View>
        </View>

        {/* Mascot Avatar Selector */}
        <View style={styles.mascotSection}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>CHOOSE YOUR 3D MASCOT</Text>
          <View style={styles.mascotRow}>
            {MASCOT_AVATARS.map((m) => {
              const isSelected = selectedAvatar === m.uri;
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => setSelectedAvatar(m.uri)}
                  style={[
                    styles.mascotBtn,
                    { borderColor: isSelected ? colors.accent : colors.border },
                    isSelected && { backgroundColor: colors.accentSoft, transform: [{ scale: 1.08 }] },
                  ]}
                  activeOpacity={0.7}
                >
                  <Image source={{ uri: m.uri }} style={styles.mascotThumb} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Inputs */}
        <View style={styles.form}>
          {/* Display Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>DISPLAY NAME</Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.bgInput, borderColor: colors.border },
              ]}
            >
              <User size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="e.g. Satoshi Nakamoto"
                placeholderTextColor={colors.textMuted}
                value={displayName}
                onChangeText={(text) => {
                  setDisplayName(text);
                  setErrorMsg(null);
                }}
                maxLength={30}
              />
            </View>
          </View>

            {/* Username */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>UNIQUE USERNAME</Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.bgInput,
                    borderColor: isAvailable === false ? '#EF4444' : isAvailable === true ? '#10B981' : colors.border,
                  },
                ]}
              >
                <AtSign size={16} color={isAvailable === false ? '#EF4444' : isAvailable === true ? '#10B981' : colors.accent} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="username"
                  placeholderTextColor={colors.textMuted}
                  value={username}
                  onChangeText={(text) => {
                    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
                    setUsername(cleaned);
                    setErrorMsg(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={24}
                />
                {isChecking && (
                  <ActivityIndicator size="small" color={colors.accent} style={{ transform: [{ scale: 0.8 }] }} />
                )}
                {!isChecking && isAvailable === true && (
                  <CheckCircle2 size={16} color="#10B981" />
                )}
                {!isChecking && isAvailable === false && (
                  <AlertCircle size={16} color="#EF4444" />
                )}
              </View>

              {/* Live Availability Feedback Badge */}
              {isChecking ? (
                <Text style={[styles.statusHint, { color: colors.textMuted }]}>Checking availability...</Text>
              ) : isAvailable === true && username.trim().length >= 2 ? (
                <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                  <CheckCircle2 size={12} color="#10B981" />
                  <Text style={[styles.statusText, { color: '#10B981' }]}>
                    @{username.trim()} is available!
                  </Text>
                </View>
              ) : isAvailable === false && errorMsg ? (
                <View style={{ gap: 6 }}>
                  <View style={[styles.statusBadge, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                    <AlertCircle size={12} color="#EF4444" />
                    <Text style={[styles.statusText, { color: '#EF4444' }]}>
                      {errorMsg}
                    </Text>
                  </View>
                  {suggestedAlternative && (
                    <TouchableOpacity
                      style={[styles.suggestionChip, { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder }]}
                      onPress={() => {
                        setUsername(suggestedAlternative);
                        setErrorMsg(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <RefreshCw size={12} color={colors.accent} />
                      <Text style={[styles.suggestionText, { color: colors.accent }]}>
                        Tap to use available: <Text style={{ fontWeight: '800' }}>@{suggestedAlternative}</Text>
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <Text style={[styles.helperText, { color: colors.textMuted }]}>
                  Must be unique across all Blink users. Letters, numbers, and underscores only.
                </Text>
              )}
            </View>

            {/* Preview Badge */}
            <View style={[styles.previewBadge, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
              <Text style={[styles.previewLabel, { color: colors.textMuted }]}>PREVIEW:</Text>
              <Text style={[styles.previewName, { color: colors.textPrimary }]}>
                {displayName.trim() || 'Your Name'}
              </Text>
              <Text style={[styles.previewUser, { color: colors.accent }]}>
                @{username.trim() || 'username'}
              </Text>
            </View>

            {/* Confirm Button */}
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                {
                  backgroundColor:
                    isAvailable === false
                      ? (isDark ? '#262938' : '#CBD5E1')
                      : colors.accent,
                },
              ]}
              onPress={handleConfirm}
              activeOpacity={isAvailable === false ? 1 : 0.8}
              disabled={isAvailable === false || isChecking}
            >
              <Text style={[styles.confirmBtnText, isAvailable === false && { color: colors.textMuted }]}>
                {isChecking ? 'Verifying...' : isAvailable === false ? 'Username Taken — Choose Another' : 'Save & Start Exploring'}
              </Text>
              {isAvailable !== false && <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />}
            </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 99998,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 24,
    gap: 20,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  titleGroup: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    outlineStyle: 'none' as any,
  },
  helperText: {
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 3,
  },
  statusHint: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  previewName: {
    fontSize: 13,
    fontWeight: '700',
  },
  previewUser: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
    shadowColor: '#5B67F6',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  mascotSection: {
    gap: 8,
  },
  mascotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mascotBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mascotThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
});
