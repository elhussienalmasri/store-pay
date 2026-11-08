import { PublicKey } from '@solana/web3.js';
import { ed25519 } from '@noble/curves/ed25519';
import { ApiError } from './api';
import { PAYOUT_DOMAIN, parsePayoutMessage, sha256HexOf } from '../payoutCore.mjs';

// A payout signature older than this is rejected, so a captured signing cannot be replayed later.
const SIGNATURE_MAX_AGE_MS = 15 * 60 * 1000;

// Some wallets wrap the payload in the Solana signed-message header before signing it.
// The route accepts either form so the seller is not locked to one wallet.
function solanaPrefixedMessage(messageBytes) {
  const header = new TextEncoder().encode(`SOL Signed Message:\n${messageBytes.length}`);
  const headerLength = new Uint8Array([header.length]);
  const combined = new Uint8Array(headerLength.length + header.length + messageBytes.length);
  combined.set(headerLength, 0);
  combined.set(header, headerLength.length);
  combined.set(messageBytes, headerLength.length + header.length);
  return combined;
}

/**
 * Confirm that the wallet behind `wallet` signed exactly this text, at this time,
 * for these details. Returns the parsed payload; the caller decides how to store it.
 */
export async function verifyPayoutPayload({ wallet, message, signature, profileJson, domain = PAYOUT_DOMAIN }) {
  let pubkeyBytes;
  let walletAddress;
  try {
    pubkeyBytes = new PublicKey(String(wallet || '').trim());
    walletAddress = pubkeyBytes.toBase58();
  } catch (err) {
    throw new ApiError(400, 'That wallet address is not valid.');
  }

  const parsed = parsePayoutMessage(message, domain);
  if (!parsed) {
    throw new ApiError(400, 'The signed text is not a message for this endpoint. Please sign it again.');
  }
  if (parsed.wallet !== walletAddress) {
    throw new ApiError(400, 'The signed text names a different wallet than the one saving it.');
  }

  const signedAt = Date.parse(parsed.updatedAt);
  if (Number.isNaN(signedAt)) {
    throw new ApiError(400, 'The signed text has no readable timestamp.');
  }
  if (Date.now() - signedAt > SIGNATURE_MAX_AGE_MS) {
    throw new ApiError(400, 'That signature is too old. Please sign the details again.');
  }

  const rawJson = String(profileJson ?? '');
  if (parsed.detailsHash !== (await sha256HexOf(rawJson))) {
    throw new ApiError(400, 'The signed text does not cover these details. Please sign them again.');
  }

  const signatureBytes = Uint8Array.from(Array.isArray(signature) ? signature : []);
  if (signatureBytes.length !== 64) {
    throw new ApiError(400, 'The wallet signature is missing or malformed.');
  }

  const messageBytes = new TextEncoder().encode(String(message));
  const verified =
    ed25519.verify(signatureBytes, messageBytes, pubkeyBytes.toBytes()) ||
    ed25519.verify(signatureBytes, solanaPrefixedMessage(messageBytes), pubkeyBytes.toBytes());
  if (!verified) {
    throw new ApiError(400, 'The wallet signature could not be verified.');
  }

  try {
    return JSON.parse(rawJson);
  } catch (err) {
    throw new ApiError(400, 'The signed details could not be read.');
  }
}
