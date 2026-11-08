import { PublicKey } from '@solana/web3.js';
import { getClientIp, rateLimit, sendError } from '../../../../../lib/server/api';
import { deletePayoutProfile, getPayoutProfile, upsertPayoutProfile } from '../../../../../lib/server/store';
import { verifyPayoutPayload } from '../../../../../lib/server/payout';
import { normalizePayoutProfile } from '../../../../../lib/payoutCore.mjs';

function walletFrom(req) {
  const input = String(req.query?.wallet || req.body?.wallet || '').trim();
  if (!input) return null;
  try {
    return new PublicKey(input).toBase58();
  } catch (err) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    const wallet = walletFrom(req);
    if (!wallet) {
      return res.status(400).json({ error: 'A valid wallet address is required.' });
    }

    if (req.method === 'GET') {
      rateLimit(`payouts-read:${getClientIp(req)}`, 240, 60_000);
      const stored = await getPayoutProfile(wallet);
      return res.status(200).json({
        wallet,
        profile: stored?.profile || null,
        updatedAt: stored?.updatedAt || null,
      });
    }

    if (req.method === 'PUT') {
      rateLimit(`payouts-save:${getClientIp(req)}`, 10, 60_000);

      const payload = await verifyPayoutPayload({
        wallet,
        message: req.body?.message,
        signature: req.body?.signature,
        profileJson: req.body?.profileJson,
      });

      if (payload?.removed === true) {
        await deletePayoutProfile(wallet);
        return res.status(200).json({ wallet, profile: null, updatedAt: null });
      }

      let profile;
      try {
        profile = normalizePayoutProfile(payload);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }

      const updatedAt = new Date().toISOString();
      await upsertPayoutProfile({ wallet, profile, updatedAt });
      return res.status(200).json({ wallet, profile, updatedAt });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    return sendError(res, err);
  }
}
