import { SolanaActionMetadata } from '../types';

export const DEMO_ACTIONS: Record<string, SolanaActionMetadata> = {
  'merchant-checkout': {
    title: 'Dean’s Coffee — Cold Brew',
    icon: '',
    description: 'Contactless merchant point-of-sale checkout on Solana. Verified via hardware Seed Vault.',
    label: 'Pay 4.50 USDC',
    category: 'retail',
    merchantName: "Dean's Coffee",
    links: {
      actions: [
        {
          label: 'Pay 4.50 USDC',
          href: 'https://api.blink.org/pay?amount=4.50'
        },
        {
          label: 'Pay 4.50 USDC + 15% Tip',
          href: 'https://api.blink.org/pay?amount=5.17'
        }
      ]
    }
  },
  'seeker-credential': {
    title: 'Seeker Verification Credential',
    icon: '',
    description: 'Mint an on-chain compressed proof credential verifying your hardware-backed Seeker device.',
    label: 'Mint Credential (0.01 SOL)',
    category: 'event',
    merchantName: 'Solana Mobile',
    links: {
      actions: [
        {
          label: 'Mint for 0.01 SOL',
          href: 'https://api.blink.org/mint'
        }
      ]
    }
  }
};
