import { Platform } from 'react-native';
import { PushNotificationService } from './pushNotificationService';
import { ToastService } from './toastService';
import { getApiUrl } from './apiConfig';

export interface StreakData {
  currentStreak: number;
  highestStreak: number;
  lastClockInTimestamp: number | null; // epoch ms
  totalClockIns: number;
}

const STORAGE_KEY = 'blink_clock_in_streak_v1';
const TWENTY_HOURS_MS = 20 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

export class StreakService {
  private static cachedData: StreakData | null = null;

  /**
   * Load streak data from local storage, evaluating streak breaks.
   */
  static getStreakData(): StreakData {
    if (this.cachedData) {
      return this.evaluateStreak(this.cachedData);
    }

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const data: StreakData = {
            currentStreak: typeof parsed.currentStreak === 'number' ? parsed.currentStreak : 0,
            highestStreak: typeof parsed.highestStreak === 'number' ? parsed.highestStreak : 0,
            lastClockInTimestamp: typeof parsed.lastClockInTimestamp === 'number' ? parsed.lastClockInTimestamp : null,
            totalClockIns: typeof parsed.totalClockIns === 'number' ? parsed.totalClockIns : 0,
          };
          this.cachedData = this.evaluateStreak(data);
          return this.cachedData;
        }
      }
    } catch (err) {
      console.warn('[StreakService] Error reading streak storage:', err);
    }

    const defaultData: StreakData = {
      currentStreak: 0,
      highestStreak: 0,
      lastClockInTimestamp: null,
      totalClockIns: 0,
    };
    this.cachedData = defaultData;
    return defaultData;
  }

  /**
   * Evaluates if more than 48 hours have passed since the last clock-in.
   * If yes, the streak is reset to 0.
   */
  private static evaluateStreak(data: StreakData): StreakData {
    if (!data.lastClockInTimestamp || data.currentStreak === 0) {
      return data;
    }

    const now = Date.now();
    const elapsed = now - data.lastClockInTimestamp;

    if (elapsed > FORTY_EIGHT_HOURS_MS) {
      // Streak broken
      const updated: StreakData = {
        ...data,
        currentStreak: 0,
      };
      this.saveStreakData(updated);
      return updated;
    }

    return data;
  }

  /**
   * Save streak data locally and dispatch global update event.
   */
  static saveStreakData(data: StreakData): void {
    this.cachedData = data;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch (err) {
      console.warn('[StreakService] Error saving streak data:', err);
    }

    // Dispatch events for real-time reactivity across screens
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('blink_streak_updated', { detail: data }));
      window.dispatchEvent(new CustomEvent('tapblink_streak_updated', { detail: data }));
    }
  }

  /**
   * Calculate current streak bonus percentage.
   * Formula: 1% discount for every 10 consecutive days clocked in.
   * e.g. 0-9 days = 0%, 10-19 days = 1%, 20-29 days = 2%, etc.
   */
  static getStreakBonusPercent(): number {
    const data = this.getStreakData();
    return Math.floor(data.currentStreak / 10);
  }

  /**
   * Total SKR benefit percent: 10% base + streak bonus %
   */
  static getTotalSkrBenefitPercent(): number {
    return 10 + this.getStreakBonusPercent();
  }

  /**
   * Check if user is currently eligible to clock in.
   * Returns:
   * - canClockIn: boolean
   * - hoursRemaining: hours until next clock-in window opens
   * - isStreakAtRisk: true if user is within 12 hours of the 48-hour streak expiration
   */
  static getClockInStatus(): {
    canClockIn: boolean;
    hoursRemaining: number;
    minutesRemaining: number;
    isStreakAtRisk: boolean;
    currentStreak: number;
    bonusPercent: number;
    nextMilestoneDays: number;
    daysUntilNextMilestone: number;
    milestoneProgress: number; // 0 to 1
  } {
    const data = this.getStreakData();
    const now = Date.now();
    const currentStreak = data.currentStreak;
    const bonusPercent = Math.floor(currentStreak / 10);
    const nextMilestoneDays = (Math.floor(currentStreak / 10) + 1) * 10;
    const daysUntilNextMilestone = nextMilestoneDays - currentStreak;
    const milestoneProgress = (currentStreak % 10) / 10;

    if (!data.lastClockInTimestamp) {
      return {
        canClockIn: true,
        hoursRemaining: 0,
        minutesRemaining: 0,
        isStreakAtRisk: false,
        currentStreak,
        bonusPercent,
        nextMilestoneDays,
        daysUntilNextMilestone,
        milestoneProgress,
      };
    }

    const elapsed = now - data.lastClockInTimestamp;

    if (elapsed >= TWENTY_HOURS_MS) {
      // Eligible to clock in!
      const timeBeforeBreak = FORTY_EIGHT_HOURS_MS - elapsed;
      const isStreakAtRisk = currentStreak > 0 && timeBeforeBreak < 12 * 60 * 60 * 1000;
      return {
        canClockIn: true,
        hoursRemaining: 0,
        minutesRemaining: 0,
        isStreakAtRisk,
        currentStreak,
        bonusPercent,
        nextMilestoneDays,
        daysUntilNextMilestone,
        milestoneProgress,
      };
    }

    // Still in cooldown period
    const msLeft = TWENTY_HOURS_MS - elapsed;
    const hoursRemaining = Math.floor(msLeft / (60 * 60 * 1000));
    const minutesRemaining = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));

    return {
      canClockIn: false,
      hoursRemaining,
      minutesRemaining,
      isStreakAtRisk: false,
      currentStreak,
      bonusPercent,
      nextMilestoneDays,
      daysUntilNextMilestone,
      milestoneProgress,
    };
  }

  /**
   * Perform daily Clock In.
   */
  static async clockIn(userWalletOrHandle?: string): Promise<{
    success: boolean;
    streak: number;
    bonusPercent: number;
    message: string;
  }> {
    const status = this.getClockInStatus();
    if (!status.canClockIn) {
      const waitMsg = status.hoursRemaining > 0
        ? `Already clocked in! Next clock-in in ~${status.hoursRemaining}h ${status.minutesRemaining}m.`
        : `Already clocked in! Next clock-in in ~${status.minutesRemaining}m.`;
      return {
        success: false,
        streak: status.currentStreak,
        bonusPercent: status.bonusPercent,
        message: waitMsg,
      };
    }

    const data = this.getStreakData();
    const newStreak = data.currentStreak + 1;
    const newHighest = Math.max(data.highestStreak, newStreak);
    const newBonus = Math.floor(newStreak / 10);
    const oldBonus = Math.floor(data.currentStreak / 10);

    const updatedData: StreakData = {
      currentStreak: newStreak,
      highestStreak: newHighest,
      lastClockInTimestamp: Date.now(),
      totalClockIns: (data.totalClockIns || 0) + 1,
    };

    this.saveStreakData(updatedData);

    // Schedule 24-hour reminder push notification
    try {
      await PushNotificationService.scheduleClockInReminder(86400, newStreak);
    } catch (err) {
      console.warn('[StreakService] Failed to schedule push notification:', err);
    }

    // Sync to backend if handle or wallet provided
    if (userWalletOrHandle && typeof fetch === 'function') {
      try {
        fetch(getApiUrl('/api/profile/streak'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: userWalletOrHandle,
            streakData: updatedData,
          }),
        }).catch(() => {});
      } catch {}
    }

    let successMessage = `Clocked In! Day ${newStreak} streak recorded.`;
    if (newBonus > oldBonus) {
      successMessage = `Milestone Reached! Unlocked +${newBonus}% SKR discount bonus!`;
    } else {
      const daysLeft = 10 - (newStreak % 10);
      if (daysLeft === 10) {
        successMessage = `Clocked In! Day ${newStreak} streak active (+${newBonus}% bonus).`;
      } else {
        successMessage = `Clocked In! Day ${newStreak} streak active. ${daysLeft} days to +${newBonus + 1}% bonus.`;
      }
    }

    return {
      success: true,
      streak: newStreak,
      bonusPercent: newBonus,
      message: successMessage,
    };
  }
}
