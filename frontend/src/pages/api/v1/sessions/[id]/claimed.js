import { ApiError, sendError } from '../../../../../lib/server/api';
import { requireMerchant } from '../../../../../lib/server/auth';
import { verifyEscrowClosed } from '../../../../../lib/server/solana';
import { findSessionById, patchSession } from '../../../../../lib/server/store';
import { notifyBuyer } from '../../../../../lib/server/notifications';
import { sessionMerchantView } from '../../../../../lib/server/views';
import { deliverWebhook } from '../../../../../lib/server/webhooks';
import { needsBuyerConfirmation } from '../../../../../lib/widgetCore.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const merchant = await requireMerchant(req);
    const session = await findSessionById(req.query.id);
    if (!session || session.merchantId !== merchant.id) {
      throw new ApiError(404, 'Order not found');
    }

    if (session.status === 'claimed') {
      return res.status(200).json({ session: sessionMerchantView(session) });
    }
    if (session.status !== 'funded' || !session.escrowAddress) {
      throw new ApiError(409, `Order cannot be claimed in status ${session.status}`);
    }
    if (needsBuyerConfirmation(session)) {
      throw new ApiError(409, 'The buyer has not confirmed receipt yet');
    }

    const signature = String(req.body?.signature || '');
    if (!signature) throw new ApiError(400, 'Missing transaction signature');

    try {
      await verifyEscrowClosed({
        session,
        signature,
        signer: session.payoutWallet,
      });
    } catch (err) {
      throw new ApiError(400, err.message);
    }

    const updated = await patchSession(session.id, {
      status: 'claimed',
      signatures: { ...(session.signatures || {}), claimed: signature },
      claimedAt: new Date().toISOString(),
    });

    await notifyBuyer({
      merchant,
      session: updated,
      kind: 'order.claimed',
      title: 'Order completed',
      body: `${merchant.name} confirmed delivery of ${updated.quantity} × ${updated.productName}. The escrow was released.`,
    });

    await deliverWebhook(merchant, 'order.claimed', {
      orderId: updated.id,
      session: sessionMerchantView(updated),
    }).catch((err) => console.warn('[escrowpay] webhook failed:', err.message));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ session: sessionMerchantView(updated) });
  } catch (err) {
    sendError(res, err);
  }
}
