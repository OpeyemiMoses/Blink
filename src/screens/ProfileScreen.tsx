import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  User,
  Check,
  Camera,
  Image as ImageIcon,
  Copy,
  ExternalLink,
  Shield,
  Mail,
  Globe,
  Code2,
  Share2,
  MessageSquare,
  Send,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Sparkles,
  Pencil,
  X as XIcon,
  Smartphone,
  Key,
  Moon,
  Sun,
  Fingerprint,
  Flame,
} from 'lucide-react-native';
import { BiometricService } from '../services/biometricService';
import { usePrivy, useExportWallet } from '../auth/privyAdapter';
import { UserProfileService, UserProfile, DEFAULT_AVATARS, LinkedAccounts } from '../services/userProfileService';
import { StreakService } from '../services/streakService';
import { MASCOT_AVATARS } from '../constants/mascotAvatars';
import { DatabaseService } from '../services/databaseService';
import { ToastService } from '../services/toastService';
import { BlinkBrandMark } from '../components/BrandLogos';
import { WalletAccount } from '../services/walletProviderService';
import { PrivyIcon } from '../components/PrivyIcon';
import { BlinkIdService } from '../services/blinkIdService';
import {
  EmailLogo,
  GoogleLogo,
  GithubLogo,
  XLogo,
  DiscordLogo,
  TelegramLogo,
} from '../components/SocialLogos';
import { useTheme } from '../theme/ThemeContext';

