import {
  ApiError,
  getAppOrigin,
  getClientIp,
  rateLimit,
  requireMethod,
  sendError,
} from '../../../lib/server/api';
import {
  MERCHANT_PLANS,
  createMerchant,
  normalizeDomains,
  normalizeMerchantEmail,
  normalizeMerchantName,
  normalizePayoutWallet,
} from '../../../lib/server/merchants';
import { hashPassword, isPasswordStrongEnough } from '../../../lib/server/passwords';
import { createSessionToken, setSessionCookie } from '../../../lib/server/session';
import { findMerchantByEmail } from '../../../lib/server/store';
import { merchantOwnerView } from '../../../lib/server/views';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
    rateLimit(`signup:${getClientIp(req)}`, 10, 60_000);

    const name = normalizeMerchantName(req.body?.name);
    const email = normalizeMerchantEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!isPasswordStrongEnough(password)) {
      throw new ApiError(
        400,
        'Password must be at least 8 characters and include a letter and a number'
      );
    }

    const domains = normalizeDomains(req.body || {});
    const payoutWallet = normalizePayoutWallet(req.body?.payoutWallet);
    const plan = MERCHANT_PLANS.includes(req.body?.plan) ? req.body.plan : 'starter';

    const existing = await findMerchantByEmail(email);
    if (existing) {
      throw new ApiError(409, 'An account with this email already exists');
    }

    const { merchant, secretKey } = await createMerchant({
      name,
      email,
      domains,
      payoutWallet,
      plan,
      passwordHash: await hashPassword(password),
    });

    setSessionCookie(res, await createSessionToken(merchant.id));

    res.status(201).json({
      merchant: merchantOwnerView(merchant),
      secretKey,
      docs: { widgetScript: `${getAppOrigin(req)}/widget/v1.js` },
    });
  } catch (err) {
    sendError(res, err);
  }
}
