import { requireMethod, sendError } from '../../../../lib/server/api';
import { requireMerchant } from '../../../../lib/server/auth';
import { listSessions } from '../../../../lib/server/store';
import { merchantStats, sessionMerchantView } from '../../../../lib/server/views';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;

  try {
    const merchant = await requireMerchant(req);
    const sessions = await listSessions(merchant.id);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      orders: sessions.map(sessionMerchantView),
      stats: merchantStats(sessions),
    });
  } catch (err) {
    sendError(res, err);
  }
}
