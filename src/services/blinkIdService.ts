/**
 * BlinkIdService - Universal Blink ID resolution and management.
 * Every created Blink account has a unique Blink ID handle (e.g. @yemi)
 * which acts as their on-chain Solana wallet address.
 */

import { PhysicalBlinkRegistry } from './physicalBlinkRegistry';

export interface ResolvedBlinkId {
  blinkId: string; // e.g. "@yemi"
  address: string; // Solana base58 public key
  displayName?: string;
  avatarUrl?: string;
  source: 'profile' | 'server' | 'physical_blink' | 'address';
}

const STORAGE_KEY = 'blink_registered_blink_ids_v1';

export class BlinkIdService {
  private static localRegistry: Record<string, ResolvedBlinkId> = {};

  static init(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          this.localRegistry = JSON.parse(stored);
        }
      } catch (e) {
        this.localRegistry = {};
      }
    }
  }

  /**
   * Format or derive a canonical Blink ID from username or wallet address.
   */
  static formatBlinkId(username?: string, address?: string): string {
    if (username && username.trim().length > 0 && username.trim().toLowerCase() !== 'seeker_user') {
      const clean = username.trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      return `@${clean}`;
    }
    if (address && address.trim().length >= 8) {
      const cleanAddr = address.trim();
      return `@user_${cleanAddr.slice(0, 4).toLowerCase()}${cleanAddr.slice(-4).toLowerCase()}`;
    }
    return '@user';
  }

  /**
   * Register a user's unique Blink ID to map to their on-chain Solana wallet address.
   */
  static async registerBlinkId(
    blinkId: string,
    address: string,
    displayName?: string,
    avatarUrl?: string,
    email?: string
  ): Promise<boolean> {
    if (!blinkId || !address) return false;

    const canonicalId = blinkId.startsWith('@') ? blinkId : `@${blinkId.trim()}`;
    const cleanKey = canonicalId.toLowerCase();

    const record: ResolvedBlinkId = {
      blinkId: canonicalId,
      address: address.trim(),
      displayName: displayName || canonicalId,
      avatarUrl: avatarUrl || '',
      source: 'profile',
    };

    // 1. Save to memory and local storage
    this.localRegistry[cleanKey] = record;
    this.localRegistry[cleanKey.replace(/^@/, '')] = record;
    this.localRegistry[address.trim().toLowerCase()] = record;

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.localRegistry));
      } catch (e) {}
    }

    // 2. Synchronize to backend server database
    if (typeof fetch === 'function') {
      try {
        await fetch('/api/blink-ids', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...record, email: email || '' }),
        });
      } catch (e) {
        // silent fail if server is temporarily unreachable
      }
    }

    return true;
  }

  /**
   * Resolve any input (Blink ID handle, username, physical blink ID, or address)
   * into an on-chain Solana wallet address.
   */
  static async resolveBlinkId(input: string): Promise<ResolvedBlinkId | null> {
    if (!input) return null;
    const trimmed = input.trim();
    if (!trimmed) return null;

    // 1. Check if the input is already a valid Solana base58 public key (32 - 44 chars)
    const isBase58SolanaAddress = /^[1-9A-HJ-NP-za-km-z]{32,44}$/.test(trimmed);
    if (isBase58SolanaAddress) {
      // Check if we have an alias for this address
      const existing = this.localRegistry[trimmed.toLowerCase()];
      if (existing) {
        return existing;
      }
      return {
        blinkId: `@${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`,
        address: trimmed,
        displayName: `${trimmed.slice(0, 6)}...${trimmed.slice(-6)}`,
        source: 'address',
      };
    }

    const cleanHandle = trimmed.replace(/^@+/, '').toLowerCase();
    const withAt = `@${cleanHandle}`;

    // 2. Check local registry
    if (this.localRegistry[withAt]) return this.localRegistry[withAt];
    if (this.localRegistry[cleanHandle]) return this.localRegistry[cleanHandle];

    // 3. Check PhysicalBlinkRegistry (Physical action blinks created on the platform)
    const cleanId = trimmed.replace(/^https?:\/\/[^\/]+\/(?:t|b)\//i, '').replace(/^\/t\//i, '');
    const physical = PhysicalBlinkRegistry.resolve(cleanId) || PhysicalBlinkRegistry.resolve(trimmed);
    if (physical && physical.recipient) {
      return {
        blinkId: `@${physical.id}`,
        address: physical.recipient,
        displayName: physical.name,
        source: 'physical_blink',
      };
    }

    // 4. Query backend server /api/blink-ids/:id
    if (typeof fetch === 'function') {
      try {
        const res = await fetch(`/api/blink-ids/${encodeURIComponent(withAt)}`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && json.data?.address) {
            const resolved: ResolvedBlinkId = {
              blinkId: json.data.blinkId || withAt,
              address: json.data.address,
              displayName: json.data.displayName || json.data.username || withAt,
              avatarUrl: json.data.avatarUrl,
              source: 'server',
            };
            this.localRegistry[withAt] = resolved;
            this.localRegistry[cleanHandle] = resolved;
            return resolved;
          }
        }
      } catch (err) {}

      // Fallback query to /api/users/:id
      try {
        const resUser = await fetch(`/api/users/${encodeURIComponent(cleanHandle)}`);
        if (resUser.ok) {
          const json = await resUser.json();
          const u = json.user;
          const userAddress = u?.address || u?.publicKey;
          if (userAddress) {
            const resolved: ResolvedBlinkId = {
              blinkId: `@${u.username || cleanHandle}`,
              address: userAddress,
              displayName: u.displayName || u.username,
              avatarUrl: u.avatarUrl,
              source: 'server',
            };
            this.localRegistry[withAt] = resolved;
            this.localRegistry[cleanHandle] = resolved;
            return resolved;
          }
        }
      } catch (err) {}
    }

    return null;
  }

  /**
   * Check if a username is available or already taken by another user.
   */
  static async isUsernameAvailable(
    username: string,
    currentAddress?: string,
    currentEmail?: string
  ): Promise<{ available: boolean; reason?: string; suggested?: string; isOwner?: boolean }> {
    if (!username || username.trim().length === 0) {
      return { available: false, reason: 'Username cannot be empty.' };
    }

    const clean = username.trim().replace(/^@+/, '').toLowerCase();

    if (clean.length < 2) {
      return { available: false, reason: 'Username must be at least 2 characters.' };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      return { available: false, reason: 'Username may only contain letters, numbers, and underscores.' };
    }

    const reserved = ['admin', 'root', 'system', 'blink', 'seeker', 'solana', 'official', 'support', 'help', 'api'];
    if (reserved.includes(clean)) {
      return { available: false, reason: `@${clean} is a reserved system handle.` };
    }

    // 1. Query server check API
    if (typeof fetch === 'function') {
      try {
        const query = new URLSearchParams({
          username: clean,
          address: currentAddress || '',
          email: currentEmail || '',
        });
        const res = await fetch(`/api/users/check-username?${query.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.available === 'boolean') {
            return {
              available: data.available,
              reason: data.reason || (data.available ? undefined : `@${clean} is already taken.`),
              suggested: data.suggested,
              isOwner: Boolean(data.isOwner),
            };
          }
        }
      } catch (err) {
        console.warn('Check username network warning:', err);
      }
    }

    // 2. Local fallback check
    const local = this.localRegistry[clean] || this.localRegistry[`@${clean}`];
    if (local && local.address) {
      if (currentAddress && local.address.toLowerCase() === currentAddress.toLowerCase()) {
        return { available: true, isOwner: true };
      }
      return {
        available: false,
        reason: `@${clean} is taken by another account.`,
        suggested: `${clean}_${Math.floor(100 + Math.random() * 900)}`,
      };
    }

    return { available: true, suggested: clean };
  }

  /**
   * Find an available unique username based on an initial candidate.
   * If candidate is taken, automatically derives a unique random variant.
   */
  static async findAvailableUsername(
    baseName: string,
    currentAddress?: string,
    currentEmail?: string
  ): Promise<string> {
    const cleanBase = (baseName || 'user')
      .trim()
      .replace(/^@+/, '')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .toLowerCase()
      .slice(0, 15);

    const initialCandidate = cleanBase.length >= 2 ? cleanBase : 'user';

    const check = await this.isUsernameAvailable(initialCandidate, currentAddress, currentEmail);
    if (check.available || check.isOwner) {
      return initialCandidate;
    }

    if (check.suggested) {
      const checkSuggested = await this.isUsernameAvailable(check.suggested, currentAddress, currentEmail);
      if (checkSuggested.available || checkSuggested.isOwner) {
        return check.suggested;
      }
    }

    // Generate random variants
    for (let i = 0; i < 15; i++) {
      const candidate = `${initialCandidate}_${Math.floor(100 + Math.random() * 900)}`;
      const cCheck = await this.isUsernameAvailable(candidate, currentAddress, currentEmail);
      if (cCheck.available || cCheck.isOwner) {
        return candidate;
      }
    }

    return `user_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Get all registered Blink IDs for suggestions.
   */
  static getKnownBlinkIds(): ResolvedBlinkId[] {
    const seen = new Set<string>();
    const list: ResolvedBlinkId[] = [];
    for (const item of Object.values(this.localRegistry)) {
      if (item && item.address && !seen.has(item.address)) {
        seen.add(item.address);
        list.push(item);
      }
    }
    return list;
  }
}

// Auto-initialize
BlinkIdService.init();
