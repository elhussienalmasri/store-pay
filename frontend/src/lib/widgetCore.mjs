// Shared pure helpers for the merchant widget feature.
// Kept dependency-free so it can run in the browser, in API routes, and in node:test.

export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
export const WSOL_DECIMALS = 9;
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const USDC_DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export const SUPPORTED_PRICING_CURRENCIES = ['USD', 'EUR'];
export const SUPPORTED_MODES = ['escrow', 'direct'];

export const DEFAULT_SOL_USD = 95.5;
export const DEFAULT_EUR_USD_RATE = 1.08;

// The deployed swap program escrows token A and asks for token B in return.
// For a merchant payment we use the buyer as the maker (they fund the vault)
// and the merchant as the taker. A 1-base-unit "receive" keeps that path valid,
// so the deposit is the quoted amount plus one lamport.
export const ESCROW_RECEIVE_BASE_UNITS = 1n;
export const ESCROW_OFFSET_LAMPORTS = 1n;

export const QUOTE_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS = 60 * 60 * 1000;

export const SESSION_STATUSES = [
  'open',
  'prepared',
  'funded',
  'claimed',
  'refunded',
  'paid',
  'expired',
];

export function normalizeDomain(input) {
  if (!input) return '';
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split(':')[0];
}

export function isOriginAllowed(origin, domains) {
  if (!origin) return true; // server-to-server calls have no browser Origin
  let hostname;
  try {
    hostname = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true;
  }
  const allowed = (domains || []).map(normalizeDomain).filter(Boolean);
  return allowed.includes(hostname);
}

export function parsePriceToMinor(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export function formatFiatMinor(minor, currency = 'USD') {
  const amount = Number(minor) / 100;
  return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
}

export function formatSol(lamports) {
  const value = BigInt(lamports);
  const whole = value / BigInt(LAMPORTS_PER_SOL);
  const fraction = value % BigInt(LAMPORTS_PER_SOL);
  if (fraction === 0n) return whole.toString();
  const fractionStr = fraction
    .toString()
    .padStart(9, '0')
    .replace(/0+$/, '');
  return `${whole}.${fractionStr}`;
}

/**
 * Convert a merchant price into a SOL settlement amount.
 * Fiat prices are integers in minor units (cents). SOL is quoted in USD.
 */
export function quoteSettlement({
  priceMinor,
  quantity = 1,
  currency = 'USD',
  eurUsdRate = DEFAULT_EUR_USD_RATE,
  solUsd = DEFAULT_SOL_USD,
}) {
  if (!Number.isFinite(Number(priceMinor)) || Number(priceMinor) <= 0) {
    throw new Error('Price must be greater than zero');
  }
  if (!SUPPORTED_PRICING_CURRENCIES.includes(currency)) {
    throw new Error(`Unsupported pricing currency: ${currency}`);
  }
  if (!Number.isFinite(Number(solUsd)) || Number(solUsd) <= 0) {
    throw new Error('Invalid SOL/USD quote');
  }

  const subtotalMinor = Math.round(Number(priceMinor) * Number(quantity));
  const usdCents =
    currency === 'EUR' ? Math.round(subtotalMinor * Number(eurUsdRate)) : subtotalMinor;
  const settlementLamports = Math.max(
    1,
    Math.round((usdCents * 10_000_000) / Number(solUsd))
  );

  return {
    subtotalMinor,
    usdCents,
    settlementLamports: String(settlementLamports),
    currency,
    quantity: Number(quantity),
    eurUsdRate: Number(eurUsdRate),
    solUsd: Number(solUsd),
  };
}

export function escrowDepositLamports(settlementLamports) {
  return BigInt(settlementLamports) + ESCROW_OFFSET_LAMPORTS;
}

export function isQuoteExpired(quoteExpiresAt, now = Date.now()) {
  return !quoteExpiresAt || new Date(quoteExpiresAt).getTime() <= now;
}

export function isSessionExpired(expiresAt, now = Date.now()) {
  return !expiresAt || new Date(expiresAt).getTime() <= now;
}

export function effectiveSessionStatus(session, now = Date.now()) {
  if (!session) return 'open';
  if (
    (session.status === 'open' || session.status === 'prepared') &&
    isSessionExpired(session.expiresAt, now)
  ) {
    return 'expired';
  }
  return session.status;
}

export function statusLabel(status) {
  switch (status) {
    case 'open':
      return 'Awaiting buyer';
    case 'prepared':
      return 'Wallet connected';
    case 'funded':
      return 'Funds in escrow';
    case 'claimed':
      return 'Settled';
    case 'refunded':
      return 'Refunded';
    case 'paid':
      return 'Paid';
    case 'expired':
      return 'Expired';
    default:
      return status || 'Unknown';
  }
}

export function maskKey(key) {
  if (!key) return '';
  if (key.length <= 12) return key;
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

export function isLikelyPublicKey(value) {
  return typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}

export function isUint64String(value) {
  if (value === null || value === undefined || value === '') return false;
  try {
    const parsed = BigInt(value);
    return parsed >= 0n && parsed <= 18446744073709551615n;
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildEmbedSnippet({
  appOrigin,
  publishableKey,
  productId,
  buttonText = 'Buy with crypto',
  quantity = 1,
  mode = 'escrow',
}) {
  return `<!-- EscrowPay merchant widget -->
<script src="${appOrigin}/widget/v1.js" async></script>
<button
  data-escrowpay
  data-public-key="${publishableKey}"
  data-product="${productId}"
  data-quantity="${quantity}"
  data-mode="${mode}"
>${escapeHtml(buttonText)}</button>`;
}

export function buildApiExample({ appOrigin, productId }) {
  return `curl -X POST ${appOrigin}/api/v1/sessions \\
  -H "Authorization: Bearer sk_live_your_secret" \\
  -H "Content-Type: application/json" \\
  -d '{"productId":"${productId}","quantity":1,"merchantOrderId":"ORDER-123"}'`;
}

export function shortAddress(address, size = 4) {
  if (!address) return '';
  return `${address.slice(0, size)}…${address.slice(-size)}`;
}
