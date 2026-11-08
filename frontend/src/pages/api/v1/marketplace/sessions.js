import {
  ApiError,
  getAppOrigin,
  getClientIp,
  rateLimit,
  requireMethod,
  sendError,
} from '../../../../lib/server/api';
import {
  randomSessionToken,
  randomUint64String,
  sha256Hex,
} from '../../../../lib/server/crypto';
import { getEurUsdRate, getSolUsd } from '../../../../lib/server/pricing';
import { insertSession, readDb } from '../../../../lib/server/store';
import { notifySeller } from '../../../../lib/server/notifications';
import { sessionPublicView } from '../../../../lib/server/views';
import {
  formatFiatMinor,
  quoteSettlement,
  QUOTE_TTL_MS,
  SESSION_TTL_MS,
  SUPPORTED_MODES,
} from '../../../../lib/widgetCore.mjs';

/**
 * Public marketplace checkout: creates an escrow/direct session for any
 * marketplace-listed product, without requiring the merchant's origin.
 */
export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
    rateLimit(`marketplace:${getClientIp(req)}`, 30, 60_000);

    const productId = String(req.body?.productId || '').trim();
    if (!productId) {
      throw new ApiError(400, 'productId is required');
    }

    const quantity = Number(req.body?.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new ApiError(400, 'Quantity must be a whole number between 1 and 100');
    }

    const db = await readDb();
    const product = db.products.find((item) => item.id === productId);
    if (!product || product.active === false || product.listed === false) {
      throw new ApiError(404, 'Item not found or is no longer available');
    }

    const merchant = db.merchants.find((item) => item.id === product.merchantId);
    if (!merchant) {
      throw new ApiError(404, 'Seller not found');
    }

    const configured = merchant.config?.mode || 'escrow';
    const allowed = configured === 'both' ? SUPPORTED_MODES : [configured];
    const requested = req.body?.mode || (configured === 'both' ? 'escrow' : configured);
    if (!SUPPORTED_MODES.includes(requested) || !allowed.includes(requested)) {
      throw new ApiError(400, 'This seller does not accept that payment mode');
    }

    const solUsd = await getSolUsd();
    const eurUsdRate = getEurUsdRate();
    const quote = quoteSettlement({
      priceMinor: product.priceMinor,
      quantity,
      currency: product.currency,
      eurUsdRate,
      solUsd,
    });

    const now = Date.now();
    const token = randomSessionToken();
    const session = {
      id: `ord_${randomSessionToken().slice(0, 20)}`,
      merchantId: merchant.id,
      productId: product.id,
      productName: product.name,
      productDescription: product.description || '',
      quantity: quote.quantity,
      unitPriceMinor: product.priceMinor,
      subtotalMinor: quote.subtotalMinor,
      currency: quote.currency,
      settlementLamports: quote.settlementLamports,
      solUsd: quote.solUsd,
      eurUsdRate: quote.eurUsdRate,
      quoteExpiresAt: new Date(now + QUOTE_TTL_MS).toISOString(),
      mode: requested,
      seed: randomUint64String(),
      tokenHash: await sha256Hex(token),
      status: 'open',
      buyer: null,
      escrowAddress: null,
      payoutWallet: merchant.payoutWallet,
      merchantOrderId: null,
      signatures: {},
      channel: 'marketplace',
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    };

    await insertSession(session);

    await notifySeller({
      merchant,
      session,
      kind: 'order.created',
      title: 'New marketplace order',
      body: `A buyer started checkout for ${quote.quantity} × ${product.name} (${formatFiatMinor(
        quote.subtotalMinor,
        quote.currency
      )}).`,
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({
      session: {
        ...sessionPublicView(session, merchant),
        token,
        checkoutUrl: `${getAppOrigin(req)}/checkout/${session.id}?t=${token}`,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
