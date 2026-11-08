import { sendError } from '../../../../lib/server/api';
import {
  deleteNotification,
  markNotificationRead,
} from '../../../../lib/server/store';
import { resolveNotificationScope } from './index';

export default async function handler(req, res) {
  if (!['PATCH', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'PATCH, DELETE');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const scope = await resolveNotificationScope(req);
    const id = String(req.query.id || '');

    if (req.method === 'PATCH') {
      const updated = await markNotificationRead(id, scope);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(updated ? 200 : 404).json({ ok: updated });
    }

    const removed = await deleteNotification(id, scope);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(removed ? 200 : 404).json({ ok: removed });
  } catch (err) {
    sendError(res, err);
  }
}
