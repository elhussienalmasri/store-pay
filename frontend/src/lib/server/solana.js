import { Connection, PublicKey } from '@solana/web3.js';
import { DEVNET_RPC_URL, PROGRAM_ID } from '../constants';
import {
  decodeEscrowAccount,
  deriveEscrowPda,
  deriveVaultAta,
} from '../escrowProgram';
import {
  ESCROW_OFFSET_LAMPORTS,
  ESCROW_RECEIVE_BASE_UNITS,
  WSOL_MINT,
} from '../widgetCore.mjs';

let cachedConnection = null;

function getConnection() {
  if (!cachedConnection) {
    cachedConnection = new Connection(DEVNET_RPC_URL, 'confirmed');
  }
  return cachedConnection;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, attempts = 3, delayMs = 700) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (err) {
      lastError = err;
    }
    if (attempt < attempts - 1) await sleep(delayMs);
  }
  if (lastError) throw lastError;
  return null;
}

export async function assertSignatureSuccess(signature, { signer } = {}) {
  if (!signature || typeof signature !== 'string') {
    throw new Error('Missing transaction signature');
  }

  const connection = getConnection();
  const status = await connection.getSignatureStatus(signature, {
    searchTransactionHistory: true,
  });

  if (!status?.value) {
    throw new Error('Transaction is not confirmed yet. Wait a moment and retry.');
  }
  if (status.value.err) {
    throw new Error('Transaction failed on-chain. No payment was recorded.');
  }

  if (signer) {
    const parsed = await withRetry(
      () =>
        connection.getParsedTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        }),
      3,
      700
    );
    if (!parsed) {
      throw new Error('Could not load the confirmed transaction. Retry in a moment.');
    }
    const signerKey = new PublicKey(signer);
    const signed = parsed.transaction.message.accountKeys.find(
      (key) => key.pubkey.equals(signerKey) && key.signer
    );
    if (!signed) {
      throw new Error('The connected wallet did not sign this transaction.');
    }
  }

  return true;
}

export async function verifyEscrowFunding({ session, signature }) {
  if (!session.buyer || !session.escrowAddress) {
    throw new Error('Connect a wallet before funding this order.');
  }

  await assertSignatureSuccess(signature, { signer: session.buyer });

  const buyer = new PublicKey(session.buyer);
  const escrowAddress = new PublicKey(session.escrowAddress);
  const { escrowPda } = deriveEscrowPda(buyer, session.seed);
  if (!escrowPda.equals(escrowAddress)) {
    throw new Error('Escrow address does not match this order.');
  }

  const connection = getConnection();
  const accountInfo = await withRetry(
    () => connection.getAccountInfo(escrowAddress, 'confirmed'),
    4,
    800
  );
  if (!accountInfo) {
    throw new Error('Escrow account not found on-chain yet. Retry in a moment.');
  }
  if (!accountInfo.owner.equals(PROGRAM_ID)) {
    throw new Error('Escrow account is not owned by the escrow program.');
  }

  const decoded = decodeEscrowAccount(Buffer.from(accountInfo.data), escrowAddress);

  if (decoded.makerAddress !== session.buyer) {
    throw new Error('Escrow maker does not match the buyer wallet.');
  }
  if (decoded.mintAAddress !== WSOL_MINT || decoded.mintBAddress !== WSOL_MINT) {
    throw new Error('Escrow was funded with an unexpected token mint.');
  }
  if (decoded.seed !== String(session.seed)) {
    throw new Error('Escrow seed does not match this order.');
  }
  if (decoded.receive !== ESCROW_RECEIVE_BASE_UNITS) {
    throw new Error('Escrow terms do not match this order.');
  }

  const vault = deriveVaultAta(escrowAddress, new PublicKey(WSOL_MINT));
  const balance = await withRetry(
    () => connection.getTokenAccountBalance(vault, 'confirmed'),
    4,
    800
  );
  const expected = BigInt(session.settlementLamports) + ESCROW_OFFSET_LAMPORTS;
  if (!balance || BigInt(balance.value.amount) !== expected) {
    throw new Error(
      `Vault balance does not match the quote. Expected ${expected.toString()} lamports.`
    );
  }

  return {
    escrow: escrowAddress.toBase58(),
    vault: vault.toBase58(),
    vaultLamports: balance.value.amount,
  };
}

export async function verifyEscrowClosed({ session, signature, signer }) {
  if (!session.escrowAddress) {
    throw new Error('This order has no escrow account.');
  }

  await assertSignatureSuccess(signature, { signer });

  const connection = getConnection();
  const escrowAddress = new PublicKey(session.escrowAddress);
  const accountInfo = await withRetry(
    () => connection.getAccountInfo(escrowAddress, 'confirmed'),
    4,
    700
  );

  if (accountInfo !== null) {
    throw new Error('Escrow is still open on-chain. Wait for finality and retry.');
  }

  return true;
}

export async function verifyDirectPayment({ session, signature, buyer }) {
  if (!buyer) throw new Error('Buyer wallet is required.');
  await assertSignatureSuccess(signature, { signer: buyer });

  const connection = getConnection();
  const parsed = await withRetry(
    () =>
      connection.getParsedTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      }),
    3,
    700
  );
  if (!parsed || !parsed.meta) {
    throw new Error('Could not load the confirmed transaction.');
  }
  if (parsed.meta.err) {
    throw new Error('Transaction failed on-chain. No payment was recorded.');
  }

  const payoutWallet = session.payoutWallet;
  let received = 0;
  parsed.transaction.message.accountKeys.forEach((key, index) => {
    if (key.pubkey.toBase58() === payoutWallet) {
      received += parsed.meta.postBalances[index] - parsed.meta.preBalances[index];
    }
  });

  if (received < Number(session.settlementLamports)) {
    throw new Error(
      `Transfer did not reach the merchant wallet. Expected at least ${session.settlementLamports} lamports.`
    );
  }

  return { received };
}
