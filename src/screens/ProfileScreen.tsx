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
  Alert,
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
  Wallet,
} from 'lucide-react-native';
import { BiometricService } from '../services/biometricService';
import { usePrivy, useExportWallet } from '../auth/privyAdapter';
import { UserProfileService, UserProfile, DEFAULT_AVATARS, LinkedAccounts } from '../services/userProfileService';
import { StreakService } from '../services/streakService';
import { MASCOT_AVATARS } from '../constants/mascotAvatars';
import { DatabaseService } from '../services/databaseService';
import { ToastService } from '../services/toastService';
import { ImagePickerService } from '../services/imagePickerService';
import { BlinkBrandMark } from '../components/BrandLogos';
import { WalletAccount } from '../services/walletProviderService';
import { PrivyIcon } from '../components/PrivyIcon';
import { BlinkIdService } from '../services/blinkIdService';
import {
  EmailLogo,
} from '../components/SocialLogos';
import { useTheme } from '../theme/ThemeContext';

interface ProfileScreenProps {
  activeAccount: WalletAccount | null;
  onOpenWalletConnect: () => void;
  network: string;
  onOpenAbout?: () => void;
  onReturnToAuth?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  activeAccount,
  onOpenWalletConnect,
  network,
  onOpenAbout,
  onReturnToAuth,
}) => {
  const { colors, isDark, theme, setTheme } = useTheme();
  const {
    user,
    login,
    logout,
    authenticated,
    linkEmail,
    unlinkEmail,
    deleteAccount,
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

  // Profile edit panel: strictly collapsed by default once saved/connected per Persistent Rule 5
  const [isEditingProfile, setIsEditingProfile] = useState(false);

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
    const key = activeAccount?.publicKey || (authenticated ? (user?.id || user?.email?.address) : null);
    const fallbackEmail = authenticated ? (user?.email?.address || user?.google?.email || undefined) : undefined;
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
  }, [activeAccount?.publicKey, authenticated, user?.id, user?.email?.address, user?.google?.email]);

  // Sync Privy verified user data with profile only when authenticated via Privy
  useEffect(() => {
    if (authenticated && user) {
      const githubLinked = (user as any)?.linkedAccounts?.find((a: any) => a.type === 'github_oauth' || a.type === 'github');
      const googleLinked = (user as any)?.linkedAccounts?.find((a: any) => a.type === 'google_oauth' || a.type === 'google');
      const twitterLinked = (user as any)?.linkedAccounts?.find((a: any) => a.type === 'twitter_oauth' || a.type === 'twitter');
      const discordLinked = (user as any)?.linkedAccounts?.find((a: any) => a.type === 'discord_oauth' || a.type === 'discord');
      const telegramLinked = (user as any)?.linkedAccounts?.find((a: any) => a.type === 'telegram');
      const emailLinked = (user as any)?.linkedAccounts?.find((a: any) => a.type === 'email');

      const email = user.email?.address || emailLinked?.address || null;
      const google = user.google?.email || user.google?.name || googleLinked?.email || googleLinked?.name || null;
      const twitter = user.twitter?.username || twitterLinked?.username || null;
      const discord = user.discord?.username || discordLinked?.username || null;
      const telegram = user.telegram?.username || telegramLinked?.username || null;
      const github = user.github?.username || githubLinked?.username || null;

      const newAccounts: Partial<LinkedAccounts> = {};
      if (email && email !== profile.linkedAccounts.email) newAccounts.email = email;
      if (google && google !== profile.linkedAccounts.google) newAccounts.google = google;
      if (twitter && twitter !== profile.linkedAccounts.twitter) newAccounts.twitter = twitter;
      if (discord && discord !== profile.linkedAccounts.discord) newAccounts.discord = discord;
      if (telegram && telegram !== profile.linkedAccounts.telegram) newAccounts.telegram = telegram;
      if (github && github !== profile.linkedAccounts.github) newAccounts.github = github;

      if (Object.keys(newAccounts).length > 0) {
        const synced = UserProfileService.updateProfile({
          linkedAccounts: {
            ...profile.linkedAccounts,
            ...newAccounts,
          },
        });
        setProfile(synced);
      }
    }
  }, [user]);

  const showToast = (msg: string) => {
    ToastService.show(msg);
  };

  // Camera-only avatar picker (strictly launches camera per user constraint)
  const handlePickFromCamera = async () => {
    try {
      const compressed = await ImagePickerService.pickFromCamera();
      if (!compressed) return;

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

      ToastService.success('Avatar updated from camera.');
    } catch (err) {
      console.error('Failed to take camera avatar:', err);
      ToastService.error('Could not take photo.');
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
      if (authenticated && provider === 'email' && typeof linkEmail === 'function') {
        await linkEmail();
        return;
      }
    } catch (err: any) {
      console.log('Privy link trigger error:', err);
    }
    setActiveBindingProvider(provider);
    setBindingInput('');
  };

  const handleConfirmBind = async (provider: keyof LinkedAccounts) => {
    const val = bindingInput.trim().toLowerCase();
    if (!val) {
      ToastService.error(`Please enter your ${provider} address.`);
      return;
    }

    if (provider === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val)) {
        ToastService.error('Please enter a valid email address.');
        return;
      }

      // Check if this email is already registered/linked to another account in cloud database
      try {
        const { getApiUrl } = await import('../services/apiConfig');
        const checkUrl = getApiUrl(`/api/users/check-email?email=${encodeURIComponent(val)}&address=${encodeURIComponent(activeAccount?.publicKey || '')}`);
        const res = await fetch(checkUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.available === false) {
            ToastService.error(data.reason || 'This email is already linked to another Blink account.');
            return;
          }
        }
      } catch (e) {
        console.warn('Check email error:', e);
      }
    }

    const updated = UserProfileService.bindAccount(provider, val);
    setProfile(updated);
    setActiveBindingProvider(null);
    setBindingInput('');

    if (activeAccount?.publicKey) {
      DatabaseService.saveUserAccount({
        id: activeAccount.publicKey,
        address: activeAccount.publicKey,
        publicKey: activeAccount.publicKey,
        displayName: updated.displayName,
        username: updated.username,
        avatarUrl: updated.avatarUrl,
        email: provider === 'email' ? val : (updated.linkedAccounts.email || undefined),
        linkedAccounts: updated.linkedAccounts,
      });
    }

    ToastService.success(`Linked ${provider} successfully!`);
  };

  const handleUnbind = async (provider: keyof LinkedAccounts) => {
    try {
      if (provider === 'email' && typeof unlinkEmail === 'function') {
        const addr = user?.email?.address || profile.linkedAccounts.email;
        if (addr) await unlinkEmail(addr);
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
  const isUserLoggedIn = authenticated || Boolean(activeAccount?.publicKey) || Boolean(solanaAddress);
  const isPrivyWallet = Boolean(
    activeAccount?.isPrivy === true ||
    (authenticated && !activeAccount?.name?.toLowerCase().includes('phantom') && !activeAccount?.name?.toLowerCase().includes('solflare'))
  );
  const walletDisplayName = activeAccount?.name || (isPrivyWallet ? 'Privy Embedded' : 'Solana External');

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

        {!isUserLoggedIn && (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {onReturnToAuth && (
              <TouchableOpacity
                style={[styles.signInBtn, { backgroundColor: colors.accent }]}
                onPress={onReturnToAuth}
                activeOpacity={0.8}
              >
                <Text style={styles.signInBtnText}>Sign In / Login</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.signInBtn, { backgroundColor: colors.bgCardAlt, borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => login()}
              activeOpacity={0.8}
            >
              <PrivyIcon size={16} />
              <Text style={[styles.signInBtnText, { color: colors.textPrimary }]}>Privy Modal</Text>
            </TouchableOpacity>
          </View>
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

      {/* Solana Wallet Card */}
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.cardTitleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isPrivyWallet ? (
              <PrivyIcon size={20} />
            ) : (
              <Wallet size={20} color={colors.accent} />
            )}
            <Text style={[styles.sectionHeaderTitle, { color: colors.textPrimary }]}>
              {isPrivyWallet ? 'PRIVY EMBEDDED SOLANA WALLET' : `${walletDisplayName.toUpperCase()} SOLANA WALLET`}
            </Text>
          </View>
          <View style={styles.verifiedBadge}>
            <Shield size={12} color="#10B981" />
            <Text style={styles.verifiedBadgeText}>Non-Custodial</Text>
          </View>
        </View>

        <Text style={[styles.sectionExplainer, { color: colors.textSecondary }]}>
          {isPrivyWallet ? 'Your Privy embedded Wallet.' : `Your connected ${walletDisplayName} wallet.`}
        </Text>

        {solanaAddress ? (
          <>
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

                {/* ONLY show Export Key for Privy embedded wallets, NEVER for Phantom or external wallets */}
                {isPrivyWallet && (
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
                )}

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

            {/* Account Switcher: Switch between Privy Embedded (Email) and External Native (Phantom) */}
            {typeof window !== 'undefined' && Boolean(window.localStorage.getItem('blink_connected_native_wallet')) && authenticated && (
              <View style={{ marginTop: 12, backgroundColor: colors.bgCardAlt, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textPrimary }}>
                    {isPrivyWallet ? 'Switch to External Phantom' : 'Switch to Privy Email Wallet'}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>
                    {isPrivyWallet ? 'Use Phantom wallet for signing and payments' : 'Use your non-custodial email embedded wallet'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={{ backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 }}
                  onPress={() => {
                    const target = isPrivyWallet ? 'native' : 'privy';
                    if (typeof window !== 'undefined') {
                      if (target === 'native') {
                        try { sessionStorage.setItem('blink_session_explicit_native', '1'); } catch {}
                      } else {
                        try { sessionStorage.removeItem('blink_session_explicit_native'); } catch {}
                      }
                      window.dispatchEvent(new CustomEvent('blink_switch_wallet', { detail: { source: target } }));
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                    {isPrivyWallet ? 'Use Phantom' : 'Use Privy'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={styles.connectWalletPrompt}>
            <Text style={[styles.connectWalletPromptText, { color: colors.textSecondary }]}>
              Connect a Solana wallet or sign in with Privy to manage your identity.
            </Text>
            {onOpenWalletConnect && (
              <TouchableOpacity
                style={styles.promptSignInBtn}
                onPress={onOpenWalletConnect}
                activeOpacity={0.8}
              >
                <Wallet size={16} color="#FFFFFF" />
                <Text style={styles.promptSignInBtnText}>Connect Wallet</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Linked Account Section (Email Only) */}
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.cardTitleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Mail size={18} color={colors.accent} />
            <Text style={[styles.sectionHeaderTitle, { color: colors.textPrimary }]}>LINKED EMAIL ACCOUNT</Text>
          </View>
        </View>

        <Text style={[styles.sectionExplainer, { color: colors.textSecondary }]}>
          Your verified email address linked to your BLINK non-custodial identity.
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
                  {profile.linkedAccounts.email || (authenticated ? user?.email?.address : null) || 'Not connected'}
                </Text>
              </View>
            </View>

            {(profile.linkedAccounts.email || (authenticated && user?.email?.address)) ? (
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
        </View>

        {/* Dedicated Full-Width Sign Out Button */}
        {isUserLoggedIn && (
          <View style={{ gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              style={[
                styles.fullSignOutBtn,
                { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.3)' },
              ]}
              onPress={async () => {
                try {
                  if (authenticated) {
                    await logout();
                  }
                } catch (e) {
                  console.warn('Privy logout error:', e);
                }
                const { WalletProviderService } = await import('../services/walletProviderService');
                WalletProviderService.disconnect();
                UserProfileService.resetProfile();
                if (typeof window !== 'undefined' && window.dispatchEvent) {
                  window.dispatchEvent(new CustomEvent('blink_auth_signout'));
                }
                ToastService.info('Signed out of account');
                if (onReturnToAuth) {
                  onReturnToAuth();
                }
              }}
              activeOpacity={0.8}
            >
              <LogOut size={18} color="#EF4444" />
              <Text style={styles.fullSignOutBtnText}>Sign Out of Account</Text>
            </TouchableOpacity>
          </View>
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

    {/* Link Provider Modal */}
    {activeBindingProvider && (
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setActiveBindingProvider(null)}
        />
        <View
          style={[
            styles.streakModalCard,
            { backgroundColor: colors.bgCard, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardTitleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Mail size={18} color={colors.accent} />
              <Text style={[styles.sectionHeaderTitle, { color: colors.textPrimary }]}>
                LINK {activeBindingProvider.toUpperCase()} ADDRESS
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setActiveBindingProvider(null)}
              style={styles.modalCloseBtn}
              activeOpacity={0.7}
            >
              <XIcon size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionExplainer, { color: colors.textSecondary, marginTop: 4 }]}>
            Enter the {activeBindingProvider} you want to link with your Blink profile. It must not be linked to any other account.
          </Text>

          <TextInput
            style={{
              backgroundColor: colors.bgInput,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: colors.textPrimary,
              fontSize: 14,
              marginTop: 12,
            }}
            placeholder={`Enter your ${activeBindingProvider}...`}
            placeholderTextColor={colors.textMuted}
            value={bindingInput}
            onChangeText={setBindingInput}
            keyboardType={activeBindingProvider === 'email' ? 'email-address' : 'default'}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: colors.bgCardAlt,
                borderColor: colors.border,
                borderWidth: 1,
              }}
              onPress={() => setActiveBindingProvider(null)}
              activeOpacity={0.7}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: colors.accent,
              }}
              onPress={() => handleConfirmBind(activeBindingProvider)}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Confirm Link</Text>
            </TouchableOpacity>
          </View>
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
    alignSelf: 'center',
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 10.5,
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
    fontSize: 11,
    fontWeight: '800',
    marginRight: 4,
  },
  usernameInput: {
    flex: 1,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 10.5,
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

