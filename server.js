const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const zlib = require('zlib');

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

// Seed global public blinks (Creator Tips, NFT Mints, Donations, Vouchers)
const DEFAULT_GLOBAL_BLINKS = [
  {
    id: 'tip-solana-dev',
    name: 'Solana Mobile Dev Tip Jar',
    actionType: 'tip',
    amount: 0.05,
    token: 'SOL',
    recipient: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    description: 'Support open-source builders creating physical Blinks on Solana Seeker.',
    verifiedDomain: 'blink.so',
    visibility: 'global',
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now(),
    stats: { taps: 142, completed: 89, volumeUsdc: 44.5 },
  },
  {
    id: 'mint-seeker-pioneer',
    name: 'Seeker Pioneer Commemorative POAP',
    actionType: 'mint',
    amount: 0.01,
    token: 'SOL',
    recipient: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    description: 'Mint your exclusive on-chain proof of physical Solana tap interaction.',
    verifiedDomain: 'seeker.solana.com',
    visibility: 'global',
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now(),
    stats: { taps: 310, completed: 278, volumeUsdc: 27.8 },
  },
  {
    id: 'charity-clean-oceans',
    name: 'Clean Oceans Solana Fund',
    actionType: 'donation',
    amount: 0.1,
    token: 'SOL',
    recipient: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    description: 'Global micro-donations cleaning ocean plastics tracked transparently on Solana.',
    verifiedDomain: 'oceans.foundation',
    visibility: 'global',
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now(),
    stats: { taps: 84, completed: 62, volumeUsdc: 62.0 },
  },
  {
    id: 'voucher-hacker-house',
    name: 'Hacker House Day Pass Voucher',
    actionType: 'voucher',
    amount: 10.0,
    token: 'USDC',
    recipient: '3BxsJ47p1wH4h2B6r9d5J8qW8kF2P3tL5j8Z9xY1W2A3',
    description: 'Digital pre-order voucher for day co-working at Solana Hacker House events.',
    verifiedDomain: 'hackerhouse.solana.com',
    visibility: 'global',
    createdAt: Date.now() - 86400000 * 1,
    updatedAt: Date.now(),
    stats: { taps: 55, completed: 41, volumeUsdc: 410.0 },
  },
];

