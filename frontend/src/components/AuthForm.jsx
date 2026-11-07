import React, { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  AlertTriangle,
  ArrowRight,
  KeyRound,
  Lock,
  ShieldCheck,
  Store,
  Wallet,
} from 'lucide-react';
import {
  loginMerchant,
  loginWithKey,
  signupAccount,
  storeSecret,
  clearStoredSecret,
} from '../lib/merchantApi';
import { isLikelyPublicKey } from '../lib/widgetCore.mjs';
import { Field, inputClass, Panel } from './widget/WidgetUi';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

export function AuthForm({ mode = 'login' }) {
  const router = useRouter();
  const { publicKey } = useWallet();
  const isSignup = mode === 'signup';

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    domain: '',
    payoutWallet: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [useKey, setUseKey] = useState(false);
  const [secretKey, setSecretKey] = useState('');

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate() {
    if (!isSignup && useKey) {
      return secretKey.trim() ? null : 'Enter your merchant secret key';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return 'Enter a valid email address';
    }
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      return 'Password must be at least 8 characters and include a letter and a number';
    }
    if (!isSignup) return null;
    if (form.name.trim().length < 2) return 'Store name must be at least 2 characters';
    if (!form.domain.trim()) return 'Add the website domain where the widget will be embedded';
    if (!isLikelyPublicKey(form.payoutWallet)) {
      return 'Payout wallet must be a valid Solana address';
    }
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    try {
      if (isSignup) {
        const data = await signupAccount({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          domain: form.domain.trim(),
          payoutWallet: form.payoutWallet.trim(),
        });
        storeSecret(data.secretKey);
      } else if (useKey) {
        await loginWithKey(secretKey.trim());
        clearStoredSecret();
      } else {
        await loginMerchant({ email: form.email.trim(), password: form.password });
        // The session cookie identifies the account; drop any key from a previous login.
        clearStoredSecret();
      }
      router.push('/merchant');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <Panel className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-white">
              {isSignup ? 'Create your EscrowPay account' : 'Sign in to EscrowPay'}
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              {isSignup
                ? 'Set up a store, get your embed snippet, and start accepting escrow payments.'
                : 'Manage products, widget settings, and settle escrow payments.'}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-[#9945FF]/10 border border-[#9945FF]/30 shrink-0">
            {isSignup ? (
              <Store className="w-5 h-5 text-[#c4a3ff]" />
            ) : (
              <KeyRound className="w-5 h-5 text-[#c4a3ff]" />
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <Field label="Store name">
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Your store name"
                autoComplete="organization"
                required
              />
            </Field>
          )}

          {!isSignup && useKey ? (
            <Field
              label="Merchant secret key"
              hint="Legacy stores created before email sign-in can still use their sk_live key."
            >
              <input
                type="password"
                className={inputClass}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="sk_live_…"
                autoComplete="off"
                required
              />
            </Field>
          ) : (
            <>
              <Field label="Email">
                <input
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="contact@example.com"
                  autoComplete="email"
                  required
                />
              </Field>

              <Field
                label="Password"
                hint={isSignup ? 'At least 8 characters with a letter and a number.' : undefined}
              >
                <input
                  type="password"
                  className={inputClass}
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                />
              </Field>
            </>
          )}

          {!isSignup && (
            <button
              type="button"
              onClick={() => {
                setUseKey((value) => !value);
                setError('');
              }}
              className="text-[11px] font-semibold text-[#c4a3ff] hover:underline"
            >
              {useKey ? 'Use email and password instead' : 'Have a merchant key? Sign in with a key'}
            </button>
          )}

          {isSignup && (
            <>
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
                    Connect a wallet to fill this automatically.
                  </span>
                )}
              </Field>

            </>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-[#0b0c12] text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy
              ? isSignup
                ? 'Creating account…'
                : 'Signing in…'
              : isSignup
              ? 'Create account'
              : useKey
              ? 'Sign in with key'
              : 'Sign in'}
            {!busy && <ArrowRight className="w-4 h-4" />}
          </button>

          <p className="text-center text-xs text-gray-500">
            {isSignup ? (
              <>
                Already have an account?{' '}
                <Link href="/login" className="text-[#c4a3ff] hover:underline">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New to EscrowPay?{' '}
                <Link href="/signup" className="text-[#c4a3ff] hover:underline">
                  Create an account
                </Link>
              </>
            )}
          </p>
        </form>

        {isSignup && (
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#1e2233]">
            <p className="text-[11px] text-gray-500">
              Add your payout wallet with a browser wallet.
            </p>
            <div className="solana-wallet-custom">
              <WalletMultiButton className="!bg-[#1a1d2b] !border !border-[#2b3048] !text-white !font-semibold !text-[11px] !rounded-xl !h-9 !px-3" />
            </div>
          </div>
        )}
      </Panel>

      <p className="mt-4 flex items-center justify-center gap-2 text-[11px] text-gray-500">
        <ShieldCheck className="w-3.5 h-3.5 text-[#14F195]" />
        Passwords are hashed with PBKDF2. Sessions are signed httpOnly cookies.
      </p>
    </div>
  );
}
