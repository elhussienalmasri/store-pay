const encoder = new TextEncoder();

function toHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function randomHex(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export function newId(prefix) {
  return `${prefix}_${randomHex(12)}`;
}

export function newApiKey(prefix) {
  return `${prefix}_${randomHex(24)}`;
}

export async function sha256Hex(value) {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    encoder.encode(String(value))
  );
  return toHex(new Uint8Array(digest));
}

export async function hmacSha256Hex(secret, message) {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(String(message))
  );
  return toHex(new Uint8Array(signature));
}

export function generateMerchantKeys() {
  return {
    publishableKey: newApiKey('pk_live'),
    secretKey: newApiKey('sk_live'),
    webhookSecret: newApiKey('whsec'),
  };
}

export function randomUint64String() {
  return BigInt(`0x${randomHex(8)}`).toString();
}

export function randomSessionToken() {
  return randomHex(32);
}
