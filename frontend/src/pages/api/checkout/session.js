import { createCheckoutSession, findCheckoutSession } from '../../../lib/server/store';

const CHECKOUT_SESSION_TTL_MS = 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { orderId, amountUsd, currency = 'USD', merchantWallet, itemName, mode = 'both' } = req.body;

    if (!amountUsd || !merchantWallet) {
      return res.status(400).json({ error: 'Missing required parameters: amountUsd and merchantWallet' });
    }

    const sessionId = `cs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const sessionData = {
      sessionId,
      orderId: orderId || `ORD-${Date.now().toString().slice(-6)}`,
      amountUsd: Number(amountUsd),
      currency: currency.toUpperCase(),
      merchantWallet,
      itemName: itemName || 'Store Item',
      mode, // 'direct', 'escrow', or 'both'
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    sessionData.expiresAt = new Date(Date.now() + CHECKOUT_SESSION_TTL_MS).toISOString();
    await createCheckoutSession(sessionData);

    return res.status(200).json({
      success: true,
      sessionId,
      sessionUrl: `/checkout?session=${sessionId}`,
      session: sessionData,
    });
  }

  if (req.method === 'GET') {
    const { sessionId } = req.query;
    const session = sessionId ? await findCheckoutSession(String(sessionId)) : null;
    if (!session) {
      return res.status(404).json({ error: 'Checkout session not found or expired.' });
    }
    return res.status(200).json(session);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
