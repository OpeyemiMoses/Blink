# Session Memory — TapBlink / Seeker Project
**Saved:** 2026-09-29T23:10

---

## Core Operational Directives (Strict Enforcement)

1. **Always Save Memory on Task Completion:** Update and persist `session_memory.md` after EVERY task or response without exception.
2. **Always Provide Mobile Test URL:** Provide the active HTTPS tunnel URL after every rebuild for instant mobile preview.
3. **No "Choose from Gallery" button anywhere:** Avatar changes are strictly via camera or 3D Mascot selector.
4. **No inline alert/toast banners:** Use `ToastService` exclusively.
5. **Profile Edit Form Hidden by Default:** Collapses once saved; pencil icon toggles display.
6. **3D Toy / Lego Mascot Avatars as Default:** All new accounts receive one of the 6 colorful 3D Toy/Lego mascot avatars from `assets/avatars/` (`mascot_purple.png`, `mascot_green.png`, `mascot_pink.png`, `mascot_cyan.png`, `mascot_orange.png`, `mascot_gold.png`) at random until they choose to change it.
7. **Creator-Only Blink Editing & Deletion:** Only the verified creator of a Blink (`activeAccount.publicKey === recipient || creatorAddress`) can edit or delete their Blink. Server enforces HTTP 403 for unauthorized updates or deletions. Non-creators CANNOT see any delete option anywhere.
8. **Global Cross-Device Deletion Tombstones:** When a creator deletes a Blink, it is permanently tombstoned in `server_deleted_db.json`. `PhysicalBlinkRegistry.syncFromCloud()` automatically purges tombstoned Blinks from all devices, browser sessions, local storage, and database across all accounts (old and new).
9. **Modal Auto-Dismissal on Delete:** Deleting a Blink from `BlinkDetailModal` or `StudioScreen` immediately dismisses the modal page (`onClose()`) and returns to the previous screen.
10. **Clean Header & Hero Cards (No Subtext / Redundant Sign Out Pills):**
    - Subtext balance lines (`● X.XXXX SOL • XX.XX USDC`) removed from balance hero cards in `PocketScreen.tsx` and `MarketsScreen.tsx`.
    - Redundant top header `Sign Out` button pills removed from `ProfileScreen.tsx` and `PocketScreen.tsx` header actions.
11. **Near End-to-End Mobile Padding:** Container horizontal padding is reduced to `6px` across all screens so cards and content expand near end-to-edge on mobile viewports.
12. **Real On-Chain Transactions (Zero Mock Signatures):** Every transaction must be broadcasted to Solana Devnet RPC and confirmed on-chain. Never return fake random string signatures (`sol_...` or random base58). Explorer and Solscan links must point strictly to Solana Devnet (`?cluster=devnet`).
13. **Strict Clipboard Accuracy:** If clipboard write fails or user cancels the OS share sheet, never display "link copied". Only confirm when copying actually succeeded.
14. **Live Spot Price Feed & Real Math:** Cumulative portfolio balances strictly derive from real-time live APIs (Coinbase API for SOL spot rates, DexScreener API for SKR rates) with automatic purging of legacy hardcoded price caches (`$142.50`).
15. **Mainnet SKR Mint & Balance Query:** SKR balances query the official mainnet mint `SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3`.

---

## Project Location
`/Users/user/.gemini/antigravity-ide/scratch/seeker-tapblink`

---

## Active Servers & Tunnel Status
- **Backend & Static App Server:** `server.js` running on Port 3000 (`node server.js`) — Active (Task `task-11415`)
- **Self-Healing Cloudflare Tunnel URL:** `https://flag-riding-faq-stats.trycloudflare.com` — Active (Supervised by `tunnel_supervisor.js`, Task `task-11118`)
- **Direct Local Network (Wi-Fi) URL:** `http://192.168.1.194:3000`

---

## Latest Update: Immediate Modal Dismissal on Delete & Clean UI Adjustments

### 1. Requirements & Fix Summary
- **Modal Dismissal on Delete:**
  - Deleting a Blink from `BlinkDetailModal` instantly invokes `onClose()`, resetting modal state and returning the user to the previous screen (`MarketsScreen`, `StudioScreen`, etc.) seamlessly.
- **Removed Unnecessary Balance Subtext Lines:**
  - Removed `gainRow` (`● X.XXXX SOL • XX.XX USDC`) subtext line from `MarketsScreen.tsx` hero balance section.
  - Removed `gainRow` (`● X.XXXX SOL • XX.XX USDC • 0.00 SKR`) subtext line from `PocketScreen.tsx` hero balance section.
- **Removed Redundant Top Sign Out Button Pills:**
  - Removed `signOutBtn` pill from `ProfileScreen.tsx` top header section (leaving the primary full-width Sign Out button at the bottom of the Profile page).
  - Removed `switchBtn` pill from `PocketScreen.tsx` top header card.
- **Global Cross-Device Deletion & Creator-Only Protection:**
  - Non-creators cannot see delete triggers anywhere.
  - Deletions are tombstoned globally in `server_deleted_db.json` and purged cross-device.
- **Near End-to-End Layout:**
  - Container padding set to `6px` across mobile viewports.

---

## Technical Stack & Architecture
- **Framework:** React Native / Expo (SDK 52), React Native Web
- **Authentication:** Privy React Auth SDK (`@privy-io/react-auth`, `@privy-io/react-auth/solana`)
- **State & Storage:** Custom `DatabaseService`, `PhysicalBlinkRegistry`, `UserProfileService` with cross-tab events (`window.dispatchEvent(new CustomEvent(...))`)
- **RPC & Blockchain:** `@solana/web3.js`, `@solana/spl-token`, custom Helius RPC fallback
