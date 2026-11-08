// Shared pure helpers for P2P payout details.
// Kept dependency-free so the same message the wallet signs is the message the API route verifies.

export const PAYOUT_DOMAIN = 'EscrowPay P2P payout profile';
export const LISTING_DOMAIN = 'EscrowPay P2P offer listing';

export const LISTING_LIMITS = {
  note: 300,
  symbol: 20,
};

export const PAYOUT_METHOD_KINDS = [
  { kind: 'bank', label: 'Bank transfer' },
  { kind: 'mobile', label: 'Mobile wallet' },
  { kind: 'app', label: 'Payment app' },
  { kind: 'crypto', label: 'Crypto address' },
  { kind: 'other', label: 'Other' },
];

export const PAYOUT_LIMITS = {
  displayName: 60,
  value: 120,
  note: 160,
  instructions: 600,
  methods: 6,
};

export function payoutKindLabel(kind) {
  return PAYOUT_METHOD_KINDS.find((entry) => entry.kind === kind)?.label || 'Other';
}

export async function sha256HexOf(value) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function buildPayoutMessage({ wallet, updatedAt, detailsHash, domain = PAYOUT_DOMAIN }) {
  return [
    domain,
    `Wallet: ${wallet}`,
    `Updated: ${updatedAt}`,
    `Details: ${detailsHash}`,
  ].join('\n');
}

export function parsePayoutMessage(message, domain = PAYOUT_DOMAIN) {
  const lines = String(message || '').split('\n');
  if (lines.length !== 4 || lines[0] !== domain) return null;
  if (!lines[1].startsWith('Wallet: ') || !lines[2].startsWith('Updated: ') || !lines[3].startsWith('Details: ')) {
    return null;
  }
  return {
    wallet: lines[1].slice('Wallet: '.length),
    updatedAt: lines[2].slice('Updated: '.length),
    detailsHash: lines[3].slice('Details: '.length),
  };
}

function cleanText(value, max, label) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length > max) {
    throw new Error(`${label} must be ${max} characters or fewer.`);
  }
  return text;
}

/**
 * Turn submitted payout details into the shape buyers are shown.
 * Throws with a buyer/seller-readable message when the input cannot be used.
 */
export function normalizePayoutProfile(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Payout details are missing.');
  }

  const displayName = cleanText(raw.displayName, PAYOUT_LIMITS.displayName, 'Display name');

  const methodsInput = Array.isArray(raw.methods) ? raw.methods : [];
  if (!methodsInput.length) {
    throw new Error('Add at least one way for the buyer to pay you.');
  }
  if (methodsInput.length > PAYOUT_LIMITS.methods) {
    throw new Error(`You can list at most ${PAYOUT_LIMITS.methods} payment methods.`);
  }

  const methods = methodsInput.map((method, index) => {
    const kind = PAYOUT_METHOD_KINDS.some((entry) => entry.kind === method?.kind) ? method.kind : 'other';
    const value = cleanText(method?.value, PAYOUT_LIMITS.value, `Payment method ${index + 1}`);
    if (!value) {
      throw new Error(`Payment method ${index + 1} needs its account, number or address.`);
    }
    const note = cleanText(method?.note, PAYOUT_LIMITS.note, `Note on payment method ${index + 1}`);
    return { kind, label: payoutKindLabel(kind), value, note: note || null };
  });

  const instructions = cleanText(raw.instructions, PAYOUT_LIMITS.instructions, 'Payment instructions');

  return {
    displayName: displayName || null,
    methods,
    instructions: instructions || null,
  };
}

/**
 * An offer settled off-chain: the seller names the token they hand over and how the buyer pays them.
 * Nothing is locked in a vault, so the payout details are part of the signed offer itself.
 */
export function normalizeListing(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Offer details are missing.');
  }

  const mint = cleanText(raw.mint, 64, 'Offered token');
  if (!mint) {
    throw new Error('Choose the token you are selling.');
  }

  const amount = cleanText(raw.amount, 30, 'Offered amount');
  if (!amount || !(Number(amount) > 0)) {
    throw new Error('The amount you offer must be greater than zero.');
  }

  const decimals = Number.isInteger(raw.decimals) && raw.decimals >= 0 && raw.decimals <= 12 ? raw.decimals : 9;
  const symbol = cleanText(raw.symbol, LISTING_LIMITS.symbol, 'Token name') || 'Token';
  const note = cleanText(raw.note, LISTING_LIMITS.note, 'Offer note');

  return {
    id: cleanText(raw.id, 40, 'Offer id'),
    mint,
    symbol,
    amount,
    decimals,
    note: note || null,
    payout: normalizePayoutProfile(raw.payout),
  };
}
