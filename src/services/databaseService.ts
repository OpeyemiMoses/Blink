import { PhysicalBlink, ActionType } from './physicalBlinkRegistry';
import { getApiUrl } from './apiConfig';

export interface UserRecord {
  id: string;
  address: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  bio?: string;
  email?: string | null;
  provider?: string;
  createdAt: number;
  lastLoginAt: number;
}

const STORAGE_USERS_KEY = 'blink_db_users_v1';
const STORAGE_BLINKS_KEY = 'blink_db_blinks_v1';
const STORAGE_BOOKMARKS_KEY = 'blink_db_bookmarks_v1';

export class DatabaseService {
  private static users: Record<string, UserRecord> = {};
  private static blinks: PhysicalBlink[] = [];
  private static bookmarks: Set<string> = new Set();
  private static initialized: boolean = false;

  private static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof window !== 'undefined' && window.localStorage) {
      // 1. Load Users
      try {
        const storedUsers = window.localStorage.getItem(STORAGE_USERS_KEY);
        if (storedUsers) {
          this.users = JSON.parse(storedUsers) || {};
        }
      } catch (err) {
        console.warn('Failed to load users from DB storage:', err);
      }

      // 2. Load Blinks
      try {
        const storedBlinks = window.localStorage.getItem(STORAGE_BLINKS_KEY);
        if (storedBlinks) {
          const parsed = JSON.parse(storedBlinks);
          if (Array.isArray(parsed)) {
            this.blinks = parsed;
          }
        }
      } catch (err) {
        console.warn('Failed to load blinks from DB storage:', err);
      }

      // 3. Load Bookmarks
      try {
        const storedBookmarks = window.localStorage.getItem(STORAGE_BOOKMARKS_KEY);
        if (storedBookmarks) {
          const parsed = JSON.parse(storedBookmarks);
          if (Array.isArray(parsed)) {
            this.bookmarks = new Set(parsed);
          }
        }
      } catch (err) {
        console.warn('Failed to load bookmarks from DB storage:', err);
      }
    }
  }

  // ─── USER DATA OPERATIONS ───────────────────────────────────────────
  static saveUserAccount(userData: Partial<UserRecord> & { address?: string; publicKey?: string; name?: string }): UserRecord {
    this.init();
    const address = userData.address || userData.publicKey || (userData as any)?.id || 'unknown';
    const safeAddress = typeof address === 'string' && address.length > 0 ? address : 'unknown_user';
    const existing = this.users[safeAddress];
    const now = Date.now();

    const shortId = safeAddress.length >= 8 ? safeAddress.slice(0, 8) : safeAddress;
    const shortEnd = safeAddress.length >= 4 ? safeAddress.slice(-4) : safeAddress;
    const derivedFromEmail = userData.email ? userData.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() : null;
    const finalUsername = (userData.username && userData.username !== 'seeker_user' && !/^[1-9A-HJ-NP-za-km-z]{32,44}$/.test(userData.username))
      ? userData.username
      : (existing?.username && existing.username !== 'seeker_user' && !/^[1-9A-HJ-NP-za-km-z]{32,44}$/.test(existing.username))
      ? existing.username
      : (derivedFromEmail || 'mybitcoind');

    const updatedUser: UserRecord = {
      id: existing?.id || (userData as any)?.id || `usr_${shortId}`,
      address: safeAddress,
      displayName: userData.displayName || (userData as any)?.name || existing?.displayName || finalUsername,
      username: finalUsername,
      avatarUrl: userData.avatarUrl || existing?.avatarUrl || '',
      bio: userData.bio !== undefined ? userData.bio : existing?.bio,
      email: userData.email !== undefined ? userData.email : existing?.email,
      provider: userData.provider || existing?.provider || 'privy',
      createdAt: existing?.createdAt || now,
      lastLoginAt: now,
    };

    this.users[safeAddress] = updatedUser;
    this.persistUsers();
    this.emitEvent('blink_user_saved', updatedUser);

    // Sync to cloud backend in background so user carries over across all devices
    if (typeof fetch === 'function') {
      fetch(getApiUrl('/api/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser),
      }).catch((err) => {
        console.warn('Background sync user error:', err);
      });
    }

    return updatedUser;
  }

  /**
   * Sync a user account from cloud backend across devices.
   */
  static async syncUserFromCloud(identifier: string): Promise<UserRecord | null> {
    if (!identifier || typeof fetch !== 'function') return null;
    try {
      const res = await fetch(getApiUrl(`/api/users/${encodeURIComponent(identifier)}`));
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          const user = data.user as UserRecord;
          this.init();
          const safeKey = user.address || identifier;
          this.users[safeKey] = {
            ...this.users[safeKey],
            ...user,
          };
          this.persistUsers();
          this.emitEvent('blink_user_saved', this.users[safeKey]);
          return this.users[safeKey];
        }
      }
    } catch (err) {
      console.warn('Could not sync user from cloud:', err);
    }
    return null;
  }

  static getUser(address: string): UserRecord | null {
    this.init();
    return this.users[address] || null;
  }

  static getAllUsers(): UserRecord[] {
    this.init();
    return Object.values(this.users);
  }

  private static persistUsers(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(this.users));
      } catch (err) {
        console.error('Failed to persist users:', err);
      }
    }
  }

  // ─── BLINK OPERATIONS ───────────────────────────────────────────────
  static getAllBlinks(): PhysicalBlink[] {
    this.init();
    return [...this.blinks];
  }

  static getBlinkById(id: string): PhysicalBlink | null {
    this.init();
    return this.blinks.find((b) => b.id === id) || null;
  }

  static saveBlink(blink: PhysicalBlink): PhysicalBlink {
    this.init();
    const cleanId = (blink.id || '').toLowerCase();
    const existingIndex = this.blinks.findIndex((b) => (b.id || '').toLowerCase() === cleanId);
    if (existingIndex >= 0) {
      this.blinks[existingIndex] = {
        ...this.blinks[existingIndex],
        ...blink,
        imageUrl: blink.imageUrl !== undefined ? blink.imageUrl : this.blinks[existingIndex].imageUrl,
        updatedAt: Date.now(),
      };
    } else {
      this.blinks.unshift({
        ...blink,
        createdAt: blink.createdAt || Date.now(),
        updatedAt: Date.now(),
      });
    }

    this.persistBlinks();
    this.emitEvent('blink_database_updated', this.blinks);
    this.emitEvent('blink_registry_updated', this.blinks);
    return { ...blink };
  }

  static updateBlink(id: string, updates: Partial<PhysicalBlink>): PhysicalBlink | null {
    this.init();
    const cleanId = (id || '').toLowerCase();
    const index = this.blinks.findIndex((b) => (b.id || '').toLowerCase() === cleanId);
    if (index === -1) return null;

    this.blinks[index] = {
      ...this.blinks[index],
      ...updates,
      updatedAt: Date.now(),
    };

    this.persistBlinks();
    this.emitEvent('blink_database_updated', this.blinks);
    this.emitEvent('blink_registry_updated', this.blinks);
    return { ...this.blinks[index] };
  }

  static deleteBlink(id: string): boolean {
    this.init();
    const initialLen = this.blinks.length;
    this.blinks = this.blinks.filter((b) => b.id !== id);
    const removed = this.blinks.length < initialLen;
    if (removed) {
      this.bookmarks.delete(id);
      this.persistBlinks();
      this.persistBookmarks();
      this.emitEvent('blink_database_updated', this.blinks);
      this.emitEvent('blink_registry_updated', this.blinks);
    }
    return removed;
  }

  static clearAllBlinks(): void {
    this.init();
    this.blinks = [];
    this.bookmarks.clear();
    this.persistBlinks();
    this.persistBookmarks();
    this.emitEvent('blink_database_updated', this.blinks);
    this.emitEvent('blink_registry_updated', this.blinks);
  }

  private static persistBlinks(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_BLINKS_KEY, JSON.stringify(this.blinks));
        window.localStorage.setItem('blink_physical_registry', JSON.stringify(this.blinks));
        window.localStorage.setItem('justblink_physical_registry', JSON.stringify(this.blinks));
      } catch (err) {
        console.error('Failed to persist blinks:', err);
      }
    }
  }

  // ─── BOOKMARKS / SAVED BLINKS ───────────────────────────────────────
  static isBookmarked(blinkId: string): boolean {
    this.init();
    return this.bookmarks.has(blinkId);
  }

  static toggleBookmark(blinkId: string): boolean {
    this.init();
    let isNowBookmarked: boolean;
    if (this.bookmarks.has(blinkId)) {
      this.bookmarks.delete(blinkId);
      isNowBookmarked = false;
    } else {
      this.bookmarks.add(blinkId);
      isNowBookmarked = true;
    }

    this.persistBookmarks();
    this.emitEvent('blink_bookmarks_updated', Array.from(this.bookmarks));
    return isNowBookmarked;
  }

  static getBookmarkedIds(): string[] {
    this.init();
    return Array.from(this.bookmarks);
  }

  static getBookmarkedBlinks(): PhysicalBlink[] {
    this.init();
    // 1. Gather all blinks from DatabaseService's local blinks
    const allBlinksMap = new Map<string, PhysicalBlink>();
    for (const b of this.blinks) {
      if (b && b.id) allBlinksMap.set(b.id, b);
    }

    // 2. Also load from physical registry in localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const rawRegistry = window.localStorage.getItem('justblink_physical_registry');
        if (rawRegistry) {
          const regBlinks = JSON.parse(rawRegistry);
          if (Array.isArray(regBlinks)) {
            for (const b of regBlinks) {
              if (b && b.id) {
                const existing = allBlinksMap.get(b.id);
                if (!existing || (b.updatedAt && (!existing.updatedAt || b.updatedAt > existing.updatedAt))) {
                  allBlinksMap.set(b.id, b);
                }
              }
            }
          }
        }
      } catch {}
    }



    const bookmarked: PhysicalBlink[] = [];
    for (const id of this.bookmarks) {
      const found = allBlinksMap.get(id);
      if (found) {
        bookmarked.push(found);
      }
    }
    return bookmarked;
  }

  private static persistBookmarks(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(
          STORAGE_BOOKMARKS_KEY,
          JSON.stringify(Array.from(this.bookmarks))
        );
      } catch (err) {
        console.error('Failed to persist bookmarks:', err);
      }
    }
  }

  // ─── EVENT DISPATCH ─────────────────────────────────────────────────
  private static emitEvent(name: string, detail: any): void {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      try {
        window.dispatchEvent(new CustomEvent(name, { detail }));
      } catch {}
    }
  }
}
