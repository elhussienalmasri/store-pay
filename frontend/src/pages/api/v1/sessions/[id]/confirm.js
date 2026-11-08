import { ApiError, sendError } from '../../../../../lib/server/api';
import { requireSessionToken } from '../../../../../lib/server/auth';
import { findMerchantById, patchSession } from '../../../../../lib/server/store';
import { notifySeller } from '../../../../../lib/server/notifications';
import { sessionPublicView } from '../../../../../lib/server/views';
import { formatFiatMinor } from '../../../../../lib/widgetCore.mjs';

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

    if (session.status !== 'funded' || session.mode !== 'escrow') {
      throw new ApiError(409, 'Only a funded escrow order can be confirmed');
    }

    if (session.buyerConfirmedAt) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ session: sessionPublicView(session, merchant) });
    }

    const updated = await patchSession(session.id, {
      buyerConfirmedAt: new Date().toISOString(),
    });
    const amount = formatFiatMinor(updated.subtotalMinor, updated.currency);

    await notifySeller({
      merchant,
      session: updated,
      kind: 'order.confirmed',
      title: 'Buyer confirmed receipt',
      body: `The buyer confirmed receiving ${updated.quantity} × ${updated.productName} (${amount}). You can claim the payment now.`,
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ session: sessionPublicView(updated, merchant) });
  } catch (err) {
    sendError(res, err);
  }
}
