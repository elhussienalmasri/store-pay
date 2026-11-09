import { getOrder, markOrderPaid } from '../../../lib/db';

const STOREPAY_API_ORIGIN = (process.env.NEXT_PUBLIC_STOREPAY_ORIGIN || '').replace(/\/+$/, '');

async function getStorePaySession({ sessionId, token }) {
  if (!STOREPAY_API_ORIGIN) {
    return { ok: false, status: 500, error: 'StorePay is not configured for this store.' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${STOREPAY_API_ORIGIN}/api/v1/sessions/${encodeURIComponent(sessionId)}?t=${encodeURIComponent(token)}`, { cache: 'no-store', signal: controller.signal });
    const data = await response.json();
    if (!response.ok) return { ok: false, status: response.status, error: data.error || 'The payment could not be verified.' };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 502, error: 'StorePay is unavailable. Your payment is safe; try confirming again shortly.' };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const reference = String(req.body?.reference || '').trim();
  const session = req.body?.session;
  if (!reference || !session?.id || !session?.token) {
    return res.status(400).json({ error: 'An order reference and payment session are required.' });
  }

  const order = getOrder(reference);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.payment) return res.status(200).json({ order });

  const verified = await getStorePaySession({ sessionId: session.id, token: session.token });
  if (!verified.ok) return res.status(verified.status).json({ error: verified.error });
  const funded = verified.data.session;
  if (
    !['inpay', null].includes(funded.channel) ||
    funded.merchantOrderId !== reference ||
    funded.pricing?.subtotalMinor !== order.totalCents ||
    funded.pricing?.currency !== 'USD' ||
    !['funded', 'claimed'].includes(funded.status) ||
    !funded.signatures?.funded
  ) {
    return res.status(409).json({ error: 'This payment does not match a paid session for this order.' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    order: markOrderPaid(reference, {
      escrowSessionId: funded.id,
      display: funded.settlement?.display,
    }),
  });
}
