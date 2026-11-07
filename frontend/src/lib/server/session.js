import fs from 'fs';
import path from 'path';
import { hmacSha256Hex, randomHex } from './crypto';

export const SESSION_COOKIE = 'escrowpay_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const SECRET_FILE = path.join(process.cwd(), 'data', '.auth-secret');
let cachedSecret = null;

// Prefer AUTH_SECRET from the environment; otherwise persist a generated
// secret next to the JSON database so restarts do not invalidate sessions.
function getSecret() {
  if (cachedSecret) return cachedSecret;

  const env = process.env.AUTH_SECRET;
  if (env && env.trim().length >= 32) {
    cachedSecret = env.trim();
    return cachedSecret;
  }

  try {
    const stored = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (stored.length >= 32) {
      cachedSecret = stored;
      return cachedSecret;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[escrowpay] could not read auth secret:', err.message);
    }
  }

  const generated = randomHex(32);
  try {
    fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
    fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  } catch (err) {
    console.warn(
      '[escrowpay] could not persist auth secret; sessions reset on restart:',
      err.message
    );
  }
  cachedSecret = generated;
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
