/**
 * BLINK — Landing Page Interactive Engine
 * Controls the live Seeker Phone Simulator, FAQ accordion, token price updates, and micro-interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
  initPhoneSimulator();
  initFaqAccordion();
  initLivePrices();
  initSmoothScroll();
});

/**
 * Interactive Solana Seeker Phone Simulator
 */
function initPhoneSimulator() {
  const radarTarget = document.getElementById('sim-radar-target');
  const simStage = document.getElementById('sim-stage-content');
  const modeBtns = document.querySelectorAll('.sim-mode-btn');

  let currentMode = 'nfc';
  let selectedToken = 'SKR'; // Default token

  // Sample Blink Profiles for Interactive Demo
  const sampleBlinks = {
    coffee: {
      name: "Seeker Cafe & Roastery",
      id: "seeker-coffee-01",
      baseUsdc: 4.50,
      skrPrice: 90.00, // with 10% discount = 81 SKR
      solPrice: 0.025,
      recipient: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      category: "Food & Beverage",
      icon: "☕"
    },
    event: {
      name: "Solana Breakpoint VIP Pass",
      id: "breakpoint-2026-vip",
      baseUsdc: 25.00,
      skrPrice: 500.00,
      solPrice: 0.14,
      recipient: "G7jrT6yzAoXP3bCXspD37WhA27KwtcHTomCMLDnFJ42Z",
      category: "Event Ticket",
      icon: "🎟️"
    }
  };

  let activeBlink = sampleBlinks.coffee;

  // Mode switcher (NFC vs QR vs Studio)
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      renderSimulatorStage();
    });
  });

  function renderSimulatorStage() {
    if (!simStage) return;

    if (currentMode === 'nfc') {
      simStage.innerHTML = `
        <div class="nfc-radar-zone">
          <div class="nfc-target-ring" id="sim-radar-target" title="Click to Simulate NFC Tap">
            <span class="nfc-icon-inner">📡</span>
          </div>
          <div class="nfc-radar-title">Ready to Tap</div>
          <div class="nfc-radar-sub">Click the target to simulate holding your Seeker against a physical NFC tag</div>
        </div>
      `;
      // Reattach listener
      const newTarget = document.getElementById('sim-radar-target');
      if (newTarget) {
        newTarget.addEventListener('click', handleNfcTap);
      }
    } else if (currentMode === 'qr') {
      simStage.innerHTML = `
        <div class="nfc-radar-zone" style="background: rgba(10, 14, 23, 0.9);">
          <div style="width: 140px; height: 140px; border: 2px solid var(--solana-purple); border-radius: 16px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #000; margin-bottom: 12px;">
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--solana-green); box-shadow: 0 0 10px var(--solana-green); animation: scanLine 2s infinite linear;"></div>
            <span style="font-size: 3rem;">📷</span>
          </div>
          <div class="nfc-radar-title">Live QR Scanner</div>
          <div class="nfc-radar-sub">Pointing camera at counter display...</div>
          <button class="btn btn-primary btn-sm" id="sim-scan-now-btn" style="margin-top: 12px;">Simulate Instant Scan</button>
        </div>
      `;
      const scanBtn = document.getElementById('sim-scan-now-btn');
      if (scanBtn) {
        scanBtn.addEventListener('click', handleScanSuccess);
      }
    } else if (currentMode === 'studio') {
      simStage.innerHTML = `
        <div class="sim-blink-card" style="padding: 16px;">
          <div style="font-size: 0.82rem; font-weight: 700; color: var(--solana-purple); text-transform: uppercase;">Blink Studio Preview</div>
          <input type="text" id="sim-studio-name" value="Artisan Espresso" style="background: var(--bg-input); border: 1px solid var(--border-subtle); color: #fff; padding: 8px 12px; border-radius: 8px; font-size: 0.85rem; width: 100%;" placeholder="Blink Title" />
          <div style="display: flex; gap: 8px;">
            <input type="number" id="sim-studio-amount" value="3.50" style="flex: 1; background: var(--bg-input); border: 1px solid var(--border-subtle); color: #fff; padding: 8px 12px; border-radius: 8px; font-size: 0.85rem;" placeholder="Amount" />
            <select id="sim-studio-token" style="background: var(--bg-input); border: 1px solid var(--border-subtle); color: #fff; padding: 8px 12px; border-radius: 8px; font-size: 0.85rem;">
              <option value="SKR">$SKR</option>
              <option value="USDC">USDC</option>
              <option value="SOL">SOL</option>
            </select>
          </div>
          <button class="btn btn-primary btn-sm" id="sim-generate-btn" style="width: 100%; margin-top: 6px;">Program NFC Tag</button>
        </div>
      `;
      const genBtn = document.getElementById('sim-generate-btn');
      if (genBtn) {
        genBtn.addEventListener('click', () => {
          alert('Blink programmed! In the mobile app, tap "Write to NFC Tag" to write NDEF records directly to physical stickers.');
        });
      }
    }
  }

  function handleNfcTap() {
    const target = document.getElementById('sim-radar-target');
    if (target) {
      target.classList.add('tapping');
    }

    setTimeout(() => {
      showActionConfirmation();
    }, 400);
  }

  function handleScanSuccess() {
    showActionConfirmation();
  }

  function showActionConfirmation() {
    const effectiveSkr = (activeBlink.skrPrice * 0.9).toFixed(2);
    
    simStage.innerHTML = `
      <div class="sim-blink-card" id="sim-action-card">
        <div class="sim-blink-header">
          <div class="sim-merchant-logo">${activeBlink.icon}</div>
          <div class="sim-merchant-info">
            <div class="sim-blink-title">${activeBlink.name}</div>
            <div class="sim-verified-tag">
              <span>✓</span> Verified Solana Blink
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 6px; margin: 4px 0;">
          <button class="token-toggle-pill ${selectedToken === 'SKR' ? 'active' : ''}" data-token="SKR">SKR (-10%)</button>
          <button class="token-toggle-pill ${selectedToken === 'USDC' ? 'active' : ''}" data-token="USDC">USDC</button>
          <button class="token-toggle-pill ${selectedToken === 'SOL' ? 'active' : ''}" data-token="SOL">SOL</button>
        </div>

        <div class="sim-amount-banner">
          <div>
            <div style="font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase;">Amount Due</div>
            <div class="sim-amount-val" id="sim-display-amount">
              ${selectedToken === 'SKR' ? `${effectiveSkr} SKR` : (selectedToken === 'USDC' ? `$${activeBlink.baseUsdc.toFixed(2)} USDC` : `${activeBlink.solPrice} SOL`)}
            </div>
          </div>
          ${selectedToken === 'SKR' ? `<span class="sim-skr-badge">10% OFF</span>` : ''}
        </div>

        <button class="sim-action-btn" id="sim-confirm-pay-btn">
          <span>⚡</span> Confirm & Settle (~400ms)
        </button>
      </div>
    `;

    // Token toggle listeners
    const pills = simStage.querySelectorAll('.token-toggle-pill');
    pills.forEach(p => {
      p.addEventListener('click', (e) => {
        selectedToken = e.target.dataset.token;
        showActionConfirmation();
      });
    });

    const confirmBtn = document.getElementById('sim-confirm-pay-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', executeSimulatedSettlement);
    }
  }

  function executeSimulatedSettlement() {
    simStage.innerHTML = `
      <div class="sim-receipt-overlay" style="min-height: 220px; justify-content: center;">
        <div style="width: 38px; height: 38px; border: 3px solid rgba(20,241,149,0.2); border-top-color: var(--solana-green); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 8px;"></div>
        <div style="font-size: 0.92rem; font-weight: 700; color: #fff;">Sub-Second Settlement</div>
        <div style="font-size: 0.74rem; color: var(--text-muted);">Broadcasting via Solana Mainnet...</div>
      </div>
    `;

    // 400ms simulate sub-second finality
    setTimeout(() => {
      const mockSig = '5Kj' + Math.random().toString(36).substring(2, 8) + '...' + Math.random().toString(36).substring(2, 6);
      simStage.innerHTML = `
        <div class="sim-receipt-overlay">
          <div class="sim-check-icon">✓</div>
          <div class="sim-receipt-title">Settlement Confirmed!</div>
          <div class="sim-receipt-detail">Payment sent to <strong>${activeBlink.name}</strong></div>
          <div class="sim-receipt-sig">TX: ${mockSig}</div>
          <div style="font-size: 0.72rem; color: var(--solana-green); font-weight: 700;">Finality: 382ms • Fee: < 0.0001 SOL</div>
          <button class="btn btn-secondary btn-sm" id="sim-reset-btn" style="margin-top: 8px; width: 100%;">Tap Another Tag</button>
        </div>
      `;

      const resetBtn = document.getElementById('sim-reset-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          renderSimulatorStage();
        });
      }
    }, 450);
  }

  // Initial render
  renderSimulatorStage();
}

