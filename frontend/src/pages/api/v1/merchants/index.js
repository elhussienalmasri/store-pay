import { PublicKey } from '@solana/web3.js';
import { ApiError, getClientIp, getAppOrigin, rateLimit, requireMethod, sendError } from '../../../../lib/server/api';
import { generateMerchantKeys, sha256Hex } from '../../../../lib/server/crypto';
import { insertMerchant, insertProduct } from '../../../../lib/server/store';
import { merchantOwnerView } from '../../../../lib/server/views';
import { isLikelyPublicKey, normalizeDomain } from '../../../../lib/widgetCore.mjs';

const PLANS = ['starter', 'growth', 'scale'];

function validatePayoutWallet(value) {
  if (!isLikelyPublicKey(value)) {
    throw new ApiError(400, 'Payout wallet must be a valid Solana address');
  }
  try {
    return new PublicKey(value).toBase58();
  } catch {
    throw new ApiError(400, 'Payout wallet must be a valid Solana address');
  }
}

function normalizeDomains(body) {
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

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
    rateLimit(`signup:${getClientIp(req)}`, 10, 60_000);

    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim();
    const plan = PLANS.includes(req.body?.plan) ? req.body.plan : 'starter';
    const domains = normalizeDomains(req.body || {});
    const payoutWallet = validatePayoutWallet(req.body?.payoutWallet);

    if (name.length < 2 || name.length > 80) {
      throw new ApiError(400, 'Store name must be between 2 and 80 characters');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, 'Enter a valid contact email');
    }

    const keys = generateMerchantKeys();
    const now = new Date().toISOString();
    const merchant = {
      id: `mch_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name,
      email,
      domains,
      payoutWallet,
      plan,
      publishableKey: keys.publishableKey,
      secretHash: await sha256Hex(keys.secretKey),
      webhookSecret: keys.webhookSecret,
      webhookUrl: '',
      config: {
        buttonText: 'Pay with crypto',
        accentColor: '#9945FF',
        mode: 'escrow',
        currency: 'USD',
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
      });
    } catch (err) {
      console.warn('[escrowpay] could not create sample product:', err.message);
    }

    res.status(201).json({
      merchant: merchantOwnerView(merchant),
      secretKey: keys.secretKey,
      docs: {
        widgetScript: `${getAppOrigin(req)}/widget/v1.js`,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
