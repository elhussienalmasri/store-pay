import { hmacSha256Hex, newId } from './crypto';
import { insertDelivery } from './store';

export async function deliverWebhook(merchant, type, data) {
  if (!merchant?.webhookUrl) {
    return { skipped: true, reason: 'No webhook URL configured' };
  }

  const event = {
    id: newId('evt'),
    type,
    createdAt: new Date().toISOString(),
    data,
  };
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await hmacSha256Hex(
    merchant.webhookSecret,
    `${timestamp}.${body}`
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  let status = 0;
  let ok = false;
  let error = '';

  try {
    const response = await fetch(merchant.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-EscrowPay-Signature': `t=${timestamp},v1=${signature}`,
        'X-EscrowPay-Event': type,
        'User-Agent': 'EscrowPay-Webhooks/1.0',
      },
      body,
      signal: controller.signal,
    });
    status = response.status;
    ok = response.ok;
  } catch (err) {
    error = err.message;
  } finally {
    clearTimeout(timeout);
  }

  await insertDelivery({
    merchantId: merchant.id,
    eventId: event.id,
    type,
    url: merchant.webhookUrl,
    status,
    ok,
    error,
  }).catch((err) => {
    console.error('[escrowpay] failed to record webhook delivery:', err.message);
  });

  return { ok, status, error, eventId: event.id };
}
