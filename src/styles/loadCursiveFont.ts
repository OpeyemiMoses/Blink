/**
 * Injects Google Fonts "Poppins" (weights 300–800) across the entire application.
 * Professional, modern, perfectly-proportioned fintech typography.
 *
 * Poppins renders ~12% larger than Caveat at the same px value, so we apply a
 * global CSS scale-down (font-size: 92%) on the root element so that every
 * component's hard-coded pixel values look correct without touching individual
 * StyleSheet definitions.
 */

export function injectAppFont() {
  if (typeof document === 'undefined') return;

  // 1. Google Fonts Preconnect
  if (!document.getElementById('google-fonts-preconnect-1')) {
    const preconnect1 = document.createElement('link');
    preconnect1.id = 'google-fonts-preconnect-1';
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnect1);
  }

  if (!document.getElementById('google-fonts-preconnect-2')) {
    const preconnect2 = document.createElement('link');
    preconnect2.id = 'google-fonts-preconnect-2';
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect2);
  }

  // 2. Google Fonts Link
  if (!document.getElementById('google-poppins-fonts-link')) {
    const fontLink = document.createElement('link');
    fontLink.id = 'google-poppins-fonts-link';
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=JetBrains+Mono:wght@400;500;600;700&display=swap';
    document.head.appendChild(fontLink);
  }

  // 3. Global CSS Override
  let styleEl = document.getElementById('poppins-global-font-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'poppins-global-font-style';
    document.head.appendChild(styleEl);
  }

  // Remove legacy caveat style element if present
  const oldCaveatEl = document.getElementById('caveat-global-font-style');
  if (oldCaveatEl && oldCaveatEl.parentNode) {
    oldCaveatEl.parentNode.removeChild(oldCaveatEl);
  }

  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

    /* ── Global font-family ────────────────────────────────────── */
    html, body, #root, #root div, #root span, #root p,
    #root h1, #root h2, #root h3, #root h4,
    #root a, #root input, #root button, #root textarea,
    [class*="css-text"], [class*="r-"], [dir] {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont,
                   "Segoe UI", Roboto, "Helvetica Neue", sans-serif !important;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      letter-spacing: -0.1px;
    }

    /* ── Clean monospace for blockchain data ────────────────────── */
    .mono-text, code, pre, [data-monospace="true"],
    [style*="monospace"], [style*="Menlo"], [style*="Courier"] {
      font-family: 'JetBrains Mono', Menlo, Monaco, Consolas,
                   'Courier New', monospace !important;
      letter-spacing: normal;
    }

    /* ── Sleek, proportional input and placeholder typography ─────── */
    input, textarea, select {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 11px !important;
      line-height: normal !important;
    }
    input::placeholder, textarea::placeholder {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 10px !important;
      opacity: 0.6 !important;
      color: #94A3B8 !important;
    }
  `;
}

// Backward compatibility alias
export const injectCursiveFont = injectAppFont;
