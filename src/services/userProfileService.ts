import {
  MASCOT_PURPLE_URI,
  MASCOT_GREEN_URI,
  MASCOT_PINK_URI,
  MASCOT_CYAN_URI,
  MASCOT_ORANGE_URI,
  MASCOT_GOLD_URI,
} from '../constants/mascotAvatars';
import { BlinkIdService } from './blinkIdService';

export interface LinkedAccounts {
  email: string | null;
  google: string | null;
  twitter: string | null;
  discord: string | null;
  telegram: string | null;
  github: string | null;
}

export interface UserProfile {
  address?: string;
  publicKey?: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  blinkId?: string; // Canonical Blink ID handle (e.g. @yemi) that acts as on-chain wallet address
  linkedAccounts: LinkedAccounts;
  hasCustomizedProfile?: boolean;
  isPremium?: boolean;
  tier?: string;
  updatedAt: number;
}

const STORAGE_PROFILE_KEY = 'blink_user_profile_v1';
const STORAGE_AVATAR_BACKUP_KEY = 'blink_avatar_backup_v1';

export const DEFAULT_AVATARS = [
  MASCOT_PURPLE_URI,
  MASCOT_GREEN_URI,
  MASCOT_PINK_URI,
  MASCOT_CYAN_URI,
  MASCOT_ORANGE_URI,
  MASCOT_GOLD_URI,
];

export const getRandomMascot = (): string => {
  return DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
};

const INITIAL_PROFILE: UserProfile = {
  username: 'seeker_user',
  displayName: 'Seeker Pioneer',
  blinkId: '@seeker_user',
  avatarUrl: DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)],
  bio: 'Building and tapping physical Solana Blinks in the wild.',
  hasCustomizedProfile: false,
  linkedAccounts: {
    email: null,
    google: null,
    twitter: null,
    discord: null,
    telegram: null,
    github: null,
  },
  updatedAt: Date.now(),
};

export class UserProfileService {
  private static profile: UserProfile | null = null;

  static getRandomMascot(): string {
    return DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
  }

  /**
   * Asynchronous Google profile onboarding with guaranteed uniqueness check.
   * If derived email prefix is taken by someone else, auto-assigns a unique random username.
   */
  static async setupGoogleProfileAsync(
    googleEmail: string,
    googleName?: string,
    userAddress?: string
  ): Promise<{ profile: UserProfile; wasUsernameTaken: boolean; assignedUsername: string; originalRequested: string }> {
    const emailPrefix = googleEmail.split('@')[0] || 'google_user';
    const cleanCandidate = emailPrefix.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const cleanDisplayName = googleName && googleName.trim().length > 0 ? googleName.trim() : emailPrefix;

    const check = await BlinkIdService.isUsernameAvailable(cleanCandidate, userAddress, googleEmail);
    let finalUsername = cleanCandidate;
    let wasTaken = false;

    if (!check.available && !check.isOwner) {
      wasTaken = true;
      finalUsername = await BlinkIdService.findAvailableUsername(cleanCandidate, userAddress, googleEmail);
    }

    const currentProfile = this.getProfile();
    const isBrokenLegacyMock = currentProfile.avatarUrl && currentProfile.avatarUrl.includes('AWgAAAFoCAYAAAB65WHVAAJo');
    const isOldSvg = currentProfile.avatarUrl && (
      currentProfile.avatarUrl.includes('image/svg+xml') ||
      currentProfile.avatarUrl.includes('<svg') ||
      currentProfile.avatarUrl.includes('viewBox=')
    );
    const avatarNeedsDefault = !currentProfile.avatarUrl || isBrokenLegacyMock || isOldSvg;
    const avatarUrl = avatarNeedsDefault
      ? this.getRandomMascot()
      : currentProfile.avatarUrl;

    const updated = this.updateProfile({
      username: finalUsername,
      displayName: cleanDisplayName,
      avatarUrl,
      hasCustomizedProfile: true,
      linkedAccounts: {
        ...this.getProfile().linkedAccounts,
        google: googleEmail,
        email: googleEmail,
      },
    });

    return {
      profile: updated,
      wasUsernameTaken: wasTaken,
      assignedUsername: finalUsername,
      originalRequested: cleanCandidate,
    };
  }

