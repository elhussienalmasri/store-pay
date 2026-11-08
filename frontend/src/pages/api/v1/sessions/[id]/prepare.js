import { PublicKey } from '@solana/web3.js';
import { ApiError, sendError } from '../../../../../lib/server/api';
import { requireSessionToken } from '../../../../../lib/server/auth';
import { deriveEscrowPda } from '../../../../../lib/escrowProgram';
import { findMerchantById, patchSession } from '../../../../../lib/server/store';
import { sessionPublicView } from '../../../../../lib/server/views';
import {
  isLikelyPublicKey,
  isQuoteExpired,
} from '../../../../../lib/widgetCore.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const token = req.body?.token || req.query.t;
    const session = await requireSessionToken(req.query.id, token);

    if (session.mode !== 'escrow') {
      throw new ApiError(400, 'This checkout does not use escrow');
    }
    const status = session.status;
    if (status !== 'open' && status !== 'prepared') {
      throw new ApiError(409, `Order cannot accept a wallet in status ${status}`);
    }
    if (
      session.status === 'open' &&
      new Date(session.expiresAt).getTime() <= Date.now()
    ) {
      throw new ApiError(409, 'This checkout session has expired');
    }
    if (isQuoteExpired(session.quoteExpiresAt)) {
      throw new ApiError(409, 'The SOL quote expired. Refresh the quote before paying.');
    }

    const buyer = String(req.body?.buyer || '');
    const escrowAddress = String(req.body?.escrowAddress || '');
    if (!isLikelyPublicKey(buyer) || !isLikelyPublicKey(escrowAddress)) {
      throw new ApiError(400, 'Buyer and escrow addresses must be valid Solana addresses');
    }

    if (session.buyer && session.buyer !== buyer) {
      throw new ApiError(409, 'This checkout is already bound to another wallet');
    }

    const derived = deriveEscrowPda(new PublicKey(buyer), session.seed).escrowPda.toBase58();
    if (derived !== escrowAddress) {
      throw new ApiError(400, 'Escrow address does not match the buyer and order seed');
    }

    const buyerEmail = String(req.body?.buyerEmail || '').trim().toLowerCase();
    const notifyBuyerByEmail =
      req.body?.notifyBuyer === true && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail);

    const updated = await patchSession(session.id, {
      buyer,
      escrowAddress,
      buyerEmail: notifyBuyerByEmail ? buyerEmail : null,
      notifyBuyer: notifyBuyerByEmail,
      status: 'prepared',
    });
    const merchant = await findMerchantById(updated.merchantId);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ session: sessionPublicView(updated, merchant) });
  } catch (err) {
    sendError(res, err);
  }
}
