// In-memory session store (in production, backed by database)
const sessions = new Map();

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

    sessions.set(sessionId, sessionData);

    return res.status(200).json({
      success: true,
      sessionId,
      sessionUrl: `/checkout?session=${sessionId}`,
      session: sessionData,
    });
  }

  if (req.method === 'GET') {
    const { sessionId } = req.query;
    if (!sessionId || !sessions.has(sessionId)) {
      return res.status(404).json({ error: 'Checkout session not found or expired.' });
    }
    return res.status(200).json(sessions.get(sessionId));
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
