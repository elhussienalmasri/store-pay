import { PublicKey } from '@solana/web3.js';
import { ApiError } from './api';
import { generateMerchantKeys, sha256Hex } from './crypto';
import { insertMerchant, insertProduct } from './store';
import { isLikelyPublicKey, normalizeDomain } from '../widgetCore.mjs';

export const MERCHANT_PLANS = ['starter', 'growth', 'scale'];

export function normalizePayoutWallet(value) {
  if (!isLikelyPublicKey(value)) {
    throw new ApiError(400, 'Payout wallet must be a valid Solana address');
  }
  try {
    return new PublicKey(value).toBase58();
  } catch {
    throw new ApiError(400, 'Payout wallet must be a valid Solana address');
  }
}

export function normalizeMerchantName(value) {
  const name = String(value || '').trim();
  if (name.length < 2 || name.length > 80) {
    throw new ApiError(400, 'Store name must be between 2 and 80 characters');
  }
  return name;
}

export function normalizeMerchantEmail(value) {
  const email = String(value || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'Enter a valid contact email');
  }
  return email;
}

export function normalizeDomains(body) {
  const input = Array.isArray(body.domains)
    ? body.domains
    : body.domain
    ? [body.domain]
    : [];
  const domains = [...new Set(input.map(normalizeDomain).filter(Boolean))];
  if (domains.length === 0) {
    throw new ApiError(400, 'Add the website domain where the widget will be embedded');
  }
  if (domains.length > 10) {
    throw new ApiError(400, 'A store can register up to 10 domains');
  }
  for (const domain of domains) {
    if (!/^[a-z0-9.-]+$/.test(domain)) {
      throw new ApiError(400, `Invalid domain: ${domain}`);
    }
  }
  return domains;
}

export async function createMerchant({
  name,
  email,
  domains,
  payoutWallet,
  plan,
  passwordHash = null,
}) {
  const keys = generateMerchantKeys();
  const now = new Date().toISOString();
  const merchant = {
    id: `mch_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name,
    email,
    notificationEmail: '',
    domains,
    payoutWallet,
    plan: MERCHANT_PLANS.includes(plan) ? plan : 'starter',
    publishableKey: keys.publishableKey,
    secretHash: await sha256Hex(keys.secretKey),
    passwordHash,
    webhookSecret: keys.webhookSecret,
    webhookUrl: '',
    config: {
      buttonText: 'Pay with crypto',
      accentColor: '#9945FF',
      mode: 'escrow',
      currency: 'USD',
      emailNotifications: false,
      createdAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };

  await insertMerchant(merchant);

  try {
    await insertProduct({
      merchantId: merchant.id,
      name: 'Sample product',
      description: 'Try the escrow-protected checkout with this sample item.',
      priceMinor: 1000,
      currency: 'USD',
      active: true,
      listed: false,
    });
  } catch (err) {
    console.warn('[escrowpay] could not create sample product:', err.message);
  }

  return { merchant, secretKey: keys.secretKey };
}