// In-memory cache + file persistence
let blinksDb = [];
let usersDb = {};

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      blinksDb = JSON.parse(data);
    } else {
      blinksDb = [...DEFAULT_GLOBAL_BLINKS];
      saveDb();
    }
  } catch (err) {
    console.error('Error loading DB:', err);
    blinksDb = [...DEFAULT_GLOBAL_BLINKS];
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

loadDb();
loadUsersDb();
loadReceiptsDb();

// Helper to send JSON responses
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
    });
    res.end();
    return;
  }

  // ─── API ROUTES ───────────────────────────────────────────────────────────
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
    return sendJson(res, 200, { success: true, count: result.length, blinks: result });
  }

  if (pathname.startsWith('/api/blinks/') && req.method === 'GET') {
    const blinkId = pathname.replace('/api/blinks/', '').trim().toLowerCase();
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

        const newBlink = {
          id: cleanId,
          name: String(data.name).trim(),
          actionType: data.actionType || 'payment',
          amount: Number(data.amount) || 0.01,
          token: data.token || 'SOL',
          recipient: String(data.recipient).trim(),
          creatorAddress: data.creatorAddress ? String(data.creatorAddress).trim() : String(data.recipient).trim(),
          description: String(data.description || '').trim(),
          verifiedDomain: data.verifiedDomain ? String(data.verifiedDomain).trim() : undefined,
          visibility,
          createdAt: data.createdAt || Date.now(),
          updatedAt: Date.now(),
          stats: data.stats || { taps: 0, completed: 0, volumeUsdc: 0 },
        };

        const existingIdx = blinksDb.findIndex(b => b.id === cleanId);
        if (existingIdx >= 0) {
          const existing = blinksDb[existingIdx];
          const incomingRequester = (data.creatorAddress || data.recipient || '').trim();
          const existingCreator = (existing.creatorAddress || existing.recipient || '').trim();
          if (existingCreator && incomingRequester && existingCreator !== incomingRequester) {
            return sendJson(res, 403, { success: false, error: 'Unauthorized: Only the creator can edit this Blink' });
          }
          blinksDb[existingIdx] = { ...blinksDb[existingIdx], ...newBlink, updatedAt: Date.now() };
        } else {
          blinksDb.unshift(newBlink);
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
          const incomingRequester = (data.creatorAddress || data.requesterAddress || data.recipient || '').trim();
          const existingCreator = (existing.creatorAddress || existing.recipient || '').trim();

          if (existingCreator && incomingRequester && existingCreator.toLowerCase() !== incomingRequester.toLowerCase()) {
            return sendJson(res, 403, { success: false, error: 'Unauthorized: Only the creator can delete this Blink' });
          }

          blinksDb.splice(existingIdx, 1);
          saveDb();
          console.log(`[TapBlink Server] Deleted Blink "${blinkId}" from cloud database.`);
          return sendJson(res, 200, { success: true, deletedId: blinkId });
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

  // ─── USERNAME UNIQUENESS & AVAILABILITY ENGINE ─────────────────────────
  function isUsernameTaken(rawUsername, requestingAddress) {
    const clean = (rawUsername || '').trim().toLowerCase().replace(/^@+/, '');
    if (!clean) return { taken: true, reason: 'Username cannot be empty.' };

    if (clean.length < 2) {
      return { taken: true, reason: 'Username must be at least 2 characters.' };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      return { taken: true, reason: 'Username may only contain letters, numbers, and underscores.' };
    }

    const reserved = ['admin', 'root', 'system', 'blink', 'blink', 'seeker', 'solana', 'official', 'support', 'help', 'api'];
    if (reserved.includes(clean)) {
      return { taken: true, reason: `@${clean} is a reserved system handle.` };
    }

    // Check physical blinks registry
    const physical = blinksDb.find(b => b.id.toLowerCase() === clean);
    if (physical) {
      return { taken: true, reason: `@${clean} matches an existing physical Blink Action.` };
    }

    const reqAddrClean = (requestingAddress || '').trim().toLowerCase();

    // Check users database
    for (const user of Object.values(usersDb)) {
      if (!user) continue;
      const uName = (user.username || '').trim().toLowerCase().replace(/^@+/, '');
      const uBlinkId = (user.blinkId || '').trim().toLowerCase().replace(/^@+/, '');

      if (uName === clean || uBlinkId === clean) {
        const uAddr = (user.address || user.publicKey || user.id || '').trim().toLowerCase();
        const uEmail = (user.email || '').trim().toLowerCase();

        // If the requesting user already owns this handle, it is not taken against them
        if (reqAddrClean && (uAddr === reqAddrClean || uEmail === reqAddrClean)) {
          return { taken: false, isOwner: true };
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

  function generateUniqueUsername(baseSeed) {
    const seedClean = (baseSeed || 'user').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 15);
    const base = seedClean.length >= 2 ? seedClean : 'user';

    if (!isUsernameTaken(base).taken) {
      return base;
    }

    // Try suffixes _100 - _999
    for (let i = 0; i < 30; i++) {
      const candidate = `${base}_${Math.floor(100 + Math.random() * 900)}`;
      if (!isUsernameTaken(candidate).taken) {
        return candidate;
      }
    }

    // Suffix with short random hex
    for (let i = 0; i < 20; i++) {
      const candidate = `${base}_${Math.random().toString(36).substring(2, 6)}`;
      if (!isUsernameTaken(candidate).taken) {
        return candidate;
      }
    }

    return `user_${Math.random().toString(36).substring(2, 8)}`;
  }

  // ─── USERNAME CHECK REST API ───────────────────────────────────────────
  if (pathname === '/api/users/check-username' && req.method === 'GET') {
    const queryUsername = (parsedUrl.query.username || '').toString();
    const queryAddress = (parsedUrl.query.address || '').toString();

    const clean = queryUsername.trim().toLowerCase().replace(/^@+/, '');
    const check = isUsernameTaken(clean, queryAddress);

    return sendJson(res, 200, {
      success: true,
      username: clean,
      available: !check.taken,
      reason: check.reason || null,
      isOwner: Boolean(check.isOwner),
      suggested: check.taken ? generateUniqueUsername(clean) : clean,
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

        const canonicalId = rawBlinkId.startsWith('@') ? rawBlinkId : `@${rawBlinkId}`;
        const cleanHandle = canonicalId.toLowerCase().replace(/^@+/, '');

        // Verify that this Blink ID is not already taken by another address
        const check = isUsernameTaken(cleanHandle, address);
        if (check.taken && !check.isOwner) {
          return sendJson(res, 409, {
            success: false,
            error: check.reason || `Blink ID @${cleanHandle} is already registered by another user.`,
            suggested: generateUniqueUsername(cleanHandle),
          });
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
      found = Object.values(usersDb).find(u =>
        (u.address && u.address.toLowerCase() === idLower) ||
        (u.publicKey && u.publicKey.toLowerCase() === idLower) ||
        (u.email && u.email.toLowerCase() === idLower) ||
        (u.id && u.id.toLowerCase() === idLower) ||
        (u.username && u.username.toLowerCase() === idLower.replace(/^@/, '')) ||
        (u.blinkId && u.blinkId.toLowerCase() === idLower)
      );
    }

    if (found) {
      return sendJson(res, 200, { success: true, user: found });
    }
    return sendJson(res, 404, { success: false, error: 'User not found' });
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

        let desiredUsername = (data.username || existing.username || 'user').trim().replace(/^@+/, '');
        let autoAssigned = false;

        // Check if username is taken by another user
        const check = isUsernameTaken(desiredUsername, safeAddress);
        if (check.taken && !check.isOwner) {
          if (data.autoAssignIfTaken || data.provider === 'google' || !existing.username) {
            // Auto-assign random unique username if derived from Google / OAuth / initial sync
            desiredUsername = generateUniqueUsername(desiredUsername);
            autoAssigned = true;
          } else {
            return sendJson(res, 409, {
              success: false,
              error: check.reason || `Username @${desiredUsername} is already taken by another user.`,
              suggested: generateUniqueUsername(desiredUsername),
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

        const updated = {
          ...existing,
          ...data,
          address: safeAddress,
          publicKey: data.publicKey || safeAddress,
          displayName: data.displayName || existing.displayName || 'Seeker User',
          username: cleanUsername,
          blinkId: canonicalBlinkId,
          avatarUrl: data.avatarUrl || existing.avatarUrl || '',
          updatedAt: Date.now(),
        };

        usersDb[key] = updated;
        if (updated.address) usersDb[updated.address.toLowerCase()] = updated;
        if (updated.email) usersDb[updated.email.toLowerCase()] = updated;
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

    if (signature) {
      const found = receiptsDb[signature];
      if (found) {
        return sendJson(res, 200, { success: true, receipt: found });
      }
      return sendJson(res, 404, { success: false, error: 'Receipt not found' });
    }

    if (query.blinkId) {
      const bClean = String(query.blinkId).toLowerCase();
      const list = Object.values(receiptsDb).filter(r =>
        (r.blinkId && String(r.blinkId).toLowerCase() === bClean) ||
        (r.id && String(r.id).toLowerCase() === bClean) ||
        (r.id && String(r.id).toLowerCase().includes(bClean))
      ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return sendJson(res, 200, { success: true, receipts: list });
    }

    if (address) {
      const addrClean = address.toLowerCase();
      const list = Object.values(receiptsDb).filter(r =>
        (r.payerAddress && r.payerAddress.toLowerCase() === addrClean) ||
        (r.recipientAddress && r.recipientAddress.toLowerCase() === addrClean)
      ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return sendJson(res, 200, { success: true, receipts: list });
    }

    return sendJson(res, 200, { success: true, receipts: Object.values(receiptsDb) });
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
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
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
