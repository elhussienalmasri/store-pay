import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  describeWalletError,
  fetchCheckoutSession,
  fundEscrow,
  payDirect,
  refundEscrow,
  requoteSession,
  confirmReceipt,
} from '../../lib/widgetCheckout';
import { getExplorerUrl } from '../../lib/constants';
import { statusLabel } from '../../lib/widgetCore.mjs';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

const STATUS_STYLES = {
  open: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  prepared: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  funded: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  claimed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  refunded: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  paid: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  expired: 'bg-red-500/10 text-red-300 border-red-500/30',
};

function shorten(value, size = 4) {
  if (!value) return '';
  return `${value.slice(0, size)}…${value.slice(-size)}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected, wallets } = useWallet();
  const walletDetected = wallets.length > 0;

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState(null); // 'pay' | 'refund' | 'requote' | 'confirm'
  const [txSignature, setTxSignature] = useState('');
  const notifiedRef = useRef(false);
  const [embedded, setEmbedded] = useState(false);
  const [devnetBalance, setDevnetBalance] = useState(null);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [notifyBuyer, setNotifyBuyer] = useState(false);

  const sessionId = router.query.sessionId;
  const token = router.query.t;

  useEffect(() => {
    setEmbedded(
      typeof window !== 'undefined' &&
        (window.parent !== window ||
          Boolean(window.opener) ||
          window.name === 'escrowpay_checkout')
    );
  }, []);

  const loadSession = useCallback(
    async (silent = false) => {
      if (!sessionId || !token) return;
      try {
        if (!silent) setLoading(true);
        const data = await fetchCheckoutSession(sessionId, token);
        setSession(data.session);
        setError('');
      } catch (err) {
        if (!silent) setError(err.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [sessionId, token]
  );

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!publicKey) {
      setDevnetBalance(null);
      return undefined;
    }
    let active = true;
    connection
      .getBalance(publicKey)
      .then((lamports) => {
        if (active) setDevnetBalance(lamports);
      })
      .catch(() => {
        if (active) setDevnetBalance(null);
      });
    return () => {
      active = false;
    };
  }, [publicKey, connection]);

  const status = session?.status;
  useEffect(() => {
    if (!status) return undefined;
    if (!['prepared', 'funded', 'open'].includes(status)) return undefined;
    const interval = setInterval(() => loadSession(true), 5000);
    return () => clearInterval(interval);
  }, [status, loadSession]);

  const notifyParent = useCallback((type) => {
    if (typeof window === 'undefined') return;
    const target =
      window.opener || (window.parent !== window ? window.parent : null);
    if (!target) return;
    try {
      target.postMessage({ type, orderId: sessionId }, '*');
    } catch {
      /* opener may be closed */
    }
  }, [sessionId]);

  useEffect(() => {
    if (notifiedRef.current) return;
    if (status === 'funded' || status === 'paid') {
      notifiedRef.current = true;
      notifyParent('escrowpay:success');
    }
  }, [status, notifyParent]);

  const accent = session?.merchant?.accentColor || '#9945FF';
  const quoteExpired = Boolean(session?.settlement?.quoteExpired);

  const canPay = useMemo(() => {
    if (!session || !connected || !publicKey) return false;
    if (!['open', 'prepared'].includes(session.status)) return false;
    if (quoteExpired) return false;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return false;
    return true;
  }, [session, connected, publicKey, quoteExpired]);

  async function handlePay() {
    if (!session || !publicKey) return;
    setAction('pay');
    setError('');
    setTxSignature('');
    try {
      const result =
        session.mode === 'escrow'
          ? await fundEscrow({
              connection,
              publicKey,
              sendTransaction,
              session,
              token,
              buyerEmail: notifyBuyer ? buyerEmail.trim() : '',
              notifyBuyer,
            })
          : await payDirect({
              connection,
              publicKey,
              sendTransaction,
              session,
              token,
              buyerEmail: notifyBuyer ? buyerEmail.trim() : '',
              notifyBuyer,
            });
      setSession(result.session);
      setTxSignature(result.signature);
    } catch (err) {
      setError(describeWalletError(err));
    } finally {
      setAction(null);
    }
  }

  async function handleRefund() {
    if (!session || !publicKey) return;
    setAction('refund');
    setError('');
    try {
      const result = await refundEscrow({
        connection,
        publicKey,
        sendTransaction,
        session,
        token,
      });
      setSession(result.session);
      setTxSignature(result.signature);
    } catch (err) {
      setError(describeWalletError(err));
    } finally {
      setAction(null);
    }
  }

  async function handleConfirm() {
    if (!session) return;
    setAction('confirm');
    setError('');
    try {
      const data = await confirmReceipt(session.id, token);
      setSession(data.session);
    } catch (err) {
      setError(err.message);
    } finally {
      setAction(null);
    }
  }

  async function handleRequote() {
    if (!session) return;
    setAction('requote');
    setError('');
    try {
      const data = await requoteSession(session.id, token);
      setSession(data.session);
    } catch (err) {
      setError(err.message);
    } finally {
      setAction(null);
    }
  }

  function closeWindow() {
    notifyParent('escrowpay:close');
    if (typeof window !== 'undefined') window.close();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0c10] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin text-[#14F195]" />
          Loading secure checkout…
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen bg-[#0b0c10] text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full glass-panel rounded-3xl p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h1 className="text-lg font-bold">Checkout unavailable</h1>
          <p className="text-sm text-gray-400 break-words">{error}</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const settled = ['claimed', 'paid'].includes(session.status);
  const refunded = session.status === 'refunded';
  const funded = session.status === 'funded';
  const awaitingConfirmation =
    funded && session.channel === 'marketplace' && !session.buyerConfirmedAt;
  const receiptConfirmed = funded && Boolean(session.buyerConfirmedAt);
  const expired = session.status === 'expired';
  const signature =
    session.signatures?.funded ||
    session.signatures?.paid ||
    session.signatures?.refunded ||
    txSignature;

  return (
    <>
      <Head>
        <title>{`${session.product.name} · ${session.merchant.name}`}</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="min-h-screen bg-[#0b0c10] text-[#e0e2ec] flex items-start sm:items-center justify-center p-4 py-8">
        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#14F195]" />
              Powered by EscrowPay
            </span>
            {embedded && (
              <button
                onClick={closeWindow}
                className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white"
                aria-label="Close checkout"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="glass-panel rounded-3xl border border-[#23273a] overflow-hidden shadow-2xl">
            <div
              className="h-1.5 w-full"
              style={{ background: `linear-gradient(90deg, ${accent}, #14F195)` }}
            />
            <div className="p-6 space-y-5">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-widest text-gray-500">
                  {session.merchant.name}
                </p>
                <h1 className="text-xl font-black text-white leading-tight">
                  {session.product.name}
                </h1>
                {session.product.description && (
                  <p className="text-xs text-gray-400">{session.product.description}</p>
                )}
              </div>

              <div className="rounded-2xl bg-[#10121a] border border-[#1e2233] p-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-gray-400">Total</span>
                  <span className="text-lg font-bold text-white">
                    {session.pricing.display}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-gray-500">
                    ≈ settlement ({session.settlement.asset})
                  </span>
                  <span className="font-mono text-[#14F195]">
                    {session.settlement.display}
                  </span>
                </div>
                {session.product.quantity > 1 && (
                  <div className="flex items-baseline justify-between text-xs text-gray-500">
                    <span>Quantity</span>
                    <span>{session.product.quantity}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-[#1b1f30]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Quote {session.settlement.quoteExpired ? 'expired' : 'valid 15 min'}
                  </span>
                  <span className="font-mono">1 SOL = ${session.settlement.solUsd}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${
                    STATUS_STYLES[session.status] || STATUS_STYLES.open
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {statusLabel(session.status)}
                </span>
                <span className="text-[11px] text-gray-500 font-mono">
                  {shorten(session.id, 6)}
                </span>
              </div>

              {quoteExpired && ['open', 'prepared'].includes(session.status) && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p>The SOL quote expired. Refresh it before paying.</p>
                    <button
                      onClick={handleRequote}
                      disabled={action === 'requote'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-semibold"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${action === 'requote' ? 'animate-spin' : ''}`}
                      />
                      Refresh quote
                    </button>
                  </div>
                </div>
              )}

              {funded && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Funds are held in escrow
                  </p>
                  <p className="text-amber-200/80">
                    {awaitingConfirmation
                      ? 'Confirm your order below once it has arrived. The seller can only claim after you confirm — until then you can reclaim your payment.'
                      : receiptConfirmed
                        ? 'You confirmed receipt. The seller can claim the escrow now.'
                        : 'The merchant can settle after delivery. Until they do, you can reclaim your payment.'}
                  </p>
                </div>
              )}

              {settled && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-200 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Payment complete</p>
                    <p className="text-emerald-200/80">
                      {session.status === 'claimed'
                        ? 'The merchant settled this escrow. Thanks for your order.'
                        : 'Payment was sent directly to the merchant.'}
                    </p>
                  </div>
                </div>
              )}

              {refunded && (
                <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-3 text-xs text-purple-200 flex items-start gap-2">
                  <RotateCcw className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Payment refunded</p>
                    <p className="text-purple-200/80">
                      The escrow was closed and the wrapped SOL was returned to your wallet.
                    </p>
                  </div>
                </div>
              )}

              {expired && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200 flex items-start gap-2">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p>
                      This checkout link expired after one hour. Return to the store and
                      press “Pay with Crypto” again for a fresh quote.
                    </p>
                    {embedded && (
                      <button
                        onClick={closeWindow}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 font-semibold"
                      >
                        Start a new checkout
                      </button>
                    )}
                  </div>
                </div>
              )}

              {error && session && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-[11px] text-red-200 break-words">
                  {error}
                </div>
              )}

              {['open', 'prepared'].includes(session.status) && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 text-[11px] text-sky-100 space-y-1">
                    <p className="font-semibold">Devnet checkout</p>
                    <p className="text-sky-200/80">
                      Set your wallet to <strong>Solana Devnet</strong> (Settings → Developer
                      Settings → Change Network). Mainnet wallets fail transaction
                      simulation.
                    </p>
                    {devnetBalance !== null && (
                      <p className={devnetBalance < 20_000_000 ? 'text-amber-200' : 'text-sky-200/80'}>
                        Devnet balance: {(devnetBalance / 1_000_000_000).toFixed(4)} SOL
                        {devnetBalance < 20_000_000 &&
                          ' — airdrop devnet SOL before paying.'}
                      </p>
                    )}
                    <a
                      href="https://faucet.solana.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block underline"
                    >
                      Get devnet SOL
                    </a>
                  </div>
                  {!walletDetected && !connected && (
                    <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 text-[11px] text-sky-100 space-y-1">
                      <p className="font-semibold">No Solana wallet detected</p>
                      <p className="text-sky-200/80">
                        Install a Solana browser wallet such as Phantom, Solflare,
                        Backpack or Glow (or enable it in this browser), then connect
                        to pay with SOL.
                      </p>
                    </div>
                  )}
                  <div className="flex justify-center">
                    <WalletMultiButton className="!bg-[#1a1d2b] !border !border-[#2b3048] !text-white !font-semibold !text-xs !rounded-xl !h-10 !px-4" />
                  </div>
                  <div className="rounded-2xl border border-[#23273a] bg-[#0e1017] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-gray-300">
                        Email me order updates
                      </span>
                      <span className="text-[10px] text-gray-600">optional</span>
                    </div>
                    <input
                      type="email"
                      value={buyerEmail}
                      onChange={(e) => {
                        setBuyerEmail(e.target.value);
                        if (!e.target.value.trim()) setNotifyBuyer(false);
                      }}
                      placeholder="you@example.com"
                      className="w-full h-9 rounded-lg bg-[#141624] border border-[#23273a] px-3 text-xs text-white placeholder:text-gray-600"
                    />
                    <label className="flex items-center gap-2 text-[11px] text-gray-400">
                      <input
                        type="checkbox"
                        checked={notifyBuyer}
                        disabled={!buyerEmail.trim()}
                        onChange={(e) => setNotifyBuyer(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#14F195] disabled:opacity-40"
                      />
                      Send me a receipt and delivery updates
                    </label>
                  </div>
                  <button
                    onClick={handlePay}
                    disabled={!canPay || action === 'pay'}
                    className="w-full h-12 rounded-2xl font-bold text-sm text-[#0b0c12] disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.99] flex items-center justify-center gap-2"
                    style={{ background: `linear-gradient(90deg, ${accent}, #14F195)` }}
                  >
                    {action === 'pay' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Waiting for wallet…
                      </>
                    ) : session.mode === 'escrow' ? (
                      <>
                        <Lock className="w-4 h-4" />
                        Pay {session.settlement.display} into escrow
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="w-4 h-4" />
                        Pay {session.settlement.display} directly
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-center text-gray-500 leading-relaxed">
                    {session.mode === 'escrow'
                      ? 'Escrow rent (~0.004 SOL) is refunded when the escrow closes. You also need a small SOL balance for network fees.'
                      : 'The merchant receives the payment immediately. No escrow protection.'}
                  </p>
                </div>
              )}

              {awaitingConfirmation && (
                <button
                  onClick={handleConfirm}
                  disabled={action === 'confirm'}
                  className="w-full h-11 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {action === 'confirm' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Confirm receipt
                </button>
              )}

              {receiptConfirmed && (
                <p className="text-[11px] text-center text-emerald-300/80 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Receipt confirmed — the seller can now claim the payment
                </p>
              )}

              {funded && !receiptConfirmed && (
                <button
                  onClick={handleRefund}
                  disabled={!connected || action === 'refund'}
                  className="w-full h-11 rounded-2xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {action === 'refund' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  Reclaim payment (refund)
                </button>
              )}

              {signature && (
                <a
                  href={getExplorerUrl('tx', signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 hover:text-white"
                >
                  View transaction on Solana Explorer
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              )}

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-600">
                <ShieldCheck className="w-3 h-3" />
                Non-custodial · Devnet only · {shorten(session.merchant.payoutWallet, 5)}
              </div>
            </div>
          </div>

          {embedded && (
            <button
              onClick={closeWindow}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-300 py-2"
            >
              Return to store
            </button>
          )}
        </div>
      </div>
    </>
  );
}
