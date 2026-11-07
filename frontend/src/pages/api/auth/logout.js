import { requireMethod, sendError } from '../../../lib/server/api';
import { clearSessionCookie } from '../../../lib/server/session';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;

  try {
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
}
