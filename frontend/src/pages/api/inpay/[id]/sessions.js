import { PublicKey } from '@solana/web3.js';
import { assertOriginAllowed, getClientIp, rateLimit, requireMethod, sendError } from '../../../../lib/server/api';
import { resolveMerchantFromRequest } from '../../../../lib/server/auth';
import { randomSessionToken, randomUint64String, sha256Hex } from '../../../../lib/server/crypto';
import { getEurUsdRate, getSolUsd } from '../../../../lib/server/pricing';
import { insertSession } from '../../../../lib/server/store';
import { deriveEscrowPda } from '../../../../lib/escrowProgram';
import {
  isLikelyPublicKey,
  quoteSettlement,
  QUOTE_TTL_MS,
  SESSION_TTL_MS,
} from '../../../../lib/widgetCore.mjs';

function escrowIdFromRequest(req) {
  const value = req.query.id;
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value) ? value : null;
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
    const escrowId = escrowIdFromRequest(req);
    if (!escrowId) return res.status(404).json({ error: 'Escrow integration not found.' });

    const { merchant, authenticatedAs } = await resolveMerchantFromRequest(req, escrowId);
    if (authenticatedAs !== 'publishable') {
      return res.status(403).json({ error: 'The inline widget requires a publishable key.' });
    }
    assertOriginAllowed(req, merchant);
    if (!['escrow', 'both'].includes(merchant.config?.mode || 'escrow')) {
      return res.status(400).json({ error: 'This store is not configured for escrow payments.' });
    }
    rateLimit(`inline-widget:${merchant.id}:${getClientIp(req)}`, 30, 60_000);

    const buyer = String(req.body?.buyer || '').trim();
    const amount = Number(req.body?.amountMinor);
    const reference = String(req.body?.reference || '').trim();
    const currency = String(req.body?.currency || merchant.config?.currency || 'USD').toUpperCase();
    const description = String(req.body?.description || 'Payment').trim().slice(0, 120);
    if (!isLikelyPublicKey(buyer)) {
      return res.status(400).json({ error: 'Connect a valid Solana wallet before paying.' });
    }
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 100_000_000) {
      return res.status(400).json({ error: 'The order amount is invalid.' });
    }
    if (!reference || reference.length > 120) {
      return res.status(400).json({ error: 'A valid order reference is required.' });
    }
    if (!['USD', 'EUR'].includes(currency)) {
      return res.status(400).json({ error: 'The order currency is not supported.' });
    }

    const quote = quoteSettlement({
      priceMinor: amount,
      quantity: 1,
      currency,
      eurUsdRate: getEurUsdRate(),
      solUsd: await getSolUsd(),
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
      merchantOrderId: reference,
      signatures: {},
      channel: 'inpay',
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    };
    await insertSession(session);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ session: { id: session.id, token } });
  } catch (error) {
    sendError(res, error);
  }
}
