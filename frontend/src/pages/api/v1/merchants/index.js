import { getClientIp, getAppOrigin, rateLimit, requireMethod, sendError } from '../../../../lib/server/api';
import {
  MERCHANT_PLANS,
  createMerchant,
  normalizeDomains,
  normalizeMerchantEmail,
  normalizeMerchantName,
  normalizePayoutWallet,
} from '../../../../lib/server/merchants';
import { merchantOwnerView } from '../../../../lib/server/views';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
    rateLimit(`signup:${getClientIp(req)}`, 10, 60_000);

    const name = normalizeMerchantName(req.body?.name);
    const email = normalizeMerchantEmail(req.body?.email);
    const plan = MERCHANT_PLANS.includes(req.body?.plan) ? req.body.plan : 'starter';
    const domains = normalizeDomains(req.body || {});
    const payoutWallet = normalizePayoutWallet(req.body?.payoutWallet);

    const { merchant, secretKey } = await createMerchant({
      name,
      email,
      domains,
      payoutWallet,
      plan,
    });

    res.status(201).json({
      merchant: merchantOwnerView(merchant),
      secretKey,
      docs: {
        widgetScript: `${getAppOrigin(req)}/widget/v1.js`,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
}
