# TapBlink Session Memory

## Project
Expo/React Native mobile app — Solana Blink payments with NFC & QR.  
Workspace: `/Users/user/.gemini/antigravity-ide/scratch/seeker-tapblink`  
GitHub Repo: `https://github.com/OpeyemiMoses/Blink.git` (Pushed & up to date on `main` at commit `f5853c3`)

## Active Mobile Test URLs
- **localtunnel**: `https://every-baboons-knock.loca.lt` (Password: `105.120.131.143`)
- **Railway Cloud Backend**: `https://blink-production-5c36.up.railway.app`
- **EAS Build 3 (Previous)**: https://expo.dev/accounts/yemigraffix/projects/blink/builds/34643ec7-5b23-4ab5-a2b0-b9ecf39f18af
- **EAS Build 4 (Active Live Build)**: https://expo.dev/accounts/yemigraffix/projects/blink/builds/68f1187d-3cb9-461c-b59b-c919dfd2166d
- **GitHub Release (APK)**: https://github.com/OpeyemiMoses/Blink/releases

---

## Hackathon Intelligence ("Clock In" — Solana Mobile Hackathon)
- **Source**: `https://solanamobile.radiant.nexus/` (Radiants DAO & Solana Mobile)
- **Submissions Close**: **October 8, 2026, 23:59 UTC (Hard Deadline: ~6 days remaining)**
- **Prize Pool**: $135k USDC total ($30k 1st, $25k 2nd, etc.) + **$10,000 in $SKR** for Best SKR Integration + Matched ORE Prize (up to $30k) + Seeker devices + 1-on-1 Call with Anatoly Yakovenko (Toly)
- **Judging Criteria (25% each)**:
  1. Stickiness & PMF (25%)
  2. User Experience (25%)
  3. Innovation / X-factor (25%)
  4. Presentation & Demo Quality (25%)

---

## Completed Fixes & Diagnoses (Turn Update — Oct 2, 2026)

### 1. In-App Privy WebView Blank Screen & Status Bar Collision
- **Issue 1 (Status Bar Collision)**: Top modal header overlapped directly with Android status bar icons (clock, battery, 4G, camera cutout).
  - **Fix**: Added `paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0` to `PrivyAuthModal.tsx` container styles.
- **Issue 2 (WebView Going Blank)**: Modal displayed "Connecting to Privy secure authentication..." and then turned completely blank black.
  - **Root Cause**:
    1. `PROD_AUTH_URL` targeted `/auth-modal.html`, which executed a client-side redirect (`window.location.replace('/?auth_modal=1')`) that dropped or failed in React Native WebView.
    2. Railway lacked the pre-compiled `dist/` bundle because `dist/` was in `.gitignore` and Railway Nixpacks ran out of memory compiling `expo export --platform web`.
    3. Missing Android WebView flags (`javaScriptCanOpenWindowsAutomatically={true}`, `setSupportMultipleWindows={false}`) caused OAuth popup windows to be silently dropped into a blank state.
  - **Fix**:
    1. Targeted `PROD_AUTH_URL` directly to `https://blink-production-5c36.up.railway.app/?auth_modal=1` (zero redirect latency).
    2. Removed `dist/` from `.gitignore` and committed the pre-compiled production web bundle directly.
    3. Configured `railway.json` to skip memory-intensive building and serve the pre-built `dist/` bundle instantly.
    4. Enabled `javaScriptCanOpenWindowsAutomatically={true}`, `setSupportMultipleWindows={false}`, `userAgent` mobile Chrome string, `domStorageEnabled`, and cache disable in `PrivyAuthModal.tsx`.
    5. Added an external browser fallback button (`Linking.openURL`) in the modal header so users can also authenticate via their system browser if needed.

### 2. Mobile Wallet Adapter (MWA) & Phantom App Visibility on Android
- **Issue**: Tapping MWA / Phantom did not discover or trigger installed Solana wallet apps on the user's Android device.
- **Root Cause**: Android 11+ (API 30+) restricts inter-app package visibility unless intent filters and `<queries>` tags are explicitly declared in the app manifest.
- **Fix**:
  - Created Expo config plugin `plugins/withAndroidQueries.js` declaring intent schemes (`solana-wallet`, `phantom`, `solflare`) and packages (`app.phantom`, `com.solflare.mobile`).
  - Added `intentFilters` to `app.json` for `solana-wallet` and `phantom`.
  - Bumped `versionCode` to `4` in `app.json`.

### 3. Guest Mode Delete Account Button Removed
- **Issue**: Guest accounts viewing the app without an account saw an "ACCOUNT DANGER ZONE" and "Delete Account" button in `SettingsScreen.tsx`.
- **Fix**:
  - Replaced "ACCOUNT DANGER ZONE" with a dedicated "GUEST SESSION" card for unauthenticated visitors.
  - Only authenticated users can see the "Delete Account" button.
  - Guests now see an "Exit Guest Mode & Sign In" button that brings them to the Welcome/Auth screen.

### 4. Global Database Deletion & Clean Toast Copy
- **Issue**: Deleting an account only cleared localStorage without purging the account record globally from the backend database, and the toast copy was verbose ("Account deleted and local session cleared.").
- **Fix**:
  - Added `UserProfileService.deleteAccountGlobally(address)` which executes `DELETE /api/users/:address` against the backend database (`server.js`), purging the user globally.
  - Cleaned toast notification strictly to `ToastService.success('Account deleted.')`.

### 5. Guest Mode Profile Navigation to Welcome/Auth Page
- **Issue**: Clicking Profile as a guest did not return the user to the front page / WelcomeAuthScreen to try logging in again.
- **Fix**:
  - Updated `handleOpenProfile` in `App.tsx`: if `!authenticated`, it sets `setIsGuestMode(false)`, immediately returning the user to the front Welcome/Auth screen.
  - In `ProfileScreen.tsx` and `SettingsScreen.tsx`: added `onReturnToAuth={() => setIsGuestMode(false)}` actions to return to the front page with a single tap.
