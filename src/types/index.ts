export type ActionType = 'payment' | 'donation' | 'mint' | 'stake' | 'swap' | 'custom';

export interface ActionParameter {
  name: string;
  label: string;
  required?: boolean;
  type?: 'number' | 'text' | 'select';
  options?: { label: string; value: string }[];
}

export interface LinkedAction {
  label: string;
  href: string;
  parameters?: ActionParameter[];
}

export interface SolanaActionMetadata {
  icon: string;
  title: string;
  description: string;
  label: string;
  disabled?: boolean;
  links?: {
    actions: LinkedAction[];
  };
  error?: {
    message: string;
  };
  // Blink extensions
  skrRewardPercent?: number;
  merchantName?: string;
  category?: 'retail' | 'event' | 'defi' | 'social';
}

export interface StoredBlink {
  id: string;
  url: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  lastExecutedAt?: number;
  isPinned?: boolean;
  totalVolumeUsd?: number;
}

export interface TransactionReceipt {
  id: string;
  signature: string;
  blinkTitle: string;
  blinkId?: string;
  amount: number;
  token: 'SOL' | 'USDC' | 'SKR';
  payerAddress?: string;
  recipientAddress: string;
  skrEarned?: number;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'failed';
  method?: 'nfc_tap' | 'qr_scan' | 'pocket_direct' | 'send' | 'receive';
  actionType?: string;
  verifiedDomain?: string;
  note?: string;
}

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Radiant';

export interface SkrTierDetails {
  tier: LoyaltyTier;
  minSkr: number;
  cashbackPercent: number;
  merchantFeePercent: number;
  badge: string;
  color: string;
}

export interface SeedVaultAuthResult {
  approved: boolean;
  signature?: string;
  publicKey?: string;
  biometricType?: 'fingerprint' | 'face' | 'pin';
  error?: string;
}
