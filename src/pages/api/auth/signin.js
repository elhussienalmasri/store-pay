import { createSession, findUserByEmail } from '../../../lib/db';
import {
  newSessionToken,
  sessionCookieHeader,
  sessionExpiry,
  validateSignin,
  verifyPassword,
} from '../../../lib/auth';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { errors, value } = validateSignin(req.body || {});
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors, error: 'Check the highlighted fields.' });
  }

  const account = findUserByEmail(value.email);
  if (!account || !verifyPassword(value.password, account.passwordHash)) {
    return res.status(401).json({
      errors: { password: 'Email or password is wrong.' },
      error: 'Email or password is wrong.',
    });
  }

  const token = newSessionToken();
  createSession({ userId: account.id, token, expiresAt: sessionExpiry() });
  res.setHeader('Set-Cookie', sessionCookieHeader(token));

  return res.status(200).json({ user: { id: account.id, name: account.name, email: account.email } });
}
