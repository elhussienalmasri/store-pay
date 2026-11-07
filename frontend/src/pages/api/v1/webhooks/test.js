import { ApiError, sendError } from '../../../../lib/server/api';
import { requireMerchant } from '../../../../lib/server/auth';
import { listDeliveries } from '../../../../lib/server/store';
import { deliverWebhook } from '../../../../lib/server/webhooks';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const merchant = await requireMerchant(req);

    if (req.method === 'GET') {
      const deliveries = await listDeliveries(merchant.id, 20);
      return res.status(200).json({ deliveries });
    }

    if (!merchant.webhookUrl) {
      throw new ApiError(400, 'Add a webhook URL before sending a test event');
    }

    const result = await deliverWebhook(merchant, 'test.ping', {
      message: 'EscrowPay webhook test',
      merchantId: merchant.id,
    });

    return res.status(200).json({ result });
  } catch (err) {
    sendError(res, err);
  }
}
