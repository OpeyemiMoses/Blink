const fs = require('fs');
const path = require('path');

const distIndex = path.join(__dirname, '../dist/index.html');
const jsDir = path.join(__dirname, '../dist/_expo/static/js/web');

// 1. Patch JavaScript Bundles for CJS/ESM tslib Interop bug
if (fs.existsSync(jsDir)) {
  const files = fs.readdirSync(jsDir);
  for (const file of files) {
    if (file.endsWith('.js')) {
      const filePath = path.join(jsDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      let patched = false;

      // Fix 1: destructuring from n.default when n.default is undefined in tslib
      if (content.includes('}=n.default')) {
        content = content.replace(/\}=n\.default/g, '}=(n.default||n)');
        patched = true;
      }

      if (patched) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[Patch] Successfully patched CJS/ESM tslib interop in ${file}`);
      }
    }
  }
}

// 2. Patch dist/index.html
if (fs.existsSync(distIndex)) {
  let html = fs.readFileSync(distIndex, 'utf8');

  // Ensure body has dark background
  if (!html.includes('background-color: #07080B')) {
    html = html.replace('body {', 'body {\n        background-color: #07080B;\n        color: #FFFFFF;');
  }

  // Inject storage safeguard & error tracking into <head>
  const headScript = `
    <script>
      window.__boot_errors = [];
      window.addEventListener('error', function(e) {
        var msg = (e.error && (e.error.stack || e.error.message)) || e.message || 'Unknown error';
        console.error('[Blink Window Error]:', msg);
        window.__boot_errors.push(msg);
      });
      window.addEventListener('unhandledrejection', function(e) {
        var msg = (e.reason && (e.reason.stack || e.reason.message)) || String(e.reason) || 'Unhandled rejection';
        console.error('[Blink Rejection]:', msg);
        window.__boot_errors.push(msg);
      });
      (function() {
        try {
          if (!window.localStorage) throw new Error();
          var k = '__b_t__';
          window.localStorage.setItem(k, '1');
          window.localStorage.removeItem(k);
        } catch(e) {
          var mem = {};
          window.localStorage = {
            getItem: function(k) { return mem[k] || null; },
            setItem: function(k, v) { mem[k] = String(v); },
            removeItem: function(k) { delete mem[k]; },
            clear: function() { mem = {}; },
            get length() { return Object.keys(mem).length; },
            key: function(i) { return Object.keys(mem)[i] || null; }
          };
        }
        try {
          if (!window.sessionStorage) throw new Error();
          var sk = '__b_st__';
          window.sessionStorage.setItem(sk, '1');
          window.sessionStorage.removeItem(sk);
        } catch(e) {
          var smem = {};
          window.sessionStorage = {
            getItem: function(k) { return smem[k] || null; },
            setItem: function(k, v) { smem[k] = String(v); },
            removeItem: function(k) { delete smem[k]; },
            clear: function() { smem = {}; },
            get length() { return Object.keys(smem).length; },
            key: function(i) { return Object.keys(smem)[i] || null; }
          };
        }
      })();
    </script>
`;

  if (!html.includes('__boot_errors')) {
    html = html.replace('</head>', `${headScript}\n</head>`);
  }

  // Inject fallback recovery script into <body> with 6s timeout & error display
  const recoveryScript = `
    <script>
      setTimeout(function() {
        var root = document.getElementById('root');
        if (root && root.children.length === 0) {
          console.warn('[Blink Boot Guard] Root is still empty after 6 seconds. Rendering recovery screen.');
          var errHtml = '';
          if (window.__boot_errors && window.__boot_errors.length > 0) {
            errHtml = '<pre style="color:#EF4444;font-size:11px;max-width:320px;overflow:auto;max-height:100px;text-align:left;background:#18181B;padding:8px;border-radius:8px;margin-bottom:16px;">' +
              window.__boot_errors[0] +
            '</pre>';
          }
          root.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#07080B;color:#FFF;padding:24px;font-family:sans-serif;text-align:center;">' +
            '<h2 style="font-size:22px;font-weight:800;margin-bottom:12px;">Blink</h2>' +
            '<p style="color:#94A3B8;font-size:14px;max-width:320px;margin-bottom:16px;">Initializing application. Tap below to reload if stalled.</p>' +
            errHtml +
            '<button onclick="window.location.reload()" style="background:#5B67F6;color:#FFF;border:none;padding:12px 28px;border-radius:24px;font-weight:700;font-size:14px;cursor:pointer;">Reload App</button>' +
          '</div>';
        }
      }, 6000);
    </script>
`;

  if (!html.includes('[Blink Boot Guard]')) {
    html = html.replace('</body>', `${recoveryScript}\n</body>`);
  }

  // Cache-bust all JS scripts so browsers never serve a stale cached bundle
  const cacheBuster = Date.now();
  html = html.replace(/src="(\/_expo\/static\/js\/web\/[^"?]+)(\?[^"]*)?"/g, `src="$1?v=${cacheBuster}"`);

  fs.writeFileSync(distIndex, html, 'utf8');
  console.log('[Patch] Successfully updated dist/index.html with error tracker, recovery watchdog, and cache-busting');
}
