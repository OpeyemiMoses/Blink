/**
 * Injects Google Fonts "Caveat" (weights 400, 500, 600, 700) across the entire application.
 * Bold styles render with weight 700, normal styles render with weight 400.
 */

export function injectCursiveFont() {
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

  // 2. Google Fonts Link (Loads Caveat with weights 400, 500, 600, 700)
  if (!document.getElementById('google-caveat-fonts-link')) {
    const fontLink = document.createElement('link');
    fontLink.id = 'google-caveat-fonts-link';
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&display=swap';
    document.head.appendChild(fontLink);
  }

  // 3. Global CSS Override
  let styleEl = document.getElementById('caveat-global-font-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'caveat-global-font-style';
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&display=swap');

    html, body, #root, #root div, #root span, #root p, #root h1, #root h2, #root h3, #root h4, #root a, #root input, #root button, #root textarea,
    [class*="css-text"], [class*="r-"] {
      font-family: 'Caveat', cursive, sans-serif !important;
      letter-spacing: 0.3px;
    }

    /* Preserve monospace for blockchain addresses, public keys, and code blocks */
    .mono-text, code, pre, [data-monospace="true"], [style*="monospace"], [style*="Menlo"] {
      font-family: Menlo, Monaco, Consolas, 'Courier New', monospace !important;
      letter-spacing: normal;
    }
  `;
}
