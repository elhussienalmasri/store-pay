import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Sparkles,
  Code2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Zap,
  ShoppingBag,
  Terminal,
  Settings,
  Layers
} from 'lucide-react';

const SAMPLE_PRODUCTS = [
  {
    id: 'prod_1',
    name: 'Wireless Mechanical Keyboard',
    priceUsd: 85.0,
    icon: '⌨️',
    description: 'Hot-swappable RGB mechanical gaming keyboard with Bluetooth 5.0',
  },
  {
    id: 'prod_2',
    name: 'Noise-Cancelling Headphones',
    priceUsd: 140.0,
    icon: '🎧',
    description: 'Premium wireless headphones with 40-hour battery life and spatial audio',
  },
  {
    id: 'prod_3',
    name: 'Artisan Coffee Roasters Box',
    priceUsd: 24.5,
    icon: '☕',
    description: 'Fresh whole bean specialty coffee subscription box (3 bags)',
  },
];

export function MerchantWidgetPortal() {
  const { publicKey } = useWallet();

  // Merchant Settings
  const [merchantWallet, setMerchantWallet] = useState('');
  const [codeTab, setCodeTab] = useState('html'); // 'html' | 'api' | 'curl'
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [selectedMode, setSelectedMode] = useState('both'); // 'both' | 'escrow' | 'direct'

  useEffect(() => {
    if (publicKey) {
      setMerchantWallet(publicKey.toBase58());
    }
  }, [publicKey]);

  // Load widget script into head if not already present
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.CryptoCheckout) {
      const script = document.createElement('script');
      script.src = '/widget.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  function handleTestCheckout(product) {
    if (typeof window !== 'undefined' && window.CryptoCheckout) {
      window.CryptoCheckout.open({
        priceUsd: product.priceUsd,
        itemName: product.name,
        merchantWallet: merchantWallet || '2RUCd28fjPeXaLGFbgo45KEuFdMxDCpjuHreenC5WquF',
        mode: selectedMode,
      });
    } else {
      alert('Loading checkout widget... please click again in a moment.');
    }
  }

  function handleCopy(text) {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  const htmlCodeSnippet = `<!-- 1. Add Widget Script to <head> -->
<script src="http://localhost:3000/widget.js" async></script>

<!-- 2. Add Pay with Crypto Button -->
<button 
  class="crypto-pay-btn"
  data-merchant-wallet="${merchantWallet || 'YOUR_MERCHANT_WALLET'}"
  data-price-usd="50.00"
  data-item-name="Store Product"
  data-mode="${selectedMode}">
  ⚡ Pay with Crypto
</button>`;

  const nodeCodeSnippet = `// Backend Order Session API (Node.js / Express)
const res = await fetch("http://localhost:3000/api/checkout/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    orderId: "ORDER-10029",
    amountUsd: 50.00,
    currency: "${selectedCurrency}",
    merchantWallet: "${merchantWallet || 'YOUR_WALLET'}",
    itemName: "Store Product",
    mode: "${selectedMode}"
  })
});

const { sessionId } = await res.json();
// Open widget with secure session ID:
// CryptoCheckout.openSession(sessionId);`;

  const curlCodeSnippet = `curl -X POST http://localhost:3000/api/checkout/session \\
  -H "Content-Type: application/json" \\
  -d '{
    "orderId": "ORDER-9812",
    "amountUsd": 50.00,
    "currency": "USD",
    "merchantWallet": "${merchantWallet || 'YOUR_WALLET'}",
    "itemName": "Custom Product"
  }'`;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#23273a] shadow-2xl relative overflow-hidden">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 mb-3">
            <Zap className="w-3.5 h-3.5" />
            Universal Merchant Payment Gateway
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Accept <span className="bg-gradient-to-r from-[#9945FF] to-[#14F195] bg-clip-text text-transparent">Crypto</span> on Any Website
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-2 leading-relaxed">
            Let customers pay with digital dollars (USDC) or SOL directly from their Phantom wallet. Embed the "Pay with Crypto" button with 1 line of HTML, or generate secure order sessions through the API.
          </p>
        </div>
      </div>

      {/* SECTION 1: INTERACTIVE DEMO STORE */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#23273a] shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-[#1b1f30]">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#14F195]" />
              Live Demo Store Preview
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Click the "Pay with Crypto" button on any item to test the customer checkout experience live
            </p>
          </div>

          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[#141624] text-purple-300 border border-purple-500/20">
            Payout Wallet: {merchantWallet ? `${merchantWallet.slice(0, 4)}...${merchantWallet.slice(-4)}` : 'Default Test'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {SAMPLE_PRODUCTS.map((product) => (
            <div
              key={product.id}
              className="p-5 bg-[#0e1017] border border-[#1e2233] hover:border-[#2e344d] rounded-2xl flex flex-col justify-between transition group shadow-lg"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#171926] border border-[#272b3f] flex items-center justify-center text-2xl mb-3 group-hover:scale-105 transition">
                  {product.icon}
                </div>
                <h4 className="font-bold text-sm text-white mb-1">{product.name}</h4>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">{product.description}</p>
              </div>

              <div className="pt-3 border-t border-[#181b28] flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-semibold text-gray-500">Price</div>
                  <div className="text-base font-extrabold text-white font-mono">${product.priceUsd.toFixed(2)}</div>
                </div>

                <button
                  onClick={() => handleTestCheckout(product)}
                  className="px-3.5 py-2 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c10] font-extrabold text-xs rounded-xl hover:opacity-95 active:scale-95 transition shadow-md flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  Pay with Crypto
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: DEVELOPER INTEGRATION CODE */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#23273a] shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Code2 className="w-5 h-5 text-[#9945FF]" />
              Merchant Integration Code
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Copy-paste this snippet into any website (Shopify, WordPress, Webflow, custom app)
            </p>
          </div>

          <div className="flex items-center gap-2 p-1 bg-[#10121a] border border-[#23273a] rounded-xl text-xs">
            <button
              onClick={() => setCodeTab('html')}
              className={`px-3 py-1.5 font-bold rounded-lg transition ${
                codeTab === 'html' ? 'bg-[#9945FF] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Method A: Simple HTML
            </button>
            <button
              onClick={() => setCodeTab('api')}
              className={`px-3 py-1.5 font-bold rounded-lg transition ${
                codeTab === 'api' ? 'bg-[#9945FF] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Method B: Backend API
            </button>
            <button
              onClick={() => setCodeTab('curl')}
              className={`px-3 py-1.5 font-bold rounded-lg transition ${
                codeTab === 'curl' ? 'bg-[#9945FF] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              cURL
            </button>
          </div>
        </div>

        {/* Code Snippet Box */}
        <div className="relative p-4 bg-[#0a0b10] border border-[#1c1f2e] rounded-2xl font-mono text-xs text-gray-300 overflow-x-auto">
          <button
            onClick={() => handleCopy(codeTab === 'html' ? htmlCodeSnippet : codeTab === 'api' ? nodeCodeSnippet : curlCodeSnippet)}
            className="absolute top-3 right-3 flex items-center gap-1 px-3 py-1.5 bg-[#171a28] hover:bg-[#23273b] border border-[#282d42] text-xs font-semibold rounded-lg text-white transition"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCode ? 'Copied!' : 'Copy Code'}
          </button>

          <pre className="pr-20">
            <code>
              {codeTab === 'html' && htmlCodeSnippet}
              {codeTab === 'api' && nodeCodeSnippet}
              {codeTab === 'curl' && curlCodeSnippet}
            </code>
          </pre>
        </div>
      </div>

      {/* SECTION 3: MERCHANT SETTINGS & CUSTOMIZATION */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-[#23273a] shadow-xl space-y-5 text-xs">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-[#14F195]" />
          Merchant Widget Configuration
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 uppercase font-semibold text-[11px] mb-1.5">
              Payout Wallet Address (Where funds land)
            </label>
            <input
              type="text"
              placeholder="Solana Wallet Public Key"
              value={merchantWallet}
              onChange={(e) => setMerchantWallet(e.target.value)}
              className="w-full bg-[#0e1017] border border-[#23273a] text-xs font-mono text-white rounded-xl p-3 focus:outline-none focus:border-[#14F195]"
            />
          </div>

          <div>
            <label className="block text-gray-400 uppercase font-semibold text-[11px] mb-1.5">
              Payment Security Mode
            </label>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="w-full bg-[#0e1017] border border-[#23273a] text-xs font-semibold text-white rounded-xl p-3 focus:outline-none focus:border-[#14F195]"
            >
              <option value="both">Both (Buyer chooses Direct or Protected Escrow)</option>
              <option value="escrow">Strict Escrow Only (All orders held in vault)</option>
              <option value="direct">Direct Payment Only (Immediate settlement)</option>
            </select>
          </div>
        </div>
      </div>

    </div>
  );
}
