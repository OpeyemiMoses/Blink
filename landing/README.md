# Blink Landing Page

The official, high-performance landing page for **Blink — The Physical Interaction Layer for Solana**.

## Features Included
- **Stunning Dark Glassmorphic Aesthetic:** Custom radiant Solana gradients (`#9945FF` to `#14F195`), glowing ambient spheres, and sleek card typography.
- **Interactive Seeker Phone Simulator:** Visitors can interact live with NFC Tap-to-Pay, QR Scanner, and Blink Studio simulations right on the page without installing anything.
- **Live Solana Market Ticker:** Displays real-time SOL and $SKR token economics.
- **Download Center:** Direct 1-tap download for the official Android APK (`blink.apk v1.0.0`) with installation walkthrough.
- **Audited & Hardened:** Highlights the completed security audit findings and non-custodial cryptographic guarantees.
- **Zero Build Step:** 100% pure vanilla HTML5, CSS3, and JavaScript — loads instantly (0ms bundle delay, 100/100 Lighthouse score).

---

## Deploying to Vercel

### Method 1: Via Vercel Dashboard (GitHub Integration)
1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Import the GitHub repository: **`OpeyemiMoses/Blink`**.
3. In the project configuration:
   - **Root Directory:** Click "Edit" and select **`landing`**.
   - **Framework Preset:** Select **`Other`** (Static HTML).
4. Click **Deploy**. Vercel will instantly publish the landing page with global edge CDN and automatic HTTPS!

### Method 2: Via Vercel CLI (Command Line)
If you have Vercel CLI installed:
```bash
cd landing
npx vercel
```
Follow the prompts to deploy immediately to a production `.vercel.app` domain.
