import { ApiError, sendError } from '../../../../../lib/server/api';
import { requireSessionToken } from '../../../../../lib/server/auth';
import { getEurUsdRate, getSolUsd } from '../../../../../lib/server/pricing';
import { findMerchantById, patchSession } from '../../../../../lib/server/store';
import { sessionPublicView } from '../../../../../lib/server/views';
import { quoteSettlement, QUOTE_TTL_MS } from '../../../../../lib/widgetCore.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const token = req.body?.token || req.query.t;
    const session = await requireSessionToken(req.query.id, token);

    if (session.status !== 'open' && session.status !== 'prepared') {
      throw new ApiError(409, `Quote cannot be refreshed in status ${session.status}`);
    }
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      throw new ApiError(409, 'This checkout session has expired');
    }

    const quote = quoteSettlement({
      priceMinor: session.unitPriceMinor,
      quantity: session.quantity,
      currency: session.currency,
      eurUsdRate: getEurUsdRate(),
      solUsd: await getSolUsd(),
    });

    const updated = await patchSession(session.id, {
      settlementLamports: quote.settlementLamports,
      solUsd: quote.solUsd,
      eurUsdRate: quote.eurUsdRate,
      quoteExpiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    });
    const merchant = await findMerchantById(updated.merchantId);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ session: sessionPublicView(updated, merchant) });
  } catch (err) {
    sendError(res, err);
  }
}
