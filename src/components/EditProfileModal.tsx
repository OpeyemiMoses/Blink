import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  Check,
  User,
  Mail,
  Globe,
  Code2,
  Share2,
  MessageSquare,
  Send,
  Camera,
  Shield,
  CheckCircle2,
  Trash2,
} from 'lucide-react-native';
import {
  UserProfileService,
  UserProfile,
  DEFAULT_AVATARS,
  LinkedAccounts,
} from '../services/userProfileService';
import { BlinkIdService } from '../services/blinkIdService';
import { MASCOT_AVATARS } from '../constants/mascotAvatars';
import {
  EmailLogo,
  TelegramLogo,
  GoogleLogo,
  GithubLogo,
  XLogo,
  DiscordLogo,
} from './SocialLogos';
import { usePrivy } from '@privy-io/react-auth';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onProfileUpdated: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
  onProfileUpdated,
}) => {
  const {
    user,
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
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [bio, setBio] = useState(profile.bio);

  const [activeBindingProvider, setActiveBindingProvider] = useState<keyof LinkedAccounts | null>(null);
  const [bindingInput, setBindingInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  const [showCustomAvatarField, setShowCustomAvatarField] = useState(false);

  // Sync with Privy user when available
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

  useEffect(() => {
    if (visible) {
      const p = UserProfileService.getProfile();
      setProfile(p);
      setUsername(p.username);
      setDisplayName(p.displayName);
      setAvatarUrl(p.avatarUrl);
      setBio(p.bio);
      setActiveBindingProvider(null);
      setBindingInput('');
    }
  }, [visible]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handlePickFromCamera = () => {
    if (typeof document !== 'undefined') {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.setAttribute('capture', 'environment');
      fileInput.onchange = (event: any) => {
        const file = event.target?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const rawDataUrl = e.target?.result as string;
          if (!rawDataUrl) return;
          const img = new (window as any).Image();
          img.onload = () => {
            const MAX = 256;
            const scale = Math.min(MAX / img.width, MAX / img.height, 1);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const compressed = canvas.toDataURL('image/jpeg', 0.82);
            setAvatarUrl(compressed);
            UserProfileService.updateProfile({ avatarUrl: compressed, hasCustomizedProfile: true });
            showToast('Avatar updated!');
          };
          img.src = rawDataUrl;
        };
        reader.readAsDataURL(file);
      };
      fileInput.click();
    }
  };

  const handleSave = async () => {
    const cleanUsername = username.trim().replace(/^@/, '').toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleanUsername) {
      showToast('Please provide a valid username.');
      return;
    }

    const currentClean = (profile.username || '').trim().replace(/^@/, '').toLowerCase();
    if (cleanUsername !== currentClean) {
      const address = user?.wallet?.address;
      const check = await BlinkIdService.isUsernameAvailable(cleanUsername, address);
      if (!check.available && !check.isOwner) {
        showToast(check.reason || `Username @${cleanUsername} is already taken by another user.`);
        return;
      }
    }

    const updated = UserProfileService.updateProfile({
      username: cleanUsername,
      displayName: displayName.trim() || cleanUsername,
      avatarUrl: avatarUrl.trim() || DEFAULT_AVATARS[0],
      bio: bio.trim(),
    });

    setProfile(updated);
    showToast('Profile saved successfully!');
    onProfileUpdated();
    setTimeout(() => {
      onClose();
    }, 700);
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
    onProfileUpdated();
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
    onProfileUpdated();
  };

  const handleCancel = () => {
    const p = UserProfileService.getProfile();
    setUsername(p.username);
    setDisplayName(p.displayName);
    setAvatarUrl(p.avatarUrl);
    setBio(p.bio);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Edit Profile & Identities</Text>
              <Text style={styles.headerSub}>Manage your username, avatar, and Privy social accounts</Text>
            </View>
            <TouchableOpacity onPress={handleCancel} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Toast */}
          {toastMessage && (
            <View style={styles.toast}>
              <CheckCircle2 size={15} color="#10B981" />
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          )}

          <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
            {/* Avatar Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PROFILE PICTURE</Text>
              <Text style={styles.avatarHelper}>Select a 3D mascot avatar or upload a custom photo:</Text>
              <View style={styles.avatarRow}>
                <Image source={{ uri: avatarUrl }} style={styles.avatarPreview} />
                <View style={styles.avatarChoices}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarThumbRow}>
                    {MASCOT_AVATARS.map((m) => {
                      const isSelected = avatarUrl === m.uri;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          onPress={() => {
                            setAvatarUrl(m.uri);
                            showToast(`${m.name} chosen!`);
                          }}
                          style={[
                            styles.avatarThumbWrap,
                            isSelected && styles.avatarThumbActive,
                          ]}
                          activeOpacity={0.8}
                        >
                          <Image source={{ uri: m.uri }} style={styles.avatarThumb} />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      onPress={handlePickFromCamera}
                      style={styles.galleryUploadBtn}
                      activeOpacity={0.8}
                    >
                      <Camera size={13} color="#FFFFFF" />
                      <Text style={styles.galleryUploadBtnText}>Upload Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setShowCustomAvatarField(!showCustomAvatarField)}
                      style={styles.customUrlToggle}
                    >
                      <Text style={styles.customUrlToggleText}>
                        {showCustomAvatarField ? 'Hide custom URL' : 'Paste image URL'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {showCustomAvatarField && (
                    <View style={styles.customAvatarRow}>
                      <TextInput
                        style={styles.customAvatarInput}
                        placeholder="https://example.com/avatar.jpg"
                        placeholderTextColor="#64748B"
                        value={customAvatarInput}
                        onChangeText={setCustomAvatarInput}
                      />
                      <TouchableOpacity
                        style={styles.applyAvatarBtn}
                        onPress={() => {
                          if (customAvatarInput.trim()) {
                            setAvatarUrl(customAvatarInput.trim());
                            showToast('Custom avatar applied');
                          }
                        }}
                      >
                        <Text style={styles.applyAvatarText}>Apply</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Display Name & Username */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>DISPLAY NAME</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your Display Name"
                placeholderTextColor="#64748B"
              />

              <Text style={[styles.sectionLabel, { marginTop: 14 }]}>USERNAME</Text>
              <View style={styles.usernameRow}>
                <Text style={styles.atSign}>@</Text>
                <TextInput
                  style={styles.usernameInput}
                  value={username}
                  onChangeText={(val) => setUsername(val.replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="username"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                />
              </View>

              <Text style={[styles.sectionLabel, { marginTop: 14 }]}>BIO</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell the Solana world about yourself..."
                placeholderTextColor="#64748B"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Privy Social Accounts Binding */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Shield size={14} color="#5B67F6" />
                <Text style={styles.sectionLabel}>LINKED ACCOUNTS (PRIVY IDENTITY)</Text>
              </View>
              <Text style={styles.subtext}>
                Bind your verified social identities to your non-custodial Solana account.
              </Text>

              {/* Email */}
              <View style={styles.bindCard}>
                <View style={styles.bindCardHeader}>
                  <View style={[styles.bindIconBox, { backgroundColor: 'transparent' }]}>
                    <EmailLogo size={22} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.bindTitle}>Email Address</Text>
                    <Text style={styles.bindStatus}>
                      {profile.linkedAccounts.email
                        ? profile.linkedAccounts.email
                        : 'No email bound'}
                    </Text>
                  </View>
                  {profile.linkedAccounts.email ? (
                    <TouchableOpacity
                      onPress={() => handleUnbind('email')}
                      style={styles.unbindBtn}
                    >
                      <Trash2 size={13} color="#EF4444" />
                      <Text style={styles.unbindText}>Unlink</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleStartBind('email')}
                      style={styles.bindBtn}
                    >
                      <Text style={styles.bindBtnText}>Link Email</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {activeBindingProvider === 'email' && (
                  <View style={styles.inlineBindRow}>
                    <TextInput
                      style={styles.inlineInput}
                      placeholder="you@domain.com"
                      placeholderTextColor="#64748B"
                      value={bindingInput}
                      onChangeText={setBindingInput}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.confirmBindBtn}
                      onPress={() => handleConfirmBind('email')}
                    >
                      <Check size={14} color="#FFFFFF" />
                      <Text style={styles.confirmBindText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Google */}
              <View style={styles.bindCard}>
                <View style={styles.bindCardHeader}>
                  <View style={[styles.bindIconBox, { backgroundColor: 'transparent' }]}>
                    <GoogleLogo size={22} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.bindTitle}>Google</Text>
                    <Text style={styles.bindStatus}>
                      {profile.linkedAccounts.google
                        ? profile.linkedAccounts.google
                        : 'No Google account bound'}
                    </Text>
                  </View>
                  {profile.linkedAccounts.google ? (
                    <TouchableOpacity
                      onPress={() => handleUnbind('google')}
                      style={styles.unbindBtn}
                    >
                      <Trash2 size={13} color="#EF4444" />
                      <Text style={styles.unbindText}>Unlink</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleStartBind('google')}
                      style={styles.bindBtn}
                    >
                      <Text style={styles.bindBtnText}>Link Google</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {activeBindingProvider === 'google' && (
                  <View style={styles.inlineBindRow}>
                    <TextInput
                      style={styles.inlineInput}
                      placeholder="you@gmail.com"
                      placeholderTextColor="#64748B"
                      value={bindingInput}
                      onChangeText={setBindingInput}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.confirmBindBtn}
                      onPress={() => handleConfirmBind('google')}
                    >
                      <Check size={14} color="#FFFFFF" />
                      <Text style={styles.confirmBindText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* GitHub */}
              <View style={styles.bindCard}>
                <View style={styles.bindCardHeader}>
                  <View style={[styles.bindIconBox, { backgroundColor: 'transparent' }]}>
                    <GithubLogo size={22} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.bindTitle}>GitHub</Text>
                    <Text style={styles.bindStatus}>
                      {profile.linkedAccounts.github
                        ? `@${profile.linkedAccounts.github.replace(/^@/, '')}`
                        : 'No GitHub bound'}
                    </Text>
                  </View>
                  {profile.linkedAccounts.github ? (
                    <TouchableOpacity
                      onPress={() => handleUnbind('github')}
                      style={styles.unbindBtn}
                    >
                      <Trash2 size={13} color="#EF4444" />
                      <Text style={styles.unbindText}>Unlink</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleStartBind('github')}
                      style={styles.bindBtn}
                    >
                      <Text style={styles.bindBtnText}>Link GitHub</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {activeBindingProvider === 'github' && (
                  <View style={styles.inlineBindRow}>
                    <TextInput
                      style={styles.inlineInput}
                      placeholder="github-username"
                      placeholderTextColor="#64748B"
                      value={bindingInput}
                      onChangeText={setBindingInput}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.confirmBindBtn}
                      onPress={() => handleConfirmBind('github')}
                    >
                      <Check size={14} color="#FFFFFF" />
                      <Text style={styles.confirmBindText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* X / Twitter */}
              <View style={styles.bindCard}>
                <View style={styles.bindCardHeader}>
                  <View style={[styles.bindIconBox, { backgroundColor: '#000000' }]}>
                    <XLogo size={18} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.bindTitle}>X (Twitter)</Text>
                    <Text style={styles.bindStatus}>
                      {profile.linkedAccounts.twitter
                        ? `@${profile.linkedAccounts.twitter.replace(/^@/, '')}`
                        : 'No X account bound'}
                    </Text>
                  </View>
                  {profile.linkedAccounts.twitter ? (
                    <TouchableOpacity
                      onPress={() => handleUnbind('twitter')}
                      style={styles.unbindBtn}
                    >
                      <Trash2 size={13} color="#EF4444" />
                      <Text style={styles.unbindText}>Unlink</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleStartBind('twitter')}
                      style={styles.bindBtn}
                    >
                      <Text style={styles.bindBtnText}>Link X</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {activeBindingProvider === 'twitter' && (
                  <View style={styles.inlineBindRow}>
                    <TextInput
                      style={styles.inlineInput}
                      placeholder="@handle"
                      placeholderTextColor="#64748B"
                      value={bindingInput}
                      onChangeText={setBindingInput}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.confirmBindBtn}
                      onPress={() => handleConfirmBind('twitter')}
                    >
                      <Check size={14} color="#FFFFFF" />
                      <Text style={styles.confirmBindText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Discord */}
              <View style={styles.bindCard}>
                <View style={styles.bindCardHeader}>
                  <View style={[styles.bindIconBox, { backgroundColor: 'transparent' }]}>
                    <DiscordLogo size={22} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.bindTitle}>Discord</Text>
                    <Text style={styles.bindStatus}>
                      {profile.linkedAccounts.discord
                        ? profile.linkedAccounts.discord
                        : 'No Discord bound'}
                    </Text>
                  </View>
                  {profile.linkedAccounts.discord ? (
                    <TouchableOpacity
                      onPress={() => handleUnbind('discord')}
                      style={styles.unbindBtn}
                    >
                      <Trash2 size={13} color="#EF4444" />
                      <Text style={styles.unbindText}>Unlink</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleStartBind('discord')}
                      style={styles.bindBtn}
                    >
                      <Text style={styles.bindBtnText}>Link Discord</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {activeBindingProvider === 'discord' && (
                  <View style={styles.inlineBindRow}>
                    <TextInput
                      style={styles.inlineInput}
                      placeholder="username#0000"
                      placeholderTextColor="#64748B"
                      value={bindingInput}
                      onChangeText={setBindingInput}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.confirmBindBtn}
                      onPress={() => handleConfirmBind('discord')}
                    >
                      <Check size={14} color="#FFFFFF" />
                      <Text style={styles.confirmBindText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Telegram */}
              <View style={styles.bindCard}>
                <View style={styles.bindCardHeader}>
                  <View style={[styles.bindIconBox, { backgroundColor: 'transparent' }]}>
                    <TelegramLogo size={22} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.bindTitle}>Telegram</Text>
                    <Text style={styles.bindStatus}>
                      {profile.linkedAccounts.telegram
                        ? `@${profile.linkedAccounts.telegram.replace(/^@/, '')}`
                        : 'No Telegram bound'}
                    </Text>
                  </View>
                  {profile.linkedAccounts.telegram ? (
                    <TouchableOpacity
                      onPress={() => handleUnbind('telegram')}
                      style={styles.unbindBtn}
                    >
                      <Trash2 size={13} color="#EF4444" />
                      <Text style={styles.unbindText}>Unlink</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleStartBind('telegram')}
                      style={styles.bindBtn}
                    >
                      <Text style={styles.bindBtnText}>Link Telegram</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {activeBindingProvider === 'telegram' && (
                  <View style={styles.inlineBindRow}>
                    <TextInput
                      style={styles.inlineInput}
                      placeholder="@telegram_handle"
                      placeholderTextColor="#64748B"
                      value={bindingInput}
                      onChangeText={setBindingInput}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.confirmBindBtn}
                      onPress={() => handleConfirmBind('telegram')}
                    >
                      <Check size={14} color="#FFFFFF" />
                      <Text style={styles.confirmBindText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSave} style={styles.saveBtn} activeOpacity={0.8}>
              <Check size={16} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 9999,
  },
  modalBox: {
    backgroundColor: '#0F121C',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E2333',
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1F2C',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  headerSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#181C28',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.3)',
  },
  toastText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  subtext: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarPreview: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#5B67F6',
  },
  avatarChoices: {
    flex: 1,
  },
  avatarHelper: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 6,
  },
  avatarThumbRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  avatarThumbWrap: {
    padding: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  avatarThumbActive: {
    borderColor: '#5B67F6',
  },
  avatarThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  galleryUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#5B67F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  galleryUploadBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  customUrlToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  customUrlToggleText: {
    color: '#5B67F6',
    fontSize: 11,
    fontWeight: '600',
  },
  customAvatarRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  customAvatarInput: {
    flex: 1,
    backgroundColor: '#141824',
    borderWidth: 1,
    borderColor: '#22293A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#FFFFFF',
    fontSize: 12,
  },
  applyAvatarBtn: {
    backgroundColor: '#1E2333',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 8,
  },
  applyAvatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#141824',
    borderWidth: 1,
    borderColor: '#22293A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
  },
  bioInput: {
    height: 70,
    textAlignVertical: 'top',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141824',
    borderWidth: 1,
    borderColor: '#22293A',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  atSign: {
    color: '#5B67F6',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 4,
  },
  usernameInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
  },
  bindCard: {
    backgroundColor: '#141824',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22293A',
    padding: 12,
    marginBottom: 10,
  },
  bindCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bindIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#1A2030',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bindTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bindStatus: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  bindBtn: {
    backgroundColor: '#1E2333',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D354B',
  },
  bindBtnText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
  },
  unbindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unbindText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
  },
  inlineBindRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E2333',
  },
  inlineInput: {
    flex: 1,
    backgroundColor: '#0F121C',
    borderWidth: 1,
    borderColor: '#22293A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#FFFFFF',
    fontSize: 12,
  },
  confirmBindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#5B67F6',
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  confirmBindText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A1F2C',
    backgroundColor: '#0F121C',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#181C28',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#5B67F6',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
