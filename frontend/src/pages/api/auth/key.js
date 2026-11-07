import {
  ApiError,
  getClientIp,
  rateLimit,
  requireMethod,
  sendError,
} from '../../../lib/server/api';
import { createSessionToken, setSessionCookie } from '../../../lib/server/session';
import { findMerchantBySecret } from '../../../lib/server/store';
import { merchantOwnerView } from '../../../lib/server/views';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
    rateLimit(`key-login:${getClientIp(req)}`, 20, 60_000);

    const secretKey = String(req.body?.secretKey || '').trim();
    if (!secretKey) {
      throw new ApiError(400, 'Enter your merchant secret key');
    }

    const merchant = await findMerchantBySecret(secretKey);
    if (!merchant) {
      throw new ApiError(401, 'That merchant key is not valid');
    }

    setSessionCookie(res, await createSessionToken(merchant.id));
    res.status(200).json({ merchant: merchantOwnerView(merchant) });
  } catch (err) {
    sendError(res, err);
  }
}
