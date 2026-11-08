import { PublicKey } from '@solana/web3.js';
import {
  ApiError,
  getAppOrigin,
  getClientIp,
  rateLimit,
  requireMethod,
  sendError,
} from '../../../../lib/server/api';
import { resolveMerchantFromRequest } from '../../../../lib/server/auth';
import {
  randomSessionToken,
  randomUint64String,
  sha256Hex,
} from '../../../../lib/server/crypto';
import { getEurUsdRate, getSolUsd } from '../../../../lib/server/pricing';
import { insertSession } from '../../../../lib/server/store';
import { notifySeller } from '../../../../lib/server/notifications';
import { deriveEscrowPda } from '../../../../lib/escrowProgram';
import {
  formatFiatMinor,
  isLikelyPublicKey,
  quoteSettlement,
  QUOTE_TTL_MS,
  SESSION_TTL_MS,
  SUPPORTED_PRICING_CURRENCIES,
} from '../../../../lib/widgetCore.mjs';

/**
 * InPay: inline/embedded session endpoint for server-side carts.
 * Creates an escrow session already bound to the buyer's wallet so the
 * merchant page can sign the funding transaction without a hosted checkout.
 * Server-to-server only (merchant secret key); escrow mode only.
 */
export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
    const { merchant, authenticatedAs } = await resolveMerchantFromRequest(req);
    if (authenticatedAs !== 'secret') {
      throw new ApiError(403, 'InPay requires the merchant secret key');
    }

    rateLimit(`inpay:${merchant.id}:${getClientIp(req)}`, 40, 60_000);

    const configuredMode = merchant.config?.mode || 'escrow';
    if (!['escrow', 'both'].includes(configuredMode)) {
      throw new ApiError(400, 'This store is not configured for escrow payments');
    }

    const buyer = String(req.body?.buyer || '').trim();
    if (!isLikelyPublicKey(buyer)) {
      throw new ApiError(400, 'A valid buyer wallet address is required');
    }

    const amount = Number(req.body?.customAmountMinor);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ApiError(400, 'customAmountMinor must be a positive integer');
    }

    const currency = String(
      req.body?.currency || merchant.config?.currency || 'USD'
    ).toUpperCase();
    if (!SUPPORTED_PRICING_CURRENCIES.includes(currency)) {
      throw new ApiError(
        400,
        `Currency must be one of: ${SUPPORTED_PRICING_CURRENCIES.join(', ')}`
      );
    }

    const description = String(req.body?.description || 'Custom payment').slice(0, 120);
    const merchantOrderId = req.body?.merchantOrderId
      ? String(req.body.merchantOrderId).slice(0, 120)
      : null;

    const solUsd = await getSolUsd();
    const eurUsdRate = getEurUsdRate();
    const quote = quoteSettlement({
      priceMinor: amount,
      quantity: 1,
      currency,
      eurUsdRate,
      solUsd,
    });

    const seed = randomUint64String();
    const token = randomSessionToken();
    const { escrowPda } = deriveEscrowPda(new PublicKey(buyer), seed);
    const now = Date.now();

    const session = {
      id: `ord_${randomSessionToken().slice(0, 20)}`,
      merchantId: merchant.id,
      productId: null,
      productName: description,
      productDescription: '',
      quantity: 1,
      unitPriceMinor: amount,
      subtotalMinor: quote.subtotalMinor,
      currency: quote.currency,
      settlementLamports: quote.settlementLamports,
      solUsd: quote.solUsd,
      eurUsdRate: quote.eurUsdRate,
      quoteExpiresAt: new Date(now + QUOTE_TTL_MS).toISOString(),
      mode: 'escrow',
      seed,
      tokenHash: await sha256Hex(token),
      status: 'prepared',
      buyer,
      escrowAddress: escrowPda.toBase58(),
      payoutWallet: merchant.payoutWallet,
      merchantOrderId,
      signatures: {},
      channel: 'inpay',
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    };

    await insertSession(session);

    await notifySeller({
      merchant,
      session,
      kind: 'order.created',
      title: 'New inline payment order',
      body: `Buyer ${buyer.slice(0, 4)}…${buyer.slice(-4)} started an inline payment for ${description} (${formatFiatMinor(
        quote.subtotalMinor,
        quote.currency
      )}).`,
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({
      session: {
        id: session.id,
        token,
        seed: session.seed,
        buyer: session.buyer,
        escrowAddress: session.escrowAddress,
        settlementLamports: session.settlementLamports,
        quoteExpiresAt: session.quoteExpiresAt,
        expiresAt: session.expiresAt,
        status: session.status,
        solUsd: session.solUsd,
        merchantOrderId: session.merchantOrderId,
        checkoutUrl: `${getAppOrigin(req)}/checkout/${session.id}?t=${token}`,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
