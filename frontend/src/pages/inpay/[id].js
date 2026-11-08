import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, ShieldCheck, Wallet, Zap } from 'lucide-react';
import { findMerchantByPublishableKey } from '../../lib/server/store';
import { normalizeDomain } from '../../lib/widgetCore.mjs';

const SIGN_AND_SEND = 'solana:signAndSendTransaction';
const CHAIN = 'solana:devnet';

function encodeBase58(value) {
  const bytes = value instanceof Uint8Array ? value : Uint8Array.from(value);
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits = [];
  for (let index = zeros; index < bytes.length; index += 1) {
    let carry = bytes[index];
    for (let digit = 0; digit < digits.length; digit += 1) {
      carry += digits[digit] << 8;
      digits[digit] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  return alphabet[0].repeat(zeros) + digits.reverse().map((digit) => alphabet[digit]).join('');
}

function readAccount(value) {
  if (!value) return null;
  if (typeof value === 'string') return { address: value, key: value };
  if (typeof value.toBase58 === 'function') {
    const address = value.toBase58();
    return { address, key: typeof value.toBytes === 'function' ? value.toBytes() : address };
  }
  if (typeof value.address === 'string' && value.address) {
    return { address: value.address, key: value };
  }
  try {
    const bytes = value instanceof Uint8Array ? value : Uint8Array.from(value);
    return bytes.length === 32 ? { address: encodeBase58(bytes), key: bytes } : null;
  } catch {
    return null;
  }
}

function decodeBase64(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function discoverWallets() {
  const found = new Map();
  const remember = (wallet) => {
    if (!wallet?.name) return;
    const raw = wallet.features?.[SIGN_AND_SEND];
    const signAndSend = typeof raw === 'function' ? raw : raw?.signAndSendTransaction;
    if (typeof signAndSend !== 'function') return;
    found.set(wallet.name, {
      wallet,
      feature: {
        ...(typeof raw === 'function' ? {} : raw),
        signAndSendTransaction: (input) => signAndSend({
          ...input,
          transaction: typeof input.transaction === 'string' ? decodeBase64(input.transaction) : input.transaction,
        }),
      },
    });
  };
  try {
    window.dispatchEvent(new CustomEvent('walletStandard:get', {
      detail: { register: (...wallets) => { wallets.forEach(remember); return () => {}; } },
    }));
    navigator.wallets?.forEach?.(remember);
  } catch {
    // Wallet extensions may expose only the legacy provider.
  }
  const legacy = window.phantom?.solana || window.solana;
  if (typeof legacy?.signAndSendTransaction === 'function') {
    found.set('Phantom', {
      wallet: { name: 'Phantom', accounts: [] },
      feature: {
        signAndSendTransaction: async (input) => {
          const { Transaction, VersionedTransaction } = await import('@solana/web3.js');
          const bytes = Uint8Array.from(atob(input.transaction), (character) => character.charCodeAt(0));
          const decoded = input.legacy ? Transaction.from(bytes) : new VersionedTransaction(bytes);
          const result = await legacy.signAndSendTransaction(decoded);
          return { signature: typeof result === 'string' ? result : result.signature };
        },
      },
      legacy,
    });
  }
  return [...found.values()];
}

function supportsVersion(feature, version) {
  const versions = feature.supportedTransactionVersions;
  if (!versions) return true;
  return typeof versions.has === 'function' ? versions.has(version) : versions.includes?.(version) ?? true;
}

function isRejection(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return error?.code === 4001 || /reject|cancel|denied/.test(message);
}

async function connectWallet(selected) {
  if (selected.legacy) {
    const result = await selected.legacy.connect();
    const account = readAccount(result?.publicKey || selected.legacy.publicKey);
    if (!account) throw new Error('Your wallet did not share an account. Unlock it and try again.');
    return account;
  }
  const existing = (selected.wallet.accounts || []).map(readAccount).find(Boolean);
  if (existing) return existing;
  const signIn = selected.wallet.features?.['solana:signIn'];
  if (signIn) {
    try {
      const result = await signIn.signIn({ scopes: ['account:address'], chain: CHAIN });
      const account = readAccount(result?.account || result?.address);
      if (account) return account;
    } catch (error) {
      if (isRejection(error)) throw error;
    }
  }
  throw new Error(`Unlock ${selected.wallet.name} and try again.`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function InlineWidget({ escrowId, merchant }) {
  // Kept as a DOM-only suffix so separately embedded frames never reuse a select id.
  const widgetId = escrowId;
  const [wallets, setWallets] = useState([]);
  const [walletName, setWalletName] = useState('');
  const walletNameRef = useRef('');
  const [address, setAddress] = useState('');
  const [checkout, setCheckout] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [paidSession, setPaidSession] = useState(null);
  const current = useRef(null);
  const run = useRef(null);
  const retry = useRef(null);
  const mounted = useRef(true);
  const serial = useRef(0);
  const root = useRef(null);
  const accent = /^#[0-9a-f]{6}$/i.test(merchant.accentColor || '') ? merchant.accentColor : '#9945FF';

  useEffect(() => {
    walletNameRef.current = walletName;
  }, [walletName]);

  function emit(name, detail) {
    const event = { escrowId, ...detail };
    window.dispatchEvent(new CustomEvent(`escrowpay:${name}`, { detail: event }));
    if (window.parent !== window) window.parent.postMessage({ type: 'escrowpay:event', escrowId, name: `escrowpay:${name}`, detail: event }, '*');
  }

  function postSize() {
    if (window.parent === window || !root.current) return;
    window.parent.postMessage({ type: 'escrowpay:resize', escrowId, height: Math.ceil(root.current.getBoundingClientRect().height) }, '*');
  }

  useEffect(() => {
    const frame = requestAnimationFrame(postSize);
    return () => cancelAnimationFrame(frame);
  });

  function reset() {
    run.current?.abort();
    run.current = null;
    retry.current = null;
    current.current = null;
    serial.current += 1;
    setCheckout(null);
    setAddress('');
    setPaidSession(null);
    setStatus('idle');
    setMessage('');
    emit('reset', {});
  }

  useEffect(() => {
    mounted.current = true;
    const scan = () => {
      if (!mounted.current) return;
      const available = discoverWallets();
      setWallets(available);
      setWalletName((previous) => {
        const next = previous || available.find((entry) => entry.wallet.accounts?.length)?.wallet.name || available[0]?.wallet.name || '';
        walletNameRef.current = next;
        return next;
      });
    };
    scan();
    const timers = [setTimeout(scan, 250), setTimeout(scan, 1000)];
    window.addEventListener('wallet-standard:register-wallet', scan);
    window.addEventListener('focus', scan);

    async function receiveOrder(event) {
      const order = event.detail;
      if (!order || ((order.escrowId || order.widgetId) && (order.escrowId || order.widgetId) !== escrowId)) return;
      const amountMinor = Number(order.amountMinor);
      const reference = String(order.reference || '').trim();
      const currency = String(order.currency || 'USD').toUpperCase();
      const description = String(order.description || 'Payment');
      const attempt = ++serial.current;
      try {
        if (!reference || reference.length > 120 || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > 100000000 || !['USD', 'EUR'].includes(currency)) {
          throw new Error('The order details are incomplete. Refresh the checkout and try again.');
        }
        const selected = discoverWallets().find((entry) => entry.wallet.name === walletNameRef.current);
        if (!selected) throw new Error('No Solana wallet was found. Install Phantom or Solflare, then reload this page.');
        setStatus('connecting');
        setMessage(`Connect ${selected.wallet.name} to continue.`);
        const account = await connectWallet(selected);
        if (attempt !== serial.current) return;
        current.current = { ...selected, account };
        setAddress(account.address);
        emit('wallet-connected', { address: account.address, wallet: selected.wallet.name });
        setStatus('preparing');
        setMessage('Preparing your secure payment…');
        const controller = new AbortController();
        run.current = controller;
        const timeout = setTimeout(() => controller.abort(), 20000);
        let response;
        let data;
        try {
          response = await fetch(`/api/inpay/${encodeURIComponent(escrowId)}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ buyer: account.address, amountMinor, reference, currency, description }),
            signal: controller.signal,
          });
          data = await response.json();
        } finally {
          clearTimeout(timeout);
        }
        if (!response.ok) throw new Error(data.error || 'The payment could not be prepared.');
        const payment = { ...data.session, order: { amountMinor, reference, currency } };
        const preparedResponse = await fetch('/api/v1/inpay/transaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: payment.id, token: payment.token }),
          signal: controller.signal,
        });
        const prepared = await preparedResponse.json();
        if (!preparedResponse.ok) throw new Error(prepared.error || 'The payment could not be prepared.');
        if (attempt !== serial.current) return;
        setCheckout({ ...payment, ...prepared });
        retry.current = null;
        setStatus('review');
        setMessage('Opening your wallet for approval…');
        emit('ready', { session: { id: payment.id }, reference });
        await approve({ ...payment, ...prepared });
      } catch (error) {
        if (attempt !== serial.current) return;
        const text = isRejection(error) ? 'Wallet connection was cancelled. Nothing was paid.' : error.name === 'AbortError' ? 'The payment service took too long to answer. Try again.' : error.message || 'The payment could not be started.';
        setStatus('error');
        setMessage(text);
        emit('error', { message: text });
      }
    }

    window.addEventListener('escrowpay:pay', receiveOrder);
    function requestOrder(event) {
      if (event.source !== window.parent || event.data?.type !== 'escrowpay:pay' || ((event.data.escrowId || event.data.widgetId) && (event.data.escrowId || event.data.widgetId) !== escrowId)) return;
      receiveOrder({ detail: event.data.order });
    }
    window.addEventListener('message', requestOrder);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(postSize) : null;
    if (root.current) observer?.observe(root.current);
    emit('ready', {});
    return () => {
      mounted.current = false;
      serial.current += 1;
      run.current?.abort();
      observer?.disconnect();
      timers.forEach(clearTimeout);
      window.removeEventListener('wallet-standard:register-wallet', scan);
      window.removeEventListener('focus', scan);
      window.removeEventListener('escrowpay:pay', receiveOrder);
      window.removeEventListener('message', requestOrder);
    };
  }, [escrowId]);

  async function verify(payment, signature, { automatic = false } = {}) {
    const controller = new AbortController();
    run.current = controller;
    const timeout = setTimeout(() => controller.abort(), automatic ? 90_000 : 20_000);
    setStatus('confirming');
    setMessage('Checking your payment on Solana…');
    try {
      for (let attempt = 0; attempt < (automatic ? 40 : 1); attempt += 1) {
        if (attempt > 0) await delay(1500);
        if (!mounted.current || controller.signal.aborted) return;
        const response = await fetch(`/api/v1/sessions/${encodeURIComponent(payment.id)}/funded`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: payment.token, signature }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok && data.session?.status === 'funded' && data.session.signatures?.funded === signature) {
          const fundedSession = { ...data.session, token: payment.token };
          setPaidSession(fundedSession);
          setStatus('paid');
          setMessage('Your payment is safely in escrow.');
          retry.current = null;
          emit('paid', { session: fundedSession, reference: payment.order.reference, signature });
          return;
        }
        if (!automatic && response.status !== 400) throw new Error(data.error || 'The payment could not be confirmed.');
        if (attempt === (automatic ? 39 : 0)) throw new Error('Your transaction was sent, but confirmation is still pending. Check payment again before paying a second time.');
      }
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      const text = error.name === 'AbortError' ? 'Confirmation took too long. Check payment again before paying a second time.' : error.message;
      retry.current = { payment, signature };
      setStatus('error');
      setMessage(text);
      emit('error', { message: text });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function approve(payment = checkout) {
    if (!payment || !current.current || status === 'paying') return;
    const attempt = serial.current;
    const { feature, account, wallet } = current.current;
    const transaction = supportsVersion(feature, 'legacy') && payment.transaction ? payment.transaction : payment.transactionV0;
    if (!transaction) {
      setMessage(`${wallet.name} cannot sign this payment. Try another Solana wallet.`);
      setStatus('error');
      return;
    }
    setStatus('paying');
    setMessage(`Approve ${payment.settlement.display} in ${wallet.name}.`);
    try {
      const result = await feature.signAndSendTransaction({
        transaction,
        account: account.key,
        chain: CHAIN,
        legacy: transaction === payment.transaction,
      });
      if (attempt !== serial.current) return;
      const returnedSignature = result?.signature || (typeof result === 'string' ? result : null);
      if (!returnedSignature?.length) throw new Error('Your wallet did not return a transaction signature.');
      const signature = typeof returnedSignature === 'string' ? returnedSignature : encodeBase58(returnedSignature);
      retry.current = { payment, signature };
      emit('submitted', { signature, reference: payment.order.reference });
      await verify(payment, signature, { automatic: true });
    } catch (error) {
      if (attempt !== serial.current) return;
      const text = isRejection(error) ? 'Payment cancelled. No transaction was sent.' : error.message || 'Your wallet could not send the payment.';
      setStatus(retry.current ? 'error' : 'review');
      setMessage(text);
      emit('error', { message: text });
    }
  }

  async function checkPayment() {
    if (!retry.current || status === 'confirming') return;
    await verify(retry.current.payment, retry.current.signature);
  }

  const working = ['connecting', 'preparing', 'paying', 'confirming'].includes(status);
  const busy = working || status === 'review' || Boolean(retry.current);

  return (
    <section ref={root} className="ep-widget" aria-label="EscrowPay inline checkout" style={{ '--ep-accent': accent }} data-state={status}>
      <style dangerouslySetInnerHTML={{ __html: `
        .ep-widget{box-sizing:border-box;width:100%;max-width:460px;color-scheme:dark;font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#eff1fb;background:linear-gradient(145deg,#1c1630 0%,#101724 55%,#0c2527 100%);border:1px solid #414262;border-radius:22px;padding:20px;box-shadow:0 18px 50px #06081030;overflow:hidden}
        .ep-widget *,.ep-widget *::before,.ep-widget *::after{box-sizing:border-box}.ep-widget button{font:inherit;cursor:pointer}.ep-widget button:disabled{cursor:not-allowed;opacity:.5}.ep-widget button:focus-visible{outline:3px solid #bfb3ff;outline-offset:3px}.ep-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.ep-brand{display:flex;align-items:center;gap:10px}.ep-logo{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:linear-gradient(140deg,var(--ep-accent),#4e8eff);color:white;box-shadow:0 0 22px #9945ff40}.ep-brand strong{display:block;font-size:14px;letter-spacing:-.02em}.ep-brand small{display:block;color:#acb1c9;font-size:11px}.ep-network{display:flex;align-items:center;gap:5px;color:#8cecc8;background:#113b35;border:1px solid #28705d;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:700;white-space:nowrap}.ep-dot{height:5px;width:5px;border-radius:50%;background:#14f195;box-shadow:0 0 8px #14f19588}.ep-title{margin:20px 0 4px;font-size:22px;line-height:1.25;letter-spacing:-.045em;font-weight:760}.ep-copy{margin:0;color:#b5bad0;font-size:12px}.ep-wallet{margin-top:17px;display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid #444762;border-radius:12px;background:#121827}.ep-wallet svg{color:#bca9ff;flex-shrink:0}.ep-wallet label{display:block;color:#9ea6c2;font-size:10px;line-height:1.3}.ep-wallet select{appearance:auto;display:block;width:100%;border:0;background:#121827;color:#eff1fb;padding:2px 0;font:600 12px/1.5 inherit;outline-offset:3px}.ep-wallet code{display:block;font:11px/1.5 ui-monospace,monospace;color:#d5cef5;overflow-wrap:anywhere}.ep-empty{margin-top:16px;padding:12px;border:1px solid #615333;border-radius:12px;background:#302819;color:#f1d6a0;font-size:12px}.ep-amount{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:17px 0;padding:16px;border-radius:14px;border:1px solid #49517a;background:linear-gradient(115deg,#242044,#132c3c)}.ep-amount small{display:block;color:#b8b9d2;font-size:10px;text-transform:uppercase;letter-spacing:.1em}.ep-amount strong{display:block;margin-top:3px;font-size:25px;line-height:1.2;letter-spacing:-.05em}.ep-amount span{color:#b8f8dc;font-size:12px;white-space:nowrap}.ep-action{width:100%;min-height:44px;border:1px solid #ae8bff;border-radius:12px;background:linear-gradient(105deg,var(--ep-accent),#457ef0 56%,#1bc99e);color:#fff;font-weight:750!important;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;text-shadow:0 1px 2px #10102155;transition:filter .18s,transform .18s}.ep-action:hover:not(:disabled){filter:brightness(1.12);transform:translateY(-1px)}.ep-secondary{background:#192538;border-color:#52627b;color:#dae9fc;text-shadow:none}.ep-status{display:flex;align-items:flex-start;gap:8px;margin:12px 0 0;font-size:12px;color:#c7cbe0;min-height:18px}.ep-status[data-tone="error"]{color:#ffc1c8}.ep-status[data-tone="paid"]{color:#a1f3ce}.ep-spin{animation:ep-spin .8s linear infinite;flex-shrink:0;margin-top:2px}.ep-foot{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:15px;padding-top:12px;border-top:1px solid #ffffff12;color:#9ea8c3;font-size:10px}.ep-success{display:grid;place-items:center;width:52px;height:52px;margin:22px auto 13px;border-radius:18px;color:#a2f8d1;background:linear-gradient(135deg,#145949,#164555);border:1px solid #368d73;box-shadow:0 0 32px #14f1951a}.ep-widget[data-state="paid"] .ep-title,.ep-widget[data-state="paid"] .ep-copy{text-align:center}.ep-widget ::-webkit-scrollbar{width:6px;height:6px}.ep-widget ::-webkit-scrollbar-track{background:#121827}.ep-widget ::-webkit-scrollbar-thumb{background:#6e609e;border-radius:6px}@keyframes ep-spin{to{transform:rotate(360deg)}}@media(max-width:360px){.ep-widget{padding:16px;border-radius:18px}.ep-title{font-size:20px}.ep-network{font-size:9px;padding:4px 6px}.ep-amount{padding:13px}.ep-amount strong{font-size:22px}}@media(prefers-reduced-motion:reduce){.ep-widget *{animation:none!important;transition:none!important}}
      ` }} />
      <div className="ep-head">
        <div className="ep-brand"><span className="ep-logo"><Zap size={18} strokeWidth={2.4} /></span><div><strong>{merchant.name}</strong><small>Powered by EscrowPay</small></div></div>
        <span className="ep-network"><span className="ep-dot" />Solana Devnet</span>
      </div>
      {paidSession ? <>
        <div className="ep-success"><Check size={27} strokeWidth={2.5} /></div>
        <h2 className="ep-title">Payment received</h2>
        <p className="ep-copy">Your payment is safely held in escrow.</p>
        <div className="ep-amount"><div><small>Amount received</small><strong>{paidSession.settlement.display}</strong></div><span>{paidSession.pricing.display}</span></div>
      </> : <>
        <h2 className="ep-title">{checkout ? 'One approval. Safely held.' : 'Pay without leaving.'}</h2>
        <p className="ep-copy">{checkout ? 'Your payment stays in escrow until the seller claims it.' : 'Connect a Solana wallet to pay securely on this page.'}</p>
        {wallets.length > 0 ? <div className="ep-wallet"><Wallet size={19} /><div style={{ minWidth: 0, flex: 1 }}>{address ? <><label>Connected wallet</label><code>{address.slice(0, 6)}…{address.slice(-6)}</code></> : <><label htmlFor={`ep-wallet-${widgetId}`}>Pay with</label><select id={`ep-wallet-${widgetId}`} aria-label="Payment wallet" value={walletName} disabled={busy} onChange={(event) => setWalletName(event.target.value)}>{wallets.map(({ wallet }) => <option key={wallet.name} value={wallet.name}>{wallet.name}</option>)}</select></>}</div>{!address && <button type="button" onClick={() => { const available = discoverWallets(); setWallets(available); setMessage(available.length ? 'Wallet list refreshed.' : 'No wallet detected. Unlock your wallet and refresh again.'); }} className="ep-secondary" style={{ border: '1px solid #52627b', borderRadius: 8, padding: '5px 8px', fontSize: 10 }}>Refresh</button>}</div> : <div className="ep-empty">No Solana wallet detected. Install Phantom or Solflare, then reload this page.</div>}
        {checkout && <div className="ep-amount"><div><small>You pay</small><strong>{checkout.settlement.display}</strong></div><span>{checkout.order.currency === 'EUR' ? '€' : '$'}{(checkout.order.amountMinor / 100).toFixed(2)}</span></div>}
        {retry.current && status !== 'paid' ? <button type="button" className="ep-action ep-secondary" onClick={checkPayment} disabled={working}><ShieldCheck size={16} />Check payment</button> : checkout ? <button type="button" className="ep-action" onClick={approve} disabled={working}>{working ? <Loader2 size={16} className="ep-spin" /> : <Wallet size={16} />}{status === 'paying' ? 'Waiting for wallet…' : status === 'confirming' ? 'Confirming payment…' : `Pay ${checkout.settlement.display}`}</button> : null}
        {retry.current && <button type="button" onClick={reset} disabled={working} style={{ border: 0, background: 'transparent', color: '#b6bdd3', fontSize: 11, marginTop: 10, padding: 0, textDecoration: 'underline' }}>Start a new payment</button>}
      </>}
      <p className="ep-status" role="status" aria-live="polite" data-tone={status === 'error' ? 'error' : status === 'paid' ? 'paid' : 'info'}>{working && <Loader2 size={13} className="ep-spin" />}{message || (wallets.length ? 'Your wallet asks before any payment is sent.' : '')}</p>
      <div className="ep-foot"><ShieldCheck size={12} />Non-custodial escrow · No checkout popup</div>
    </section>
  );
}

export async function getServerSideProps({ params, res }) {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(params.id || '')) return { notFound: true };
  const merchant = await findMerchantByPublishableKey(params.id);
  if (!merchant) return { notFound: true };
  const ancestors = ["'self'", 'http://localhost:*', 'http://127.0.0.1:*'];
  for (const domain of (merchant.domains || []).map(normalizeDomain).filter(Boolean)) {
    ancestors.push(`https://${domain}`, `http://${domain}`);
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', `frame-ancestors ${ancestors.join(' ')}`);
  return {
    props: {
      escrowId: params.id,
      merchant: { name: merchant.name, accentColor: merchant.config?.accentColor || '#9945FF' },
    },
  };
}
