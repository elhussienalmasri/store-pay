import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import {
  ApiError,
  getClientIp,
  rateLimit,
  requireMethod,
  sendError,
} from '../../../../lib/server/api';
import { requireSessionToken } from '../../../../lib/server/auth';
import { findMerchantById } from '../../../../lib/server/store';
import { sessionPublicView } from '../../../../lib/server/views';
import { buildEscrowFundingTransaction } from '../../../../lib/widgetCheckout';
import { DEVNET_RPC_URL } from '../../../../lib/constants';
import { effectiveSessionStatus, isQuoteExpired } from '../../../../lib/widgetCore.mjs';

/**
 * InPay: returns the unsigned escrow-funding transaction for a prepared inline
 * order, so the merchant page only needs a wallet, not the escrow program layout.
 */
export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
    rateLimit(`inpay:tx:${getClientIp(req)}`, 40, 60_000);

    const token = req.body?.token || req.query.t;
    const session = await requireSessionToken(req.body?.sessionId || req.query.id, token);

    if (session.channel !== 'inpay') {
      throw new ApiError(400, 'This order was not started from an inline integration');
    }

    const status = effectiveSessionStatus(session);
    if (status !== 'prepared') {
      throw new ApiError(409, `Order cannot be funded in status ${status}`);
    }
    if (isQuoteExpired(session.quoteExpiresAt)) {
      throw new ApiError(409, 'The SOL quote has expired. Start the payment again.');
    }
    if (!session.buyer) {
      throw new ApiError(400, 'A buyer wallet is required before the payment can be built');
    }

    const merchant = await findMerchantById(session.merchantId);
    if (!merchant) throw new ApiError(404, 'Store not found');

    const connection = new Connection(DEVNET_RPC_URL, 'confirmed');
    const view = sessionPublicView(session, merchant);
    const transaction = await buildEscrowFundingTransaction({
      connection,
      buyer: session.buyer,
      session: view,
    });

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.feePayer = new PublicKey(session.buyer);
    transaction.recentBlockhash = blockhash;

    const unsigned = transaction
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString('base64');

    // Wallets that only speak address-lookup-table messages reject legacy bytes, so the
    // same instructions are offered both ways and the client picks by supportedTransactionVersions.
    const versioned = Buffer.from(
      new VersionedTransaction(
        new TransactionMessage({
          payerKey: transaction.feePayer,
          recentBlockhash: blockhash,
          instructions: transaction.instructions,
        }).compileToV0Message()
      ).serialize()
    ).toString('base64');

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      transaction: unsigned,
      transactionV0: versioned,
      blockhash,
      lastValidBlockHeight,
      settlement: view.settlement,
    });
  } catch (err) {
    sendError(res, err);
  }
}
