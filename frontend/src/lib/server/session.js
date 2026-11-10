import { hmacSha256Hex } from './crypto';

export const SESSION_COOKIE = 'escrowpay_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

let cachedSecret = null;

// Authentication state must be portable across server instances. A generated
// local file is unsafe in a serverless deployment because each instance differs.
function getSecret() {
  if (cachedSecret) return cachedSecret;

  const env = process.env.AUTH_SECRET?.trim();
  if (!env) {
    throw new Error('AUTH_SECRET must be set.');
  }
  cachedSecret = env;
  return cachedSecret;
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSessionToken(merchantId) {
  const payload = encodePayload({
    mid: merchantId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
  const signature = await hmacSha256Hex(getSecret(), payload);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = await hmacSha256Hex(getSecret(), payload);
  if (!constantTimeEqual(expected, signature)) return null;

  try {
    const data = decodePayload(payload);
    if (!data?.mid || typeof data.exp !== 'number') return null;
    if (data.exp * 1000 <= Date.now()) return null;
    return data.mid;
  } catch {
    return null;
  }
}

export function readSessionCookie(req) {
  const header = req.headers?.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function cookieAttributes() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_TTL_SECONDS}${cookieAttributes()}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Max-Age=0${cookieAttributes()}`
  );
}
