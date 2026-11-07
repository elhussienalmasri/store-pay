import { ApiError, getBearerToken } from './api';
import {
  findMerchantByPublishableKey,
  findMerchantBySecret,
  findSessionByToken,
} from './store';

export async function requireMerchant(req) {
  const secretKey = getBearerToken(req) || req.headers['x-api-key'];
  if (!secretKey) {
    throw new ApiError(401, 'Missing merchant API key');
  }
  const merchant = await findMerchantBySecret(secretKey);
  if (!merchant) {
    throw new ApiError(401, 'Invalid merchant API key');
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

  if (!publishableKey) {
    throw new ApiError(401, 'Provide a publishable key or merchant secret key');
  }

  const merchant = await findMerchantByPublishableKey(publishableKey);
  if (!merchant) throw new ApiError(401, 'Invalid publishable key');
  return { merchant, authenticatedAs: 'publishable' };
}

export async function requireSessionToken(sessionId, token) {
  if (!token) throw new ApiError(401, 'Missing checkout token');
  const session = await findSessionByToken(sessionId, token);
  if (!session) {
    throw new ApiError(404, 'Checkout session not found or token is invalid');
  }
  return session;
}
