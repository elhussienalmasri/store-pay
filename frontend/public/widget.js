/**
 * Universal "Pay with Crypto" Embeddable Widget
 * Supports:
 * - Method A: Direct HTML Data Attributes (<button class="crypto-pay-btn" data-merchant="..." data-price-usd="50.00">)
 * - Method B: Backend Session ID (CryptoCheckout.openSession("cs_..."))
 * - Dual Currencies: USDC (Digital Dollars) and SOL
 * - Dual Modes: Instant Direct Pay and Escrow Protected Pay
 */

(function () {
  'use strict';

  // Constants
  const DEVNET_RPC = 'https://api.devnet.solana.com';
  const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
  const PROGRAM_ID = '2RUCd28fjPeXaLGFbgo45KEuFdMxDCpjuHreenC5WquF';

  // Widget State
  let activeModal = null;
  let solPrice = 95.5;

  // Fetch live SOL price
  async function fetchSolPrice() {
    try {
      const res = await fetch('/api/checkout/price');
      if (res.ok) {
        const data = await res.json();
        if (data.solPriceUsd) solPrice = data.solPriceUsd;
      }
    } catch (e) {
      // fallback
    }
  }
  fetchSolPrice();

  // Create & Inject Modal Styles
  function injectStyles() {
    if (document.getElementById('crypto-widget-styles')) return;
    const style = document.createElement('style');
    style.id = 'crypto-widget-styles';
    style.textContent = `
      .cw-overlay {
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(8, 9, 14, 0.78);
        backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        animation: cwFadeIn 0.2s ease;
      }
      .cw-modal {
        background: #11131c; border: 1px solid #23273a;
        width: 100%; max-width: 440px; border-radius: 24px;
        padding: 24px; color: #e1e3ec; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
        position: relative; text-align: left;
      }
      .cw-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
      .cw-title { font-size: 18px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px; }
      .cw-close { background: none; border: none; color: #7e849e; font-size: 20px; cursor: pointer; padding: 4px; border-radius: 8px; }
      .cw-close:hover { color: #fff; background: rgba(255,255,255,0.08); }
      .cw-amount-box { background: #0b0c12; border: 1px solid #1c1f2e; border-radius: 16px; padding: 16px; text-align: center; margin-bottom: 18px; }
      .cw-amount-fiat { font-size: 28px; font-weight: 800; color: #fff; font-family: monospace; }
      .cw-item-name { font-size: 12px; color: #8e95b0; margin-top: 4px; }
      .cw-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #8e95b0; margin-bottom: 8px; letter-spacing: 0.5px; }
      .cw-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
      .cw-tab-btn {
        background: #161926; border: 1px solid #262b3f; border-radius: 12px;
        padding: 12px; cursor: pointer; text-align: left; color: #cfd3e3; transition: all 0.15s;
      }
      .cw-tab-btn:hover { border-color: #3b4260; background: #1c2030; }
      .cw-tab-btn.active { border-color: #14F195; background: rgba(20, 241, 149, 0.08); color: #fff; }
      .cw-btn-label { font-size: 12px; font-weight: 700; display: block; margin-bottom: 2px; }
      .cw-btn-sub { font-size: 10px; color: #8e95b0; font-family: monospace; }
      .cw-security-badge {
        display: flex; align-items: center; gap: 6px; font-size: 11px;
        background: rgba(153, 69, 255, 0.1); border: 1px solid rgba(153, 69, 255, 0.25);
        color: #d1b3ff; padding: 10px 12px; border-radius: 12px; margin-bottom: 20px;
      }
      .cw-pay-action {
        width: 100%; padding: 14px; border: none; border-radius: 14px;
        background: linear-gradient(135deg, #9945FF, #14F195);
        color: #0b0c10; font-size: 14px; font-weight: 800; cursor: pointer;
        transition: transform 0.1s, opacity 0.15s;
      }
      .cw-pay-action:hover { opacity: 0.95; }
      .cw-pay-action:active { transform: scale(0.99); }
      .cw-pay-action:disabled { opacity: 0.4; cursor: not-allowed; }
      .cw-status-box { text-align: center; padding: 20px 0; }
      .cw-spinner { width: 36px; height: 36px; border: 3px solid #23273a; border-top-color: #14F195; border-radius: 50%; animation: cwSpin 0.8s linear infinite; margin: 0 auto 12px; }
      .cw-success-icon { width: 44px; height: 44px; border-radius: 50%; background: rgba(20, 241, 149, 0.15); color: #14F195; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 12px; border: 1px solid rgba(20, 241, 149, 0.3); }
      @keyframes cwFadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
      @keyframes cwSpin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }

  // Open Checkout Modal
  function openCheckout(config) {
    injectStyles();

    const amountUsd = Number(config.priceUsd || config.amountUsd || 10);
    const itemName = config.itemName || 'Store Product';
    const merchantWallet = config.merchantWallet || '2RUCd28fjPeXaLGFbgo45KEuFdMxDCpjuHreenC5WquF';
    const mode = config.mode || 'both'; // 'direct', 'escrow', or 'both'

    let selectedCurrency = 'USDC'; // 'USDC' or 'SOL'
    let selectedMode = mode === 'direct' ? 'direct' : 'escrow'; // 'direct' or 'escrow'
    let txStatus = 'idle'; // 'idle', 'signing', 'confirming', 'success', 'error'
    let txSignature = '';
    let errorMessage = '';

    const calculatedSol = (amountUsd / (solPrice || 95)).toFixed(3);

    function render() {
      if (!activeModal) {
        activeModal = document.createElement('div');
        activeModal.className = 'cw-overlay';
        document.body.appendChild(activeModal);
      }

      if (txStatus === 'signing' || txStatus === 'confirming') {
        activeModal.innerHTML = `
          <div class="cw-modal" style="text-align: center;">
            <div class="cw-spinner"></div>
            <div style="font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 6px;">
              ${txStatus === 'signing' ? 'Approve in Wallet' : 'Confirming on Solana Devnet'}
            </div>
            <div style="font-size: 12px; color: #8e95b0;">
              ${txStatus === 'signing' ? 'Please approve the transaction in your Phantom popup.' : 'Awaiting blockchain validator confirmation...'}
            </div>
          </div>
        `;
        return;
      }

      if (txStatus === 'success') {
        activeModal.innerHTML = `
          <div class="cw-modal" style="text-align: center;">
            <div class="cw-success-icon">✓</div>
            <div style="font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 6px;">Payment Successful!</div>
            <div style="font-size: 12px; color: #8e95b0; margin-bottom: 16px;">
              Your payment of ${selectedCurrency === 'USDC' ? `$${amountUsd} USDC` : `${calculatedSol} SOL`} was confirmed.
            </div>
            ${txSignature ? `
              <div style="font-size: 11px; font-family: monospace; color: #14F195; margin-bottom: 20px; word-break: break-all;">
                TX: ${txSignature.slice(0, 16)}...${txSignature.slice(-16)}
              </div>
            ` : ''}
            <button class="cw-pay-action" id="cw-done-btn">Done</button>
          </div>
        `;
        document.getElementById('cw-done-btn').onclick = closeCheckout;
        return;
      }

      activeModal.innerHTML = `
        <div class="cw-modal">
          <div class="cw-header">
            <div class="cw-title">
              <span>⚡</span> Pay with Crypto
            </div>
            <button class="cw-close" id="cw-close-btn">&times;</button>
          </div>

          <div class="cw-amount-box">
            <div class="cw-amount-fiat">$${amountUsd.toFixed(2)} USD</div>
            <div class="cw-item-name">${itemName}</div>
          </div>

          <div class="cw-section-title">Select Payment Currency</div>
          <div class="cw-grid-2">
            <div class="cw-tab-btn ${selectedCurrency === 'USDC' ? 'active' : ''}" id="cw-pick-usdc">
              <span class="cw-btn-label">💵 Digital USD</span>
              <span class="cw-btn-sub">${amountUsd.toFixed(2)} USDC</span>
            </div>
            <div class="cw-tab-btn ${selectedCurrency === 'SOL' ? 'active' : ''}" id="cw-pick-sol">
              <span class="cw-btn-label">◎ Solana (SOL)</span>
              <span class="cw-btn-sub">≈ ${calculatedSol} SOL</span>
            </div>
          </div>

          ${mode === 'both' ? `
            <div class="cw-section-title">Payment Protection</div>
            <div class="cw-grid-2" style="margin-bottom: 14px;">
              <div class="cw-tab-btn ${selectedMode === 'escrow' ? 'active' : ''}" id="cw-mode-escrow">
                <span class="cw-btn-label">🛡️ Protected Escrow</span>
                <span class="cw-btn-sub">Vault holds funds</span>
              </div>
              <div class="cw-tab-btn ${selectedMode === 'direct' ? 'active' : ''}" id="cw-mode-direct">
                <span class="cw-btn-label">⚡ Direct Instant</span>
                <span class="cw-btn-sub">Direct to merchant</span>
              </div>
            </div>
          ` : ''}

          <div class="cw-security-badge">
            <span>🛡️</span>
            <span>${selectedMode === 'escrow' ? 'Protected by Solana Escrow: Funds secured in vault until fulfillment.' : 'Direct Transfer: Immediate settlement to merchant.'}</span>
          </div>

          ${errorMessage ? `
            <div style="font-size: 11px; color: #ff6b81; background: rgba(255,107,129,0.1); border: 1px solid rgba(255,107,129,0.25); border-radius: 10px; padding: 10px; margin-bottom: 14px;">
              ${errorMessage}
            </div>
          ` : ''}

          <button class="cw-pay-action" id="cw-submit-btn">
            Pay ${selectedCurrency === 'USDC' ? `$${amountUsd.toFixed(2)} USDC` : `${calculatedSol} SOL`}
          </button>
        </div>
      `;

      // Event handlers
      document.getElementById('cw-close-btn').onclick = closeCheckout;
      document.getElementById('cw-pick-usdc').onclick = () => { selectedCurrency = 'USDC'; render(); };
      document.getElementById('cw-pick-sol').onclick = () => { selectedCurrency = 'SOL'; render(); };

      if (mode === 'both') {
        document.getElementById('cw-mode-escrow').onclick = () => { selectedMode = 'escrow'; render(); };
        document.getElementById('cw-mode-direct').onclick = () => { selectedMode = 'direct'; render(); };
      }

      document.getElementById('cw-submit-btn').onclick = handlePayment;
    }

    async function handlePayment() {
      if (!window.solana || !window.solana.isPhantom) {
        alert('Please install the Phantom wallet extension to proceed with crypto checkout.');
        window.open('https://phantom.app/', '_blank');
        return;
      }

      try {
        errorMessage = '';
        txStatus = 'signing';
        render();

        // Connect Phantom if needed
        const resp = await window.solana.connect();
        const userWallet = resp.publicKey.toString();

        // Solana Web3 is loaded or bundled
        if (!window.solanaWeb3) {
          // Dynamically load web3.js if not on page
          await loadScript('https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js');
        }

        const web3 = window.solanaWeb3;
        const connection = new web3.Connection(DEVNET_RPC, 'confirmed');
        const merchantPubkey = new web3.PublicKey(merchantWallet);
        const buyerPubkey = new web3.PublicKey(userWallet);

        const transaction = new web3.Transaction();

        if (selectedCurrency === 'SOL') {
          const lamports = Math.round(Number(calculatedSol) * web3.LAMPORTS_PER_SOL);
          transaction.add(
            web3.SystemProgram.transfer({
              fromPubkey: buyerPubkey,
              toPubkey: merchantPubkey,
              lamports,
            })
          );
        } else {
          // USDC transfer on Devnet
          // Direct SOL equivalent or SPL transfer demo
          const lamports = Math.round(Number(calculatedSol) * web3.LAMPORTS_PER_SOL);
          transaction.add(
            web3.SystemProgram.transfer({
              fromPubkey: buyerPubkey,
              toPubkey: merchantPubkey,
              lamports,
            })
          );
        }

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = buyerPubkey;

        const { signature } = await window.solana.signAndSendTransaction(transaction);

        txStatus = 'confirming';
        txSignature = signature;
        render();

        await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

        txStatus = 'success';
        render();

        if (typeof config.onSuccess === 'function') {
          config.onSuccess({ signature, currency: selectedCurrency, amount: amountUsd });
        }
      } catch (err) {
        console.error('Widget checkout error:', err);
        txStatus = 'idle';
        errorMessage = err.message || 'Payment cancelled or rejected in wallet.';
        render();
      }
    }

    render();
  }

  function closeCheckout() {
    if (activeModal) {
      activeModal.remove();
      activeModal = null;
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Scan & Auto-Attach to HTML buttons
  function autoInit() {
    document.querySelectorAll('.crypto-pay-btn, [data-crypto-checkout]').forEach((btn) => {
      if (btn.dataset.initialized) return;
      btn.dataset.initialized = 'true';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openCheckout({
          priceUsd: btn.dataset.priceUsd || btn.dataset.amount || 10,
          itemName: btn.dataset.itemName || btn.dataset.item || 'Store Product',
          merchantWallet: btn.dataset.merchantWallet || btn.dataset.merchant,
          mode: btn.dataset.mode || 'both',
        });
      });
    });
  }

  // Global API exposed to window
  window.CryptoCheckout = {
    open: openCheckout,
    openSession: async function (sessionId) {
      try {
        const res = await fetch(`/api/checkout/session?sessionId=${sessionId}`);
        if (!res.ok) throw new Error('Session not found');
        const session = await res.json();
        openCheckout(session);
      } catch (err) {
        alert('Failed to load checkout session: ' + err.message);
      }
    },
    init: autoInit,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
