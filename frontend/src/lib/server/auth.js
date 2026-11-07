import { ApiError, getBearerToken } from './api';
import {
  findMerchantById,
  findMerchantByPublishableKey,
  findMerchantBySecret,
  findSessionByToken,
} from './store';
import { readSessionCookie, verifySessionToken } from './session';

export async function merchantFromSession(req) {
  const token = readSessionCookie(req);
  if (!token) return null;
  const merchantId = await verifySessionToken(token);
  if (!merchantId) return null;
  return findMerchantById(merchantId);
}

export async function requireMerchant(req) {
  const secretKey = getBearerToken(req) || req.headers['x-api-key'];
  if (secretKey) {
    const merchant = await findMerchantBySecret(secretKey);
    if (!merchant) {
      throw new ApiError(401, 'Invalid merchant API key');
    }
    return merchant;
  }

  const sessionMerchant = await merchantFromSession(req);
  if (sessionMerchant) return sessionMerchant;

  throw new ApiError(401, 'Missing merchant API key');
}

export async function requireAuthMerchant(req) {
  const merchant = await merchantFromSession(req);
  if (!merchant) {
    throw new ApiError(401, 'Sign in to continue');
  }
  return merchant;
}

export async function resolveMerchantFromRequest(req, publishableKey) {
  const secretKey = getBearerToken(req) || req.headers['x-api-key'];
  if (secretKey) {
    const merchant = await findMerchantBySecret(secretKey);
    if (!merchant) throw new ApiError(401, 'Invalid merchant API key');
    return { merchant, authenticatedAs: 'secret' };
  }

  if (publishableKey) {
    const merchant = await findMerchantByPublishableKey(publishableKey);
    if (!merchant) throw new ApiError(401, 'Invalid publishable key');
    return { merchant, authenticatedAs: 'publishable' };
  }

  const sessionMerchant = await merchantFromSession(req);
  if (sessionMerchant) {
    return { merchant: sessionMerchant, authenticatedAs: 'session' };
  }

  throw new ApiError(401, 'Provide a publishable key or merchant secret key');
}

export async function requireSessionToken(sessionId, token) {
  if (!token) throw new ApiError(401, 'Missing checkout token');
  const session = await findSessionByToken(sessionId, token);
  if (!session) {
    throw new ApiError(404, 'Checkout session not found or token is invalid');
  }
  return session;
}
