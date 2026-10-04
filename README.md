# Blink

> **The Physical Solana Actions & Blinks Engine for Solana Mobile**

Blink bridges digital Solana Actions into the physical world. Built natively for mobile devices and the Solana Mobile Stack (SMS), Blink transforms physical interactions—contactless NFC taps, peer-to-peer device beams, and dynamic visual QR codes—into verified, on-chain Solana transactions in under 400 milliseconds.

---

## Overview

Solana Actions and Blinks turned complex smart contracts into shareable metadata links (`solana-action:`), but historically they remained confined to desktop browsers and social media feeds. Meanwhile, mobile Web3 commerce has been held back by traditional app store constraints: 30% platform cuts, restrictions on direct cryptocurrency checkout, and fragmented wallet connectivity.

**Blink** breaks through these barriers:
* **Contactless Tap-to-Blink:** Tap physical NFC tags, posters, or merchant terminals to execute Solana Actions instantly without opening browser tabs or copying addresses.
* **Hardware Biometric Signing:** Integrates directly with the Solana Mobile Stack (MWA) and hardware Seed Vault. Private keys never leave the device enclave; payments are approved with a simple biometric touch.
* **0% Intermediary Fees:** Direct peer-to-peer and merchant-to-customer settlement on Solana, bypassing traditional payment rails and mobile store fees.
* **Dynamic Fiat-to-Crypto Spot Pegging:** Merchants set prices in USD, and Blink automatically calculates real-time token requirements at checkout using live price feeds.
* **Everyday Engagement:** Built-in daily clock-in streaks, loyalty reward tiers, and proximity airdrop discovery.

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Physical World Inputs                           │
│   • NDEF NFC Tags / Posters   • Merchant Phone NFC Beam   • Solana QR  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Tap / Scan (<400ms)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Blink Mobile Client                           │
│               React Native + Expo SDK 52 | Android Native              │
│                                                                        │
│  ┌───────────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │      BlinkPocket      │  │ Tap & Scan Radar │  │   Merchant POS  │  │
│  │  Multi-Asset & Ledger │  │  NFC + QR Engine │  │  Beam & Catalog │  │
│  └───────────────────────┘  └──────────────────┘  └─────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                       Identity & Key Layer                       │  │
│  │   • Social Onboarding (Email / Google / SMS via Privy)           │  │
│  │   • Solana Mobile Stack (MWA) & Hardware Seed Vault              │  │
│  │   • External Wallets (Phantom / Solflare Deeplinks)              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────┬───────────────────────────────┬────────────────────┘
                    │                               │
       Cloud Sync & Receipts              On-Chain Settlement
                    ▼                               ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│        Cloud Backend Service         │  │        Solana Network        │
│   Node.js + Express + Persistent DB  │  │  • SOL / USDC Settlement     │
│   • Catalog & Receipt Registry       │  │  • Real 88-char Signatures   │
│   • Multi-Device Streak Sync         │  │  • Solscan Explorer Links    │
│   • Account-Scoped Notifications     │  │  • Staking & Reward Tiers    │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

---

## Core Features

### 1. BlinkPocket (Asset Hub & Ledger)
* **Multi-Token Overview:** Real-time balances for SOL, USDC, and $SKR with live fiat USD market valuations.
* **On-Chain Ledger:** Live transaction history linked directly to block explorers (Solscan) with verified on-chain signatures.
* **Quick Access Bar:** Instant shortcuts for Send, Receive, Scan, and Merchant POS.
* **Saved & Pinned Blinks:** Bookmark frequent actions (daily coffee, tipping jars, creator subscriptions) for one-tap execution.

### 2. Tap & Scan Engine
* **NFC Radar Listener:** Background listener that instantly detects physical NFC chips and smart tags loaded with Solana Actions.
* **Visual QR Scanner:** High-speed camera scanner for Solana Pay and standard Solana Action QR codes.
* **Sub-Second Biometric Checkout:** Tapping an action renders an interactive preview card; tapping **Pay** immediately triggers biometric authentication or Seed Vault approval.
* **Simulation Harness:** Built-in hardware simulation mode for testing contactless flows in desktop and emulator environments.

