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

  const handleOutput = (data) => {
    const text = data.toString();
    process.stdout.write(text);

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
      console.warn('[TunnelSupervisor] Detected expired/revoked tunnel from Cloudflare edge. Restarting in 3s...');
      cleanupAndRestart();
    }
  };

  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);

  child.on('exit', (code, signal) => {
    console.log(`[TunnelSupervisor] cloudflared exited (code: ${code}, signal: ${signal}).`);
    if (!isStopping) {
      setTimeout(startTunnel, 3000);
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
