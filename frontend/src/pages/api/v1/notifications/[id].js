import { sendError } from '../../../../lib/server/api';
import { deleteNotification } from '../../../../lib/server/store';
import { resolveNotificationScope } from './index';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const scope = await resolveNotificationScope(req);
    const removed = await deleteNotification(String(req.query.id || ''), scope);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(removed ? 200 : 404).json({ ok: removed });
  } catch (err) {
    sendError(res, err);
  }
}
