import { requireMethod, sendError } from '../../../../../lib/server/api';
import { requireSessionToken } from '../../../../../lib/server/auth';
import { findMerchantById } from '../../../../../lib/server/store';
import { sessionPublicView } from '../../../../../lib/server/views';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;

  try {
    const token = req.query.t || req.query.token;
    const session = await requireSessionToken(req.query.id, token);
    const merchant = await findMerchantById(session.merchantId);
    if (!merchant) return res.status(404).json({ error: 'Store not found' });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ session: sessionPublicView(session, merchant) });
  } catch (err) {
    sendError(res, err);
  }
}
