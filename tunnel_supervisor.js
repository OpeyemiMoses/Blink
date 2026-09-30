/**
 * Tunnel Supervisor - Automatically keeps Cloudflare Tunnel healthy and running.
 * Restarts cloudflared if the edge connection disconnects or expires.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const URL_FILE = path.join(__dirname, 'ACTIVE_TUNNEL_URL.txt');
let child = null;
let isStopping = false;

function startTunnel() {
  if (isStopping) return;

  console.log('[TunnelSupervisor] Launching cloudflared tunnel...');
  child = spawn('/tmp/cloudflared', ['tunnel', '--url', 'http://localhost:3000'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let urlDetected = false;

  let isRateLimited = false;

  const handleOutput = (data) => {
    const text = data.toString();
    process.stdout.write(text);

    if (text.includes('status 429')) {
      isRateLimited = true;
    }

    // Look for trycloudflare.com URL
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !urlDetected) {
      urlDetected = true;
      const activeUrl = match[0];
      console.log('\n==================================================');
      console.log(`[TunnelSupervisor] ACTIVE MOBILE URL: ${activeUrl}`);
      console.log('==================================================\n');
      try {
        fs.writeFileSync(URL_FILE, activeUrl, 'utf8');
      } catch (e) {}
    }

    // Check for edge revocation or unrecoverable error
    if (text.includes('Unauthorized: Tunnel not found') || text.includes('Error shutting down control stream')) {
      console.warn('[TunnelSupervisor] Detected expired/revoked tunnel from Cloudflare edge. Restarting...');
      cleanupAndRestart();
    }
  };

  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);

  child.on('exit', (code, signal) => {
    const delay = isRateLimited ? 15000 : 3000;
    console.log(`[TunnelSupervisor] cloudflared exited (code: ${code}, signal: ${signal}). Re-trying in ${delay / 1000}s...`);
    if (!isStopping) {
      setTimeout(startTunnel, delay);
    }
  });
}

function cleanupAndRestart() {
  if (child) {
    try {
      child.kill('SIGTERM');
    } catch (e) {}
    child = null;
  }
  setTimeout(startTunnel, 3000);
}

process.on('SIGINT', () => { isStopping = true; if (child) child.kill(); process.exit(); });
process.on('SIGTERM', () => { isStopping = true; if (child) child.kill(); process.exit(); });

startTunnel();
