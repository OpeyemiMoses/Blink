# Session Memory — TapBlink / Seeker Project
**Saved:** 2026-09-29T23:34

---

## Core Operational Directives (Strict Enforcement)

1. **Always Save Memory on Task Completion:** Update and persist `session_memory.md` after EVERY task or response without exception.
2. **Always Provide Mobile Test URL:** Provide the active HTTPS tunnel URL after every rebuild for instant mobile preview.
3. **No Printable Stickers / Placards:** Removed all printable card/sticker placard previews and download options across the app (`CreateBlinkModal.tsx`, `StudioScreen.tsx`).
4. **Instant Modal Dismissal on Delete:**
   - Deleting a Blink instantly invokes `onClose()`, resetting `selectedDetailBlink` state to `null` with 0ms delay.
   - `App.tsx` and `BlinkDetailModal.tsx` listen to deletion window events (`blink_deleted`, `tapblink_blink_deleted`) and auto-dismiss the modal page, seamlessly returning the user to the exact screen they opened the Blink from (`MarketsScreen`, `StudioScreen`, etc.).
5. **Strict Creator-Only Editing & Deletion:**
   - Non-creators cannot see or invoke Edit or Delete buttons anywhere (`BlinkDetailModal.tsx`, `StudioScreen.tsx`).
   - `server.js` validates creator matching case-insensitively (`incomingRequester === existingCreator`) and rejects unauthorized edit or deletion attempts with HTTP 403.
6. **Global Cross-Device Deletion Sync:**
   - When a creator deletes a Blink, `server.js` adds the ID to `deletedBlinksDb` (`server_deleted_db.json`).
   - Every client device running `PhysicalBlinkRegistry.syncFromCloud()` automatically purges tombstoned IDs from `this.globalCloudBlinks`, `this.blinks`, `DatabaseService`, and `localStorage` across all user sessions globally.
7. **Scrollable Mobile Search & Filter Bars:** The search bar and category filter pills in `MarketsScreen.tsx` are wrapped in a horizontal `ScrollView` so no text, input fields, or pills get cut off on mobile viewports.
8. **No Mocked or Pre-populated Default Blinks:** All seeded, mocked, and default blinks (`DEFAULT_GLOBAL_BLINKS`, `DEFAULT_FALLBACKS`, `server_db.json`) are completely removed from both backend and frontend. The app operates with a clean slate for real user-created Blinks.
9. **No "Choose from Gallery" button anywhere:** Avatar changes are strictly via camera or 3D Mascot selector.
10. **No inline alert/toast banners:** Use `ToastService` exclusively.
11. **Profile Edit Form Hidden by Default:** Collapses once saved; pencil icon toggles display.
12. **3D Toy / Lego Mascot Avatars as Default:** All new accounts receive one of the 6 colorful 3D Toy/Lego mascot avatars from `assets/avatars/` (`mascot_purple.png`, `mascot_green.png`, `mascot_pink.png`, `mascot_cyan.png`, `mascot_orange.png`, `mascot_gold.png`) at random until they choose to change it.
13. **Clean Header & Hero Cards (No Subtext / Redundant Sign Out Pills):**
    - Subtext balance lines (`● X.XXXX SOL • XX.XX USDC`) removed from balance hero cards in `PocketScreen.tsx` and `MarketsScreen.tsx`.
    - Redundant top header `Sign Out` button pills removed from `ProfileScreen.tsx` and `PocketScreen.tsx` header actions.
14. **Near End-to-End Mobile Padding:** Container horizontal padding is reduced to `6px` across all screens so cards and content expand near end-to-edge on mobile viewports.
15. **Real On-Chain Transactions (Zero Mock Signatures):** Every transaction must be broadcasted to Solana Devnet RPC and confirmed on-chain. Never return fake random string signatures (`sol_...` or random base58). Explorer and Solscan links must point strictly to Solana Devnet (`?cluster=devnet`).
16. **Strict Clipboard Accuracy:** If clipboard write fails or user cancels the OS share sheet, never display "link copied". Only confirm when copying actually succeeded.
17. **Live Spot Price Feed & Real Math:** Cumulative portfolio balances strictly derive from real-time live APIs (Coinbase API for SOL spot rates, DexScreener API for SKR rates) with automatic purging of legacy hardcoded price caches (`$142.50`).

---

## Project Location
`/Users/user/.gemini/antigravity-ide/scratch/seeker-tapblink`

---

## Active Servers & Tunnel Status
- **Backend & Static App Server:** `server.js` running on Port 3000 (`node server.js`) — Active (Task `task-11664`)
- **Self-Healing Cloudflare Tunnel URL:** `https://flag-riding-faq-stats.trycloudflare.com` — Active (Supervised by `tunnel_supervisor.js`, Task `task-11118`)
- **Direct Local Network (Wi-Fi) URL:** `http://192.168.1.194:3000`

---

## Latest Update: Complete Removal of Printable Card Stickers / Placards

### 1. Requirements & Fix Summary
- **Sticker / Placard Removal:**
  - Removed "Placard Preview Card" and "Save Printable Card Image (PNG)" from [`CreateBlinkModal.tsx`](file:///Users/user/.gemini/antigravity-ide/scratch/seeker-tapblink/src/components/CreateBlinkModal.tsx).
  - Removed "Print Card" action button and "Save Printable Card Image (PNG)" from [`StudioScreen.tsx`](file:///Users/user/.gemini/antigravity-ide/scratch/seeker-tapblink/src/screens/StudioScreen.tsx).
