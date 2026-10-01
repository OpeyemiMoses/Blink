# TapBlink Session Memory

## Project
Expo/React Native mobile app — Solana Blink payments with NFC & QR.  
Workspace: `/Users/user/.gemini/antigravity-ide/scratch/seeker-tapblink`  
GitHub Repo: `https://github.com/OpeyemiMoses/Blink.git` (Pushed & up to date on `main`)

## Active Tunnels
- **localtunnel**: `https://wise-peas-brake.loca.lt` (Password: `105.120.128.249`)
- **cloudflared**: `https://adelaide-barriers-capacity-treated.trycloudflare.com`
- **node server**: task-2636 serving latest `dist/` on `http://localhost:3000`

---

## Hackathon Intelligence ("Clock In" — Solana Mobile Hackathon)
- **Source**: `https://solanamobile.radiant.nexus/` (Radiants DAO & Solana Mobile)
- **Submissions Close**: **October 8, 2026, 23:59 UTC (Hard Deadline: ~7 days remaining)**
- **Prize Pool**: $135k USDC total ($30k 1st, $25k 2nd, etc.) + **$10,000 in $SKR** for Best SKR Integration + Matched ORE Prize (up to $30k) + Seeker devices + 1-on-1 Call with Anatoly Yakovenko (Toly)
- **Judging Panel**: Anatoly Yakovenko (Solana Labs), Mert (Helius), Chase (Solana Foundation), Akshay & Beeman (Solana Mobile), Voynich & A2nkF (Ethelsec)
- **Judging Criteria (25% each)**:
  1. Stickiness & PMF (25%)
  2. User Experience (25%)
  3. Innovation / X-factor (25%)
  4. Presentation & Demo Quality (25%)

---

## Completed Features

### Solana Mobile Stack (SMS) & Mobile Wallet Adapter (MWA) (COMPLETED Oct 1)
- Installed official `@solana-mobile/mobile-wallet-adapter-protocol` and `@solana-mobile/mobile-wallet-adapter-protocol-web3js`.
- Implemented native `transact` in `SolanaMobileStackService.ts` for MWA authorization, reauthorization, and transaction signing.
- Integrated automatic MWA routing inside `WalletProviderService.signAndSendTransaction` for seamless Seed Vault / Android wallet signing.
- Configured Android package `com.blink.solanamobile` in `app.json` for Android APK generation.
- Added `skipLibCheck: true` in `tsconfig.json` for fast, reliable compilation with deep Web3 libraries.
- Verified web and mobile compatibility: full web bundle exported cleanly (`npx expo export --platform web` exited with code 0).
- Successfully committed and pushed to `https://github.com/OpeyemiMoses/Blink.git` on `main`.

### SKR Discount / Rebate System
- SKR blink payments get 10% off — price set in USDC, backend queries live SKR price, applies 10% discount.
- Price updates live via `PriceService.subscribe()` throughout all screens.
- Fixed: SKR price dynamic back-calculation from stored SKR using `(storedSKR × livePrice) / 0.9`, rounded to $0.50.
- Applied in `loadRegistry()` (physicalBlinkRegistry) and `resolve()` URL parsing for QR codes without `baseUsdc` param.
- `TapScanScreen` success toast uses live `checkoutAmount` for SKR.

### Streak / Daily Clock-In System
- Users clock in daily to earn +1% off every 10-day streak on SKR Blink payments.
- Streak is displayed on Profile screen via FAB icon (floating bottom-right).
- FAB is transparent when streak not active, raised above nav bar.
- Streak copy: "Clock in daily to earn +1% off every 10-day streak.."

### Blink Cards & Custom Image Upload
- `MusicianLogo` removed; replaced with `imageUrl` or `<BlinkBrandMark />` fallback.
- `CreateBlinkModal.tsx` & `StudioScreen.tsx`: Image picker (HTML5 camera/upload, compressed to 480px JPEG dataURL).

### UI & Styling Standards
- Text field fonts globally reduced to 11px / 10px.
- Avatar picker: camera icon only on Profile screen.
- Toasts strictly via `ToastService`.
- Profile edit form collapsed by default, pencil icon toggles.
- Mascot vector avatars default for new profiles.
- No emojis in UI text.

---

## Remaining Hackathon Action Items
1. **Generate Standalone Android APK**: Run EAS Build (`eas build -p android --profile preview`) or generate local APK for judges to install on Seeker/Android devices.
2. **Record 3-Minute Demo Video**: Showcase NFC physical tap, live SKR price dynamic discount, and daily Clock-In streak.
3. **Build 6-Slide Pitch Deck**: Highlighting Seeker POS, SKR token mechanics, and 30-day Solana dApp Store deployment roadmap.
