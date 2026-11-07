import { createSession, createUser, findUserByEmail } from '../../../lib/db';
import {
  hashPassword,
  newSessionToken,
  sessionCookieHeader,
  sessionExpiry,
  validateSignup,
} from '../../../lib/auth';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { errors, value } = validateSignup(req.body || {});
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors, error: 'Check the highlighted fields.' });
  }

  if (findUserByEmail(value.email)) {
    return res
      .status(409)
      .json({ errors: { email: 'An account already uses this email. Sign in instead.' }, error: 'That email is taken.' });
  }

  const user = createUser({
    name: value.name,
    email: value.email,
    passwordHash: hashPassword(value.password),
    createdAt: new Date().toISOString(),
  });

  const token = newSessionToken();
  createSession({ userId: user.id, token, expiresAt: sessionExpiry() });
  res.setHeader('Set-Cookie', sessionCookieHeader(token));

  return res.status(201).json({ user });
}