### 3. Merchant POS & Contactless Beam
* **Turnkey Mobile Terminal:** Converts any compatible mobile device into a merchant register without extra hardware.
* **Product Catalog:** Create reusable Blinks with custom titles, descriptions, cover images, and set amounts.
* **Dynamic USD Spot Pegging:** Define pricing in fiat USD; the checkout engine resolves the exact token amount at the time of payment.
* **NFC Beam Mode:** Uses Host Card Emulation (HCE) to beam payment requests back-to-back from the merchant device to the customer phone.
* **Dynamic QR Display:** Instant fallback to high-resolution on-screen QR codes for non-NFC customer devices.

### 4. Loyalty Vault & Daily Clock-In Engine
* **Daily Clock-In Streak:** Encourages recurring engagement with progressive multi-day streaks and reward multipliers.
* **Cloud-Synced Persistence:** Daily streaks and badges survive app restarts, updates, and device migrations.
* **Staking Tiers:** Tier progression (Bronze, Silver, Gold, Radiant) offering reduced merchant processing fees down to 0% and enhanced cashback.
* **Proximity Airdrop Radar:** Discovers nearby geo-fenced token drops and beacon events.

### 5. Flexible Identity & Wallets
* **Frictionless Social Login:** Easy onboarding using Email, Google, or SMS with non-custodial embedded key management.
* **Seed Vault & MWA Integration:** Hardware-level security on compatible Solana Mobile devices, signing transactions through the device's secure enclave.
* **External Self-Custody:** Full support for Phantom and Solflare mobile applications.
* **Isolated Profiles & Notifications:** Storage and notifications are strictly scoped per active address, preventing data bleed across accounts.

---

## Real-World Use Cases

| Scenario | Flow | Benefit |
|---|---|---|
| **Retail & Cafes** | Customer taps their phone against the merchant's device | Instant crypto settlement, zero credit card interchange fees |
| **Events & Conferences** | Tap NFC wristbands or badges | Instant tips, attendee badges, POAP claims, and merch checkouts |
| **Micro-Payments & Transit** | Tap turnstiles, rental lockers, or bikes | Sub-second biometric unlocked access |
| **Interactive Print & Merch** | Physical posters, flyers, or apparel with NFC chips | Direct one-tap minting, donations, or ticket purchases |

---

## Technical Stack

* **Mobile Client:** React Native, Expo SDK 52, TypeScript, Vanilla CSS design system
* **Hardware & Device APIs:** Native NFC Reader (`NDEFReader`), Host Card Emulation (`HCE`), Biometrics (`expo-local-authentication`), Solana Mobile Wallet Adapter (`@solana-mobile/mobile-wallet-adapter-protocol`)
* **Solana & Web3 Libraries:** `@solana/web3.js`, `@solana/actions`, `@privy-io/expo`
* **Price Feeds & Oracles:** Real-time live feeds via Pyth Network and CoinGecko
* **Cloud Backend:** Node.js, Express, persistent JSON file databases, deployed on Railway
* **Compilation Targets:** Progressive Web App (PWA), Android APK (Capacitor & EAS), Solana Seeker dApp Store

---

## Getting Started

### Prerequisites
* Node.js v18 or v20
* npm or bun

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/OpeyemiMoses/Blink.git
   cd Blink
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   # App will be accessible at http://localhost:3000
   ```

4. **Run typechecks:**
   ```bash
   npx tsc --noEmit
   ```

### Building for Android & Solana Seeker

#### Option A: Local Android Studio Build
```bash
# 1. Generate the native Android project
npx expo prebuild --platform android

# 2. Compile release APK
cd android && ./gradlew assembleRelease
# Output will be located at: android/app/build/outputs/apk/release/app-release.apk
```

#### Option B: EAS Cloud Build
```bash
npx eas-cli build --platform android --profile preview
```

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
