import { getApiUrl, DEFAULT_CLOUD_API_URL } from './apiConfig';

export type ActionType = 'payment' | 'tip' | 'claim' | 'mint' | 'checkin' | 'donation' | 'voucher';
export type BlinkVisibility = 'global' | 'physical';

export interface PhysicalBlink {
  id: string; // e.g. "coffee-shop-001"
  name: string; // e.g. "Dean's Coffee Counter"
  actionType: ActionType;
  amount: number;
  token: 'USDC' | 'SOL' | 'SKR';
  recipient: string;
  creatorAddress?: string;
  owner?: string;
  description: string;
  verifiedDomain?: string;
  visibility?: BlinkVisibility; // 'global' (Explore feed, shareable anywhere) or 'physical' (on-site tap, private POS)
  baseUsdcAmount?: number;
  imageUrl?: string;
  createdAt: number;
  updatedAt: number;
  stats: {
    taps: number;
    completed: number;
    volumeUsdc: number;
  };
}

import { DatabaseService } from './databaseService';
import { PriceService } from './priceService';

const STORAGE_REGISTRY_KEY = 'justblink_physical_registry';
const LEGACY_STORAGE_KEY = 'blink_physical_registry';

export class PhysicalBlinkRegistry {
  private static blinks: PhysicalBlink[] = [];
  private static globalCloudBlinks: PhysicalBlink[] = [];
  private static tombstonedDeletedIds = new Set<string>();
  private static isSyncing = false;

