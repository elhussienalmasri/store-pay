import { PublicKey } from '@solana/web3.js';
import { ApiError, sendError } from '../../../../lib/server/api';
import { requireMerchant } from '../../../../lib/server/auth';
import {
  listDeliveries,
  listProducts,
  listSessions,
  patchMerchant,
} from '../../../../lib/server/store';
import {
  merchantOwnerView,
  merchantStats,
  productView,
} from '../../../../lib/server/views';
import {
  isLikelyPublicKey,
  normalizeDomain,
  SUPPORTED_MODES,
} from '../../../../lib/widgetCore.mjs';

const PLANS = ['starter', 'growth', 'scale'];
const CONFIG_MODES = [...SUPPORTED_MODES, 'both'];

function sanitizeDomains(value) {
  const input = Array.isArray(value) ? value : [value];
  const domains = [...new Set(input.map(normalizeDomain).filter(Boolean))];
  if (domains.length === 0) {
    throw new ApiError(400, 'At least one storefront domain is required');
  }
  for (const domain of domains) {
    if (!/^[a-z0-9.-]+$/.test(domain)) {
      throw new ApiError(400, `Invalid domain: ${domain}`);
    }
  }
  return domains;
}

function sanitizeConfig(input) {
  if (!input || typeof input !== 'object') return null;
  const config = {};
  if (typeof input.buttonText === 'string') {
    const text = input.buttonText.trim();
    if (text.length < 1 || text.length > 40) {
      throw new ApiError(400, 'Button text must be between 1 and 40 characters');
    }
    config.buttonText = text;
  }
  if (typeof input.accentColor === 'string') {
    if (!/^#[0-9a-fA-F]{6}$/.test(input.accentColor)) {
      throw new ApiError(400, 'Accent color must be a hex value like #9945FF');
    }
    config.accentColor = input.accentColor.toUpperCase();
  }
  if (typeof input.mode === 'string') {
    if (!CONFIG_MODES.includes(input.mode)) {
      throw new ApiError(400, `Mode must be one of: ${CONFIG_MODES.join(', ')}`);
    }
    config.mode = input.mode;
  }
  return config;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const merchant = await requireMerchant(req);

    if (req.method === 'GET') {
      const [products, sessions, deliveries] = await Promise.all([
        listProducts(merchant.id),
        listSessions(merchant.id),
        listDeliveries(merchant.id, 10),
      ]);

      return res.status(200).json({
        merchant: merchantOwnerView(merchant),
        products: products.map(productView),
        stats: merchantStats(sessions),
        deliveries,
      });
    }

    const patch = {};
    if (typeof req.body?.name === 'string') {
      const name = req.body.name.trim();
      if (name.length < 2 || name.length > 80) {
        throw new ApiError(400, 'Store name must be between 2 and 80 characters');
      }
      patch.name = name;
    }
    if (typeof req.body?.email === 'string') {
      const email = req.body.email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ApiError(400, 'Enter a valid contact email');
      }
      patch.email = email;
    }
    if (req.body?.domains !== undefined || req.body?.domain !== undefined) {
      patch.domains = sanitizeDomains(req.body.domains ?? req.body.domain);
    }
    if (req.body?.payoutWallet !== undefined) {
      if (!isLikelyPublicKey(req.body.payoutWallet)) {
        throw new ApiError(400, 'Payout wallet must be a valid Solana address');
      }
      patch.payoutWallet = new PublicKey(req.body.payoutWallet).toBase58();
    }
    if (req.body?.plan !== undefined) {
      if (!PLANS.includes(req.body.plan)) {
        throw new ApiError(400, 'Unknown plan');
      }
      patch.plan = req.body.plan;
    }
    if (req.body?.webhookUrl !== undefined) {
      const value = String(req.body.webhookUrl || '').trim();
      if (value) {
        try {
          const url = new URL(value);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad protocol');
        } catch {
          throw new ApiError(400, 'Webhook URL must be a valid http(s) URL');
        }
      }
      patch.webhookUrl = value;
    }
    if (req.body?.config !== undefined) {
      const config = sanitizeConfig(req.body.config);
      if (config) patch.config = config;
    }

    if (Object.keys(patch).length === 0) {
      throw new ApiError(400, 'No supported fields to update');
    }

    const updated = await patchMerchant(merchant.id, patch);
    return res.status(200).json({ merchant: merchantOwnerView(updated) });
  } catch (err) {
    sendError(res, err);
  }
}
