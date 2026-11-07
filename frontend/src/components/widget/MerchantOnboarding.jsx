import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  ArrowRight,
  Check,
  KeyRound,
  Lock,
  ShieldCheck,
  Store,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  getMerchant,
  signupMerchant,
  storeSecret,
} from '../../lib/merchantApi';
import { isLikelyPublicKey } from '../../lib/widgetCore.mjs';
import { DEVNET_RPC_URL, PROGRAM_ID_STRING } from '../../lib/constants';
import { CopyButton, Field, inputClass, Panel } from './WidgetUi';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Free',
    detail: 'Demo plan · no card required',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '0.9%',
    detail: 'per settled payment',
  },
  {
    id: 'scale',
    name: 'Scale',
    price: '0.5%',
    detail: 'plus $29/mo · priority support',
  },
];

export function MerchantOnboarding({ onReady }) {
  const { publicKey } = useWallet();
  const [mode, setMode] = useState('create');
  const [form, setForm] = useState({
    name: '',
    email: '',
    domain: '',
    payoutWallet: '',
    plan: 'starter',
  });
  const [secretInput, setSecretInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const [channel, setChannel] = useState('escrow');
  const [sampleProductId, setSampleProductId] = useState('');

  useEffect(() => {
    if (!created) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/v1/products?publishableKey=${encodeURIComponent(created.merchant.publishableKey)}`
        );
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.products?.length) {
          setSampleProductId(data.products[0].id);
        }
      } catch {
        // The snippet still works once a product id is pasted in.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [created]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError('');
    if (!isLikelyPublicKey(form.payoutWallet)) {
      setError('Payout wallet must be a valid Solana address');
      return;
    }
    setBusy(true);
    try {
      const data = await signupMerchant(form);
      storeSecret(data.secretKey);
      setCreated({ merchant: data.merchant, secretKey: data.secretKey });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExisting(event) {
    event.preventDefault();
    setError('');
    if (!secretInput.trim()) {
      setError('Paste your merchant secret key');
      return;
    }
    setBusy(true);
    try {
      const data = await getMerchant(secretInput.trim());
      storeSecret(secretInput.trim());
      onReady(data.merchant, secretInput.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://escrowpay.app';
    const escrowSnippet = `<!-- EscrowPay merchant widget -->
<script src="${origin}/widget/v1.js" async></script>
<button
  data-escrowpay
  data-public-key="${created.merchant.publishableKey}"
  data-product="${sampleProductId || 'prd_your_product'}"
  data-quantity="1"
  data-mode="escrow"
>Pay with crypto</button>`;
    const inpayEnv = `ESCROWPAY_SECRET_KEY=${created.secretKey}
ESCROWPAY_INPAY_API_URL=${origin}
NEXT_PUBLIC_ESCROWPAY_INPAY=1
NEXT_PUBLIC_ESCROWPAY_PROGRAM_ID=${PROGRAM_ID_STRING}
NEXT_PUBLIC_ESCROWPAY_RPC_URL=${DEVNET_RPC_URL}`;

    return (
      <div className="max-w-xl mx-auto">
        <Panel className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Store created</h2>
              <p className="text-xs text-gray-400 mt-1">
                Save your secret key now. It is shown once and is required for
                server-to-server API calls.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                Secret key (sk_live)
              </span>
              <CopyButton value={created.secretKey} label="Copy secret" />
            </div>
            <code className="block text-[11px] text-amber-100 break-all font-mono">
              {created.secretKey}
            </code>
            <p className="text-[11px] text-amber-200/70">
              Keep this out of the browser on production sites. Your publishable
              key is safe for the widget snippet.
            </p>
          </div>

          <div className="rounded-2xl bg-[#10121a] border border-[#1e2233] p-4 text-xs space-y-1.5">
            <p className="text-gray-400">
              Store:{' '}
              <span className="text-white font-semibold">{created.merchant.name}</span>
            </p>
            <p className="text-gray-400">
              Publishable key:{' '}
              <span className="font-mono text-[11px] text-gray-200">
                {created.merchant.publishableKey}
              </span>
            </p>
            <p className="text-gray-400">
              Payout wallet:{' '}
              <span className="font-mono text-[11px] text-gray-200">
                {created.merchant.payoutWallet}
              </span>
            </p>
          </div>

          <div className="space-y-2">
            <div className="inline-flex rounded-xl bg-[#0e1017] border border-[#23273a] p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setChannel('escrow')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  channel === 'escrow' ? 'bg-[#9945FF] text-white' : 'text-gray-400'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Escrow
              </button>
              <button
                type="button"
                onClick={() => setChannel('inpay')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  channel === 'inpay' ? 'bg-[#9945FF] text-white' : 'text-gray-400'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                InPay
              </button>
            </div>

            <div className="rounded-2xl bg-[#10121a] border border-[#1e2233] p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {channel === 'inpay' ? 'InPay .env' : 'Escrow embed snippet'}
                </span>
                <CopyButton
                  value={channel === 'inpay' ? inpayEnv : escrowSnippet}
                  label={channel === 'inpay' ? 'Copy .env' : 'Copy HTML'}
                />
              </div>
              <pre className="text-[10px] leading-relaxed text-gray-300 bg-[#0a0c12] border border-[#1e2233] rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all">
                {channel === 'inpay' ? inpayEnv : escrowSnippet}
              </pre>
              <p className="text-[10px] text-gray-500">
                {channel === 'inpay'
                  ? 'Inline payment for your own checkout: no popup. Keep the secret key on your server only.'
                  : 'Popup checkout for your storefront. The publishable key is safe in page HTML.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => onReady(created.merchant, created.secretKey)}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-sm font-bold flex items-center justify-center gap-2"
          >
            Open merchant dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-6 items-start">
      <Panel className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">Order your widget</h2>
            <p className="text-xs text-gray-400 mt-1">
              Create a store, get an embed snippet, and start accepting escrow
              payments.
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#9945FF]/10 border border-[#9945FF]/30">
            <Store className="w-5 h-5 text-[#c4a3ff]" />
          </div>
        </div>

        <div className="inline-flex rounded-xl bg-[#0e1017] border border-[#23273a] p-1 text-xs font-semibold">
          <button
            onClick={() => setMode('create')}
            className={`px-3 py-1.5 rounded-lg transition ${
              mode === 'create' ? 'bg-[#9945FF] text-white' : 'text-gray-400'
            }`}
          >
            New store
          </button>
          <button
            onClick={() => setMode('existing')}
            className={`px-3 py-1.5 rounded-lg transition ${
              mode === 'existing' ? 'bg-[#9945FF] text-white' : 'text-gray-400'
            }`}
          >
            I have a key
          </button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Store name">
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Your store name"
                  required
                />
              </Field>
              <Field label="Contact email">
                <input
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="contact@example.com"
                  required
                />
              </Field>
            </div>

            <Field
              label="Storefront domain"
              hint="The widget only accepts sessions from this origin (localhost is always allowed for testing)."
            >
              <input
                className={inputClass}
                value={form.domain}
                onChange={(e) => update('domain', e.target.value)}
                placeholder="yourstore.com"
                required
              />
            </Field>

            <Field
              label="Payout wallet"
              hint="Settled SOL is sent here. You can update it later in Settings."
            >
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={form.payoutWallet}
                  onChange={(e) => update('payoutWallet', e.target.value)}
                  placeholder="Solana wallet address"
                  required
                />
                <button
                  type="button"
                  onClick={() => publicKey && update('payoutWallet', publicKey.toBase58())}
                  disabled={!publicKey}
                  className="shrink-0 px-3 rounded-xl bg-[#181b28] border border-[#2a2f45] text-[11px] font-semibold text-gray-300 disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Connected
                </button>
              </div>
              {!publicKey && (
                <span className="block text-[11px] text-gray-500 mt-1">
                  Connect a wallet from the header to fill this automatically.
                </span>
              )}
            </Field>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Plan
              </span>
              <div className="grid sm:grid-cols-3 gap-2">
                {PLANS.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => update('plan', plan.id)}
                    className={`text-left p-3 rounded-xl border transition ${
                      form.plan === plan.id
                        ? 'border-[#14F195]/60 bg-[#14F195]/10'
                        : 'border-[#23273a] bg-[#0e1017] hover:border-[#3a405c]'
                    }`}
                  >
                    <span className="block text-sm font-bold text-white">{plan.name}</span>
                    <span className="block text-lg font-black text-[#14F195]">
                      {plan.price}
                    </span>
                    <span className="block text-[10px] text-gray-500">{plan.detail}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500">
                Demo plans: no billing is wired yet. Fees are not enforced on-chain.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? 'Creating store…' : 'Create store & generate keys'}
              {!busy && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        ) : (
          <form onSubmit={handleExisting} className="space-y-4">
            <Field
              label="Merchant secret key"
              hint="Stored locally in this browser. Never embed it in a website."
            >
              <input
                className={inputClass}
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                placeholder="sk_live_..."
                required
              />
            </Field>
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-sm font-bold disabled:opacity-50"
            >
              {busy ? 'Checking key…' : 'Open dashboard'}
            </button>
          </form>
        )}
      </Panel>

      <div className="space-y-4">
        <Panel className="space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#14F195]" />
            How EscrowPay works
          </h3>
          <ol className="space-y-3 text-xs text-gray-400">
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#9945FF]/20 text-[#c4a3ff] text-[10px] font-bold flex items-center justify-center shrink-0">
                1
              </span>
              Buyer pays into a program-owned vault from the hosted checkout.
            </li>
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#9945FF]/20 text-[#c4a3ff] text-[10px] font-bold flex items-center justify-center shrink-0">
                2
              </span>
              You deliver, then claim the payment from the Orders dashboard.
            </li>
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#9945FF]/20 text-[#c4a3ff] text-[10px] font-bold flex items-center justify-center shrink-0">
                3
              </span>
              The buyer can reclaim funds until you claim. No custodian holds keys.
            </li>
          </ol>
        </Panel>

        <Panel className="space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            Keys & security
          </h3>
          <p className="text-xs text-gray-400">
            The publishable key goes in the embed snippet. The secret key stays
            server-side and authenticates API and webhook calls.
          </p>
          <p className="text-[11px] text-gray-500 flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-500" />
            Devnet only. Amounts are always calculated on the server; the browser
            cannot set the price.
          </p>
        </Panel>
      </div>
    </div>
  );
}
