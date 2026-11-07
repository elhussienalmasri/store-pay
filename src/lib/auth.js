const crypto = require('node:crypto');

const SCRYPT_KEYLEN = 32;
const SESSION_TTL_DAYS = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(String(password), salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function newSessionToken() {
  return crypto.randomBytes(24).toString('hex');
}

function sessionExpiry(now = new Date()) {
  return new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function validateSignup({ name, email, password }) {
  const errors = {};
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const secret = String(password || '');

  if (cleanName.length < 2) errors.name = 'Enter the name you want shown on orders.';
  if (!EMAIL_PATTERN.test(cleanEmail)) errors.email = 'Enter a valid email address.';
  if (secret.length < 8) errors.password = 'Use at least 8 characters for your password.';

  return { errors, value: { name: cleanName, email: cleanEmail, password: secret } };
}

function validateSignin({ email, password }) {
  const errors = {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(cleanEmail)) errors.email = 'Enter the email you signed up with.';
  if (String(password || '').length === 0) errors.password = 'Enter your password.';
  return { errors, value: { email: cleanEmail, password: String(password || '') } };
}

const SESSION_COOKIE = 'shop_session';

function readSessionCookie(req) {
  const fromParsed = req.cookies ? req.cookies[SESSION_COOKIE] : undefined;
  if (fromParsed) return fromParsed;
  const header = String(req.headers.cookie || '');
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function sessionCookieHeader(token, maxAgeSeconds = SESSION_TTL_DAYS * 24 * 60 * 60) {
  const expires = new Date(Date.now() + maxAgeSeconds * 1000).toUTCString();
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}; Expires=${expires}`;
}

function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
  hashPassword,
  verifyPassword,
  newSessionToken,
  sessionExpiry,
  readSessionCookie,
  sessionCookieHeader,
  clearSessionCookieHeader,
  validateSignup,
  validateSignin,
};
