export type ActionType = 'payment' | 'tip' | 'claim' | 'mint' | 'checkin' | 'donation' | 'voucher';
export type BlinkVisibility = 'global' | 'physical';

export interface PhysicalBlink {
  id: string; // e.g. "coffee-shop-001"
  name: string; // e.g. "Dean's Coffee Counter"
  actionType: ActionType;
  amount: number;
  token: 'USDC' | 'SOL' | 'SKR';
  recipient: string;
  description: string;
  verifiedDomain?: string;
  visibility?: BlinkVisibility; // 'global' (Explore feed, shareable anywhere) or 'physical' (on-site tap, private POS)
  createdAt: number;
  updatedAt: number;
  stats: {
    taps: number;
    completed: number;
    volumeUsdc: number;
  };
}

import { DatabaseService } from './databaseService';

const STORAGE_REGISTRY_KEY = 'justblink_physical_registry';

export class PhysicalBlinkRegistry {
  private static blinks: PhysicalBlink[] = [];
  private static globalCloudBlinks: PhysicalBlink[] = [];
  private static isSyncing = false;

  /**
   * Fetch global shareable blinks and creator blinks from the cloud backend.
   */
  static async syncFromCloud(): Promise<PhysicalBlink[]> {
    if (typeof window === 'undefined') return [];
    try {
      this.isSyncing = true;
      const res = await fetch('/api/blinks');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.blinks)) {
          this.globalCloudBlinks = data.blinks;

          // Merge cloud blinks into local registry so all devices share them
          let current = this.loadRegistry();
          let changed = false;

          // Purge any globally deleted Blinks tombstoned by cloud server
          if (Array.isArray(data.deletedIds) && data.deletedIds.length > 0) {
            for (const delId of data.deletedIds) {
              const cleanDel = String(delId).toLowerCase().trim();
              const beforeLen = current.length;
              current = current.filter(b => b.id.toLowerCase() !== cleanDel);
              this.globalCloudBlinks = this.globalCloudBlinks.filter(b => b.id.toLowerCase() !== cleanDel);
              if (current.length < beforeLen) changed = true;
              DatabaseService.deleteBlink(cleanDel);
            }
          }

          for (const cb of data.blinks) {
            const existingIdx = current.findIndex(b => b.id.toLowerCase() === cb.id.toLowerCase());
            if (existingIdx >= 0) {
              current[existingIdx] = { ...current[existingIdx], ...cb };
              changed = true;
            } else {
              current.unshift(cb);
              changed = true;
            }
          }
          if (changed) {
            this.blinks = current;
            this.saveRegistry();
          }
          this.notifyChange();
          return this.globalCloudBlinks;
        }
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

    // 1. Try loading from DatabaseService first
    const dbBlinks = DatabaseService.getAllBlinks();
    if (dbBlinks && dbBlinks.length > 0) {
      this.blinks = dbBlinks;
      return [...this.blinks];
    }

    // 2. Check localStorage and sanitize
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored =
        window.localStorage.getItem('blink_physical_registry') ||
        window.localStorage.getItem(STORAGE_REGISTRY_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            this.blinks = parsed;
            this.saveRegistry();
            return [...this.blinks];
          }
        } catch {}
      }
    }

    this.blinks = [];
    this.saveRegistry();
    return [];
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
   * Resolve a Physical ID, tag payload, or URL into a programmed Action.
   * Supports:
   * 1. Direct ID matching (local or cloud)
   * 2. URL with embedded parameters (/t/<id>?name=...&amount=...&recipient=...)
   * 3. Cloud query for remote direct links
   */
  static resolve(idOrUrl: string): PhysicalBlink | null {
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
            token: (params.get('token') as 'USDC' | 'SOL') || 'SOL',
            recipient: params.get('recipient') || '',
            description: decodeURIComponent(params.get('desc') || 'Physical Solana Blink transaction'),
            verifiedDomain: params.get('domain') ? decodeURIComponent(params.get('domain')!) : undefined,
            visibility: (params.get('visibility') as BlinkVisibility) || 'physical',
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

    // 2. Check local list by direct ID
    const directMatch = list.find(b => b.id.toLowerCase() === clean.toLowerCase());
    if (directMatch) return directMatch;

    // 3. Check cloud cache by direct ID
    const cloudMatch = this.globalCloudBlinks.find(b => b.id.toLowerCase() === clean.toLowerCase());
    if (cloudMatch) return cloudMatch;

    // 4. Check if it's a URL ending with /t/<id>
    const match = clean.match(/\/t\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const id = match[1].toLowerCase();
      const found = list.find(b => b.id.toLowerCase() === id);
      if (found) return found;
      const foundCloud = this.globalCloudBlinks.find(b => b.id.toLowerCase() === id);
      if (foundCloud) return foundCloud;
    }

    return null;
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

    const newBlink: PhysicalBlink = {
      ...data,
      id: cleanId,
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

    // Sync to cloud backend in background
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      fetch('/api/blinks', {
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

    let finalAmount = list[idx].amount;
    if (updates.amount !== undefined) {
      const parsed = typeof updates.amount === 'number'
        ? updates.amount
        : parseFloat(String(updates.amount).replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed) && parsed >= 0) {
        finalAmount = parsed;
      }
    }

    const updatedItem: PhysicalBlink = {
      ...list[idx],
      ...updates,
      amount: finalAmount,
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

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      fetch('/api/blinks', {
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
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      fetch(`/api/blinks/${cleanId}`, {
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
  static recordTap(id: string, success: boolean, amountUsdc: number = 0): void {
    const list = this.loadRegistry();
    const blink = list.find(b => b.id === id);
    if (!blink) return;

    blink.stats.taps += 1;
    if (success) {
      blink.stats.completed += 1;
      blink.stats.volumeUsdc += amountUsdc;
    }

    this.saveRegistry();

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      fetch(`/api/blinks/${id}/tap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success, amountUsdc }),
      }).catch(() => {});
    }
  }

  /**
   * Generate canonical Physical Blink URL.
   */
  static getPhysicalUrl(id: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://blink.so';
    return `${origin}/t/${id}`;
  }

  /**
   * Generate shareable URL with parameters if physical, ensuring anyone clicking it remotely can load it.
   */
  static getShareableUrl(blink: PhysicalBlink): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://blink.so';
    if (blink.visibility === 'physical') {
      const q = new URLSearchParams({
        name: blink.name,
        amount: String(blink.amount),
        token: blink.token,
        recipient: blink.recipient,
        type: blink.actionType,
        desc: blink.description,
        visibility: 'physical',
      });
      if (blink.verifiedDomain) q.set('domain', blink.verifiedDomain);
      return `${origin}/t/${blink.id}?${q.toString()}`;
    }
    return `${origin}/t/${blink.id}`;
  }
}
