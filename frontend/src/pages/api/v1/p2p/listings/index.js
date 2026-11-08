import { PublicKey } from '@solana/web3.js';
import { getClientIp, rateLimit, sendError } from '../../../../../lib/server/api';
import { deleteP2PListing, listP2PListings, upsertP2PListing } from '../../../../../lib/server/store';
import { verifyPayoutPayload } from '../../../../../lib/server/payout';
import { LISTING_DOMAIN, normalizeListing } from '../../../../../lib/payoutCore.mjs';

function walletFrom(value) {
  const input = String(value || '').trim();
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
    if (req.method === 'GET') {
      rateLimit(`listings-read:${getClientIp(req)}`, 240, 60_000);
      const wallet = walletFrom(req.query?.wallet);
      if (req.query?.wallet && !wallet) {
        return res.status(400).json({ error: 'That wallet address is not valid.' });
      }
      const listings = await listP2PListings(wallet);
      return res.status(200).json({ listings });
    }

    if (req.method === 'PUT') {
      rateLimit(`listings-save:${getClientIp(req)}`, 10, 60_000);

      const wallet = walletFrom(req.body?.wallet);
      if (!wallet) {
        return res.status(400).json({ error: 'A valid wallet address is required.' });
      }

      const payload = await verifyPayoutPayload({
        wallet,
        message: req.body?.message,
        signature: req.body?.signature,
        profileJson: req.body?.listingJson,
        domain: LISTING_DOMAIN,
      });

      if (payload?.removed === true) {
        const id = String(payload.id || '').trim();
        if (!id) {
          return res.status(400).json({ error: 'The offer to remove is not identified.' });
        }
        const removed = await deleteP2PListing(wallet, id);
        return res.status(200).json({ wallet, removed });
      }

      let listing;
      try {
        listing = normalizeListing(payload);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
      if (!listing.id) {
        return res.status(400).json({ error: 'The offer is missing its id.' });
      }

      const now = new Date().toISOString();
      const stored = await upsertP2PListing({
        wallet,
        id: listing.id,
        listing,
        createdAt: now,
        updatedAt: now,
      });
      return res.status(200).json({ wallet, listing: stored });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  } catch (err) {
    return sendError(res, err);
  }
}
