import { LoyaltyTier, SkrTierDetails } from '../types';

export const SKR_TIERS: Record<LoyaltyTier, SkrTierDetails> = {
  Bronze: {
    tier: 'Bronze',
    minSkr: 0,
    cashbackPercent: 1.0,
    merchantFeePercent: 0.8,
    badge: 'Seeker Novice',
    color: '#CD7F32'
  },
  Silver: {
    tier: 'Silver',
    minSkr: 500,
    cashbackPercent: 2.5,
    merchantFeePercent: 0.4,
    badge: 'Radiant Builder',
    color: '#C0C0C0'
  },
  Gold: {
    tier: 'Gold',
    minSkr: 2500,
    cashbackPercent: 5.0,
    merchantFeePercent: 0.1,
    badge: 'Seeker Vanguard',
    color: '#FFD700'
  },
  Radiant: {
    tier: 'Radiant',
    minSkr: 10000,
    cashbackPercent: 10.0,
    merchantFeePercent: 0.0, // Zero merchant fee on Seeker!
    badge: 'Radiant Master',
    color: '#00F0FF'
  }
};

export class SkrService {
  private static userSkrBalance: number = 3250;
  private static stakedSkr: number = 2000;

  static getBalance(): number {
    return this.userSkrBalance;
  }

  static getStakedAmount(): number {
    return this.stakedSkr;
  }

  static getCurrentTier(): SkrTierDetails {
    const total = this.userSkrBalance + this.stakedSkr;
    if (total >= SKR_TIERS.Radiant.minSkr) return SKR_TIERS.Radiant;
    if (total >= SKR_TIERS.Gold.minSkr) return SKR_TIERS.Gold;
    if (total >= SKR_TIERS.Silver.minSkr) return SKR_TIERS.Silver;
    return SKR_TIERS.Bronze;
  }

  static calculateCashback(amountUsd: number): number {
    const tier = this.getCurrentTier();
    // 1 SKR ~ $0.05 estimated hackathon demo benchmark
    const cashbackUsd = (amountUsd * tier.cashbackPercent) / 100;
    return Number((cashbackUsd / 0.05).toFixed(2));
  }

  static stakeSkr(amount: number): boolean {
    if (amount <= 0 || amount > this.userSkrBalance) return false;
    this.userSkrBalance -= amount;
    this.stakedSkr += amount;
    return true;
  }

  static unstakeSkr(amount: number): boolean {
    if (amount <= 0 || amount > this.stakedSkr) return false;
    this.stakedSkr -= amount;
    this.userSkrBalance += amount;
    return true;
  }

  static creditCashback(skrEarned: number) {
    this.userSkrBalance += skrEarned;
  }
}
