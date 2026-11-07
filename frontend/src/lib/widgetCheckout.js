import {
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  createMakeInstruction,
  createRefundInstruction,
  createTakeInstruction,
  deriveEscrowPda,
  parseAnchorError,
} from './escrowProgram';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from './constants';
import {
  escrowDepositLamports,
  WSOL_MINT,
} from './widgetCore.mjs';

async function api(path, { method = 'GET', body, secret } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed (${response.status})`);
  }
  return data;
}

export function fetchCheckoutSession(sessionId, token) {
  return api(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}?t=${encodeURIComponent(token)}`
  );
}

export function requoteSession(sessionId, token) {
  return api(`/api/v1/sessions/${encodeURIComponent(sessionId)}/requote`, {
    method: 'POST',
    body: { token },
  });
}

async function sendAndConfirm(connection, sendTransaction, transaction, payer) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.feePayer = payer;
  transaction.recentBlockhash = blockhash;
  const signature = await sendTransaction(transaction, connection);
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  );
  return signature;
}

export async function buildEscrowFundingTransaction({ connection, buyer, session }) {
  const buyerKey = new PublicKey(buyer);
  const mint = new PublicKey(WSOL_MINT);
  const buyerWsol = getAssociatedTokenAddressSync(
    mint,
    buyerKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const transaction = new Transaction();
  const ataInfo = await connection.getAccountInfo(buyerWsol);
  if (!ataInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        buyerKey,
        buyerWsol,
        buyerKey,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  // The escrow quote plus one lamport that the merchant pays back on claim.
  const deposit = escrowDepositLamports(session.settlement.lamports);
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: buyerKey,
      toPubkey: buyerWsol,
      lamports: Number(deposit),
    }),
    createSyncNativeInstruction(buyerWsol, TOKEN_PROGRAM_ID),
    createMakeInstruction({
      maker: buyerKey,
      seed: session.seed,
      receiveAmount: 1n,
      depositAmount: deposit,
      mintA: mint,
      mintB: mint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
  );

  return transaction;
}

export async function fundEscrow({ connection, publicKey, sendTransaction, session, token }) {
  const buyer = publicKey.toBase58();
  const { escrowPda } = deriveEscrowPda(publicKey, session.seed);

  await api(`/api/v1/sessions/${encodeURIComponent(session.id)}/prepare`, {
    method: 'POST',
    body: {
      token,
      buyer,
      escrowAddress: escrowPda.toBase58(),
    },
  });

  const transaction = await buildEscrowFundingTransaction({
    connection,
    buyer,
    session,
  });
  const signature = await sendAndConfirm(connection, sendTransaction, transaction, publicKey);

  const data = await api(`/api/v1/sessions/${encodeURIComponent(session.id)}/funded`, {
    method: 'POST',
    body: { token, signature },
  });

  return { signature, session: data.session };
}

export async function refundEscrow({ connection, publicKey, sendTransaction, session, token }) {
  const mint = new PublicKey(WSOL_MINT);
  const transaction = new Transaction().add(
    createRefundInstruction({
      maker: publicKey,
      seed: session.seed,
      mintA: mint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
  );
  const signature = await sendAndConfirm(connection, sendTransaction, transaction, publicKey);

  const data = await api(`/api/v1/sessions/${encodeURIComponent(session.id)}/refunded`, {
    method: 'POST',
    body: { token, signature },
  });

  return { signature, session: data.session };
}

export async function payDirect({ connection, publicKey, sendTransaction, session, token }) {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: new PublicKey(session.merchant.payoutWallet),
      lamports: Number(session.settlement.lamports),
    })
  );
  const signature = await sendAndConfirm(connection, sendTransaction, transaction, publicKey);

  const data = await api(`/api/v1/sessions/${encodeURIComponent(session.id)}/direct-paid`, {
    method: 'POST',
    body: { token, buyer: publicKey.toBase58(), signature },
  });

  return { signature, session: data.session };
}

export async function buildClaimTransaction({ connection, merchant, session }) {
  if (!session.buyer) throw new Error('Order has no buyer yet');
  if (!session.escrowAddress) throw new Error('Order has no escrow account');

  const mint = new PublicKey(WSOL_MINT);
  const merchantWsol = getAssociatedTokenAddressSync(
    mint,
    merchant,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const transaction = new Transaction();
  const ataInfo = await connection.getAccountInfo(merchantWsol);
  let needsWrap = true;

  if (!ataInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        merchant,
        merchantWsol,
        merchant,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  } else {
    const balance = await connection.getTokenAccountBalance(merchantWsol);
    needsWrap = BigInt(balance.value.amount) < 1n;
  }

  if (needsWrap) {
    // The escrow asks for a 1-lamport "receive" amount, so the claiming wallet
    // needs a tiny wrapped-SOL balance before the take instruction runs.
    const wrapLamports = 10_000_000; // 0.01 SOL
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: merchant,
        toPubkey: merchantWsol,
        lamports: wrapLamports,
      }),
      createSyncNativeInstruction(merchantWsol, TOKEN_PROGRAM_ID)
    );
  }

  transaction.add(
    createTakeInstruction({
      taker: merchant,
      maker: new PublicKey(session.buyer),
      seed: session.seed,
      mintA: mint,
      mintB: mint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
  );

  // Unwrap the settled WSOL back into native SOL in the same transaction.
  transaction.add(
    createCloseAccountInstruction(
      merchantWsol,
      merchant,
      merchant,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  return transaction;
}

export async function claimPayment({
  connection,
  publicKey,
  sendTransaction,
  session,
  secretKey,
}) {
  const transaction = await buildClaimTransaction({
    connection,
    merchant: publicKey,
    session,
  });
  const signature = await sendAndConfirm(connection, sendTransaction, transaction, publicKey);

  const data = await api(`/api/v1/sessions/${encodeURIComponent(session.id)}/claimed`, {
    method: 'POST',
    body: { signature },
    secret: secretKey,
  });

  return { signature, order: data.session };
}

export function describeWalletError(error) {
  return parseAnchorError(error);
}
