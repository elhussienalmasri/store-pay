import React, { useEffect, useState } from 'react';
import {
  Check,
  KeyRound,
  LogOut,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Webhook,
} from 'lucide-react';
import {
  regenerateSecret,
  sendTestWebhook,
  storeSecret,
  updateMerchant,
} from '../../lib/merchantApi';
import { isLikelyPublicKey, maskKey } from '../../lib/widgetCore.mjs';
import { CopyButton, Field, inputClass, Panel } from './WidgetUi';

const PLANS = [
  { id: 'starter', label: 'Starter · free (demo)' },
  { id: 'growth', label: 'Growth · 0.9% per payment' },
  { id: 'scale', label: 'Scale · 0.5% + $29/mo' },
];

export function SettingsPanel({ secret, merchant, onChanged, onSignOut, onSecretChanged }) {
  const [form, setForm] = useState({
    name: merchant.name,
    email: merchant.email,
    domains: (merchant.domains || []).join(', '),
    payoutWallet: merchant.payoutWallet,
    webhookUrl: merchant.webhookUrl || '',
    plan: merchant.plan,
  });
  const [busy, setBusy] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setForm({
      name: merchant.name,
      email: merchant.email,
      domains: (merchant.domains || []).join(', '),
      payoutWallet: merchant.payoutWallet,
      webhookUrl: merchant.webhookUrl || '',
      plan: merchant.plan,
    });
  }, [merchant]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!isLikelyPublicKey(form.payoutWallet)) {
      setError('Payout wallet must be a valid Solana address');
      return;
    }
    const domains = form.domains
      .split(',')
      .map((domain) => domain.trim())
      .filter(Boolean);
    if (domains.length === 0) {
      setError('Add at least one storefront domain');
      return;
    }
    setBusy(true);
    try {
      await updateMerchant(secret, {
        name: form.name,
        email: form.email,
        domains,
        payoutWallet: form.payoutWallet,
        webhookUrl: form.webhookUrl,
        plan: form.plan,
      });
      await onChanged();
      setNotice('Settings saved');
      setTimeout(() => setNotice(''), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerateSecret() {
    const confirmed = window.confirm(
      'Generate a new secret key? The current key stops working immediately, so update your server before going live.'
    );
    if (!confirmed) return;

    setError('');
    setNotice('');
    setRotating(true);
    try {
      const data = await regenerateSecret(secret);
      storeSecret(data.secretKey);
      await onSecretChanged?.(data.secretKey);
      setNotice('New secret key generated. Copy it now and update your server.');
    } catch (err) {
      setError(err.message);
    } finally {
      setRotating(false);
    }
  }

  async function handleTestWebhook() {
    setError('');
    setNotice('');
    setTesting(true);
    try {
      const data = await sendTestWebhook(secret);
      if (data.result?.skipped) {
        setError(data.result.reason || 'No webhook URL configured');
      } else if (data.result?.ok) {
        setNotice(`Webhook delivered (HTTP ${data.result.status})`);
      } else {
        setError(
          `Webhook failed${data.result?.status ? ` (HTTP ${data.result.status})` : ''}${
            data.result?.error ? `: ${data.result.error}` : ''
          }`
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6 items-start">
      <Panel className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-white">Store settings</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Payout destination, allowed origins, and webhook delivery.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Store name">
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
              />
            </Field>
            <Field label="Contact email">
              <input
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Storefront domains"
            hint="Comma-separated. Only these origins can create widget sessions."
          >
            <input
              className={inputClass}
              value={form.domains}
              onChange={(e) => update('domains', e.target.value)}
              placeholder="yourstore.com, www.yourstore.com"
            />
          </Field>

          <Field
            label="Payout wallet"
            hint="New orders snapshot this address. Existing orders must be claimed by the wallet they were created with."
          >
            <input
              className={inputClass}
              value={form.payoutWallet}
              onChange={(e) => update('payoutWallet', e.target.value)}
            />
          </Field>

          <Field label="Plan">
            <select
              className={inputClass}
              value={form.plan}
              onChange={(e) => update('plan', e.target.value)}
            >
              {PLANS.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Webhook URL"
            hint="We POST signed order events here. Respond 2xx to acknowledge."
          >
            <input
              className={inputClass}
              value={form.webhookUrl}
              onChange={(e) => update('webhookUrl', e.target.value)}
              placeholder="https://yourstore.com/api/escrowpay/webhook"
            />
          </Field>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 flex items-center gap-2">
              <Check className="w-3.5 h-3.5" />
              {notice}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {busy ? 'Saving…' : 'Save settings'}
            </button>
            <button
              type="button"
              onClick={handleTestWebhook}
              disabled={testing || !form.webhookUrl}
              className="px-3 h-10 rounded-xl bg-[#181b28] border border-[#2a2f45] text-[11px] font-semibold text-gray-200 disabled:opacity-40 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {testing ? 'Sending…' : 'Send test'}
            </button>
          </div>
        </form>
      </Panel>

      <div className="space-y-4">
        <Panel className="space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            API credentials
          </h3>
          <div className="space-y-2 text-xs">
            <div className="rounded-xl bg-[#0e1017] border border-[#1e2233] p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-gray-500">
                  Publishable key
                </span>
                <CopyButton value={merchant.publishableKey} label="Copy" />
              </div>
              <code className="block text-[11px] text-gray-300 break-all font-mono">
                {merchant.publishableKey}
              </code>
            </div>
            <div className="rounded-xl bg-[#0e1017] border border-[#1e2233] p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-gray-500">
                  Secret key
                </span>
                <CopyButton value={secret} label="Copy" />
              </div>
              <code className="block text-[11px] text-gray-300 break-all font-mono">
                {maskKey(secret)}
              </code>
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] text-gray-500">
                  Stored in this browser only. Use it from your server, never in
                  storefront HTML.
                </p>
                <button
                  type="button"
                  onClick={handleRegenerateSecret}
                  disabled={rotating}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#181b28] border border-[#2a2f45] text-[10px] font-semibold text-gray-300 hover:text-white disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${rotating ? 'animate-spin' : ''}`} />
                  {rotating ? 'Generating…' : 'Generate new key'}
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-[#0e1017] border border-[#1e2233] p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-gray-500">
                  Webhook signing secret
                </span>
                <CopyButton value={merchant.webhookSecret} label="Copy" />
              </div>
              <code className="block text-[11px] text-gray-300 break-all font-mono">
                {maskKey(merchant.webhookSecret)}
              </code>
            </div>
          </div>
        </Panel>

        <Panel className="space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Webhook className="w-4 h-4 text-cyan-400" />
            Webhook signature
          </h3>
          <p className="text-[11px] text-gray-400">
            Verify{' '}
            <code className="text-gray-200">X-EscrowPay-Signature</code> as
            HMAC-SHA256 over{' '}
            <code className="text-gray-200">{'{timestamp}.{rawBody}'}</code> using
            the signing secret.
          </p>
          <p className="text-[11px] text-gray-500">
            Events: order.funded, order.claimed, order.refunded, order.paid,
            test.ping.
          </p>
        </Panel>

        <Panel className="space-y-3 border-red-500/20">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            This device
          </h3>
          <p className="text-[11px] text-gray-400">
            Signing out removes the locally stored secret key. Create or paste a
            key again to return.
          </p>
          <button
            onClick={onSignOut}
            className="w-full h-10 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-red-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out of this device
          </button>
        </Panel>
      </div>
    </div>
  );
}
