const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const zlib = require('zlib');
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const https = require('https');

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');
const DB_FILE = path.join(__dirname, 'server_db.json');
const USERS_DB_FILE = path.join(__dirname, 'server_users_db.json');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

// Seed global public blinks (empty by default)
const DEFAULT_GLOBAL_BLINKS = [];

// In-memory cache + file persistence
let blinksDb = [];
let usersDb = {};

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      blinksDb = JSON.parse(data);
    } else {
      blinksDb = [];
      saveDb();
    }
  } catch (err) {
    console.error('Error loading DB:', err);
    blinksDb = [];
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(blinksDb, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving DB:', err);
  }
}

function loadUsersDb() {
  try {
    if (fs.existsSync(USERS_DB_FILE)) {
      const data = fs.readFileSync(USERS_DB_FILE, 'utf8');
      usersDb = JSON.parse(data);
    } else {
      usersDb = {};
    }
  } catch (err) {
    console.error('Error loading users DB:', err);
    usersDb = {};
  }
}

function saveUsersDb() {
  try {
    fs.writeFileSync(USERS_DB_FILE, JSON.stringify(usersDb, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving users DB:', err);
  }
}

const RECEIPTS_DB_FILE = path.join(__dirname, 'server_receipts_db.json');
let receiptsDb = {};
const parsedTxCache = new Map();
const addressSigsCache = new Map();
const addressBalanceCache = new Map();

function loadReceiptsDb() {
  try {
    if (fs.existsSync(RECEIPTS_DB_FILE)) {
      const data = fs.readFileSync(RECEIPTS_DB_FILE, 'utf8');
      receiptsDb = JSON.parse(data);
    } else {
      receiptsDb = {};
    }
  } catch (err) {
    console.error('Error loading receipts DB:', err);
    receiptsDb = {};
  }
}

function saveReceiptsDb() {
  try {
    fs.writeFileSync(RECEIPTS_DB_FILE, JSON.stringify(receiptsDb, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving receipts DB:', err);
  }
}

const DELETED_DB_FILE = path.join(__dirname, 'server_deleted_db.json');
let deletedBlinksDb = new Set();

function loadDeletedDb() {
  try {
    if (fs.existsSync(DELETED_DB_FILE)) {
      const data = fs.readFileSync(DELETED_DB_FILE, 'utf8');
      const list = JSON.parse(data);
      deletedBlinksDb = new Set(Array.isArray(list) ? list : []);
    }
  } catch (err) {
    deletedBlinksDb = new Set();
  }
}

function saveDeletedDb() {
  try {
    fs.writeFileSync(DELETED_DB_FILE, JSON.stringify(Array.from(deletedBlinksDb)), 'utf8');
  } catch (err) {}
}

loadDb();
loadUsersDb();
loadReceiptsDb();
loadDeletedDb();

// Helper to send JSON responses
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
  });
  res.end(JSON.stringify(data));
}

// ─── REAL-TIME SERVER-SENT EVENTS (SSE) STREAMING FOR SALE NOTIFICATIONS ───
const sseClients = new Map();

function addSseClient(key, res) {
  if (!key) return;
  const k = String(key).toLowerCase().trim();
  if (!sseClients.has(k)) {
    sseClients.set(k, new Set());
  }
  sseClients.get(k).add(res);
}

function removeSseClient(key, res) {
  if (!key) return;
  const k = String(key).toLowerCase().trim();
  if (sseClients.has(k)) {
    sseClients.get(k).delete(res);
    if (sseClients.get(k).size === 0) {
      sseClients.delete(k);
    }
  }
}

function broadcastSseEvent(targetKeys, eventName, data) {
  // Mobile proxies (Cloudflare Tunnel, localtunnel, nginx) buffer SSE chunks smaller than 2KB.
  // Appending standard SSE comment padding forces reverse proxies to flush the chunk IMMEDIATELY to mobile devices!
  const commentPadding = ': ' + ' '.repeat(2048) + '\n';
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n${commentPadding}\n`;
  const targets = Array.isArray(targetKeys) ? targetKeys : [targetKeys];
  const notifiedResponses = new Set();

  targets.forEach(rawKey => {
    if (!rawKey) return;
    const k = String(rawKey).toLowerCase().trim();
    const clients = sseClients.get(k);
    if (clients) {
      clients.forEach(res => {
        if (!notifiedResponses.has(res) && !res.writableEnded) {
          notifiedResponses.add(res);
          try {
            res.write(payload);
            if (typeof res.flush === 'function') res.flush();
          } catch (writeErr) {
            console.warn('[SSE] Write error:', writeErr);
          }
        }
      });
    }
  });
}

// ─── LIVE TOKEN MARKET PRICES (CoinGecko & DexScreener Orca/Raydium) ────────
let cachedMarketPrices = {
  sol: 117.30,
  skr: 0.0181,
  usdc: 1.0,
  updatedAt: 0,
};
let isFetchingPrices = false;

async function fetchLiveMarketPrices() {
  if (isFetchingPrices) return cachedMarketPrices;
  // Cache for 3 seconds for near real-time pricing
  if (Date.now() - cachedMarketPrices.updatedAt < 3000 && cachedMarketPrices.updatedAt > 0) {
    return cachedMarketPrices;
  }
  isFetchingPrices = true;
  try {
    // 1. Live SOL price from CoinGecko
    try {
      const cgData = await new Promise((resolve, reject) => {
        https.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 4000
        }, res => {
          let str = '';
          res.on('data', d => str += d);
          res.on('end', () => {
            try { resolve(JSON.parse(str)); } catch(e) { reject(e); }
          });
        }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
      });
      if (cgData?.solana?.usd) {
        cachedMarketPrices.sol = Number(cgData.solana.usd);
      }
    } catch (e) {}

    // 2. Live SKR price from DexScreener by exact Solana Mint
    try {
      const dexData = await new Promise((resolve, reject) => {
        https.get('https://api.dexscreener.com/latest/dex/tokens/SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3', {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 4000
        }, res => {
          let str = '';
          res.on('data', d => str += d);
          res.on('end', () => {
            try { resolve(JSON.parse(str)); } catch(e) { reject(e); }
          });
        }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
      });
      const pairPrice = parseFloat(dexData?.pairs?.[0]?.priceUsd);
      if (!isNaN(pairPrice) && pairPrice > 0) {
        cachedMarketPrices.skr = Number(pairPrice);
      }
    } catch (e) {}

    cachedMarketPrices.updatedAt = Date.now();
  } finally {
    isFetchingPrices = false;
  }
  return cachedMarketPrices;
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
    });
    res.end();
    return;
  }

  // Direct serving of auth-modal.html for In-App Native Privy WebView
  if (pathname === '/auth-modal.html' || pathname === '/auth-modal') {
    const candidatePaths = [
      path.join(__dirname, 'public', 'auth-modal.html'),
      path.join(__dirname, 'dist', 'auth-modal.html'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        });
        return fs.createReadStream(p).pipe(res);
      }
    }
  }

  // ─── API ROUTES ───────────────────────────────────────────────────────────
  if (pathname === '/api/prices' && req.method === 'GET') {
    fetchLiveMarketPrices().then(prices => {
      sendJson(res, 200, {
        success: true,
        prices: {
          sol: prices.sol,
          skr: prices.skr,
          usdc: 1.0,
          updatedAt: prices.updatedAt,
        }
      });
    }).catch(() => {
      sendJson(res, 200, {
        success: true,
        prices: cachedMarketPrices
      });
    });
    return;
  }

  if (pathname === '/api/blinks' && req.method === 'GET') {
    const visibilityFilter = parsedUrl.query.visibility; // 'global' or 'physical'
    const creatorFilter = parsedUrl.query.creator;
    let result = blinksDb;
    if (creatorFilter) {
      const c = creatorFilter.toLowerCase().trim();
      result = result.filter(b => 
        (b.creatorAddress && b.creatorAddress.toLowerCase().trim() === c) ||
        (b.recipient && b.recipient.toLowerCase().trim() === c)
      );
    }
    if (visibilityFilter === 'global') {
      result = result.filter(b => b.visibility === 'global');
    } else if (visibilityFilter === 'physical') {
      result = result.filter(b => b.visibility === 'physical');
    }
    return sendJson(res, 200, {
      success: true,
      count: result.length,
      blinks: result,
      deletedIds: Array.from(deletedBlinksDb),
    });
  }

  if (pathname.startsWith('/api/blinks/') && req.method === 'GET') {
    const blinkId = pathname.replace('/api/blinks/', '').trim().toLowerCase();
    if (deletedBlinksDb.has(blinkId)) {
      return sendJson(res, 404, { success: false, error: 'Blink has been permanently deleted', deleted: true });
    }
    const found = blinksDb.find(b => b.id.toLowerCase() === blinkId);
    if (found) {
      return sendJson(res, 200, { success: true, blink: found });
    }
    return sendJson(res, 404, { success: false, error: 'Blink not found' });
  }

  if (pathname === '/api/blinks' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (!data.id || !data.name || !data.recipient) {
          return sendJson(res, 400, { success: false, error: 'Missing required blink fields' });
        }

        const cleanId = String(data.id).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        
        // Auto-assign visibility if not specified:
        // tips, mints, donations, vouchers, claims -> 'global'
        // payments (food, coffee, retail) -> 'physical'
        let visibility = data.visibility;
        if (!visibility) {
          const globalTypes = ['tip', 'mint', 'donation', 'voucher', 'claim'];
          visibility = globalTypes.includes(data.actionType) ? 'global' : 'physical';
        }

        const existingIdx = blinksDb.findIndex(b => b.id.toLowerCase() === cleanId);
        const existing = existingIdx >= 0 ? blinksDb[existingIdx] : null;

        const newBlink = {
          id: cleanId,
          name: String(data.name).trim(),
          actionType: data.actionType || 'payment',
          amount: Number(data.amount) || 0.01,
          baseUsdcAmount: data.baseUsdcAmount !== undefined ? Number(data.baseUsdcAmount) : undefined,
          token: data.token || 'SOL',
          recipient: String(data.recipient).trim(),
          creatorAddress: data.creatorAddress ? String(data.creatorAddress).trim() : String(data.recipient).trim(),
          description: String(data.description || '').trim(),
          imageUrl: data.imageUrl || data.icon || (existing ? existing.imageUrl : undefined),
          verifiedDomain: data.verifiedDomain ? String(data.verifiedDomain).trim() : undefined,
          visibility,
          createdAt: data.createdAt || (existing ? existing.createdAt : Date.now()),
          updatedAt: Date.now(),
          stats: data.stats || (existing ? existing.stats : { taps: 0, completed: 0, volumeUsdc: 0 }),
        };

        if (existingIdx >= 0) {
          const incomingRequester = (data.creatorAddress || data.recipient || data.requesterAddress || '').trim().toLowerCase();
          const existingCreator = (existing.creatorAddress || existing.recipient || '').trim().toLowerCase();
          if (existingCreator && (!incomingRequester || existingCreator !== incomingRequester)) {
            return sendJson(res, 403, { success: false, error: 'Unauthorized: Only the creator can edit this Blink' });
          }
          blinksDb[existingIdx] = { ...blinksDb[existingIdx], ...newBlink, updatedAt: Date.now() };
        } else {
          blinksDb.unshift(newBlink);
        }

        if (deletedBlinksDb.has(cleanId)) {
          deletedBlinksDb.delete(cleanId);
          saveDeletedDb();
        }

        saveDb();
        return sendJson(res, 200, { success: true, blink: newBlink });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: 'Invalid JSON payload' });
      }
    });
    return;
  }

  // Delete a Blink (DELETE /api/blinks/<id> or POST /api/blinks/<id>/delete)
  if (pathname.startsWith('/api/blinks/') && !pathname.endsWith('/tap') && (req.method === 'DELETE' || (req.method === 'POST' && pathname.endsWith('/delete')))) {
    const cleanPath = pathname.replace('/api/blinks/', '').replace(/\/delete$/, '').trim();
    const blinkId = cleanPath.toLowerCase();

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        const existingIdx = blinksDb.findIndex(b => b.id.toLowerCase() === blinkId);
        if (existingIdx >= 0) {
          const existing = blinksDb[existingIdx];
          const incomingRequester = (data.creatorAddress || data.requesterAddress || data.recipient || '').trim().toLowerCase();
          const existingCreator = (existing.creatorAddress || existing.recipient || '').trim().toLowerCase();

          if (existingCreator && (!incomingRequester || existingCreator !== incomingRequester)) {
            return sendJson(res, 403, { success: false, error: 'Unauthorized: Only the creator can delete this Blink' });
          }

          blinksDb.splice(existingIdx, 1);
          deletedBlinksDb.add(blinkId);
          saveDb();
          saveDeletedDb();
          console.log(`[Blink Server] Permanently deleted Blink "${blinkId}" from cloud database.`);
          return sendJson(res, 200, { success: true, deletedId: blinkId, deletedIds: Array.from(deletedBlinksDb) });
        }
        return sendJson(res, 404, { success: false, error: 'Blink not found' });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: 'Invalid JSON payload' });
      }
    });
    return;
  }

  if (pathname.endsWith('/tap') && req.method === 'POST') {
    const parts = pathname.split('/');
    const blinkId = parts[3]; // /api/blinks/<id>/tap
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const blink = blinksDb.find(b => b.id.toLowerCase() === (blinkId || '').toLowerCase());
        if (blink) {
          blink.stats = blink.stats || { taps: 0, completed: 0, volumeUsdc: 0 };
          blink.stats.taps += 1;
          if (payload.success) {
            blink.stats.completed += 1;
            blink.stats.volumeUsdc += Number(payload.amountUsdc || blink.amount || 0);
          }
          saveDb();
          return sendJson(res, 200, { success: true, stats: blink.stats });
        }
        return sendJson(res, 404, { success: false, error: 'Blink not found' });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: 'Invalid payload' });
      }
    });
    return;
  }

  // ─── REAL-TIME MARKET PRICE API ──────────────────────────────────────────
  let cachedSolPrice = 118.84;
  let lastPriceFetch = 0;

  if (pathname === '/api/price' && req.method === 'GET') {
    const now = Date.now();
    if (now - lastPriceFetch > 30000) {
      // Refresh price asynchronously from CoinGecko
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,usdt')
        .then(r => r.json())
        .then(data => {
          const p = data?.solana?.usdt || data?.solana?.usd;
          if (typeof p === 'number' && p > 0) {
            cachedSolPrice = Number(p.toFixed(2));
            lastPriceFetch = Date.now();
          }
        })
        .catch(() => {});
    }
    return sendJson(res, 200, {
      success: true,
      solUsdt: cachedSolPrice,
      symbol: 'SOL/USDT',
      updatedAt: lastPriceFetch || now,
    });
  }

  // Helper to extract all emails associated with a user record
  function extractUserEmails(u) {
    if (!u) return [];
    const emails = new Set();
    if (u.email && typeof u.email === 'string') {
      emails.add(u.email.trim().toLowerCase());
    }
    if (u.linkedAccounts) {
      if (u.linkedAccounts.email && typeof u.linkedAccounts.email === 'string') {
        emails.add(u.linkedAccounts.email.trim().toLowerCase());
      }
      if (u.linkedAccounts.google && typeof u.linkedAccounts.google === 'string') {
        emails.add(u.linkedAccounts.google.trim().toLowerCase());
      }
    }
    if (u.displayName && typeof u.displayName === 'string' && u.displayName.includes('@')) {
      emails.add(u.displayName.trim().toLowerCase());
    }
    return Array.from(emails);
  }

  // ─── USERNAME UNIQUENESS & AVAILABILITY ENGINE ─────────────────────────
  function isUsernameTaken(rawUsername, requestingAddress, requestingEmail) {
    const clean = (rawUsername || '').trim().toLowerCase().replace(/^@+/, '');
    if (!clean) return { taken: true, reason: 'Username cannot be empty.' };

    if (clean.length < 2) {
      return { taken: true, reason: 'Username must be at least 2 characters.' };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      return { taken: true, reason: 'Username may only contain letters, numbers, and underscores.' };
    }

    const reserved = ['admin', 'root', 'system', 'blink', 'seeker', 'solana', 'official', 'support', 'help', 'api'];
    if (reserved.includes(clean)) {
      return { taken: true, reason: `@${clean} is a reserved system handle.` };
    }

    // Check physical blinks registry
    const physical = blinksDb.find(b => b.id && b.id.toLowerCase() === clean);
    if (physical) {
      return { taken: true, reason: `@${clean} matches an existing physical Blink Action.` };
    }

    const reqAddrClean = (requestingAddress || '').trim().toLowerCase();
    let reqEmailClean = (requestingEmail || '').trim().toLowerCase();
    if (!reqEmailClean && reqAddrClean.includes('@')) {
      reqEmailClean = reqAddrClean;
    }

    // Check users database
    for (const user of Object.values(usersDb)) {
      if (!user) continue;
      const uName = (user.username || '').trim().toLowerCase().replace(/^@+/, '');
      const uBlinkId = (user.blinkId || '').trim().toLowerCase().replace(/^@+/, '');

      if (uName === clean || uBlinkId === clean) {
        const uAddr = (user.address || user.publicKey || user.id || '').trim().toLowerCase();
        const uEmails = extractUserEmails(user);

        // 1. Match by address / public key / user ID
        if (reqAddrClean && (uAddr === reqAddrClean || user.id?.toLowerCase() === reqAddrClean)) {
          return { taken: false, isOwner: true, ownerDisplay: user.displayName || user.username };
        }

        // 2. Match by email (if requesting email matches any email on this user account)
        if (reqEmailClean && uEmails.includes(reqEmailClean)) {
          return { taken: false, isOwner: true, ownerDisplay: user.displayName || user.username };
        }

        // 3. Match if user's requesting email prefix is this handle and the stored record has that same email prefix
        if (reqEmailClean) {
          const reqPrefix = reqEmailClean.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
          if (clean === reqPrefix && (uEmails.includes(reqEmailClean) || uEmails.length === 0 || uAddr === clean)) {
            return { taken: false, isOwner: true, ownerDisplay: user.displayName || user.username };
          }
        }

        // 4. Check if requesting address has matching email in existing database
        if (reqAddrClean && usersDb[reqAddrClean]) {
          const requestingUser = usersDb[reqAddrClean];
          const requestingEmails = extractUserEmails(requestingUser);
          const hasCommonEmail = requestingEmails.some(e => uEmails.includes(e));
          if (hasCommonEmail) {
            return { taken: false, isOwner: true, ownerDisplay: user.displayName || user.username };
          }
        }

        return {
          taken: true,
          reason: `@${clean} is already claimed by another user.`,
          ownerDisplay: user.displayName || user.username,
        };
      }
    }

    return { taken: false };
  }

  function generateUniqueUsername(baseSeed, requestingAddress, requestingEmail) {
    const seedClean = (baseSeed || 'user').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 15);
    const base = seedClean.length >= 2 ? seedClean : 'user';

    if (!isUsernameTaken(base, requestingAddress, requestingEmail).taken) {
      return base;
    }

    // Try suffixes _100 - _999
    for (let i = 0; i < 30; i++) {
      const candidate = `${base}_${Math.floor(100 + Math.random() * 900)}`;
      if (!isUsernameTaken(candidate, requestingAddress, requestingEmail).taken) {
        return candidate;
      }
    }

    // Suffix with short random hex
    for (let i = 0; i < 20; i++) {
      const candidate = `${base}_${Math.random().toString(36).substring(2, 6)}`;
      if (!isUsernameTaken(candidate, requestingAddress, requestingEmail).taken) {
        return candidate;
      }
    }

    return `user_${Math.random().toString(36).substring(2, 8)}`;
  }

  // ─── USERNAME CHECK REST API ───────────────────────────────────────────
  if (pathname === '/api/users/check-username' && req.method === 'GET') {
    const queryUsername = (parsedUrl.query.username || '').toString();
    const queryAddress = (parsedUrl.query.address || '').toString();
    const queryEmail = (parsedUrl.query.email || '').toString();

    const clean = queryUsername.trim().toLowerCase().replace(/^@+/, '');
    const check = isUsernameTaken(clean, queryAddress, queryEmail);

    return sendJson(res, 200, {
      success: true,
      username: clean,
      available: !check.taken,
      reason: check.reason || null,
      isOwner: Boolean(check.isOwner),
      suggested: check.taken ? generateUniqueUsername(clean, queryAddress, queryEmail) : clean,
    });
  }

  // ─── UNIQUE BLINK ID REGISTRY REST API ──────────────────────────────────
  if (pathname === '/api/blink-ids' && req.method === 'GET') {
    const list = Object.values(usersDb)
      .filter(u => u.address || u.publicKey)
      .map(u => ({
        blinkId: u.blinkId || (u.username ? (u.username.startsWith('@') ? u.username : `@${u.username}`) : `@${(u.address || u.publicKey).slice(0, 4)}...${(u.address || u.publicKey).slice(-4)}`),
        address: u.address || u.publicKey,
        displayName: u.displayName || u.username,
        avatarUrl: u.avatarUrl,
      }));
    return sendJson(res, 200, { success: true, count: list.length, blinkIds: list });
  }

  if (pathname.startsWith('/api/blink-ids/') && req.method === 'GET') {
    const rawId = decodeURIComponent(pathname.replace('/api/blink-ids/', '').trim());
    const clean = rawId.toLowerCase().replace(/^@+/, '');
    const withAt = `@${clean}`;

    // 1. Check in usersDb
    let found = Object.values(usersDb).find(u => {
      const uName = (u.username || '').toLowerCase().replace(/^@+/, '');
      const uBlinkId = (u.blinkId || '').toLowerCase().replace(/^@+/, '');
      const uDisp = (u.displayName || '').toLowerCase().replace(/^@+/, '');
      const uAddr = (u.address || u.publicKey || '').toLowerCase();
      return uName === clean || uBlinkId === clean || uDisp === clean || uAddr === clean;
    });

    if (found) {
      const address = found.address || found.publicKey;
      return sendJson(res, 200, {
        success: true,
        data: {
          blinkId: found.blinkId || (found.username ? (found.username.startsWith('@') ? found.username : `@${found.username}`) : withAt),
          address,
          displayName: found.displayName || found.username,
          avatarUrl: found.avatarUrl,
        },
      });
    }

    // 2. Check in blinksDb (Physical blinks)
    const blink = blinksDb.find(b => b.id.toLowerCase() === clean);
    if (blink && blink.recipient) {
      return sendJson(res, 200, {
        success: true,
        data: {
          blinkId: `@${blink.id}`,
          address: blink.recipient,
          displayName: blink.name,
          avatarUrl: '',
        },
      });
    }

    return sendJson(res, 404, { success: false, error: 'Blink ID not found' });
  }

  if (pathname === '/api/blink-ids' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const rawBlinkId = (data.blinkId || '').trim();
        const address = (data.address || data.publicKey || '').trim();
        if (!rawBlinkId || !address) {
          return sendJson(res, 400, { success: false, error: 'Missing blinkId or address' });
        }

        const cleanHandle = rawBlinkId.toLowerCase().replace(/^@+/, '');
        const canonicalId = `@${cleanHandle}`;
        const userEmail = (data.email || '').trim().toLowerCase();

        // Verify that this Blink ID is not already taken by another address
        const check = isUsernameTaken(cleanHandle, address, userEmail);
        if (check.taken && !check.isOwner) {
          return sendJson(res, 409, {
            success: false,
            error: check.reason || `Blink ID @${cleanHandle} is already registered by another user.`,
            suggested: generateUniqueUsername(cleanHandle, address, userEmail),
          });
        }

        // If an old record held this username under the same user / email or legacy placeholder, reassign & clean up
        for (const [k, u] of Object.entries(usersDb)) {
          if (!u) continue;
          const uHandle = (u.username || '').toLowerCase().replace(/^@+/, '');
          const uBlink = (u.blinkId || '').toLowerCase().replace(/^@+/, '');
          if (uHandle === cleanHandle || uBlink === cleanHandle) {
            const uAddr = (u.address || u.publicKey || '').toLowerCase();
            if (uAddr && uAddr !== address.toLowerCase()) {
              const uEmails = extractUserEmails(u);
              if (uAddr === cleanHandle || (userEmail && uEmails.includes(userEmail))) {
                delete usersDb[k];
              }
            }
          }
        }

        const existing = usersDb[address.toLowerCase()] || {};

        // If user changed their username / blinkId, release the old aliases
        if (existing.username && existing.username.toLowerCase() !== cleanHandle) {
          delete usersDb[existing.username.toLowerCase()];
        }
        if (existing.blinkId && existing.blinkId.toLowerCase() !== canonicalId.toLowerCase()) {
          delete usersDb[existing.blinkId.toLowerCase()];
        }

        const updated = {
          ...existing,
          address,
          publicKey: address,
          blinkId: canonicalId,
          username: cleanHandle,
          displayName: data.displayName || existing.displayName || cleanHandle,
          avatarUrl: data.avatarUrl || existing.avatarUrl || '',
          updatedAt: Date.now(),
        };

        usersDb[address.toLowerCase()] = updated;
        usersDb[cleanHandle] = updated;
        usersDb[canonicalId.toLowerCase()] = updated;

        saveUsersDb();
        return sendJson(res, 200, { success: true, data: updated });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: 'Invalid payload' });
      }
    });
    return;
  }

  // ─── DEVELOPER ADMIN ANALYTICS REST API ─────────────────────────────────
  if (pathname === '/api/admin/analytics' && req.method === 'GET') {
    // Count unique registered users
    const uniqueUserMap = new Map();
    Object.values(usersDb).forEach(u => {
      const addr = (u.address || u.publicKey || u.id || u.email || '').toLowerCase().trim();
      if (addr && !uniqueUserMap.has(addr)) {
        uniqueUserMap.set(addr, u);
      }
    });
    const totalUsers = uniqueUserMap.size;

    // Count active premium subscribers ($2/mo Pro Creators)
    const now = Date.now();
    let premiumUsersCount = 0;
    uniqueUserMap.forEach(u => {
      if (u.isPremium || (u.premiumExpiresAt && u.premiumExpiresAt > now)) {
        premiumUsersCount++;
      }
    });

    // Compute total transaction volume from logged receipts and blink stats
    let totalSol = 0;
    let totalUsdc = 0;
    let totalSkr = 0;

    Object.values(receiptsDb).forEach(r => {
      const amt = Number(r.amount || 0);
      const token = (r.token || 'SOL').toUpperCase();
      if (token === 'SOL') totalSol += amt;
      else if (token === 'SKR') totalSkr += amt;
      else totalUsdc += amt;
    });

    // Sol price estimate for total USD value
    const solPriceUsd = cachedSolPrice || 145.0;
    const skrPriceUsd = 0.05;
    const totalUsdVal = totalUsdc + (totalSol * solPriceUsd) + (totalSkr * skrPriceUsd);

    return sendJson(res, 200, {
      success: true,
      timestamp: now,
      analytics: {
        totalRegisteredUsers: totalUsers,
        premiumUsersCount: premiumUsersCount,
        monthlySubscriptionFeeUsd: 2.00,
        transactionVolume: {
          sol: Number(totalSol.toFixed(4)),
          usdc: Number(totalUsdc.toFixed(2)),
          skr: Number(totalSkr.toFixed(2)),
          totalUsdEquivalent: Number(totalUsdVal.toFixed(2)),
        }
      }
    });
  }

  // ─── PRO CREATOR $2/MO SUBSCRIPTION REST API ───────────────────────────
  if (pathname === '/api/users/subscribe' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const key = (data.address || data.publicKey || data.id || '').trim();
        if (!key) {
          return sendJson(res, 400, { success: false, error: 'Missing user address' });
        }

        const existing = usersDb[key] || usersDb[key.toLowerCase()] || {};
        const safeAddress = data.address || data.publicKey || existing.address || key;

        const updated = {
          ...existing,
          address: safeAddress,
          publicKey: safeAddress,
          isPremium: true,
          tier: 'pro_creator',
          subscribedAt: Date.now(),
          premiumExpiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
          lastSubscriptionSignature: data.signature || null,
          developerWallet: data.developerWallet || null,
          updatedAt: Date.now(),
        };

        if (data.signature) {
          receiptsDb[data.signature] = {
            id: `sub_${data.signature.slice(0, 10)}`,
            signature: data.signature,
            blinkTitle: 'Pro Creator Subscription ($2.00/mo)',
            amount: Number(data.amount || 2.0),
            token: data.token || 'SOL',
            payerAddress: safeAddress,
            recipientAddress: data.developerWallet || 'dev_treasury',
            timestamp: Date.now(),
            status: 'confirmed',
            actionType: 'subscription',
          };
          saveReceiptsDb();
        }

        usersDb[safeAddress.toLowerCase()] = updated;
        if (updated.username) usersDb[updated.username.toLowerCase()] = updated;
        if (updated.blinkId) usersDb[updated.blinkId.toLowerCase()] = updated;

        saveUsersDb();
        return sendJson(res, 200, { success: true, user: updated, message: 'Upgraded to Pro Creator ($2/mo)' });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: 'Invalid payload' });
      }
    });
    return;
  }

  // ─── USER ACCOUNTS CLOUD SYNC REST API ────────────────────────────────────
  if (pathname === '/api/users' && req.method === 'GET') {
    const list = Object.values(usersDb);
    return sendJson(res, 200, { success: true, count: list.length, users: list });
  }

  if (pathname.startsWith('/api/users/') && req.method === 'GET') {
    const rawId = decodeURIComponent(pathname.replace('/api/users/', '').trim());
    const idLower = rawId.toLowerCase();

    // Lookup by exact key, address, email, or id
    let found = usersDb[rawId] || usersDb[idLower];
    if (!found) {
      const matches = Object.values(usersDb).filter(u => {
        if (!u) return false;
        const emails = extractUserEmails(u);
        return (
          (u.address && u.address.toLowerCase() === idLower) ||
          (u.publicKey && u.publicKey.toLowerCase() === idLower) ||
          (u.id && u.id.toLowerCase() === idLower) ||
          emails.includes(idLower) ||
          (u.username && u.username.toLowerCase() === idLower.replace(/^@/, '')) ||
          (u.blinkId && u.blinkId.toLowerCase() === idLower)
        );
      });

      if (matches.length > 0) {
        // Prioritize profile that has a real customized username over auto-generated user_xxx
        found = matches.find(m => m.username && !m.username.startsWith('user_') && m.username !== 'seeker_user') || matches[0];
      }
    }

    if (found) {
      return sendJson(res, 200, { success: true, user: found });
    }
    return sendJson(res, 404, { success: false, error: 'User not found' });
  }

  // DELETE User Account & purge from database
  if (pathname.startsWith('/api/users/') && req.method === 'DELETE') {
    const rawId = decodeURIComponent(pathname.replace('/api/users/', '').trim());
    const idLower = rawId.toLowerCase();

    // Find user record to delete
    let target = usersDb[rawId] || usersDb[idLower];
    if (!target) {
      target = Object.values(usersDb).find(u => {
        if (!u) return false;
        const emails = extractUserEmails(u);
        return (
          (u.address && u.address.toLowerCase() === idLower) ||
          (u.publicKey && u.publicKey.toLowerCase() === idLower) ||
          (u.id && u.id.toLowerCase() === idLower) ||
          emails.includes(idLower) ||
          (u.username && u.username.toLowerCase() === idLower.replace(/^@/, ''))
        );
      });
    }

    if (target) {
      const keysToDelete = new Set();
      const targetAddress = (target.address || target.publicKey || '').toLowerCase();
      const targetUsername = (target.username || '').toLowerCase().replace(/^@+/, '');
      const targetEmails = extractUserEmails(target);

      for (const [k, u] of Object.entries(usersDb)) {
        if (!u) continue;
        const uAddr = (u.address || u.publicKey || '').toLowerCase();
        const uUser = (u.username || '').toLowerCase().replace(/^@+/, '');
        const uBlink = (u.blinkId || '').toLowerCase().replace(/^@+/, '');
        const uEmails = extractUserEmails(u);

        const matchesAddress = targetAddress && uAddr === targetAddress;
        const matchesUsername = targetUsername && (uUser === targetUsername || uBlink === targetUsername);
        const matchesEmail = targetEmails.length > 0 && uEmails.some(e => targetEmails.includes(e));

        if (u === target || matchesAddress || matchesUsername || matchesEmail || k.toLowerCase() === idLower) {
          keysToDelete.add(k);
        }
      }

      keysToDelete.forEach(k => delete usersDb[k]);
      saveUsersDb();
      return sendJson(res, 200, {
        success: true,
        message: `Account deleted successfully. Removed ${keysToDelete.size} records/aliases.`
      });
    }

    return sendJson(res, 404, { success: false, error: 'User not found' });
  }

  // Clock In Streak sync endpoint
  if (pathname === '/api/profile/streak' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { identifier, streakData } = payload;
        if (identifier && streakData) {
          const cleanKey = identifier.trim().toLowerCase().replace(/^@/, '');
          if (!usersDb[cleanKey]) {
            usersDb[cleanKey] = { username: cleanKey };
          }
          usersDb[cleanKey].streakData = streakData;
          saveUsersDb();
        }
        return sendJson(res, 200, { success: true, streakData });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: err.message });
      }
    });
    return;
  }

  if (pathname === '/api/users' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const key = (data.address || data.publicKey || data.id || data.email || '').trim();
        if (!key) {
          return sendJson(res, 400, { success: false, error: 'Missing user address or identifier' });
        }

        const existing = usersDb[key] || usersDb[key.toLowerCase()] || {};
        const safeAddress = data.address || data.publicKey || existing.address || key;
        const userEmail = (data.email || data.linkedAccounts?.email || data.linkedAccounts?.google || '').trim().toLowerCase();

        let desiredUsername = (data.username || existing.username || 'user').trim().replace(/^@+/, '');
        let autoAssigned = false;

        // Check if username is taken by another user
        const check = isUsernameTaken(desiredUsername, safeAddress, userEmail);
        if (check.taken && !check.isOwner) {
          if (data.autoAssignIfTaken || data.provider === 'google' || !existing.username) {
            // Auto-assign random unique username if derived from Google / OAuth / initial sync
            desiredUsername = generateUniqueUsername(desiredUsername, safeAddress, userEmail);
            autoAssigned = true;
          } else {
            return sendJson(res, 409, {
              success: false,
              error: check.reason || `Username @${desiredUsername} is already taken by another user.`,
              suggested: generateUniqueUsername(desiredUsername, safeAddress, userEmail),
            });
          }
        }

        const cleanUsername = desiredUsername.toLowerCase();
        const canonicalBlinkId = `@${cleanUsername}`;

        // Release old username & blinkId aliases if changed
        if (existing.username && existing.username.toLowerCase() !== cleanUsername) {
          delete usersDb[existing.username.toLowerCase()];
        }
        if (existing.blinkId && existing.blinkId.toLowerCase() !== canonicalBlinkId.toLowerCase()) {
          delete usersDb[existing.blinkId.toLowerCase()];
        }

        // Reassign & clean up any older record with this username if owned by this user
        for (const [k, u] of Object.entries(usersDb)) {
          if (!u) continue;
          const uHandle = (u.username || '').toLowerCase().replace(/^@+/, '');
          const uBlink = (u.blinkId || '').toLowerCase().replace(/^@+/, '');
          if (uHandle === cleanUsername || uBlink === cleanUsername) {
            const uAddr = (u.address || u.publicKey || '').toLowerCase();
            if (uAddr && uAddr !== safeAddress.toLowerCase()) {
              const uEmails = extractUserEmails(u);
              if (uAddr === cleanUsername || (userEmail && uEmails.includes(userEmail))) {
                delete usersDb[k];
              }
            }
          }
        }

        const mergedLinkedAccounts = {
          ...(existing.linkedAccounts || {}),
        };
        if (data.linkedAccounts && typeof data.linkedAccounts === 'object') {
          for (const [k, v] of Object.entries(data.linkedAccounts)) {
            if (v !== undefined) {
              mergedLinkedAccounts[k] = v;
            }
          }
        }

        const updated = {
          ...existing,
          ...data,
          address: safeAddress,
          publicKey: data.publicKey || safeAddress,
          displayName: data.displayName || existing.displayName || 'Seeker User',
          username: cleanUsername,
          blinkId: canonicalBlinkId,
          avatarUrl: data.avatarUrl || existing.avatarUrl || '',
          linkedAccounts: mergedLinkedAccounts,
          updatedAt: Date.now(),
        };

        usersDb[key] = updated;
        if (updated.address) usersDb[updated.address.toLowerCase()] = updated;
        if (updated.email) usersDb[updated.email.toLowerCase()] = updated;
        if (userEmail) usersDb[userEmail.toLowerCase()] = updated;
        usersDb[cleanUsername] = updated;
        usersDb[canonicalBlinkId.toLowerCase()] = updated;

        saveUsersDb();
        return sendJson(res, 200, { success: true, user: updated, usernameAutoAssigned: autoAssigned });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: 'Invalid payload' });
      }
    });
    return;
  }

  // ─── REAL-TIME SERVER-SENT EVENTS (SSE) SUBSCRIPTION ───────────────────
  if (pathname === '/api/events' && req.method === 'GET') {
    const address = (parsedUrl.query.address || '').toString().trim();
    const username = (parsedUrl.query.username || '').toString().trim().replace(/^@+/, '');

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });
    // Immediately write initial padding comment to force reverse proxy (Cloudflare) to flush the connection open
    res.write(': connected\n: ' + ' '.repeat(2048) + '\n\n');
    if (typeof res.flush === 'function') res.flush();

    const keys = [];
    if (address) {
      keys.push(address);
      keys.push(address.toLowerCase());
    }
    if (username) {
      keys.push(username);
      keys.push(username.toLowerCase());
      keys.push(`@${username.toLowerCase()}`);
    }
    keys.push('global');

    keys.forEach(k => addSseClient(k, res));

    // Keep-alive heartbeat every 8s (with padding) to keep mobile tunnels open and buffer-flushed
    const pingTimer = setInterval(() => {
      if (!res.writableEnded) {
        try {
          res.write(': ping\n: ' + ' '.repeat(2048) + '\n\n');
          if (typeof res.flush === 'function') res.flush();
        } catch (e) {
          clearInterval(pingTimer);
        }
      } else {
        clearInterval(pingTimer);
      }
    }, 8000);

    req.on('close', () => {
      clearInterval(pingTimer);
      keys.forEach(k => removeSseClient(k, res));
    });
    return;
  }

  // ─── CLOUD RECEIPTS API (Cross-Device Sender & Receiver Sync) ───────────
  if (pathname === '/api/receipts' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const rcpt = JSON.parse(body);
        if (!rcpt.signature) {
          return sendJson(res, 400, { success: false, error: 'Missing transaction signature' });
        }
        receiptsDb[rcpt.signature] = {
          ...rcpt,
          updatedAt: Date.now(),
        };
        saveReceiptsDb();

        // 1. Immediately invalidate signature caches for both parties so tx-history is instantly fresh
        if (rcpt.recipientAddress) {
          addressSigsCache.delete(rcpt.recipientAddress.toLowerCase().trim());
        }
        if (rcpt.payerAddress) {
          addressSigsCache.delete(rcpt.payerAddress.toLowerCase().trim());
        }

        // 2. Only broadcast real-time blink_sale SSE event when this is an actual Blink Sale
        //    (i.e. the receipt has a blinkId). Plain P2P transfers must NOT fire this event.
        if (rcpt.blinkId) {
          const targetKeys = [
            rcpt.recipientAddress,
            rcpt.payerAddress,
          ];
          const recipClean = (rcpt.recipientAddress || '').toLowerCase().trim().replace(/^@+/, '');
          if (recipClean) {
            targetKeys.push(recipClean);
            targetKeys.push(`@${recipClean}`);
          }

          const recipUser = Object.values(usersDb).find(u =>
            (u.address && u.address.toLowerCase() === (rcpt.recipientAddress || '').toLowerCase()) ||
            (u.publicKey && u.publicKey.toLowerCase() === (rcpt.recipientAddress || '').toLowerCase()) ||
            (u.username && u.username.toLowerCase().replace(/^@+/, '') === recipClean) ||
            (u.blinkId && u.blinkId.toLowerCase().replace(/^@+/, '') === recipClean)
          );
          if (recipUser) {
            if (recipUser.address) targetKeys.push(recipUser.address);
            if (recipUser.publicKey) targetKeys.push(recipUser.publicKey);
            if (recipUser.username) {
              targetKeys.push(recipUser.username);
              targetKeys.push(recipUser.username.replace(/^@+/, ''));
            }
            if (recipUser.blinkId) {
              targetKeys.push(recipUser.blinkId);
              targetKeys.push(recipUser.blinkId.replace(/^@+/, ''));
            }
          }

          broadcastSseEvent(targetKeys, 'blink_sale', {
            receipt: receiptsDb[rcpt.signature],
            timestamp: Date.now(),
          });
        }

        return sendJson(res, 200, { success: true, receipt: receiptsDb[rcpt.signature] });
      } catch (err) {
        return sendJson(res, 400, { success: false, error: 'Invalid JSON payload' });
      }
    });
    return;
  }

  if (pathname === '/api/receipts' && req.method === 'GET') {
    const query = parsedUrl.query || {};
    const signature = query.signature;
    const address = query.address;
    const since = parseInt(query.since, 10) || 0;

    if (signature) {
      const found = receiptsDb[signature];
      if (found) {
        return sendJson(res, 200, { success: true, receipt: found });
      }
      return sendJson(res, 404, { success: false, error: 'Receipt not found' });
    }

    if (query.blinkId) {
      const bClean = String(query.blinkId).toLowerCase().trim();
      const list = Object.values(receiptsDb).filter(r =>
        (r.blinkId && String(r.blinkId).toLowerCase().trim() === bClean) ||
        (r.id && String(r.id).toLowerCase().trim() === bClean)
      ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return sendJson(res, 200, { success: true, receipts: list });
    }

    if (address || query.username) {
      const rawParam = (address || query.username || '').toString().toLowerCase().trim();
      const cleanParam = rawParam.replace(/^@+/, '');
      const searchKeys = new Set([rawParam, cleanParam, `@${cleanParam}`]);

      const matchedUser = Object.values(usersDb).find(u =>
        (u.address && u.address.toLowerCase().trim() === cleanParam) ||
        (u.publicKey && u.publicKey.toLowerCase().trim() === cleanParam) ||
        (u.username && u.username.toLowerCase().trim().replace(/^@+/, '') === cleanParam) ||
        (u.blinkId && u.blinkId.toLowerCase().trim().replace(/^@+/, '') === cleanParam)
      );
      if (matchedUser) {
        if (matchedUser.address) searchKeys.add(matchedUser.address.toLowerCase().trim());
        if (matchedUser.publicKey) searchKeys.add(matchedUser.publicKey.toLowerCase().trim());
        if (matchedUser.username) {
          const uClean = matchedUser.username.toLowerCase().trim().replace(/^@+/, '');
          searchKeys.add(uClean);
          searchKeys.add(`@${uClean}`);
        }
        if (matchedUser.blinkId) {
          const bClean = matchedUser.blinkId.toLowerCase().trim().replace(/^@+/, '');
          searchKeys.add(bClean);
          searchKeys.add(`@${bClean}`);
        }
      }

      const list = Object.values(receiptsDb).filter(r => {
        const pClean = (r.payerAddress || '').toLowerCase().trim();
        const pCleanNoAt = pClean.replace(/^@+/, '');
        const rClean = (r.recipientAddress || '').toLowerCase().trim();
        const rCleanNoAt = rClean.replace(/^@+/, '');

        const matchesAddr = searchKeys.has(pClean) || searchKeys.has(pCleanNoAt) ||
                            searchKeys.has(rClean) || searchKeys.has(rCleanNoAt);
        if (!matchesAddr) return false;
        if (since > 0 && (r.timestamp || r.updatedAt || 0) <= since) return false;
        return true;
      }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return sendJson(res, 200, { success: true, receipts: list });
    }

    return sendJson(res, 200, { success: true, receipts: Object.values(receiptsDb) });
  }

  // ─── WALLET BALANCE BACKEND PROXY (SOL + USDC) ───────────────────────────
  if (pathname === '/api/balance' && req.method === 'GET') {
    const rawAddress = (parsedUrl.query.address || '').toString().trim();
    if (!rawAddress) {
      return sendJson(res, 400, { success: false, error: 'Missing address parameter' });
    }

    let resolvedAddress = rawAddress;
    if (rawAddress.startsWith('@') || !rawAddress.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
      const clean = rawAddress.toLowerCase().replace(/^@+/, '');
      const user = Object.values(usersDb).find(u => {
        const uName = (u.username || '').toLowerCase().replace(/^@+/, '');
        const uBlinkId = (u.blinkId || '').toLowerCase().replace(/^@+/, '');
        const uAddr = (u.address || u.publicKey || '').toLowerCase();
        return uName === clean || uBlinkId === clean || uAddr === clean;
      });
      if (user && (user.address || user.publicKey)) {
        resolvedAddress = user.address || user.publicKey;
      }
    }

    const cacheKey = resolvedAddress.toLowerCase();
    const now = Date.now();
    const cachedBal = addressBalanceCache.get(cacheKey);
    if (cachedBal && (now - cachedBal.time < 5000)) {
      return sendJson(res, 200, { success: true, ...cachedBal.data });
    }

    (async () => {
      try {
        let pubkey = null;
        try {
          pubkey = new PublicKey(resolvedAddress);
        } catch {}

        if (!pubkey) {
          return sendJson(res, 400, { success: false, error: 'Invalid public key' });
        }

        const devnetConn = new Connection('https://api.devnet.solana.com', {
          commitment: 'confirmed',
          disableRetryOnRateLimit: true,
        });

        const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
        const FAUCET_MINT = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
        const SKR_MINT = new PublicKey('SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3');

        const mainnetConn = new Connection('https://api.mainnet-beta.solana.com', {
          commitment: 'confirmed',
          disableRetryOnRateLimit: true,
        });

        const [solLamports, circleRes, faucetRes, skrMainnetRes, skrDevnetRes] = await Promise.allSettled([
          devnetConn.getBalance(pubkey),
          devnetConn.getParsedTokenAccountsByOwner(pubkey, { mint: USDC_MINT }),
          devnetConn.getParsedTokenAccountsByOwner(pubkey, { mint: FAUCET_MINT }),
          mainnetConn.getParsedTokenAccountsByOwner(pubkey, { mint: SKR_MINT }),
          devnetConn.getParsedTokenAccountsByOwner(pubkey, { mint: SKR_MINT }),
        ]);

        let sol = cachedBal?.data?.sol ?? 0;
        if (solLamports.status === 'fulfilled' && typeof solLamports.value === 'number') {
          sol = Number((solLamports.value / LAMPORTS_PER_SOL).toFixed(4));
        }

        let usdc = cachedBal?.data?.usdc ?? 0;
        let totalUsdc = 0;
        let usdcFound = false;

        if (circleRes.status === 'fulfilled' && circleRes.value?.value?.length > 0) {
          usdcFound = true;
          circleRes.value.value.forEach(a => {
            const amt = a.account.data?.parsed?.info?.tokenAmount?.uiAmount;
            if (typeof amt === 'number') totalUsdc += amt;
          });
        }

        if (faucetRes.status === 'fulfilled' && faucetRes.value?.value?.length > 0) {
          usdcFound = true;
          faucetRes.value.value.forEach(a => {
            const amt = a.account.data?.parsed?.info?.tokenAmount?.uiAmount;
            if (typeof amt === 'number') totalUsdc += amt;
          });
        }

        if (usdcFound) {
          usdc = Number(totalUsdc.toFixed(2));
        }

        let skr = cachedBal?.data?.skr ?? 0;
        let totalSkr = 0;
        let skrFound = false;

        if (skrMainnetRes.status === 'fulfilled' && skrMainnetRes.value?.value?.length > 0) {
          skrFound = true;
          skrMainnetRes.value.value.forEach(a => {
            const amt = a.account.data?.parsed?.info?.tokenAmount?.uiAmount;
            if (typeof amt === 'number') totalSkr += amt;
          });
        }

        if (!skrFound && skrDevnetRes.status === 'fulfilled' && skrDevnetRes.value?.value?.length > 0) {
          skrFound = true;
          skrDevnetRes.value.value.forEach(a => {
            const amt = a.account.data?.parsed?.info?.tokenAmount?.uiAmount;
            if (typeof amt === 'number') totalSkr += amt;
          });
        }

        if (skrFound) {
          skr = Number(totalSkr.toFixed(2));
        }

        const data = { address: resolvedAddress, sol, usdc, skr };
        addressBalanceCache.set(cacheKey, { data, time: now });
        return sendJson(res, 200, { success: true, ...data });
      } catch (err) {
        if (cachedBal) {
          return sendJson(res, 200, { success: true, ...cachedBal.data });
        }
        return sendJson(res, 500, { success: false, error: err?.message || String(err) });
      }
    })();
    return;
  }

  // ─── TRANSACTION HISTORY BACKEND PROXY (Devnet RPC + Cloud Receipts) ───────
  if (pathname === '/api/tx-history' && req.method === 'GET') {
    const rawAddress = (parsedUrl.query.address || '').toString().trim();
    const limit = Math.min(100, Math.max(1, parseInt(parsedUrl.query.limit, 10) || 50));

    if (!rawAddress) {
      return sendJson(res, 400, { success: false, error: 'Missing address parameter' });
    }

    // Resolve Blink ID or username if provided instead of raw base58 pubkey
    let resolvedAddress = rawAddress;
    if (rawAddress.startsWith('@') || !rawAddress.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
      const clean = rawAddress.toLowerCase().replace(/^@+/, '');
      const user = Object.values(usersDb).find(u => {
        const uName = (u.username || '').toLowerCase().replace(/^@+/, '');
        const uBlinkId = (u.blinkId || '').toLowerCase().replace(/^@+/, '');
        const uAddr = (u.address || u.publicKey || '').toLowerCase();
        return uName === clean || uBlinkId === clean || uAddr === clean;
      });
      if (user && (user.address || user.publicKey)) {
        resolvedAddress = user.address || user.publicKey;
      }
    }

    (async () => {
      try {
        const userAddrLower = resolvedAddress.toLowerCase();
        let sigInfos = [];
        const parsedMap = new Map();

        try {
          const cachedEntry = addressSigsCache.get(userAddrLower);
          const now = Date.now();
          if (cachedEntry && (now - cachedEntry.time < 2500) && cachedEntry.sigs && cachedEntry.sigs.length > 0) {
            sigInfos = cachedEntry.sigs;
          } else {
            let pubkey = null;
            try {
              pubkey = new PublicKey(resolvedAddress);
            } catch (pkErr) {
              // Not a valid base58 pubkey
            }
            if (pubkey) {
              try {
                const devnetConn = new Connection('https://api.devnet.solana.com', {
                  commitment: 'confirmed',
                  disableRetryOnRateLimit: true,
                });
                const freshSigs = await devnetConn.getSignaturesForAddress(pubkey, { limit });
                if (freshSigs && freshSigs.length >= 0) {
                  sigInfos = freshSigs;
                  addressSigsCache.set(userAddrLower, { sigs: freshSigs, time: now });
                }
              } catch (connErr) {
                // If throttled (429), reuse last known cached signatures without wiping out
                if (cachedEntry && cachedEntry.sigs) {
                  sigInfos = cachedEntry.sigs;
                }
              }
            }
          }

          if (sigInfos && sigInfos.length > 0) {
            // Only parse transactions that are NOT in receiptsDb and NOT in parsedTxCache
            const neededSigs = sigInfos
              .map(s => s.signature)
              .filter(sig => !receiptsDb[sig] && !parsedTxCache.has(sig))
              .slice(0, 5);

            sigInfos.forEach(s => {
              if (parsedTxCache.has(s.signature)) {
                parsedMap.set(s.signature, parsedTxCache.get(s.signature));
              }
            });

            if (neededSigs.length > 0) {
              try {
                const devnetConn = new Connection('https://api.devnet.solana.com', {
                  commitment: 'confirmed',
                  disableRetryOnRateLimit: true,
                });
                const parsedBatch = await devnetConn.getParsedTransactions(neededSigs, {
                  maxSupportedTransactionVersion: 0,
                  commitment: 'confirmed',
                });
                neededSigs.forEach((sig, idx) => {
                  if (parsedBatch && parsedBatch[idx]) {
                    parsedMap.set(sig, parsedBatch[idx]);
                    parsedTxCache.set(sig, parsedBatch[idx]);
                  }
                });
              } catch (pErr) {
                // Throttled, proceed gracefully with existing cached items
              }
            }
          }
        } catch (rpcErr) {
          // Fallback gracefully
        }

        const existingSigSet = new Set((sigInfos || []).map(s => s.signature));

        const onChainList = (sigInfos || []).map(s => {
          const rcpt = receiptsDb[s.signature];
          let direction = 'unknown';
          let amountSol = null;
          let amountUsdc = null;
          let token = 'SOL';
          let counterparty = null;

          if (rcpt && rcpt.amount > 0) {
            if (rcpt.token === 'USDC') {
              amountUsdc = rcpt.amount;
              token = 'USDC';
            } else {
              amountSol = rcpt.amount;
              token = 'SOL';
            }
            if (rcpt.payerAddress && rcpt.payerAddress.toLowerCase() === userAddrLower) {
              direction = 'send';
              counterparty = rcpt.recipientAddress;
            } else if (rcpt.recipientAddress && rcpt.recipientAddress.toLowerCase() === userAddrLower) {
              direction = 'receive';
              counterparty = rcpt.payerAddress;
            }
          }

          const parsed = parsedMap.get(s.signature);
          if (parsed && parsed.meta && direction === 'unknown') {
            const keys = (parsed.transaction?.message?.accountKeys || []).map(k =>
              typeof k === 'string' ? k : k.pubkey?.toString() || k.toString()
            );
            const uIdx = keys.findIndex(k => k && k.toLowerCase() === userAddrLower);
            if (uIdx !== -1) {
              const preSol = (parsed.meta.preBalances?.[uIdx] || 0) / LAMPORTS_PER_SOL;
              const postSol = (parsed.meta.postBalances?.[uIdx] || 0) / LAMPORTS_PER_SOL;
              const diff = postSol - preSol;
              if (diff < -0.00001) {
                direction = 'send';
                amountSol = Number(Math.abs(diff).toFixed(6));
              } else if (diff > 0.00001) {
                direction = 'receive';
                amountSol = Number(diff.toFixed(6));
              }
              const feePayer = keys[0] || null;
              if (!counterparty) {
                counterparty = direction === 'send' ? (keys.find((_, i) => i !== uIdx && i !== 0) || keys[1] || null) : feePayer;
              }
            }
          }

          return {
            signature: s.signature,
            slot: s.slot || 0,
            err: s.err ? true : null,
            memo: rcpt?.blinkTitle || s.memo || null,
            blockTime: s.blockTime || (rcpt ? Math.floor(rcpt.timestamp / 1000) : 0),
            direction,
            amountSol,
            amountUsdc,
            token,
            counterparty,
          };
        });

        // Add any cloud receipts for this address that weren't caught in the top signatures
        const receiptsForUser = Object.values(receiptsDb).filter(r =>
          r.signature &&
          !existingSigSet.has(r.signature) &&
          ((r.payerAddress && r.payerAddress.toLowerCase() === userAddrLower) ||
           (r.recipientAddress && r.recipientAddress.toLowerCase() === userAddrLower))
        ).map(r => {
          const isSend = Boolean(r.payerAddress && r.payerAddress.toLowerCase() === userAddrLower);
          return {
            signature: r.signature,
            slot: 0,
            err: r.status === 'failed' ? true : null,
            memo: r.blinkTitle || null,
            blockTime: Math.floor((r.timestamp || Date.now()) / 1000),
            direction: isSend ? 'send' : 'receive',
            amountSol: r.token === 'SOL' ? r.amount : null,
            amountUsdc: r.token === 'USDC' ? r.amount : null,
            token: r.token || 'SOL',
            counterparty: isSend ? r.recipientAddress : r.payerAddress,
          };
        });

        const combined = [...receiptsForUser, ...onChainList].sort(
          (a, b) => (b.blockTime || 0) - (a.blockTime || 0)
        );

        return sendJson(res, 200, {
          success: true,
          count: combined.length,
          transactions: combined,
        });
      } catch (fatalErr) {
        console.error('Fatal error in /api/tx-history:', fatalErr);
        return sendJson(res, 500, { success: false, error: fatalErr.message });
      }
    })();
    return;
  }

  // ─── SOLANA JSON-RPC PROXY ────────────────────────────────────────────────
  if (pathname === '/api/solana-rpc' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const rpcReq = https.request('https://api.devnet.solana.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (rpcRes) => {
        res.writeHead(rpcRes.statusCode || 200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        rpcRes.pipe(res);
      });

      rpcReq.on('error', (err) => {
        console.warn('Solana RPC proxy error:', err);
        return sendJson(res, 502, { jsonrpc: '2.0', error: { code: -32603, message: 'RPC gateway error: ' + err.message } });
      });

      rpcReq.write(body);
      rpcReq.end();
    });
    return;
  }

  // ─── ANDROID APP LINKS ASSETLINKS ─────────────────────────────────────────
  if (pathname === '/.well-known/assetlinks.json') {
    const assetlinks = [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.blink.solanamobile",
          sha256_cert_fingerprints: [
            "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C"
          ]
        }
      }
    ];
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'max-age=86400',
    });
    return res.end(JSON.stringify(assetlinks, null, 2));
  }

  // ─── STATIC ASSET SERVING (dist/) ─────────────────────────────────────────
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath);

  // Direct check for root assets/avatars/ (e.g. /assets/avatars/mascot_cyan.png)
  if (pathname.startsWith('/assets/avatars/')) {
    const avatarFilename = path.basename(pathname);
    const rootAvatarPath = path.join(__dirname, 'assets', 'avatars', avatarFilename);
    if (fs.existsSync(rootAvatarPath)) {
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000',
      });
      return fs.createReadStream(rootAvatarPath).pipe(res);
    }
  }

  fs.stat(filePath, (err, stats) => {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const canGzip = acceptEncoding.includes('gzip');

    if (!err && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const compressible = ['.js', '.html', '.css', '.json', '.svg'].includes(ext);

      const headers = {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': ['.html', '.js', '.json'].includes(ext) ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600',
      };

      if (canGzip && compressible) {
        headers['Content-Encoding'] = 'gzip';
        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(zlib.createGzip()).pipe(res);
      } else {
        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(res);
      }
      return;
    }

    // SPA Fallback: serve index.html for client-side routing (e.g. /t/<id>)
    const indexPath = path.join(DIST_DIR, 'index.html');
    fs.readFile(indexPath, (err2, content) => {
      if (err2) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
      const headers = {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      };
      if (canGzip) {
        headers['Content-Encoding'] = 'gzip';
        res.writeHead(200, headers);
        res.end(zlib.gzipSync(content));
      } else {
        res.writeHead(200, headers);
        res.end(content);
      }
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Blink Server] Running on http://localhost:${PORT}`);
  console.log(`[Blink Server] Serving static files from: ${DIST_DIR}`);
  console.log(`[Blink Server] Cloud Sync REST API ready.`);
});
