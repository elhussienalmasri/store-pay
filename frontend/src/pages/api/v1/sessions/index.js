import {
  ApiError,
  assertOriginAllowed,
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
import {
  insertSession,
  listProducts,
} from '../../../../lib/server/store';
import { sessionPublicView } from '../../../../lib/server/views';
import {
  quoteSettlement,
  QUOTE_TTL_MS,
  SESSION_TTL_MS,
  SUPPORTED_MODES,
  SUPPORTED_PRICING_CURRENCIES,
} from '../../../../lib/widgetCore.mjs';

function allowedModesFor(merchant) {
  const configured = merchant.config?.mode || 'escrow';
  return configured === 'both' ? SUPPORTED_MODES : [configured];
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
    const { merchant, authenticatedAs } = await resolveMerchantFromRequest(
      req,
      req.body?.publishableKey
    );

    if (authenticatedAs === 'publishable') {
      assertOriginAllowed(req, merchant);
      rateLimit(
        `session:${merchant.id}:${getClientIp(req)}`,
        40,
        60_000
      );
    }

    const quantityInput = Number(req.body?.quantity ?? 1);
    if (!Number.isInteger(quantityInput) || quantityInput < 1 || quantityInput > 100) {
      throw new ApiError(400, 'Quantity must be a whole number between 1 and 100');
    }

    const requestedMode = req.body?.mode || merchant.config?.mode || 'escrow';
    const mode = requestedMode === 'both' ? 'escrow' : requestedMode;
    if (!SUPPORTED_MODES.includes(mode)) {
      throw new ApiError(400, `Mode must be one of: ${SUPPORTED_MODES.join(', ')}`);
    }
    if (!allowedModesFor(merchant).includes(mode)) {
      throw new ApiError(400, `This store does not accept ${mode} payments`);
    }

    let product = null;
    let productId = null;
    let productName;
    let productDescription = '';
    let unitPriceMinor;
    let quantity = quantityInput;
    let currency;

    if (req.body?.productId) {
      const products = await listProducts(merchant.id);
      product = products.find((item) => item.id === req.body.productId);
      if (!product || product.active === false) {
        throw new ApiError(400, 'Product not found or is no longer available');
      }
      productId = product.id;
      productName = product.name;
      productDescription = product.description || '';
      unitPriceMinor = product.priceMinor;
      currency = product.currency;
    } else {
      if (authenticatedAs === 'publishable') {
        throw new ApiError(400, 'productId is required when using a publishable key');
      }
      const customAmount = Number(req.body?.customAmountMinor);
      if (!Number.isInteger(customAmount) || customAmount <= 0) {
        throw new ApiError(400, 'customAmountMinor must be a positive integer');
      }
      unitPriceMinor = customAmount;
      quantity = 1;
      productName = String(req.body?.description || 'Custom payment').slice(0, 120);
      currency = String(req.body?.currency || merchant.config?.currency || 'USD').toUpperCase();
      if (!SUPPORTED_PRICING_CURRENCIES.includes(currency)) {
        throw new ApiError(400, `Currency must be one of: ${SUPPORTED_PRICING_CURRENCIES.join(', ')}`);
      }
    }

    const merchantOrderId = req.body?.merchantOrderId
      ? String(req.body.merchantOrderId).slice(0, 120)
      : null;

    const solUsd = await getSolUsd();
    const eurUsdRate = getEurUsdRate();
    const quote = quoteSettlement({
      priceMinor: unitPriceMinor,
      quantity,
      currency,
      eurUsdRate,
      solUsd,
    });

    const now = Date.now();
    const token = randomSessionToken();
    const session = {
      id: `ord_${randomSessionToken().slice(0, 20)}`,
      merchantId: merchant.id,
      productId,
      productName,
      productDescription,
      quantity: quote.quantity,
      unitPriceMinor,
      subtotalMinor: quote.subtotalMinor,
      currency: quote.currency,
      settlementLamports: quote.settlementLamports,
      solUsd: quote.solUsd,
      eurUsdRate: quote.eurUsdRate,
      quoteExpiresAt: new Date(now + QUOTE_TTL_MS).toISOString(),
      mode,
      seed: randomUint64String(),
      tokenHash: await sha256Hex(token),
      status: 'open',
      buyer: null,
      escrowAddress: null,
      payoutWallet: merchant.payoutWallet,
      merchantOrderId,
      signatures: {},
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    };

    await insertSession(session);

    const appOrigin = getAppOrigin(req);
    const checkoutUrl = `${appOrigin}/checkout/${session.id}?t=${token}`;

    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({
      session: {
        ...sessionPublicView(session, merchant),
        token,
        checkoutUrl,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
