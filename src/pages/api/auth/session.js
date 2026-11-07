import { findUserBySession } from '../../../lib/db';
import { readSessionCookie } from '../../../lib/auth';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  return res.status(200).json({ user: findUserBySession(readSessionCookie(req)) });
}
