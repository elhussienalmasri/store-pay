import { requireMethod, sendError } from '../../../lib/server/api';
import { merchantFromSession } from '../../../lib/server/auth';
import { merchantOwnerView } from '../../../lib/server/views';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;

  try {
    const merchant = await merchantFromSession(req);
    res.status(200).json({ merchant: merchant ? merchantOwnerView(merchant) : null });
  } catch (err) {
    sendError(res, err);
  }
}
