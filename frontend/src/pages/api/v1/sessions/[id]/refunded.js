import { ApiError, sendError } from '../../../../../lib/server/api';
import { requireSessionToken } from '../../../../../lib/server/auth';
import { verifyEscrowClosed } from '../../../../../lib/server/solana';
import { findMerchantById, patchSession } from '../../../../../lib/server/store';
import { sessionPublicView } from '../../../../../lib/server/views';
import { deliverWebhook } from '../../../../../lib/server/webhooks';

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

    if (session.status === 'refunded') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ session: sessionPublicView(session, merchant) });
    }
    if (session.status === 'claimed') {
      throw new ApiError(409, 'The merchant already settled this payment');
    }
    if (session.status !== 'funded' || !session.escrowAddress) {
      throw new ApiError(409, `Order cannot be refunded in status ${session.status}`);
    }

    const signature = String(req.body?.signature || '');
    if (!signature) throw new ApiError(400, 'Missing transaction signature');

    try {
      await verifyEscrowClosed({
        session,
        signature,
        signer: session.buyer,
      });
    } catch (err) {
      throw new ApiError(400, err.message);
    }

    const updated = await patchSession(session.id, {
      status: 'refunded',
      signatures: { ...(session.signatures || {}), refunded: signature },
      refundedAt: new Date().toISOString(),
    });

    const view = sessionPublicView(updated, merchant);
    await deliverWebhook(merchant, 'order.refunded', {
      orderId: updated.id,
      session: view,
    }).catch((err) => console.warn('[escrowpay] webhook failed:', err.message));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ session: view });
  } catch (err) {
    sendError(res, err);
  }
}
