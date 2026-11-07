import { ApiError, sendError } from '../../../../../lib/server/api';
import { requireSessionToken } from '../../../../../lib/server/auth';
import { verifyEscrowFunding } from '../../../../../lib/server/solana';
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

    if (session.mode !== 'escrow') {
      throw new ApiError(400, 'This checkout does not use escrow');
    }

    if (session.status === 'funded') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ session: sessionPublicView(session, merchant) });
    }
    if (session.status !== 'prepared') {
      throw new ApiError(409, `Order cannot be funded in status ${session.status}`);
    }

    const signature = String(req.body?.signature || '');
    if (!signature) throw new ApiError(400, 'Missing transaction signature');

    let verification;
    try {
      verification = await verifyEscrowFunding({ session, signature });
    } catch (err) {
      throw new ApiError(400, err.message);
    }

    const updated = await patchSession(session.id, {
      status: 'funded',
      signatures: { ...(session.signatures || {}), funded: signature },
      fundedAt: new Date().toISOString(),
      vault: verification.vault,
    });

    const view = sessionPublicView(updated, merchant);
    await deliverWebhook(merchant, 'order.funded', {
      orderId: updated.id,
      session: view,
    }).catch((err) => console.warn('[escrowpay] webhook failed:', err.message));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ session: view, verification });
  } catch (err) {
    sendError(res, err);
  }
}