  /**
   * Fetch global shareable blinks and creator blinks from the cloud backend.
   */
  static async syncFromCloud(): Promise<PhysicalBlink[]> {
    if (typeof fetch === 'undefined') return [];
    try {
      this.isSyncing = true;
      const primaryUrl = getApiUrl('/api/blinks');
      const fallbackUrl = `${DEFAULT_CLOUD_API_URL}/api/blinks`;
      const endpoints = primaryUrl === fallbackUrl ? [primaryUrl] : [primaryUrl, fallbackUrl];

      let data: any = null;
      for (const ep of endpoints) {
        try {
          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;
          const res = await fetch(ep, {
            headers: { 'Accept': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
            signal: controller?.signal,
          });
          if (timer) clearTimeout(timer);
          if (res.ok) {
            const parsed = await res.json();
            if (parsed && parsed.success && Array.isArray(parsed.blinks)) {
              data = parsed;
              break;
            }
          }
        } catch {}
      }

      if (data && Array.isArray(data.blinks)) {
          // Register tombstones from server
          if (Array.isArray(data.deletedIds)) {
            for (const dId of data.deletedIds) {
              this.tombstonedDeletedIds.add(String(dId).toLowerCase().trim());
            }
          }

          // Filter out any tombstoned IDs immediately
          this.globalCloudBlinks = data.blinks.filter(
            (b: PhysicalBlink) => b && b.id && !this.tombstonedDeletedIds.has(b.id.toLowerCase().trim())
          );
          let current = this.loadRegistry();
          let changed = false;

          // Purge legacy mock default Blinks if present in local cache
          const mockIds = ['tip-solana-dev', 'mint-seeker-pioneer', 'charity-clean-oceans', 'voucher-hacker-house', 'voucher-coffee-seeker'];
          for (const mId of mockIds) {
            const beforeLen = current.length;
            current = current.filter(b => b.id.toLowerCase() !== mId);
            this.globalCloudBlinks = this.globalCloudBlinks.filter(b => b.id.toLowerCase() !== mId);
            if (current.length < beforeLen) changed = true;
            DatabaseService.deleteBlink(mId);
          }

          // Purge any globally deleted Blinks tombstoned locally or by cloud server
          for (const delId of this.tombstonedDeletedIds) {
            const cleanDel = String(delId).toLowerCase().trim();
            const beforeLen = current.length;
            current = current.filter(b => b.id.toLowerCase() !== cleanDel);
            this.globalCloudBlinks = this.globalCloudBlinks.filter(b => b.id.toLowerCase() !== cleanDel);
            if (current.length < beforeLen) changed = true;
            DatabaseService.deleteBlink(cleanDel);
          }

          if (data.blinks.length === 0) {
            current = current.filter(b => !!(b as any).creatorAddress || !!b.recipient);
            this.blinks = current;
            this.saveRegistry();
          } else {
            for (const cb of this.globalCloudBlinks) {
              if (this.tombstonedDeletedIds.has(cb.id.toLowerCase())) continue;
              const existingIdx = current.findIndex(b => b.id.toLowerCase() === cb.id.toLowerCase());
              if (existingIdx >= 0) {
                const existing = current[existingIdx];
                const maxTaps = Math.max(existing.stats?.taps || 0, cb.stats?.taps || 0);
                const maxCompleted = Math.max(existing.stats?.completed || 0, cb.stats?.completed || 0);
                const maxVolume = Math.max(existing.stats?.volumeUsdc || 0, cb.stats?.volumeUsdc || 0);

                current[existingIdx] = {
                  ...existing,
                  ...cb,
                  imageUrl: cb.imageUrl || existing.imageUrl,
                  stats: {
                    taps: maxTaps,
                    completed: maxCompleted,
                    volumeUsdc: maxVolume,
                  },
                };
                DatabaseService.saveBlink(current[existingIdx]);
                changed = true;
              } else {
                // Incorporate cloud blink so previously created blinks appear in all views
                current.push(cb);
                DatabaseService.saveBlink(cb);
                changed = true;
              }
            }
          }
          if (changed) {
            this.blinks = current;
            this.saveRegistry();
          }
          this.notifyChange();
          return this.globalCloudBlinks;
        }
    } catch (err) {
      console.warn('Could not sync blinks from cloud:', err);
    } finally {
      this.isSyncing = false;
    }
    return this.globalCloudBlinks;
  }

  /**
   * Get all global public blinks (Tips, Mints, Donations, Vouchers).
   */
  static getGlobalBlinks(): PhysicalBlink[] {
    const localList = this.loadRegistry();
    const localGlobal = localList.filter(b => b.visibility === 'global');
    
    // Combine cloud and local global blinks, ensuring the freshest updated item is used
    const combined = [...localGlobal];
    for (const cb of this.globalCloudBlinks) {
      if (cb.visibility === 'global') {
        const existIdx = combined.findIndex(b => b.id.toLowerCase() === cb.id.toLowerCase());
        if (existIdx >= 0) {
          if ((cb.updatedAt || 0) > (combined[existIdx].updatedAt || 0)) {
            combined[existIdx] = cb;
          }
        } else {
          combined.push(cb);
        }
      }
    }
    return combined;
  }

  static loadRegistry(forceReload = false): PhysicalBlink[] {
    if (!forceReload && this.blinks.length > 0) {
      return [...this.blinks];
    }

    // Combine items from memory, DatabaseService, localStorage, and globalCloudBlinks
    const dbBlinks = DatabaseService.getAllBlinks() || [];
    let localStored: PhysicalBlink[] = [];
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored =
        window.localStorage.getItem('blink_physical_registry') ||
        window.localStorage.getItem(STORAGE_REGISTRY_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) localStored = parsed;
        } catch {}
      }
    }

    const map = new Map<string, PhysicalBlink>();

    // Merge in order: memory -> localStored -> dbBlinks -> globalCloudBlinks
    const allSources = [...this.blinks, ...localStored, ...dbBlinks, ...this.globalCloudBlinks];
    for (const b of allSources) {
      if (!b || !b.id) continue;
      const key = b.id.trim().toLowerCase();
      if (this.tombstonedDeletedIds.has(key)) continue;

      // Ensure SKR Blinks always have a valid baseUsdcAmount.
      // For legacy blinks without it, back-calculate from the stored SKR amount
      // using the live SKR price reversed through the 10% discount.
      if (b.token === 'SKR') {
        if (!b.baseUsdcAmount || b.baseUsdcAmount <= 0) {
          const liveSkrPrice = PriceService.getSkrPriceSync();
          if (b.id === 'tip-jar') {
            b.baseUsdcAmount = 4.0;
          } else if (b.amount > 0 && liveSkrPrice > 0) {
            // Reverse: stored SKR amount was discounted USDC / skrPrice
            // So original USDC = storedSKR * skrPrice / discountMultiplier (0.9 for 10% off)
            // Round to nearest $0.50 for clean display
            const reversedUsdc = (b.amount * liveSkrPrice) / 0.9;
            b.baseUsdcAmount = Math.max(0.5, Math.round(reversedUsdc * 2) / 2);
          } else {
            b.baseUsdcAmount = 4.0; // last-resort fallback
          }
        }
      }

      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...b });
      } else {
        // Merge stats keeping max values
        const maxTaps = Math.max(existing.stats?.taps || 0, b.stats?.taps || 0);
        const maxCompleted = Math.max(existing.stats?.completed || 0, b.stats?.completed || 0);
        const maxVolume = Math.max(existing.stats?.volumeUsdc || 0, b.stats?.volumeUsdc || 0);

        map.set(key, {
          ...existing,
          ...b,
          baseUsdcAmount: b.baseUsdcAmount || existing.baseUsdcAmount || (key === 'tip-jar' ? 4.0 : undefined),
          stats: {
            taps: maxTaps,
            completed: maxCompleted,
            volumeUsdc: maxVolume,
          },
          updatedAt: Math.max(existing.updatedAt || 0, b.updatedAt || 0),
        });
      }
    }

    this.blinks = Array.from(map.values());
    this.saveRegistry();
    return [...this.blinks];
  }

  private static saveRegistry(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const serialized = JSON.stringify(this.blinks);
        window.localStorage.setItem(STORAGE_REGISTRY_KEY, serialized);
        window.localStorage.setItem('blink_physical_registry', serialized);
        window.localStorage.setItem('blink_db_blinks_v1', serialized);
      } catch (err) {
        console.error('Failed to save registry to localStorage:', err);
      }
    }
  }

  static notifyChange(blink?: PhysicalBlink) {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      try {
        window.dispatchEvent(new CustomEvent('blink_registry_updated', { detail: blink }));
        window.dispatchEvent(new CustomEvent('blink_database_updated', { detail: blink }));
        window.dispatchEvent(new CustomEvent('blink_updated', { detail: blink }));
      } catch {}
    }
  }

  /**
   * Check if a Blink ID is already in use by another creator.
   */
  static isIdTakenByOther(id: string, myAddress?: string): boolean {
    const cleanId = id.trim().toLowerCase();
    const myClean = (myAddress || '').trim().toLowerCase();
    const list = this.loadRegistry();
    const existing = list.find(b => b.id.toLowerCase() === cleanId && !this.tombstonedDeletedIds.has(b.id.toLowerCase())) ||
      this.globalCloudBlinks.find(b => b.id.toLowerCase() === cleanId && !this.tombstonedDeletedIds.has(b.id.toLowerCase()));
    if (!existing) return false;
    const existingCreator = (existing.creatorAddress || existing.recipient || '').trim().toLowerCase();
    if (!myClean) return true;
    return existingCreator !== myClean;
  }

  /**
   * Return all registered blinks matching a given ID or query, allowing payers to choose
   * the exact creator they want to pay if multiple creators use the same ID name.
   */
  static resolveAll(idOrQuery: string): PhysicalBlink[] {
    const list = this.loadRegistry();
    const clean = idOrQuery.trim().toLowerCase().replace(/^.*\/t\//, '').split('?')[0];
    const results: PhysicalBlink[] = [];
    const seen = new Set<string>();

    for (const b of [...list, ...this.globalCloudBlinks]) {
      if (!b || !b.id || this.tombstonedDeletedIds.has(b.id.toLowerCase())) continue;
      if (b.id.toLowerCase() === clean || (b.name && b.name.toLowerCase().includes(clean))) {
        const uniqueKey = `${b.id.toLowerCase()}::${(b.creatorAddress || b.recipient).toLowerCase()}`;
        if (!seen.has(uniqueKey)) {
          seen.add(uniqueKey);
          results.push(b);
        }
      }
    }
    return results;
  }

  /**
   * Resolve a Physical ID, tag payload, or URL into a programmed Action.
   * Supports:
   * 1. Direct ID matching (local or cloud)
   * 2. URL with embedded parameters (/t/<id>?name=...&amount=...&recipient=...)
   * 3. Scoped @creator/id syntax
   * 4. Disambiguation by creator address
   */
  static resolve(idOrUrl: string, creatorAddress?: string): PhysicalBlink | null {
    const list = this.loadRegistry();
    const clean = idOrUrl.trim();

    // 1. Check if URL contains query parameters (self-contained action link)
    if (clean.includes('?')) {
      try {
        const [pathPart, queryPart] = clean.split('?');
        const params = new URLSearchParams(queryPart);
        const match = pathPart.match(/\/t\/([a-zA-Z0-9_-]+)/);
        const extractedId = match ? match[1] : pathPart.replace(/.*\/t\//, '').trim();

        if (extractedId && params.get('recipient')) {
          const paramBlink: PhysicalBlink = {
            id: extractedId.toLowerCase(),
            name: decodeURIComponent(params.get('name') || 'Solana Action'),
            actionType: (params.get('type') as ActionType) || 'payment',
            amount: parseFloat(params.get('amount') || '0.01') || 0.01,
            token: (params.get('token') as 'USDC' | 'SOL' | 'SKR') || 'SOL',
            recipient: params.get('recipient') || '',
            creatorAddress: params.get('creator') || params.get('recipient') || '',
            description: decodeURIComponent(params.get('desc') || 'Physical Solana Blink transaction'),
            verifiedDomain: params.get('domain') ? decodeURIComponent(params.get('domain')!) : undefined,
            visibility: (params.get('visibility') as BlinkVisibility) || 'physical',
            baseUsdcAmount: (() => {
              const rawBaseUsdc = params.get('baseUsdc') ? parseFloat(params.get('baseUsdc')!) : null;
              if (rawBaseUsdc && rawBaseUsdc > 0) return rawBaseUsdc;
              // Fallback: back-calculate from stored SKR amount using live price
              const rawAmount = parseFloat(params.get('amount') || '0');
              const rawToken = params.get('token') || 'SOL';
              if (rawToken === 'SKR' && rawAmount > 0) {
                const liveSkrPrice = PriceService.getSkrPriceSync();
                if (liveSkrPrice > 0) {
                  const reversedUsdc = (rawAmount * liveSkrPrice) / 0.9;
                  return Math.max(0.5, Math.round(reversedUsdc * 2) / 2);
                }
              }
              if (extractedId.toLowerCase() === 'tip-jar') return 4.0;
              return undefined;
            })(),
            imageUrl: params.get('image') ? decodeURIComponent(params.get('image')!) : undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            stats: { taps: 1, completed: 0, volumeUsdc: 0 },
          };
          return paramBlink;
        }
      } catch (e) {
        console.warn('Error parsing self-contained blink link:', e);
      }
    }

    // 2. Check for @creator/slug syntax
    if (clean.includes('/') && !clean.startsWith('http')) {
      const parts = clean.split('/');
      if (parts.length === 2 && parts[0].startsWith('@')) {
        const creatorHandle = parts[0].replace(/^@/, '').toLowerCase();
        const blinkId = parts[1].toLowerCase();
        const scopedMatch = [...list, ...this.globalCloudBlinks].find(b => 
          b && b.id && b.id.toLowerCase() === blinkId && !this.tombstonedDeletedIds.has(b.id.toLowerCase()) && (
            (b.creatorAddress && b.creatorAddress.toLowerCase().includes(creatorHandle)) ||
            (b.recipient && b.recipient.toLowerCase().includes(creatorHandle)) ||
            ((b as any).verifiedDomain && (b as any).verifiedDomain.toLowerCase().includes(creatorHandle))
          )
        );
        if (scopedMatch) return scopedMatch;
      }
    }

    // 3. Creator-specific lookup if creatorAddress provided
    if (creatorAddress) {
      const cClean = creatorAddress.toLowerCase().trim();
      const creatorMatch = [...list, ...this.globalCloudBlinks].find(b => 
        b && b.id && b.id.toLowerCase() === clean.toLowerCase() && !this.tombstonedDeletedIds.has(b.id.toLowerCase()) && (
          (b.creatorAddress && b.creatorAddress.toLowerCase() === cClean) ||
          (b.recipient && b.recipient.toLowerCase() === cClean)
        )
      );
      if (creatorMatch) return creatorMatch;
    }

    // 4. Check local list by direct ID
    const directMatch = list.find(b => b.id.toLowerCase() === clean.toLowerCase() && !this.tombstonedDeletedIds.has(b.id.toLowerCase()));
    if (directMatch) return directMatch;

    // 5. Check cloud cache by direct ID
    const cloudMatch = this.globalCloudBlinks.find(b => b.id.toLowerCase() === clean.toLowerCase() && !this.tombstonedDeletedIds.has(b.id.toLowerCase()));
    if (cloudMatch) return cloudMatch;

    // 6. Check if it's a URL ending with /t/<id>
    const match = clean.match(/\/t\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const id = match[1].toLowerCase();
      if (!this.tombstonedDeletedIds.has(id)) {
        const found = list.find(b => b.id.toLowerCase() === id);
        if (found) return found;
        const foundCloud = this.globalCloudBlinks.find(b => b.id.toLowerCase() === id);
        if (foundCloud) return foundCloud;
      }
    }

    return null;
  }

  /**
   * Look up a Blink by ID from memory, DatabaseService, or cloud cache.
   */
  static getBlinkById(id: string): PhysicalBlink | null {
    if (!id) return null;
    const clean = id.trim().toLowerCase();
    const resolved = this.resolve(clean);
    if (resolved) return resolved;
    return DatabaseService.getBlinkById(clean);
  }

  /**
   * Alias for getBlinkById
   */
  static getById(id: string): PhysicalBlink | null {
    return this.getBlinkById(id);
  }

  /**
   * Create a new Physical Blink in Blink Studio.
   */
  static createBlink(data: Omit<PhysicalBlink, 'createdAt' | 'updatedAt' | 'stats'>): PhysicalBlink {
    const list = this.loadRegistry(true);
    const cleanId = data.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    // Auto-detect visibility if not explicitly passed:
    // Tips, mints, donations, vouchers, claims -> 'global'
    // In-person payments (food, coffee, retail) -> 'physical'
    const globalActionTypes: ActionType[] = ['tip', 'mint', 'donation', 'voucher', 'claim'];
    const visibility: BlinkVisibility = data.visibility || (globalActionTypes.includes(data.actionType) ? 'global' : 'physical');

    const isSkr = data.token === 'SKR';
    let baseUsdc = data.baseUsdcAmount;
    let initialAmount = data.amount;
    if (isSkr) {
      if (!baseUsdc || baseUsdc <= 0) {
        baseUsdc = data.amount > 50 ? 4.0 : data.amount;
      }
      initialAmount = PriceService.getSkrPaymentDetails(baseUsdc).skrAmount;
    }

    const newBlink: PhysicalBlink = {
      ...data,
      id: cleanId,
      amount: initialAmount,
      baseUsdcAmount: baseUsdc,
      imageUrl: data.imageUrl || undefined,
      visibility,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stats: {
        taps: 0,
        completed: 0,
        volumeUsdc: 0,
      },
    };

    // Replace if exists, or append
    const idx = list.findIndex(b => b.id === cleanId);
    if (idx >= 0) {
      list[idx] = newBlink;
    } else {
      list.unshift(newBlink);
    }

    this.blinks = list;
    this.saveRegistry();
    DatabaseService.saveBlink(newBlink);
    this.notifyChange(newBlink);

    // Dispatch instant creation events so lists update in real-time without page reload
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      try {
        window.dispatchEvent(new CustomEvent('blink_created', { detail: newBlink }));
        window.dispatchEvent(new CustomEvent('blink_registered', { detail: newBlink }));
        window.dispatchEvent(new CustomEvent('tapblink_blink_registered', { detail: newBlink }));
      } catch {}
    }

    // Sync to cloud backend in background
    if (typeof fetch === 'function') {
      fetch(getApiUrl('/api/blinks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBlink),
      }).catch(() => {});
    }

    return newBlink;
  }

  /**
   * Update an existing Physical Blink (The physical object stays in place, the Action changes!).
   */
  static updateBlink(
    id: string,
    updates: Partial<Omit<PhysicalBlink, 'id' | 'createdAt' | 'stats'>>
  ): PhysicalBlink | null {
    const list = this.loadRegistry(true);
    const cleanId = id.trim().toLowerCase();
    const idx = list.findIndex(b => b.id.toLowerCase() === cleanId);
    if (idx === -1) return null;

    const currentItem = list[idx];
    const isSkr = (updates.token || currentItem.token) === 'SKR';
    let finalAmount = currentItem.amount;
    let baseUsdcAmount = currentItem.baseUsdcAmount;

    if (updates.amount !== undefined) {
      const parsed = typeof updates.amount === 'number'
        ? updates.amount
        : parseFloat(String(updates.amount).replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed) && parsed >= 0) {
        if (isSkr) {
          baseUsdcAmount = parsed > 50 ? (currentItem.baseUsdcAmount || 4.0) : parsed;
          finalAmount = PriceService.getSkrPaymentDetails(baseUsdcAmount).skrAmount;
        } else {
          finalAmount = parsed;
          baseUsdcAmount = parsed;
        }
      }
    }

    // Protect SKR blinks: baseUsdcAmount must NEVER default to finalAmount (which is the SKR token quantity!)
    const effectiveBaseUsdc = updates.baseUsdcAmount !== undefined
      ? updates.baseUsdcAmount
      : (isSkr ? (baseUsdcAmount || currentItem.baseUsdcAmount || 4.0) : (baseUsdcAmount || finalAmount));

    if (isSkr && effectiveBaseUsdc) {
      finalAmount = PriceService.getSkrPaymentDetails(effectiveBaseUsdc).skrAmount;
    }

    const updatedItem: PhysicalBlink = {
      ...currentItem,
      ...updates,
      amount: finalAmount,
      baseUsdcAmount: effectiveBaseUsdc,
      imageUrl: updates.imageUrl !== undefined ? updates.imageUrl : currentItem.imageUrl,
      updatedAt: Date.now(),
    };

    list[idx] = updatedItem;
    this.blinks = [...list];

    // Synchronize in-memory cloud blinks cache so it reflects the updated price immediately
    const cloudIdx = this.globalCloudBlinks.findIndex(b => b.id.toLowerCase() === cleanId);
    if (cloudIdx >= 0) {
      this.globalCloudBlinks[cloudIdx] = { ...this.globalCloudBlinks[cloudIdx], ...updatedItem };
    }

    // Keep DatabaseService in-memory and disk storage synchronized
    DatabaseService.saveBlink(updatedItem);

    this.saveRegistry();
    this.notifyChange(updatedItem);

    if (typeof fetch === 'function') {
      fetch(getApiUrl('/api/blinks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedItem),
      }).catch(() => {});
    }

    return updatedItem;
  }

  /**
   * Update an existing Physical Blink Action (alias for updateBlink).
   */
  static updateAction(
    id: string,
    updates: Partial<Omit<PhysicalBlink, 'id' | 'createdAt' | 'stats'>>
  ): PhysicalBlink | null {
    return this.updateBlink(id, updates);
  }

  /**
   * Delete a Physical Blink permanently from local registry, DatabaseService, in-memory caches, and cloud database.
   */
  static deleteBlink(id: string, requesterAddress?: string): boolean {
    const list = this.loadRegistry(true);
    const cleanId = id.trim().toLowerCase();

    // 0. Register tombstone locally so background fetches never resurrect it
    this.tombstonedDeletedIds.add(cleanId);

    // 1. Remove from local memory list
    this.blinks = list.filter(b => b.id.toLowerCase() !== cleanId);

    // 2. Remove from in-memory globalCloudBlinks
    this.globalCloudBlinks = this.globalCloudBlinks.filter(b => b.id.toLowerCase() !== cleanId);

    // 3. Save local registry & remove from DatabaseService
    this.saveRegistry();
    DatabaseService.deleteBlink(cleanId);

    // 4. Dispatch real-time window events for 0ms reactive UI removal
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('blink_deleted', { detail: { id: cleanId } }));
        window.dispatchEvent(new CustomEvent('tapblink_blink_deleted', { detail: { id: cleanId } }));
        window.dispatchEvent(new CustomEvent('blink_database_updated', { detail: this.blinks }));
        window.dispatchEvent(new CustomEvent('blink_registry_updated', { detail: this.blinks }));
      } catch {}
    }

    // 5. Send REST DELETE request to cloud backend
    if (typeof fetch === 'function') {
      fetch(getApiUrl(`/api/blinks/${cleanId}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorAddress: requesterAddress }),
      }).catch(() => {});
    }

    return true;
  }

  /**
   * Record a physical tap interaction and update studio analytics.
   */
  static recordTap(id: string, success: boolean, amount: number = 0, token?: string): void {
    const cleanId = (id || '').trim().toLowerCase();
    const list = this.loadRegistry();
    let blink = list.find(b => b.id.toLowerCase() === cleanId);
    if (!blink) {
      blink = this.globalCloudBlinks.find(b => b.id.toLowerCase() === cleanId);
    }
    if (!blink) {
      blink = DatabaseService.getAllBlinks().find(b => b.id.toLowerCase() === cleanId);
    }

    let computedUsdc = amount;
    const effToken = token || (blink ? blink.token : 'USDC');
    if (effToken === 'SOL' && amount > 0) {
      computedUsdc = Number((amount * 118.84).toFixed(2));
    } else if (effToken === 'SKR' && amount > 0) {
      computedUsdc = Number((amount * 0.05).toFixed(2));
    }

    if (blink) {
      blink.stats = blink.stats || { taps: 0, completed: 0, volumeUsdc: 0 };
      blink.stats.taps += 1;
      if (success) {
        blink.stats.completed += 1;
        blink.stats.volumeUsdc = Number((blink.stats.volumeUsdc + computedUsdc).toFixed(2));
      }
      blink.updatedAt = Date.now();

      const lIdx = list.findIndex(b => b.id.toLowerCase() === cleanId);
      if (lIdx >= 0) {
        list[lIdx] = { ...blink };
      } else {
        list.unshift({ ...blink });
      }
      this.blinks = list;
      this.saveRegistry();

      const cIdx = this.globalCloudBlinks.findIndex(b => b.id.toLowerCase() === cleanId);
      if (cIdx >= 0) {
        this.globalCloudBlinks[cIdx] = { ...blink };
      } else {
        this.globalCloudBlinks.unshift({ ...blink });
      }

      DatabaseService.saveBlink(blink);
      this.notifyChange(blink);
    }

    if (typeof fetch === 'function') {
      fetch(getApiUrl(`/api/blinks/${cleanId}/tap`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success, amountUsdc: computedUsdc }),
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.success && data.stats && blink) {
            blink.stats = { ...data.stats };
            blink.updatedAt = Date.now();
            this.saveRegistry();
            DatabaseService.saveBlink(blink);
            this.notifyChange(blink);
          }
        })
        .catch(() => {});
    }
  }

  /**
   * Get canonical public gateway base URL.
   * If running inside Capacitor APK or localhost, defaults to the public Railway deployment.
   */
  static getPublicBaseUrl(): string {
    if (typeof window !== 'undefined' && window.location) {
      const origin = window.location.origin;
      if (
        origin &&
        !origin.includes('localhost') &&
        !origin.includes('127.0.0.1') &&
        !origin.startsWith('capacitor://') &&
        !origin.startsWith('ionic://')
      ) {
        return origin;
      }
    }
    return 'https://blink-production-5c36.up.railway.app';
  }

  /**
   * Direct deep link scheme to launch the installed mobile APK.
   */
  static getAppDeepLink(id: string): string {
    return `blink://t/${id}`;
  }

  /**
   * Android Chrome Intent URL to immediately launch com.blink.solanamobile or fallback.
   */
  static getAndroidIntentUrl(id: string, search = ''): string {
    return `intent://t/${id}${search}#Intent;scheme=blink;package=com.blink.solanamobile;end`;
  }

  /**
   * Generate canonical Physical Blink URL.
   */
  static getPhysicalUrl(id: string): string {
    const origin = this.getPublicBaseUrl();
    return `${origin}/t/${id}`;
  }

  /**
   * Generate shareable URL with parameters if physical, ensuring anyone clicking it remotely can load it.
   */
  static getShareableUrl(blink: PhysicalBlink): string {
    const origin = this.getPublicBaseUrl();
    const q = new URLSearchParams({
      name: blink.name,
      amount: String(blink.amount),
      token: blink.token,
      recipient: blink.recipient,
      type: blink.actionType,
      desc: blink.description,
      visibility: blink.visibility || 'global',
    });
    if ((blink as any).creatorAddress) q.set('creator', (blink as any).creatorAddress);
    if (blink.baseUsdcAmount) q.set('baseUsdc', String(blink.baseUsdcAmount));
    if (blink.imageUrl) q.set('image', blink.imageUrl);
    if (blink.verifiedDomain) q.set('domain', blink.verifiedDomain);
    return `${origin}/t/${blink.id}?${q.toString()}`;
  }
}