  static setupGoogleProfile(googleEmail: string, googleName?: string): UserProfile {
    const emailPrefix = googleEmail.split('@')[0] || 'google_user';
    const cleanUsername = emailPrefix.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const cleanDisplayName = googleName && googleName.trim().length > 0 ? googleName.trim() : emailPrefix;

    const currentProfile = this.getProfile();
    const isBrokenLegacyMock = currentProfile.avatarUrl && currentProfile.avatarUrl.includes('AWgAAAFoCAYAAAB65WHVAAJo');
    const isOldSvg = currentProfile.avatarUrl && (
      currentProfile.avatarUrl.includes('image/svg+xml') ||
      currentProfile.avatarUrl.includes('<svg') ||
      currentProfile.avatarUrl.includes('viewBox=')
    );
    const avatarNeedsDefault = !currentProfile.avatarUrl || isBrokenLegacyMock || isOldSvg;
    const avatarUrl = avatarNeedsDefault
      ? this.getRandomMascot()
      : currentProfile.avatarUrl;

    return this.updateProfile({
      username: cleanUsername,
      displayName: cleanDisplayName,
      avatarUrl,
      hasCustomizedProfile: true,
      linkedAccounts: {
        ...this.getProfile().linkedAccounts,
        google: googleEmail,
        email: googleEmail,
      },
    });
  }

  static setCustomIdentity(displayName: string, username: string, customAvatarUrl?: string): UserProfile {
    const cleanUsername = username.trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '');
    const cleanDisplayName = displayName.trim() || cleanUsername;
    const current = this.getProfile();

    const isBrokenOrSvg = !current.avatarUrl || 
      current.avatarUrl.includes('image/svg+xml') ||
      current.avatarUrl.includes('<svg') ||
      current.avatarUrl.includes('AWgAAAFoCAYAAAB65WHVAAJo');

    const avatarUrl = customAvatarUrl || (isBrokenOrSvg ? this.getRandomMascot() : current.avatarUrl);

