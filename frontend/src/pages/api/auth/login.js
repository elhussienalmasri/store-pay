import {
  ApiError,
  getClientIp,
  rateLimit,
  requireMethod,
  sendError,
} from '../../../lib/server/api';
import { verifyPassword } from '../../../lib/server/passwords';
import { createSessionToken, setSessionCookie } from '../../../lib/server/session';
import { findMerchantByEmail } from '../../../lib/server/store';
import { merchantOwnerView } from '../../../lib/server/views';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
    rateLimit(`login:${getClientIp(req)}`, 20, 60_000);

    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      throw new ApiError(400, 'Enter your email and password');
    }

    const merchant = await findMerchantByEmail(email);
    const valid =
      merchant?.passwordHash && (await verifyPassword(password, merchant.passwordHash));
    if (!valid) {
      throw new ApiError(401, 'Email or password is incorrect');
    }

    setSessionCookie(res, await createSessionToken(merchant.id));
    res.status(200).json({ merchant: merchantOwnerView(merchant) });
  } catch (err) {
    sendError(res, err);
  }
}
