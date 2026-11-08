import { newId } from './crypto';
import { insertNotifications } from './store';
import { sendMail } from './mail';

function buildRecord({ merchant, session, audience, wallet, kind, title, body, email }) {
  return {
    id: newId('ntf'),
    audience,
    merchantId: merchant.id,
    merchantName: merchant.name,
    wallet: wallet || null,
    orderId: session.id,
    kind,
    title,
    body,
    read: false,
    email: email || null,
    createdAt: new Date().toISOString(),
  };
}

async function sendOrderMail({ to, merchant, session, title, body }) {
  if (!to) return { sent: false, reason: 'no-recipient' };
  const text = [
    body,
    '',
    `Order: ${session.id}`,
    `Item: ${session.quantity} × ${session.productName}`,
    `Store: ${merchant.name}`,
    '',
    'You are receiving this because order emails are enabled for this account.',
  ].join('\n');
  return sendMail({ to, subject: title, text });
}

export async function notifySeller({ merchant, session, kind, title, body }) {
  try {
    let email = null;
    const recipient = merchant.notificationEmail || merchant.email;
    if (merchant.config?.emailNotifications === true && recipient) {
      email = await sendOrderMail({
        to: recipient,
        merchant,
        session,
        title,
        body,
      });
    }
    await insertNotifications([
      buildRecord({
        merchant,
        session,
        audience: 'merchant',
        wallet: null,
        kind,
        title,
        body,
        email,
      }),
    ]);
  } catch (err) {
    console.warn('[escrowpay] seller notification failed:', err.message);
  }
}

export async function notifyBuyer({ merchant, session, kind, title, body }) {
  if (!session.buyer) return;
  try {
    let email = null;
    if (session.notifyBuyer === true && session.buyerEmail) {
      email = await sendOrderMail({
        to: session.buyerEmail,
        merchant,
        session,
        title,
        body,
      });
    }
    await insertNotifications([
      buildRecord({
        merchant,
        session,
        audience: 'buyer',
        wallet: session.buyer,
        kind,
        title,
        body,
        email,
      }),
    ]);
  } catch (err) {
    console.warn('[escrowpay] buyer notification failed:', err.message);
  }
}