    return this.updateProfile({
      displayName: cleanDisplayName,
      username: cleanUsername,
      avatarUrl,
      hasCustomizedProfile: true,
    });
  }

  static getProfile(): UserProfile {
    if (this.profile) return { ...this.profile };

    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_PROFILE_KEY);
      const backupAvatar = window.localStorage.getItem(STORAGE_AVATAR_BACKUP_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const rawAvatar = parsed.avatarUrl || backupAvatar;
          const isBrokenLegacyMock = rawAvatar && rawAvatar.includes('AWgAAAFoCAYAAAB65WHVAAJo');
          const isOldSvg = rawAvatar && (
            rawAvatar.includes('image/svg+xml') ||
            rawAvatar.includes('<svg') ||
            rawAvatar.includes('viewBox=')
          );
          const avatarValid = !isBrokenLegacyMock && !isOldSvg && rawAvatar && (
            rawAvatar.startsWith('data:image/') ||
            rawAvatar.startsWith('http://') ||
            rawAvatar.startsWith('https://') ||
            rawAvatar.startsWith('/assets/avatars/')
          );
          const isCustom = typeof parsed.hasCustomizedProfile === 'boolean'
            ? parsed.hasCustomizedProfile
            : Boolean(parsed.username && parsed.username !== 'seeker_user');
          
          const chosenAvatar = avatarValid ? rawAvatar : this.getRandomMascot();

          this.profile = {
            ...INITIAL_PROFILE,
            ...parsed,
            username: parsed.username || INITIAL_PROFILE.username,
            displayName: parsed.displayName || INITIAL_PROFILE.displayName,
            hasCustomizedProfile: isCustom,
            avatarUrl: chosenAvatar,
            linkedAccounts: {
              ...INITIAL_PROFILE.linkedAccounts,
              ...(parsed.linkedAccounts || {}),
            },
          };

          if (!avatarValid) {
            this.saveProfile();
          }

          return { ...this.profile } as UserProfile;
        } catch {}
      }
    }

    const randomAvatar = this.getRandomMascot();
    this.profile = { ...INITIAL_PROFILE, avatarUrl: randomAvatar };
    this.saveProfile();
    return { ...this.profile };
  }

  static updateProfile(updates: Partial<UserProfile>): UserProfile {
    const current = this.getProfile();
    const hasCustomized = updates.hasCustomizedProfile ?? (
      updates.avatarUrl || updates.displayName || updates.username ? true : current.hasCustomizedProfile
    );
    const effectiveUsername = (updates.username || current.username || 'seeker_user').trim().replace(/^@+/, '');
    const canonicalBlinkId = updates.blinkId || `@${effectiveUsername.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}`;

    this.profile = {
      ...current,
      ...updates,
      username: effectiveUsername,
      blinkId: canonicalBlinkId,
      hasCustomizedProfile: hasCustomized,
      updatedAt: Date.now(),
    };
    this.saveProfile();
    this.notifyChange();
    return { ...this.profile };
  }

  static bindAccount(provider: keyof LinkedAccounts, handle: string): UserProfile {
    const current = this.getProfile();
    const updatedAccounts: LinkedAccounts = {
      ...current.linkedAccounts,
      [provider]: handle.trim(),
    };

    return this.updateProfile({ linkedAccounts: updatedAccounts });
  }

  static unbindAccount(provider: keyof LinkedAccounts): UserProfile {
    const current = this.getProfile();
    const updatedAccounts: LinkedAccounts = {
      ...current.linkedAccounts,
      [provider]: null,
    };

    return this.updateProfile({ linkedAccounts: updatedAccounts });
  }

  static async syncCloudProfile(addressOrEmail?: string, fallbackEmail?: string): Promise<UserProfile | null> {
    if (!addressOrEmail || typeof fetch !== 'function') return null;
    try {
      let res = await fetch(`/api/users/${encodeURIComponent(addressOrEmail)}`);
      let data = res.ok ? await res.json() : null;

      // If initial result has a temporary/auto-generated username and we have an email, check email profile
      if (
        fallbackEmail &&
        fallbackEmail.toLowerCase() !== addressOrEmail.toLowerCase() &&
        (!data?.user || !data.user.username || data.user.username.startsWith('user_') || data.user.username === 'seeker_user')
      ) {
        try {
          const emailRes = await fetch(`/api/users/${encodeURIComponent(fallbackEmail)}`);
          if (emailRes.ok) {
            const emailData = await emailRes.json();
            if (emailData?.user?.username && !emailData.user.username.startsWith('user_')) {
              data = emailData;
            }
          }
        } catch (e) {}
      }

      if (data && data.success && data.user) {
        const cloud = data.user;
        const current = this.getProfile();
        if (cloud.hasCustomizedProfile || cloud.displayName || cloud.avatarUrl || cloud.bio) {
          const updated = this.updateProfile({
            displayName: cloud.displayName || current.displayName,
            username: cloud.username || current.username,
            avatarUrl: cloud.avatarUrl || current.avatarUrl,
            bio: cloud.bio !== undefined ? cloud.bio : current.bio,
            hasCustomizedProfile: cloud.hasCustomizedProfile ?? true,
            linkedAccounts: {
              ...current.linkedAccounts,
              ...(cloud.linkedAccounts || {}),
              ...(fallbackEmail ? { email: fallbackEmail, google: fallbackEmail } : {}),
            },
          });
          return updated;
        }
      }
    } catch (err) {
      console.warn('Error syncing cloud profile:', err);
    }
    return null;
  }

  private static saveProfile(): void {
    if (typeof window !== 'undefined' && window.localStorage && this.profile) {
      try {
        window.localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(this.profile));
        if (this.profile.avatarUrl) {
          window.localStorage.setItem(STORAGE_AVATAR_BACKUP_KEY, this.profile.avatarUrl);
        }
      } catch (err) {
        console.error('Failed to save profile:', err);
      }

      // Background Cloud Sync to server database
      try {
        const p = this.profile;
        const userKey = p.address || p.publicKey || p.username;
        const payload = {
          ...p,
          address: userKey,
          publicKey: userKey,
          updatedAt: p.updatedAt || Date.now(),
        };
        fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      } catch {}
    }
  }

  private static notifyChange(): void {
    if (typeof window !== 'undefined' && window.dispatchEvent && this.profile) {
      try {
        window.dispatchEvent(
          new CustomEvent('blink_profile_updated', { detail: { ...this.profile } })
        );
      } catch {}
    }
  }

  static subscribe(callback: (profile: UserProfile) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handler = (e: any) => {
      if (e.detail) callback(e.detail);
    };
    window.addEventListener('blink_profile_updated', handler);
    return () => window.removeEventListener('blink_profile_updated', handler);
  }
}