interface ProfileScreenProps {
  activeAccount: WalletAccount | null;
  onOpenWalletConnect: () => void;
  network: string;
  onOpenAbout?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  activeAccount,
  onOpenWalletConnect,
  network,
  onOpenAbout,
}) => {
  const { colors, isDark, theme, setTheme } = useTheme();
  const {
    user,
    login,
    logout,
    authenticated,
    linkEmail,
    linkGoogle,
    linkGithub,
    linkTwitter,
    linkDiscord,
    linkTelegram,
    unlinkEmail,
    unlinkGoogle,
    unlinkGithub,
    unlinkTwitter,
    unlinkDiscord,
    unlinkTelegram,
  } = usePrivy();



  const [profile, setProfile] = useState<UserProfile>(() => UserProfileService.getProfile());
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);

  const [copiedAddress, setCopiedAddress] = useState(false);
  const [activeBindingProvider, setActiveBindingProvider] = useState<keyof LinkedAccounts | null>(null);
  const [bindingInput, setBindingInput] = useState('');
  const [toast, setToast] = useState<import('../services/toastService').ToastMessage | null>(null);
  const [bioEnabled, setBioEnabled] = useState<boolean>(() => BiometricService.isBiometricsEnabled());
  const [isAuthenticatingBio, setIsAuthenticatingBio] = useState<boolean>(false);

  const handleToggleBiometrics = async (targetState: boolean) => {
    if (bioEnabled === targetState || isAuthenticatingBio) return;
    setIsAuthenticatingBio(true);
    try {
      const res = await BiometricService.toggleBiometricsWithAuth(targetState);
      if (res.success) {
        setBioEnabled(targetState);
        ToastService.success(targetState ? 'Biometric security enabled (ON)' : 'Biometric security disabled (OFF)');
      } else {
        ToastService.error(res.error || 'Biometric authentication failed or cancelled.');
      }
    } catch (err: any) {
      ToastService.error(err?.message || 'Biometric verification failed.');
    } finally {
      setIsAuthenticatingBio(false);
    }
  };
  const [streakStatus, setStreakStatus] = useState(() => StreakService.getClockInStatus());
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockInModalOpen, setIsClockInModalOpen] = useState(false);

  useEffect(() => {
    const updateStreak = () => {
      setStreakStatus(StreakService.getClockInStatus());
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('blink_streak_updated', updateStreak);
      window.addEventListener('tapblink_streak_updated', updateStreak);
    }
    const timer = setInterval(updateStreak, 30000);
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('blink_streak_updated', updateStreak);
        window.removeEventListener('tapblink_streak_updated', updateStreak);
      }
      clearInterval(timer);
    };
  }, []);

  const handleClockIn = async () => {
    if (isClockingIn || !streakStatus.canClockIn) return;
    setIsClockingIn(true);
    try {
      const res = await StreakService.clockIn(activeAccount?.publicKey || username);
      setStreakStatus(StreakService.getClockInStatus());
      if (res.success) {
        ToastService.success(res.message);
      } else {
        ToastService.info(res.message);
      }
    } catch (err: any) {
      ToastService.error(err?.message || 'Clock in failed. Please try again.');
    } finally {
      setIsClockingIn(false);
    }
  };

  // Profile edit panel: hidden by default once profile is saved, shown for new users
  const [isEditingProfile, setIsEditingProfile] = useState(() => !profile.hasCustomizedProfile);

  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [suggestedAlternative, setSuggestedAlternative] = useState<string | null>(null);
  const usernameDebounceRef = useRef<any>(null);

  useEffect(() => {
    if (!isEditingProfile) return;

    const cleanUser = username.trim().replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!cleanUser || cleanUser.length < 2) {
      setIsCheckingUsername(false);
      setIsUsernameAvailable(false);
      setUsernameError('Username must be at least 2 characters.');
      setSuggestedAlternative(null);
      return;
    }

    // If unchanged from their current username, it's theirs!
    if (cleanUser === (profile.username || '').trim().replace(/^@/, '').toLowerCase()) {
      setIsCheckingUsername(false);
      setIsUsernameAvailable(true);
      setUsernameError(null);
      setSuggestedAlternative(null);
      return;
    }

    setIsCheckingUsername(true);
    setUsernameError(null);

    if (usernameDebounceRef.current) {
      clearTimeout(usernameDebounceRef.current);
    }

    usernameDebounceRef.current = setTimeout(async () => {
      try {
        const res = await BlinkIdService.isUsernameAvailable(cleanUser, activeAccount?.publicKey);
        setIsCheckingUsername(false);
        if (res.available) {
          setIsUsernameAvailable(true);
          setUsernameError(null);
          setSuggestedAlternative(null);
        } else {
          setIsUsernameAvailable(false);
          setUsernameError(res.reason || `@${cleanUser} is already claimed by another user.`);
          setSuggestedAlternative(res.suggested || null);
        }
      } catch {
        setIsCheckingUsername(false);
      }
    }, 300);

    return () => {
      if (usernameDebounceRef.current) {
        clearTimeout(usernameDebounceRef.current);
      }
    };
  }, [username, isEditingProfile, profile.username, activeAccount?.publicKey]);

  // Subscribe to global ToastService
  useEffect(() => {
    const unsub = ToastService.subscribe(setToast);
    return unsub;
  }, []);

  // Keep state in sync whenever userProfile is updated from anywhere (Google login, onboarding, or edits)
  useEffect(() => {
    const unsub = UserProfileService.subscribe((updated) => {
      setProfile(updated);
      setDisplayName(updated.displayName);
      setUsername(updated.username);
      setBio(updated.bio);
      setAvatarUrl(updated.avatarUrl);
    });
    return unsub;
  }, []);

  // Automatically sync profile with cloud database on screen mount or wallet change
  useEffect(() => {
    const key = activeAccount?.publicKey || user?.id || user?.email?.address;
    const fallbackEmail = user?.email?.address || user?.google?.email || profile.linkedAccounts.email || profile.linkedAccounts.google || undefined;
    if (key) {
      UserProfileService.syncCloudProfile(key, fallbackEmail).then(synced => {
        if (synced) {
          setProfile(synced);
          setDisplayName(synced.displayName);
          setUsername(synced.username);
          setBio(synced.bio);
          setAvatarUrl(synced.avatarUrl);
        }
      });
    }
  }, [activeAccount?.publicKey, user?.id, user?.email?.address, user?.google?.email]);

  // Sync Privy verified user data with profile
  useEffect(() => {
    if (user) {
      const email = user.email?.address || null;
      const google = user.google?.email || user.google?.name || null;
      const twitter = user.twitter?.username || null;
      const discord = user.discord?.username || null;
      const telegram = user.telegram?.username || null;
      const github = user.github?.username || null;

      if (email || google || twitter || discord || telegram || github) {
        const synced = UserProfileService.updateProfile({
          linkedAccounts: {
            email: email || profile.linkedAccounts.email,
            google: google || profile.linkedAccounts.google,
            twitter: twitter || profile.linkedAccounts.twitter,
            discord: discord || profile.linkedAccounts.discord,
            telegram: telegram || profile.linkedAccounts.telegram,
            github: github || profile.linkedAccounts.github,
          },
        });
        setProfile(synced);
      }
    }
  }, [user]);

  const showToast = (msg: string) => {
    ToastService.show(msg);
  };

  // Camera-only avatar picker with automatic canvas compression
  const handlePickFromCamera = () => {
    if (typeof document !== 'undefined') {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.setAttribute('capture', 'environment');
      fileInput.onchange = (event: any) => {
        const file = event.target?.files?.[0];
        if (!file) return;

        if (file.size > 20 * 1024 * 1024) {
          ToastService.error('Image exceeds 20MB limit.');
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const rawDataUrl = e.target?.result as string;
          if (!rawDataUrl) return;

          const img = new (window as any).Image();
          img.onload = () => {
            try {
              const MAX = 256;
              const scale = Math.min(MAX / img.width, MAX / img.height, 1);
              const canvas = document.createElement('canvas');
              canvas.width = Math.round(img.width * scale);
              canvas.height = Math.round(img.height * scale);
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                ToastService.error('Could not process canvas context.');
                return;
              }
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              // JPEG at 0.82 quality produces ~18-25KB, well within localStorage quota
              const compressed = canvas.toDataURL('image/jpeg', 0.82);

              setAvatarUrl(compressed);
              const updated = UserProfileService.updateProfile({
                avatarUrl: compressed,
                hasCustomizedProfile: true,
              });
              setProfile(updated);

              const userAddress = activeAccount?.publicKey || 'local_user';
              DatabaseService.saveUserAccount({
                id: userAddress,
                address: userAddress,
                publicKey: userAddress,
                displayName: updated.displayName,
                username: updated.username,
                avatarUrl: compressed,
              });

              ToastService.success('Avatar saved.');
            } catch (err) {
              console.error('Failed to compress avatar:', err);
              ToastService.error('Could not compress photo.');
            }
          };
          img.onerror = () => {
            ToastService.error('Could not decode camera image.');
          };
          img.src = rawDataUrl;
        };
        reader.readAsDataURL(file);
      };
      fileInput.click();
    }
  };

  const handleCancelEditing = () => {
    const p = UserProfileService.getProfile();
    setProfile(p);
    setUsername(p.username);
    setDisplayName(p.displayName);
    setBio(p.bio);
    setAvatarUrl(p.avatarUrl);
    setIsUsernameAvailable(null);
    setUsernameError(null);
    setSuggestedAlternative(null);
    setIsEditingProfile(false);
  };

  const handleSaveProfile = async () => {
    const cleanUsername = username.trim().replace(/^@/, '').toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleanUsername) {
      ToastService.error('Please provide a valid username.');
      return;
    }

    const userEmail = profile.linkedAccounts.email || profile.linkedAccounts.google || user?.email?.address || user?.google?.email || '';

    // Check if username changed and is taken by another user
    const currentClean = (profile.username || '').trim().replace(/^@/, '').toLowerCase();
    if (cleanUsername !== currentClean) {
      setIsCheckingUsername(true);
      const check = await BlinkIdService.isUsernameAvailable(cleanUsername, activeAccount?.publicKey, userEmail);
      setIsCheckingUsername(false);

      if (!check.available && !check.isOwner) {
        setIsUsernameAvailable(false);
        setUsernameError(check.reason || `Username @${cleanUsername} is already taken by another user.`);
        if (check.suggested) setSuggestedAlternative(check.suggested);
        ToastService.error(`Username @${cleanUsername} is taken by another user.`);
        return;
      }
    }

    const updated = UserProfileService.updateProfile({
      displayName: displayName.trim() || cleanUsername,
      username: cleanUsername,
      avatarUrl: avatarUrl.trim() || DEFAULT_AVATARS[0],
      bio: bio.trim(),
    });

    if (activeAccount?.publicKey) {
      DatabaseService.saveUserAccount({
        id: activeAccount.publicKey,
        address: activeAccount.publicKey,
        publicKey: activeAccount.publicKey,
        displayName: updated.displayName,
        username: updated.username,
        name: updated.displayName,
        avatarUrl: updated.avatarUrl,
        bio: updated.bio,
        email: userEmail || undefined,
      });

      // Synchronize unique Blink ID to server
      BlinkIdService.registerBlinkId(`@${cleanUsername}`, activeAccount.publicKey, updated.displayName, updated.avatarUrl, userEmail || undefined);
    }

    setProfile(updated);
    setIsEditingProfile(false); // Collapse the edit panel after saving
    ToastService.success('Profile saved.');
  };

  const handleStartBind = async (provider: keyof LinkedAccounts) => {
    try {
      if (provider === 'email' && typeof linkEmail === 'function') {
        linkEmail();
        return;
      }
      if (provider === 'google' && typeof linkGoogle === 'function') {
        linkGoogle();
        return;
      }
      if (provider === 'github' && typeof linkGithub === 'function') {
        linkGithub();
        return;
      }
      if (provider === 'twitter' && typeof linkTwitter === 'function') {
        linkTwitter();
        return;
      }
      if (provider === 'discord' && typeof linkDiscord === 'function') {
        linkDiscord();
        return;
      }
      if (provider === 'telegram' && typeof linkTelegram === 'function') {
        linkTelegram();
        return;
      }
    } catch (err: any) {
      console.log('Privy link trigger error:', err);
    }

    setActiveBindingProvider(provider);
    setBindingInput(profile.linkedAccounts[provider] || '');
  };

  const handleConfirmBind = (provider: keyof LinkedAccounts) => {
    const val = bindingInput.trim();
    if (!val) {
      showToast(`Please enter your ${provider} handle.`);
      return;
    }

    const updated = UserProfileService.bindAccount(provider, val);
    setProfile(updated);
    setActiveBindingProvider(null);
    setBindingInput('');
    showToast(`Linked ${provider} successfully!`);

    // If linking an email or Google account, check if this email previously owned a customized handle
    if (provider === 'email' || provider === 'google') {
      UserProfileService.syncCloudProfile(activeAccount?.publicKey, val).then(synced => {
        if (synced && synced.username && !synced.username.startsWith('user_') && synced.username !== updated.username) {
          setProfile(synced);
          setUsername(synced.username);
          setDisplayName(synced.displayName);
          ToastService.success(`Recognized previous email! Restored handle @${synced.username}`);
        }
      });
    }
  };

  const handleUnbind = async (provider: keyof LinkedAccounts) => {
    try {
      if (provider === 'email' && user?.email?.address && typeof unlinkEmail === 'function') {
        await unlinkEmail(user.email.address);
      } else if (provider === 'google' && user?.google?.subject && typeof unlinkGoogle === 'function') {
        await unlinkGoogle(user.google.subject);
      } else if (provider === 'github' && user?.github?.subject && typeof unlinkGithub === 'function') {
        await unlinkGithub(user.github.subject);
      } else if (provider === 'twitter' && user?.twitter?.subject && typeof unlinkTwitter === 'function') {
        await unlinkTwitter(user.twitter.subject);
      } else if (provider === 'discord' && user?.discord?.subject && typeof unlinkDiscord === 'function') {
        await unlinkDiscord(user.discord.subject);
      } else if (provider === 'telegram' && user?.telegram?.telegramUserId && typeof unlinkTelegram === 'function') {
        await unlinkTelegram(user.telegram.telegramUserId);
      }
    } catch (err) {
      console.log('Privy unlink error:', err);
    }

    const updated = UserProfileService.unbindAccount(provider);
    setProfile(updated);
    showToast(`Unlinked ${provider}.`);
  };

  const copyPublicKey = () => {
    if (activeAccount?.publicKey && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(activeAccount.publicKey);
      setCopiedAddress(true);
      showToast('Wallet address copied to clipboard!');
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const { exportWallet } = useExportWallet();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportKey = async () => {
    if (!solanaAddress) {
      ToastService.error('No embedded Solana wallet found.');
      return;
    }
    setIsExporting(true);
    try {
      await exportWallet({ address: solanaAddress });
    } catch (err: any) {
      console.warn('Privy wallet export flow:', err);
      if (err?.message && !err.message.toLowerCase().includes('closed')) {
        ToastService.error(err.message || 'Could not export private key');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const solanaAddress = activeAccount?.publicKey || null;

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.contentContainer}>

      {/* Screen Title */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>User Profile & Identity</Text>
          <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
            Manage your identity
          </Text>
        </View>

        {!authenticated && (
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => login()}
            activeOpacity={0.8}
          >
            <PrivyIcon size={16} />
            <Text style={styles.signInBtnText}>Sign In with Privy</Text>
          </TouchableOpacity>
        )}
      </View>


      {/* Hero Avatar & Identity Card */}
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.avatarRow}>
          {/* Avatar Preview with Camera Overlay */}
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: avatarUrl || DEFAULT_AVATARS[0] }}
              style={styles.avatarImage}
            />
            <TouchableOpacity
              style={styles.avatarCameraBadge}
              onPress={handlePickFromCamera}
              activeOpacity={0.8}
              accessibilityLabel="Change avatar"
            >
              <Camera size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Quick Info + Edit Toggle */}
          <View style={[styles.avatarInfoCol, { flex: 1 }]}>
            <Text style={[styles.profileNameDisplay, { color: colors.textPrimary }]}>{displayName || 'Unnamed Pioneer'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: 'rgba(20, 241, 149, 0.12)',
                  borderColor: 'rgba(20, 241, 149, 0.3)',
                  borderWidth: 1,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#14F195' }}>
                  Blink ID: @{username || 'user'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(`@${username || 'user'}`);
                    ToastService.success(`Blink ID @${username || 'user'} copied!`);
                  }
                }}
                activeOpacity={0.7}
              >
                <Copy size={12} color={colors.accent} />
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  backgroundColor: 'rgba(20, 241, 149, 0.12)',
                  borderColor: 'rgba(20, 241, 149, 0.3)',
                  borderWidth: 1,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}
                onPress={() => setIsClockInModalOpen(true)}
                activeOpacity={0.7}
              >
                <Flame size={11} color="#14F195" />
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#14F195' }}>
                  {streakStatus.currentStreak > 0 ? `Day ${streakStatus.currentStreak}` : 'Clock In'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
              Unique Blink ID
            </Text>
            {bio ? <Text style={[{ color: colors.textSecondary, fontSize: 10, marginTop: 4 }]} numberOfLines={2}>{bio}</Text> : null}
          </View>

          {/* Pencil icon to toggle edit form */}
          <TouchableOpacity
            onPress={() => {
              if (isEditingProfile) {
                handleCancelEditing();
              } else {
                setIsEditingProfile(true);
              }
            }}
            style={[styles.editToggleBtn, { backgroundColor: isEditingProfile ? colors.accent + '22' : colors.bgCardAlt, borderColor: isEditingProfile ? colors.accent : colors.border }]}
            activeOpacity={0.7}
            accessibilityLabel="Edit profile"
          >
            {isEditingProfile
              ? <XIcon size={16} color={colors.accent} />
              : <Pencil size={16} color={colors.textSecondary} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Collapsible Edit Profile Form */}
      {isEditingProfile && (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionHeaderTitle, { color: colors.textPrimary }]}>PROFILE DETAILS</Text>

          {/* 3D Mascot Avatar Selector */}
          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>CHOOSE 3D MASCOT AVATAR</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mascotThumbScroll}>
              {MASCOT_AVATARS.map((m) => {
                const isSelected = avatarUrl === m.uri;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => {
                      setAvatarUrl(m.uri);
                      ToastService.info(`${m.name} mascot selected!`);
                    }}
                    style={[
                      styles.mascotThumbWrap,
                      { borderColor: isSelected ? colors.accent : colors.border },
                      isSelected && { backgroundColor: colors.accentSoft, transform: [{ scale: 1.06 }] },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Image source={{ uri: m.uri }} style={styles.mascotThumbImg} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Display Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.textPrimary }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your Display Name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Username</Text>
            <View
              style={[
                styles.usernameInputWrap,
                {
                  backgroundColor: colors.bgInput,
                  borderColor: isUsernameAvailable === false ? '#EF4444' : isUsernameAvailable === true ? '#10B981' : colors.border,
                },
              ]}
            >
              <Text style={[styles.atSymbol, isUsernameAvailable === false && { color: '#EF4444' }, isUsernameAvailable === true && { color: '#10B981' }]}>@</Text>
              <TextInput
                style={[styles.usernameInput, { color: colors.textPrimary }]}
                value={username}
                onChangeText={(val) => {
                  setUsername(val.replace(/[^a-zA-Z0-9_]/g, ''));
                  setUsernameError(null);
                }}
                placeholder="username"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              {isCheckingUsername && (
                <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 10, transform: [{ scale: 0.8 }] }} />
              )}
              {!isCheckingUsername && isUsernameAvailable === true && (
                <CheckCircle2 size={16} color="#10B981" style={{ marginRight: 10 }} />
              )}
              {!isCheckingUsername && isUsernameAvailable === false && (
                <AlertCircle size={16} color="#EF4444" style={{ marginRight: 10 }} />
              )}
            </View>

            {/* Live Status Hint */}
            {isCheckingUsername ? (
              <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>Checking availability...</Text>
            ) : isUsernameAvailable === true && username.trim().length >= 2 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                <CheckCircle2 size={12} color="#10B981" />
                <Text style={{ fontSize: 10.5, color: '#10B981', fontWeight: '700' }}>
                  @{username.trim()} is available!
                </Text>
              </View>
            ) : isUsernameAvailable === false && usernameError ? (
              <View style={{ gap: 5, marginTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <AlertCircle size={12} color="#EF4444" />
                  <Text style={{ fontSize: 10.5, color: '#EF4444', fontWeight: '700' }}>
                    {usernameError}
                  </Text>
                </View>
                {suggestedAlternative && (
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: colors.accentSoft,
                      borderColor: colors.accentBorder,
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      alignSelf: 'flex-start',
                    }}
                    onPress={() => {
                      setUsername(suggestedAlternative);
                      setUsernameError(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <RefreshCw size={12} color={colors.accent} />
                    <Text style={{ fontSize: 10.5, color: colors.accent, fontWeight: '600' }}>
                      Tap to use: <Text style={{ fontWeight: '800' }}>@{suggestedAlternative}</Text>
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <Text style={{ fontSize: 10, color: colors.textMuted, marginTop: 4 }}>
                Unique Blink ID
              </Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput, { backgroundColor: colors.bgInput, borderColor: colors.border, color: colors.textPrimary }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell the Solana ecosystem about yourself..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.saveProfileBtn,
              isUsernameAvailable === false && { backgroundColor: isDark ? '#262938' : '#CBD5E1' },
            ]}
            onPress={handleSaveProfile}
            activeOpacity={isUsernameAvailable === false ? 1 : 0.8}
            disabled={isUsernameAvailable === false || isCheckingUsername}
          >
            <Check size={16} color={isUsernameAvailable === false ? colors.textMuted : '#FFFFFF'} />
            <Text style={[styles.saveProfileBtnText, isUsernameAvailable === false && { color: colors.textMuted }]}>
              {isCheckingUsername ? 'Checking...' : isUsernameAvailable === false ? 'Username Taken — Pick Another' : 'Save Profile Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Privy Non-Custodial Embedded Solana Wallet Card */}
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.cardTitleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <PrivyIcon size={20} />
            <Text style={[styles.sectionHeaderTitle, { color: colors.textPrimary }]}>PRIVY EMBEDDED SOLANA WALLET</Text>
          </View>
          <View style={styles.verifiedBadge}>
            <Shield size={12} color="#10B981" />
            <Text style={styles.verifiedBadgeText}>Non-Custodial</Text>
          </View>
        </View>

        <Text style={[styles.sectionExplainer, { color: colors.textSecondary }]}>
          Your Privy embedded Wallet.
        </Text>

        {solanaAddress ? (
          <View style={[styles.walletAddressBox, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.walletAddressLabel, { color: colors.textMuted }]}>SOLANA DEVNET / MAINNET PUBLIC KEY</Text>
              <Text style={[styles.walletAddressText, { color: colors.textPrimary }]} selectable>
                {solanaAddress}
              </Text>
            </View>

            <View style={[styles.walletAddressActions, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.addressActionBtn, { backgroundColor: colors.bgCardAlt }]}
                onPress={copyPublicKey}
                activeOpacity={0.7}
              >
                <Copy size={14} color={copiedAddress ? '#10B981' : colors.textMuted} />
                <Text style={[styles.addressActionText, { color: copiedAddress ? '#10B981' : colors.textSecondary }]}>
                  {copiedAddress ? 'Copied' : 'Copy'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.addressActionBtn,
                  {
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    borderColor: 'rgba(245, 158, 11, 0.35)',
                    borderWidth: 1,
                  },
                ]}
                onPress={handleExportKey}
                disabled={isExporting}
                activeOpacity={0.7}
              >
                <Key size={14} color="#F59E0B" />
                <Text style={[styles.addressActionText, { color: '#F59E0B', fontWeight: '700' }]}>
                  {isExporting ? 'Opening...' : 'Export Key'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addressActionBtn, { backgroundColor: colors.bgCardAlt }]}
                onPress={() => {
                  if (typeof window !== 'undefined') {
                    window.open(
                      `https://solscan.io/account/${solanaAddress}?cluster=devnet`,
                      '_blank'
                    );
                  }
                }}
                activeOpacity={0.7}
              >
                <ExternalLink size={14} color={colors.textMuted} />
                <Text style={[styles.addressActionText, { color: colors.textSecondary }]}>Solscan</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.connectWalletPrompt}>
            <Text style={[styles.connectWalletPromptText, { color: colors.textSecondary }]}>
              Sign in with Privy to auto-provision an embedded Solana keypair.
            </Text>
            <TouchableOpacity
              style={styles.promptSignInBtn}
              onPress={() => login()}
              activeOpacity={0.8}
            >
              <PrivyIcon size={16} />
              <Text style={styles.promptSignInBtnText}>Sign In with Privy</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Privy 6 Linked Social Identities Section */}
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.cardTitleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <PrivyIcon size={20} />
            <Text style={[styles.sectionHeaderTitle, { color: colors.textPrimary }]}>LINKED IDENTITIES (PRIVY)</Text>
          </View>
          <Text style={styles.identitiesCountText}>6 Providers Enabled</Text>
        </View>

        <Text style={[styles.sectionExplainer, { color: colors.textSecondary }]}>
          Bind your verified web2 and web3 accounts directly to your BLINK identity.
        </Text>

        <View style={styles.identitiesList}>
          {/* Email */}
          <View style={[styles.identityItem, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
            <View style={styles.identityItemLeft}>
              <View style={[styles.providerIconBox, { backgroundColor: 'transparent' }]}>
                <EmailLogo size={24} />
              </View>
              <View>
                <Text style={[styles.providerName, { color: colors.textPrimary }]}>Email Address</Text>
                <Text style={[styles.providerStatus, { color: colors.textMuted }]}>
                  {profile.linkedAccounts.email || 'Not connected'}
                </Text>
              </View>
            </View>

            {profile.linkedAccounts.email ? (
              <TouchableOpacity
                onPress={() => handleUnbind('email')}
                style={styles.unbindBtn}
                activeOpacity={0.7}
              >
                <Trash2 size={13} color="#EF4444" />
                <Text style={styles.unbindBtnText}>Unlink</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => handleStartBind('email')}
                style={[styles.bindBtn, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.bindBtnText, { color: colors.textPrimary }]}>Link Email</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Google */}
          <View style={[styles.identityItem, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
            <View style={styles.identityItemLeft}>
              <View style={[styles.providerIconBox, { backgroundColor: 'transparent' }]}>
                <GoogleLogo size={24} />
              </View>
              <View>
                <Text style={[styles.providerName, { color: colors.textPrimary }]}>Google</Text>
                <Text style={[styles.providerStatus, { color: colors.textMuted }]}>
                  {profile.linkedAccounts.google || 'Not connected'}
                </Text>
              </View>
            </View>

            {profile.linkedAccounts.google ? (
              <TouchableOpacity
                onPress={() => handleUnbind('google')}
                style={styles.unbindBtn}
                activeOpacity={0.7}
              >
                <Trash2 size={13} color="#EF4444" />
                <Text style={styles.unbindBtnText}>Unlink</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => handleStartBind('google')}
                style={[styles.bindBtn, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.bindBtnText, { color: colors.textPrimary }]}>Link Google</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* GitHub */}
          <View style={[styles.identityItem, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
            <View style={styles.identityItemLeft}>
              <View style={[styles.providerIconBox, { backgroundColor: 'transparent' }]}>
                <GithubLogo size={24} />
              </View>
              <View>
                <Text style={[styles.providerName, { color: colors.textPrimary }]}>GitHub</Text>
                <Text style={[styles.providerStatus, { color: colors.textMuted }]}>
                  {profile.linkedAccounts.github
                    ? `@${profile.linkedAccounts.github.replace(/^@/, '')}`
                    : 'Not connected'}
                </Text>
              </View>
            </View>

            {profile.linkedAccounts.github ? (
              <TouchableOpacity
                onPress={() => handleUnbind('github')}
                style={styles.unbindBtn}
                activeOpacity={0.7}
              >
                <Trash2 size={13} color="#EF4444" />
                <Text style={styles.unbindBtnText}>Unlink</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => handleStartBind('github')}
                style={[styles.bindBtn, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.bindBtnText, { color: colors.textPrimary }]}>Link GitHub</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* X (Twitter) */}
          <View style={[styles.identityItem, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
            <View style={styles.identityItemLeft}>
              <View style={[styles.providerIconBox, { backgroundColor: isDark ? '#000000' : '#111827' }]}>
                <XLogo size={20} />
              </View>
              <View>
                <Text style={[styles.providerName, { color: colors.textPrimary }]}>X (Twitter)</Text>
                <Text style={[styles.providerStatus, { color: colors.textMuted }]}>
                  {profile.linkedAccounts.twitter
                    ? `@${profile.linkedAccounts.twitter.replace(/^@/, '')}`
                    : 'Not connected'}
                </Text>
              </View>
            </View>

            {profile.linkedAccounts.twitter ? (
              <TouchableOpacity
                onPress={() => handleUnbind('twitter')}
                style={styles.unbindBtn}
                activeOpacity={0.7}
              >
                <Trash2 size={13} color="#EF4444" />
                <Text style={styles.unbindBtnText}>Unlink</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => handleStartBind('twitter')}
                style={[styles.bindBtn, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.bindBtnText, { color: colors.textPrimary }]}>Link X</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Discord */}
          <View style={[styles.identityItem, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
            <View style={styles.identityItemLeft}>
              <View style={[styles.providerIconBox, { backgroundColor: 'transparent' }]}>
                <DiscordLogo size={24} />
              </View>
              <View>
                <Text style={[styles.providerName, { color: colors.textPrimary }]}>Discord</Text>
                <Text style={[styles.providerStatus, { color: colors.textMuted }]}>
                  {profile.linkedAccounts.discord || 'Not connected'}
                </Text>
              </View>
            </View>

            {profile.linkedAccounts.discord ? (
              <TouchableOpacity
                onPress={() => handleUnbind('discord')}
                style={styles.unbindBtn}
                activeOpacity={0.7}
              >
                <Trash2 size={13} color="#EF4444" />
                <Text style={styles.unbindBtnText}>Unlink</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => handleStartBind('discord')}
                style={[styles.bindBtn, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.bindBtnText, { color: colors.textPrimary }]}>Link Discord</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Telegram */}
          <View style={[styles.identityItem, { backgroundColor: colors.bgCardAlt, borderColor: colors.border }]}>
            <View style={styles.identityItemLeft}>
              <View style={[styles.providerIconBox, { backgroundColor: 'transparent' }]}>
                <TelegramLogo size={24} />
              </View>
              <View>
                <Text style={[styles.providerName, { color: colors.textPrimary }]}>Telegram</Text>
                <Text style={[styles.providerStatus, { color: colors.textMuted }]}>
                  {profile.linkedAccounts.telegram
                    ? `@${profile.linkedAccounts.telegram.replace(/^@/, '')}`
                    : 'Not connected'}
                </Text>
              </View>
            </View>

            {profile.linkedAccounts.telegram ? (
              <TouchableOpacity
                onPress={() => handleUnbind('telegram')}
                style={styles.unbindBtn}
                activeOpacity={0.7}
              >
                <Trash2 size={13} color="#EF4444" />
                <Text style={styles.unbindBtnText}>Unlink</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => handleStartBind('telegram')}
                style={[styles.bindBtn, { backgroundColor: colors.bgInput, borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.bindBtnText, { color: colors.textPrimary }]}>Link Telegram</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Manual Handle Input Fallback if Active */}
        {activeBindingProvider && (
          <View style={[styles.manualBindCard, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <Text style={[styles.manualBindTitle, { color: colors.textSecondary }]}>
              Enter {activeBindingProvider} handle manually:
            </Text>
            <View style={styles.manualBindRow}>
              <TextInput
                style={[styles.manualInput, { backgroundColor: colors.bgCard, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder={`Your ${activeBindingProvider} username/email`}
                placeholderTextColor={colors.textMuted}
                value={bindingInput}
                onChangeText={setBindingInput}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.confirmManualBtn}
                onPress={() => handleConfirmBind(activeBindingProvider)}
                activeOpacity={0.8}
              >
                <Check size={14} color="#FFFFFF" />
                <Text style={styles.confirmManualText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Dedicated Full-Width Sign Out Button */}
        {authenticated && (
          <TouchableOpacity
            style={[
              styles.fullSignOutBtn,
              { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)' },
            ]}
            onPress={() => {
              logout();
              ToastService.info('Signed out of account');
            }}
            activeOpacity={0.8}
          >
            <LogOut size={18} color="#EF4444" />
            <Text style={styles.fullSignOutBtnText}>Sign Out of Account</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>

    {/* Floating Action Button (FAB) for Clock In Streak - Profile Screen Only */}
    <TouchableOpacity
      style={[
        styles.clockInFab,
        {
          backgroundColor: streakStatus.canClockIn ? '#14F195' : (isDark ? '#161922' : '#E2E8F0'),
          borderColor: streakStatus.canClockIn ? '#10B981' : colors.border,
          opacity: streakStatus.canClockIn ? 1.0 : 0.65,
        },
      ]}
      onPress={() => setIsClockInModalOpen(true)}
      activeOpacity={0.85}
      accessibilityLabel="Clock In Streak"
    >
      <Flame size={22} color={streakStatus.canClockIn ? '#000000' : '#14F195'} />
      <View
        style={[
          styles.clockInFabBadge,
          {
            backgroundColor: streakStatus.canClockIn ? '#10B981' : '#5B67F6',
          },
        ]}
      >
        <Text style={styles.clockInFabBadgeText}>
          {streakStatus.currentStreak > 0 ? `D${streakStatus.currentStreak}` : 'NEW'}
        </Text>
      </View>
    </TouchableOpacity>

    {/* Clock In Streak Modal */}
    {isClockInModalOpen && (
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setIsClockInModalOpen(false)}
        />
        <View
          style={[
            styles.streakModalCard,
            { backgroundColor: colors.bgCard, borderColor: colors.border },
          ]}
        >
          {/* Modal Header */}
          <View style={styles.cardTitleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: 'rgba(20, 241, 149, 0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(20, 241, 149, 0.3)',
                }}
              >
                <Flame size={18} color="#14F195" />
              </View>
              <View>
                <Text style={[styles.sectionHeaderTitle, { color: colors.textPrimary, fontSize: 13 }]}>CLOCK IN STREAK</Text>
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>Daily Solana Mobile Check-In</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setIsClockInModalOpen(false)}
              style={styles.modalCloseBtn}
              activeOpacity={0.7}
            >
              <XIcon size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Streak Hero Banner */}
          <View
            style={{
              alignItems: 'center',
              paddingVertical: 12,
              backgroundColor: 'rgba(20, 241, 149, 0.06)',
              borderColor: 'rgba(20, 241, 149, 0.2)',
              borderWidth: 1,
              borderRadius: 12,
              marginTop: 6,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(20, 241, 149, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 6,
              }}
            >
              <Flame size={24} color="#14F195" />
            </View>
            <Text style={{ fontSize: 24, fontWeight: '900', color: colors.textPrimary }}>
              {streakStatus.currentStreak} {streakStatus.currentStreak === 1 ? 'Day' : 'Days'}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#14F195', marginTop: 2 }}>
              {streakStatus.bonusPercent > 0 ? `+${streakStatus.bonusPercent}% Extra SKR Discount Active` : 'Start your streak to unlock +1% off'}
            </Text>
          </View>

          {/* 2-Metric Stats Row */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {/* Streak Bonus */}
            <View
              style={{
                flex: 1,
                backgroundColor: colors.bgInput,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 10,
                padding: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Streak Bonus</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#14F195', marginTop: 2 }}>
                +{streakStatus.bonusPercent}% Off
              </Text>
            </View>

            {/* Total SKR Discount */}
            <View
              style={{
                flex: 1,
                backgroundColor: colors.bgInput,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 10,
                padding: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 9, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>Total SKR Discount</Text>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#5B67F6', marginTop: 2 }}>
                {10 + streakStatus.bonusPercent}% Off
              </Text>
            </View>
          </View>

          {/* Milestone Progress Track */}
          <View style={{ marginTop: 8, gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: colors.textSecondary }}>
                {streakStatus.daysUntilNextMilestone === 10 && streakStatus.currentStreak > 0
                  ? `Milestone unlocked! Keep going to +${streakStatus.bonusPercent + 1}%`
                  : `${streakStatus.daysUntilNextMilestone} days until +${streakStatus.bonusPercent + 1}% bonus unlock`}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textMuted }}>
                {streakStatus.currentStreak % 10}/10
              </Text>
            </View>

            <View
              style={{
                height: 6,
                backgroundColor: colors.bgInput,
                borderRadius: 3,
                overflow: 'hidden',
                borderColor: colors.border,
                borderWidth: 1,
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${Math.max(5, Math.min(100, Math.round(streakStatus.milestoneProgress * 100)))}%`,
                  backgroundColor: '#14F195',
                  borderRadius: 3,
                }}
              />
            </View>
          </View>

          <Text style={[styles.sectionExplainer, { color: colors.textMuted, fontSize: 9.5, lineHeight: 14, marginTop: 4 }]}>
            Clock in daily to earn +1% off every 10-day streak..
          </Text>

          {/* Interactive Clock In Button */}
          {streakStatus.canClockIn ? (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: '#14F195',
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 12,
                marginTop: 6,
              }}
              onPress={handleClockIn}
              activeOpacity={0.8}
              disabled={isClockingIn}
            >
              {isClockingIn ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Flame size={18} color="#000000" />
              )}
              <Text style={{ color: '#000000', fontSize: 13, fontWeight: '800' }}>
                {isClockingIn ? 'Clocking In...' : `Clock In for Today (Day ${streakStatus.currentStreak + 1})`}
              </Text>
            </TouchableOpacity>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: colors.bgCardAlt,
                borderColor: colors.border,
                borderWidth: 1,
                paddingVertical: 11,
                paddingHorizontal: 14,
                borderRadius: 12,
                marginTop: 6,
              }}
            >
              <CheckCircle2 size={16} color="#10B981" />
              <Text style={{ color: colors.textSecondary, fontSize: 11.5, fontWeight: '700' }}>
                Clocked In Today • Next window in ~{streakStatus.hoursRemaining}h {streakStatus.minutesRemaining}m
              </Text>
            </View>
          )}
        </View>
      </View>
    )}
  </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080B',
  },
  contentContainer: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 110,
    maxWidth: 800,
    marginHorizontal: 'auto',
    width: '100%',
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    color: '#94A3B8',
    fontSize: 9.5,
    marginTop: 1,
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#5B67F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  signOutBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#13231B',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toastText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#0F111A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1D212E',
    padding: 10,
    gap: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionExplainer: {
    color: '#94A3B8',
    fontSize: 9.5,
    lineHeight: 14,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#5B67F6',
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#5B67F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#5B67F6',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F111A',
  },
  avatarInfoCol: {
    flex: 1,
    gap: 4,
  },
  profileNameDisplay: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  profileUsernameDisplay: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  uploadGalleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#161B29',
    borderWidth: 1,
    borderColor: '#2D354E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  editToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 8,
  },
  mobileLinkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  mobileLinkText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  mobileLinkUrl: {
    color: '#5B67F6',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  uploadGalleryBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  presetSection: {
    borderTopWidth: 1,
    borderTopColor: '#171A25',
    paddingTop: 14,
    gap: 8,
  },
  presetLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  presetThumbWrap: {
    width: 54,
    height: 54,
    borderRadius: 12,
    padding: 2,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  presetThumbActive: {
    borderColor: '#5B67F6',
    shadowColor: '#5B67F6',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  presetThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  formGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#141724',
    borderWidth: 1,
    borderColor: '#222738',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 12,
  },
  usernameInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141724',
    borderWidth: 1,
    borderColor: '#222738',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  atSymbol: {
    color: '#5B67F6',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 4,
  },
  usernameInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 12,
  },
  bioInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  saveProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5B67F6',
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  saveProfileBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedBadgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  walletAddressBox: {
    backgroundColor: '#141724',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222738',
    padding: 14,
    gap: 12,
  },
  walletAddressLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  walletAddressText: {
    color: '#F1F5F9',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  walletAddressActions: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E2333',
    paddingTop: 10,
  },
  addressActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1B2030',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addressActionText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  exportInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },
  exportInfoTitle: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  exportInfoDesc: {
    fontSize: 10,
    lineHeight: 16,
  },
  connectWalletPrompt: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  connectWalletPromptText: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
  },
  promptSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#5B67F6',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  promptSignInBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  identitiesCountText: {
    color: '#5B67F6',
    fontSize: 10,
    fontWeight: '700',
  },
  identitiesList: {
    gap: 5,
  },
  identityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#141724',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#202536',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  identityItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  providerIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  providerStatus: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 1,
  },
  bindBtn: {
    backgroundColor: '#1D2336',
    borderWidth: 1,
    borderColor: '#2F3854',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bindBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  unbindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unbindBtnText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '700',
  },
  manualBindCard: {
    backgroundColor: '#131622',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242A3D',
    padding: 12,
    gap: 8,
    marginTop: 6,
  },
  manualBindTitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  manualBindRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#0D0F17',
    borderWidth: 1,
    borderColor: '#1F2436',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#FFFFFF',
    fontSize: 11,
  },
  confirmManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#5B67F6',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  confirmManualText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  docsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  docsCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 10,
  },
  docsIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docsCardTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  docsCardSub: {
    fontSize: 10,
    marginTop: 2,
    lineHeight: 16,
  },
  mascotThumbScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  mascotThumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mascotThumbImg: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  fullSignOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  fullSignOutBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  clockInFab: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 9999,
  },
  clockInFabBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderWidth: 1.5,
    borderColor: '#07080B',
  },
  clockInFabBadgeText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 999,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  streakModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 8,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

