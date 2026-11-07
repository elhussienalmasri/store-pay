import { ApiError, sendError } from '../../../../../lib/server/api';
import { requireSessionToken } from '../../../../../lib/server/auth';
import { verifyDirectPayment } from '../../../../../lib/server/solana';
import { findMerchantById, patchSession } from '../../../../../lib/server/store';
import { sessionPublicView } from '../../../../../lib/server/views';
import { deliverWebhook } from '../../../../../lib/server/webhooks';
import { isLikelyPublicKey } from '../../../../../lib/widgetCore.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const token = req.body?.token || req.query.t;
    const session = await requireSessionToken(req.query.id, token);
    const merchant = await findMerchantById(session.merchantId);
    if (!merchant) throw new ApiError(404, 'Store not found');

    if (session.mode !== 'direct') {
      throw new ApiError(400, 'This checkout uses escrow, not direct payment');
    }
    if (session.status === 'paid') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ session: sessionPublicView(session, merchant) });
    }
    if (session.status !== 'open') {
      throw new ApiError(409, `Order cannot be paid in status ${session.status}`);
    }

    const buyer = String(req.body?.buyer || '');
    if (!isLikelyPublicKey(buyer)) {
      throw new ApiError(400, 'Buyer must be a valid Solana address');
    }
    const signature = String(req.body?.signature || '');
    if (!signature) throw new ApiError(400, 'Missing transaction signature');

    try {
      await verifyDirectPayment({ session, signature, buyer });
    } catch (err) {
      throw new ApiError(400, err.message);
    }

    const updated = await patchSession(session.id, {
      status: 'paid',
      buyer,
      signatures: { ...(session.signatures || {}), paid: signature },
      paidAt: new Date().toISOString(),
    });

    const view = sessionPublicView(updated, merchant);
    await deliverWebhook(merchant, 'order.paid', {
      orderId: updated.id,
      session: view,
    }).catch((err) => console.warn('[escrowpay] webhook failed:', err.message));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ session: view });
  } catch (err) {
    sendError(res, err);
  }
}
