import { randomHex } from './crypto';

const ITERATIONS = 210_000;
const KEY_BITS = 256;
const encoder = new TextEncoder();

function toHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function derive(password, salt, iterations) {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(String(password)),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations,
      hash: 'SHA-256',
    },
    key,
    KEY_BITS
  );
  return toHex(new Uint8Array(bits));
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

export async function hashPassword(password) {
  const salt = randomHex(16);
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, iterationsRaw, salt, hash] = stored.split('$');
  const iterations = Number(iterationsRaw);
  if (scheme !== 'pbkdf2' || !salt || !hash || !Number.isFinite(iterations)) {
    return false;
  }
  const candidate = await derive(password, salt, iterations);
  return constantTimeEqual(candidate, hash);
}

export function isPasswordStrongEnough(password) {
  const value = String(password || '');
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}