/**
 * FAQ Accordion
 */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    if (!questionBtn) return;

    questionBtn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      // Close all other items for clean accordion behavior
      faqItems.forEach(otherItem => {
        otherItem.classList.remove('open');
      });

      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });
}

/**
 * Live Token Prices Ticker
 */
async function initLivePrices() {
  const solPriceEl = document.getElementById('price-sol-val');
  const skrPriceEl = document.getElementById('price-skr-val');

  try {
    // Fetch live market prices from public CoinGecko / DexScreener
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    if (res.ok) {
      const data = await res.json();
      if (data?.solana?.usd && solPriceEl) {
        solPriceEl.innerText = `$${Number(data.solana.usd).toFixed(2)}`;
      }
    }
  } catch (err) {
    // Graceful fallback to realistic market values
    if (solPriceEl) solPriceEl.innerText = '$148.50';
  }

  if (skrPriceEl) {
    skrPriceEl.innerText = '$0.05';
  }
}

/**
 * Smooth scrolling for navigation links
 */
function initSmoothScroll() {
  const scrollLinks = document.querySelectorAll('a[href^="#"]');

  scrollLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId && targetId !== '#') {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });
  });
}

// Add CSS keyframe for scan line animation dynamically
const style = document.createElement('style');
style.innerHTML = `
  @keyframes scanLine {
    0% { top: 0; }
    50% { top: 100%; }
    100% { top: 0; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .token-toggle-pill {
    flex: 1;
    font-size: 0.68rem;
    font-weight: 700;
    padding: 4px 6px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .token-toggle-pill.active {
    background: rgba(153, 69, 255, 0.2);
    border-color: var(--solana-purple);
    color: #fff;
  }
`;
document.head.appendChild(style);
