# Session Memory — TapBlink / Seeker Project
**Saved:** 2026-09-29T23:21

---

## Core Operational Directives (Strict Enforcement)

1. **Always Save Memory on Task Completion:** Update and persist `session_memory.md` after EVERY task or response without exception.
2. **Always Provide Mobile Test URL:** Provide the active HTTPS tunnel URL after every rebuild for instant mobile preview.
3. **No Mocked or Pre-populated Default Blinks:** All seeded, mocked, and default blinks (`DEFAULT_GLOBAL_BLINKS`, `DEFAULT_FALLBACKS`, `server_db.json`) are completely removed from both backend and frontend. The app operates with a clean slate for real user-created Blinks.
4. **No "Choose from Gallery" button anywhere:** Avatar changes are strictly via camera or 3D Mascot selector.
5. **No inline alert/toast banners:** Use `ToastService` exclusively.
6. **Profile Edit Form Hidden by Default:** Collapses once saved; pencil icon toggles display.
7. **3D Toy / Lego Mascot Avatars as Default:** All new accounts receive one of the 6 colorful 3D Toy/Lego mascot avatars from `assets/avatars/` (`mascot_purple.png`, `mascot_green.png`, `mascot_pink.png`, `mascot_cyan.png`, `mascot_orange.png`, `mascot_gold.png`) at random until they choose to change it.
8. **Creator-Only Blink Editing & Deletion:** Only the verified creator of a Blink (`activeAccount.publicKey === recipient || creatorAddress`) can edit or delete their Blink. Server enforces HTTP 403 for unauthorized updates or deletions. Non-creators CANNOT see any delete option anywhere.
9. **Global Cross-Device Deletion Tombstones:** When a creator deletes a Blink, it is permanently tombstoned in `server_deleted_db.json`. `PhysicalBlinkRegistry.syncFromCloud()` automatically purges tombstoned Blinks from all devices, browser sessions, local storage, and database across all accounts (old and new).
10. **Modal Auto-Dismissal on Delete:** Deleting a Blink from `BlinkDetailModal` or `StudioScreen` immediately dismisses the modal page (`onClose()`) and returns to the previous screen.
11. **Clean Header & Hero Cards (No Subtext / Redundant Sign Out Pills):**
    - Subtext balance lines (`● X.XXXX SOL • XX.XX USDC`) removed from balance hero cards in `PocketScreen.tsx` and `MarketsScreen.tsx`.
    - Redundant top header `Sign Out` button pills removed from `ProfileScreen.tsx` and `PocketScreen.tsx` header actions.
12. **Near End-to-End Mobile Padding:** Container horizontal padding is reduced to `6px` across all screens so cards and content expand near end-to-edge on mobile viewports.
13. **Real On-Chain Transactions (Zero Mock Signatures):** Every transaction must be broadcasted to Solana Devnet RPC and confirmed on-chain. Never return fake random string signatures (`sol_...` or random base58). Explorer and Solscan links must point strictly to Solana Devnet (`?cluster=devnet`).
14. **Strict Clipboard Accuracy:** If clipboard write fails or user cancels the OS share sheet, never display "link copied". Only confirm when copying actually succeeded.
15. **Live Spot Price Feed & Real Math:** Cumulative portfolio balances strictly derive from real-time live APIs (Coinbase API for SOL spot rates, DexScreener API for SKR rates) with automatic purging of legacy hardcoded price caches (`$142.50`).

---

## Project Location
`/Users/user/.gemini/antigravity-ide/scratch/seeker-tapblink`

---

## Active Servers & Tunnel Status
- **Backend & Static App Server:** `server.js` running on Port 3000 (`node server.js`) — Active (Task `task-11583`)
- **Self-Healing Cloudflare Tunnel URL:** `https://flag-riding-faq-stats.trycloudflare.com` — Active (Supervised by `tunnel_supervisor.js`, Task `task-11118`)
- **Direct Local Network (Wi-Fi) URL:** `http://192.168.1.194:3000`

---

## Latest Update: Complete Removal of All Mocked & Sample Blinks

### 1. Requirements & Fix Summary
- **Total Mock & Sample Blink Wipe:**
  - Removed `DEFAULT_GLOBAL_BLINKS` array in `server.js`.
  - Cleared `server_db.json` database file to `[]`.
  - Removed `DEFAULT_FALLBACKS` array in `DatabaseService.ts`.
  - Updated `PhysicalBlinkRegistry.syncFromCloud()` to automatically purge legacy mock IDs (`tip-solana-dev`, `mint-seeker-pioneer`, `charity-clean-oceans`, `voucher-hacker-house`, `voucher-coffee-seeker`) from local storage and memory on client startup.
  - The app now launches with an absolute clean slate for user-created Blinks.
