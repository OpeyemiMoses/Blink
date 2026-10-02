const fs = require('fs');
const path = require('path');

const distIndex = path.join(__dirname, '../dist/index.html');

if (fs.existsSync(distIndex)) {
  let html = fs.readFileSync(distIndex, 'utf8');

  // 1. Ensure body has dark background
  if (!html.includes('background-color: #07080B')) {
    html = html.replace('body {', 'body {\n        background-color: #07080B;\n        color: #FFFFFF;');
  }

  // 2. Inject storage safeguard into <head>
  const storageGuard = `
    <script>
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

  if (!html.includes('__b_t__')) {
    html = html.replace('</head>', `${storageGuard}\n</head>`);
  }

  // 3. Inject fallback recovery script into <body>
  const recoveryScript = `
    <script>
      setTimeout(function() {
        var root = document.getElementById('root');
        if (root && root.children.length === 0) {
          console.warn('[Blink Boot Guard] Root is still empty after 4 seconds. Rendering recovery screen.');
          root.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#07080B;color:#FFF;padding:24px;font-family:sans-serif;text-align:center;">' +
            '<h2 style="font-size:22px;font-weight:800;margin-bottom:12px;">Blink</h2>' +
            '<p style="color:#94A3B8;font-size:14px;max-width:320px;margin-bottom:24px;">Initializing application. Tap below to reload if stalled.</p>' +
            '<button onclick="window.location.reload()" style="background:#5B67F6;color:#FFF;border:none;padding:12px 28px;border-radius:24px;font-weight:700;font-size:14px;cursor:pointer;">Reload App</button>' +
          '</div>';
        }
      }, 4000);
    </script>
`;

  if (!html.includes('[Blink Boot Guard]')) {
    html = html.replace('</body>', `${recoveryScript}\n</body>`);
  }

  fs.writeFileSync(distIndex, html, 'utf8');
  console.log('Successfully patched dist/index.html with dark theme, storage guard, and recovery watchdog');
} else {
  console.error('dist/index.html not found to patch');
}
