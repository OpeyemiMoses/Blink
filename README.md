# ⚡ TapBlink (Powered by Radiants)
> **The Physical Solana Actions & Blinks Engine for Solana Seeker**  
> *Submitted to Clock In: A Solana Mobile Hackathon (September – October 2026)*

[![Solana Mobile Stack](https://img.shields.io/badge/Solana%20Mobile-Seeker%20Ready-9945FF?style=flat-square)](https://solanamobile.com)
[![Seed Vault](https://img.shields.io/badge/Seed%20Vault-Biometric%20Auth-14F195?style=flat-square)](https://solanamobile.com)
[![Blinks](https://img.shields.io/badge/Solana-Actions%20%26%20Blinks-00F0FF?style=flat-square)](https://solana.com)
[![Radiants](https://img.shields.io/badge/Track-10k%20SKR%20Prize-C084FC?style=flat-square)](https://solanamobile.radiant.nexus/)

---

## 🎯 The Problem & Vision
Solana Actions and Blinks turned complex smart contracts into shareable metadata links (`solana-action:`), but today **Blinks are trapped in desktop web browsers and Twitter feeds**.

Meanwhile, mobile web3 commerce has been stifled by Apple and Google's **30% App Store cut**, bans on direct crypto payments, and restrictions on background NFC protocols.

**TapBlink** solves this by unlocking **Physical Blinks on the Solana Seeker**:
1. **NFC Tap-to-Blink**: Tap any physical NFC tag, merchant terminal, or peer phone to execute a Solana Action in <400ms without opening browser tabs or copying addresses.
2. **Seed Vault Biometric 1-Tap Execution**: Uses the Solana Mobile Stack (MWA) and hardware Seed Vault. Private keys never leave the secure enclave—sign with your fingerprint on the Seeker power button.
3. **BlinkPocket**: A native mobile drawer to save, organize, and re-trigger your favorite Blinks (micro-tipping, daily DCA, yield vaults).
4. **Merchant POS & Beam**: Any merchant can turn their Seeker into a contactless crypto terminal with 0% App Store fees.
5. **$10,000 SKR Track Utility**: Earn instant $SKR cashback on every tap, stake $SKR to eliminate merchant fees, and claim exclusive physical beacon drops.

---

## 🏗️ Architecture & Stack

```
┌─────────────────────────────────┐        ┌──────────────────────────────────┐
│   Physical World (NFC / QR)     │        │          Solana Seeker           │
│  • Physical NFC Tags & Displays │───────>│  • Hardware NFC Antenna (NDEF)   │
│  • Peer Seeker HCE Beam         │  Tap   │  • Solana Action Spec Parser     │
│  • Geo-Located Event Beacons    │        │  • Seed Vault Biometric Signer   │
└─────────────────────────────────┘        └──────────────────────────────────┘
                                                            │
                                                   Sub-second Execution
                                                            ▼
                                           ┌──────────────────────────────────┐
                                           │       Solana Network & SKR       │
                                           │  • USDC / SOL Instant Settlement │
                                           │  • $SKR Cashback & Staking Vault │
                                           └──────────────────────────────────┘
```

* **Framework**: React Native + Expo (compiles directly to Android `.apk` for the Seeker dApp Store).
* **Solana SDK**: `@solana/web3.js`, `@solana-mobile/mobile-wallet-adapter-protocol`, `@solana/actions`.
* **Hardware**: Seeker Hardware NFC (NDEFReader / HCE) and Seed Vault TPM 2.0 enclave.
* **Styling**: Cyberpunk / Radiants OS dark-mode aesthetic with custom glassmorphism.

---

## 📱 Core Features

### 1. ⚡ BlinkPocket
* Real-time wallet overview (USDC, SOL, $SKR).
* Saved Blinks for 1-tap re-execution.
* On-chain receipts with instant Explorer transaction signatures.

### 2. 📡 Tap & Scan Engine
* Active radar listener for incoming NFC tags.
* QR scanner viewfinder for visual Blinks.
* Live simulation mode for testing physical NFC interactions without hardware tags.

### 3. 🏪 Merchant POS Terminal
* Enter custom payment amount (USDC, SOL, SKR) and item description.
* **NFC Beam Mode**: Broadcasts payment action over NFC directly to customer phones.
* Dynamic Solana Action QR generation.
* Zero Google/Apple 30% cut.

### 4. 💎 $SKR Vault ($10,000 Track Bonus)
* **Tier Status**: Bronze, Silver, Gold, and Radiant tiers.
* **Cashback Engine**: Earn 1% to 10% in $SKR on every physical tap.
* **Merchant Staking**: Staking $SKR eliminates merchant processing fees down to 0%.
* **Physical Airdrop Radar**: Discover and claim nearby physical beacon airdrops.

---

## 🚀 How to Run Locally

### Interactive Web / Seeker Simulator
To test the interactive Seeker phone simulator and demo flow right in your browser:
```bash
npm install
npm run web
# Open http://localhost:3000 or http://localhost:8081
```

### Standalone Android APK Build (For Seeker Device)
To generate the release APK for the Solana dApp Store:
```bash
# 1. Generate native Android project
npx expo prebuild --platform android

# 2. Build local debug or release APK
cd android && ./gradlew assembleRelease

# The resulting APK will be at:
# android/app/build/outputs/apk/release/app-release.apk
```

Or build via Expo Application Services (EAS):
```bash
npx eas-cli build --platform android --profile preview
```

---

## 🎬 2-Minute Demo Video Script

| Time | Visual | Voiceover / Action |
|---|---|---|
| **0:00 - 0:25** | Host holds two Seeker phones; zooms into TapBlink app. | *"Blinks changed the web, but they've been trapped on desktop Twitter. Today, we're bringing Blinks into the physical world with TapBlink on Solana Seeker."* |
| **0:25 - 0:55** | Phone 1 (Merchant) enters $4.50 for Coffee, activates NFC Beam. Phone 2 taps Phone 1 back-to-back. | *"Watch this: Phone 1 sets up an espresso order and beams it over NFC. Phone 2 taps it—instantly, the native Solana Action renders on screen."* |
| **0:55 - 1:20** | Fingerprint prompt appears on Seeker. User touches power button sensor; payment confirms in ~400ms. | *"No browser popups, no seed phrases. 1-tap Seed Vault biometric approval on Seeker's hardware sensor, and the transaction is finalized on Solana."* |
| **1:20 - 1:45** | Receipt modal triggers confetti and "+15 SKR Earned" badge. Shows $SKR Staking Vault. | *"And with Radiants $SKR integration, every tap earns instant cashback, while merchants stake SKR for 0% processing fees."* |
| **1:45 - 2:00** | Shows BlinkPocket with saved actions and APK ready for Seeker dApp Store. | *"TapBlink: Zero 30% App Store tax, 100% hardware-powered. Clock In on Seeker today."* |

---

## 👥 Hackathon Team & Acknowledgements
* Built for **Clock In: A Solana Mobile Hackathon** (in partnership with RadiantsDAO).
* Dedicated to advancing the **Solana Mobile Stack (SMS)** and **Solana Actions & Blinks** ecosystem.
