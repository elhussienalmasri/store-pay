import { destroySession } from '../../../lib/db';
import { clearSessionCookieHeader, readSessionCookie } from '../../../lib/auth';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  destroySession(readSessionCookie(req));
  res.setHeader('Set-Cookie', clearSessionCookieHeader());
  return res.status(200).json({ user: null });
}
