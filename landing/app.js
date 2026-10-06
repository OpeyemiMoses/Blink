/**
 * BLINK — Landing Page Interactive Engine
 * Solid Minimalist Interaction Engine: Seeker Phone Simulator, FAQ accordion, token prices.
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
      code: "COFFEE"
    },
    event: {
      name: "Solana Breakpoint VIP Pass",
      id: "breakpoint-2026-vip",
      baseUsdc: 25.00,
      skrPrice: 500.00,
      solPrice: 0.14,
      recipient: "G7jrT6yzAoXP3bCXspD37WhA27KwtcHTomCMLDnFJ42Z",
      category: "Event Ticket",
      code: "VIP"
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
            <span style="font-family: var(--font-mono); font-weight: 800; font-size: 0.85rem; color: var(--solana-green);">NFC</span>
          </div>
          <div class="nfc-radar-title">Ready to Tap</div>
          <div class="nfc-radar-sub">Click the target to simulate holding your Seeker against a physical NFC tag</div>
        </div>
      `;
      const newTarget = document.getElementById('sim-radar-target');
      if (newTarget) {
        newTarget.addEventListener('click', handleNfcTap);
      }
    } else if (currentMode === 'qr') {
      simStage.innerHTML = `
        <div class="nfc-radar-zone">
          <div style="width: 130px; height: 130px; border: 2px solid var(--border-strong); border-radius: 14px; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #0A0D14; margin-bottom: 12px;">
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--solana-green); animation: scanLine 2s infinite linear;"></div>
            <span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); font-weight: 700;">SCANNER</span>
          </div>
          <div class="nfc-radar-title">Live QR Viewfinder</div>
          <div class="nfc-radar-sub">Camera aligned to counter display</div>
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
          <div style="font-size: 0.8rem; font-weight: 800; color: var(--solana-green); text-transform: uppercase;">Blink Studio Preview</div>
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
          alert('Blink programmed! In the mobile APK, tap "Write to NFC Tag" to program NDEF records onto physical NFC tags.');
        });
      }
    }
  }

  function handleNfcTap() {
    showActionConfirmation();
  }

  function handleScanSuccess() {
    showActionConfirmation();
  }

  function showActionConfirmation() {
    const effectiveSkr = (activeBlink.skrPrice * 0.9).toFixed(2);
    
    simStage.innerHTML = `
      <div class="sim-blink-card" id="sim-action-card">
        <div class="sim-blink-header">
          <div class="sim-merchant-logo">${activeBlink.code}</div>
          <div class="sim-merchant-info">
            <div class="sim-blink-title">${activeBlink.name}</div>
            <div class="sim-verified-tag">
              Verified Solana Action
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
          ${selectedToken === 'SKR' ? `<span class="sim-skr-badge">10% DISCOUNT</span>` : ''}
        </div>

        <button class="sim-action-btn" id="sim-confirm-pay-btn">
          Confirm & Settle (~400ms)
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
        <div style="width: 32px; height: 32px; border: 3px solid #1E2536; border-top-color: var(--solana-green); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 10px;"></div>
        <div style="font-size: 0.92rem; font-weight: 800; color: #fff;">Sub-Second Settlement</div>
        <div style="font-size: 0.74rem; color: var(--text-muted);">Broadcasting via Solana Mainnet...</div>
      </div>
    `;

    setTimeout(() => {
      const mockSig = '5Kj' + Math.random().toString(36).substring(2, 8) + '...' + Math.random().toString(36).substring(2, 6);
      simStage.innerHTML = `
        <div class="sim-receipt-overlay">
          <div class="sim-check-icon">CONFIRMED</div>
          <div class="sim-receipt-title">Settlement Confirmed</div>
          <div class="sim-receipt-detail">Transferred to <strong>${activeBlink.name}</strong></div>
          <div class="sim-receipt-sig">TX: ${mockSig}</div>
          <div style="font-size: 0.72rem; color: var(--solana-green); font-weight: 700;">Finality: 382ms • Fee: &lt; 0.0001 SOL</div>
          <button class="btn btn-secondary btn-sm" id="sim-reset-btn" style="margin-top: 8px; width: 100%;">Reset Demo</button>
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
 * Live Token Prices
 */
async function initLivePrices() {
  const solPriceEl = document.getElementById('price-sol-val');
  const skrPriceEl = document.getElementById('price-skr-val');

  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    if (res.ok) {
      const data = await res.json();
      if (data?.solana?.usd && solPriceEl) {
        solPriceEl.innerText = `$${Number(data.solana.usd).toFixed(2)}`;
      }
    }
  } catch (err) {
    if (solPriceEl) solPriceEl.innerText = '$148.50';
  }

  if (skrPriceEl) {
    skrPriceEl.innerText = '$0.05';
  }
}

/**
 * Smooth scrolling
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

// Keyframes
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
    padding: 5px 6px;
    border-radius: 6px;
    background: #0A0D14;
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    cursor: pointer;
  }
  .token-toggle-pill.active {
    background: #181F2E;
    border-color: var(--solana-green);
    color: var(--solana-green);
  }
`;
document.head.appendChild(style);
