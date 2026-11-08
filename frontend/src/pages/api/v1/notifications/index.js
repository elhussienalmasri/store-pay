import { PublicKey } from '@solana/web3.js';
import { getClientIp, rateLimit, requireMethod, sendError } from '../../../../lib/server/api';
import { requireMerchant } from '../../../../lib/server/auth';
import {
  deleteNotifications,
  listNotifications,
  markNotificationsRead,
} from '../../../../lib/server/store';
import { isLikelyPublicKey } from '../../../../lib/widgetCore.mjs';

export async function resolveNotificationScope(req) {
  let merchant = null;
  try {
    merchant = await requireMerchant(req);
  } catch (err) {
    if (err?.status && err.status !== 401) throw err;
  }

  const walletInput = String(req.query?.wallet || req.body?.wallet || '').trim();
  const wallet = isLikelyPublicKey(walletInput)
    ? new PublicKey(walletInput).toBase58()
    : null;

  return { merchantId: merchant?.id || null, wallet };
}

function notificationView(notification) {
  return {
    id: notification.id,
    audience: notification.audience,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    orderId: notification.orderId,
    store: notification.merchantName,
    read: notification.read === true,
    email: notification.email
      ? { sent: notification.email.sent === true, reason: notification.email.reason || null }
      : null,
    createdAt: notification.createdAt,
  };
}

export default async function handler(req, res) {
  if (!['GET', 'PATCH', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const scope = await resolveNotificationScope(req);
    if (!scope.merchantId && !scope.wallet) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ notifications: [], unread: 0 });
    }

    if (req.method === 'GET') {
      rateLimit(`notifications:${getClientIp(req)}`, 120, 60_000);
      const notifications = await listNotifications(scope);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        notifications: notifications.map(notificationView),
        unread: notifications.filter((notification) => !notification.read).length,
      });
    }

    if (req.method === 'PATCH') {
      await markNotificationsRead(scope);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true });
    }

    await deleteNotifications(scope);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
}
