import {
  getClientIp,
  rateLimit,
  requireMethod,
  sendError,
} from '../../../../../lib/server/api';
import { requireMerchant } from '../../../../../lib/server/auth';
import { generateMerchantKeys, sha256Hex } from '../../../../../lib/server/crypto';
import { patchMerchant } from '../../../../../lib/server/store';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
    const merchant = await requireMerchant(req);
    rateLimit(`rotate-secret:${merchant.id}:${getClientIp(req)}`, 5, 60_000);

    const { secretKey } = generateMerchantKeys();
    await patchMerchant(merchant.id, { secretHash: await sha256Hex(secretKey) });

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ secretKey });
  } catch (err) {
    sendError(res, err);
  }
}
