import { isOriginAllowed } from '../widgetCore.mjs';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function sendError(res, error) {
  const status = error?.status || 500;
  const message = error?.message || 'Unexpected server error';
  if (status >= 500) {
    console.error('[escrowpay]', error);
  }
  return res.status(status).json({ error: message });
}

export function requireMethod(req, res, method) {
  if (req.method !== method) {
    res.setHeader('Allow', method);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
    return false;
  }
  return true;
}

export function getAppOrigin(req) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

export function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function assertOriginAllowed(req, merchant) {
  const origin = req.headers.origin;
  if (!origin) return;
  if (!isOriginAllowed(origin, merchant.domains)) {
    throw new ApiError(403, `Origin ${origin} is not registered for this store`);
  }
}

export function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

const buckets = new Map();

export function rateLimit(key, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.startedAt > windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw new ApiError(429, 'Too many requests. Please try again shortly.');
  }
}
