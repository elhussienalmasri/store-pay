import { getOrder } from '../../../lib/db';

const STOREPAY_API_ORIGIN = (process.env.NEXT_PUBLIC_STOREPAY_ORIGIN || '').replace(/\/+$/, '');
const CLIENT_PAY_SECRET = process.env.STOREPAY_SECRET_KEY || '';

function configurationError() {
  return !STOREPAY_API_ORIGIN || !CLIENT_PAY_SECRET;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (configurationError()) {
    return res.status(500).json({ error: 'Client Pay is not configured for this store.' });
  }

  const reference = String(req.body?.reference || '').trim();
  const order = getOrder(reference);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.payment) return res.status(409).json({ error: 'This order has already been paid.' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${STOREPAY_API_ORIGIN}/api/v1/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLIENT_PAY_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customAmountMinor: order.totalCents,
        currency: 'USD',
        description: order.items.map((item) => `${item.quantity}x ${item.title}`).join(', ').slice(0, 120),
        merchantOrderId: order.reference,
        mode: 'escrow',
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || 'Client Pay could not create a checkout session.' });
    }
    const session = data.session;
    if (!session?.id || !session?.token || !session?.checkoutUrl) {
      return res.status(502).json({ error: 'Client Pay returned an invalid checkout session.' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ session: { id: session.id, token: session.token, checkoutUrl: session.checkoutUrl } });
  } catch {
    return res.status(502).json({ error: 'Client Pay is unavailable. Try again shortly.' });
  } finally {
    clearTimeout(timeout);
  }
}
