import nodemailer from 'nodemailer';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

let smtpTransport = null;

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);
}

function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

function getSmtpTransport() {
  if (!smtpTransport) {
    const port = Number(process.env.SMTP_PORT || 587);
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE === 'true'
        : port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return smtpTransport;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendViaSmtp({ to, subject, text }) {
  try {
    const info = await getSmtpTransport().sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text,
      html: `<p>${escapeHtml(text)}</p>`,
    });
    return { sent: true, id: info?.messageId || null, transport: 'smtp' };
  } catch (err) {
    return { sent: false, reason: err.message, transport: 'smtp' };
  }
}

async function sendViaResend({ to, subject, text }) {
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [to],
        subject,
        text,
        html: `<p>${escapeHtml(text)}</p>`,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        sent: false,
        reason: data?.message || `HTTP ${response.status}`,
        transport: 'resend',
      };
    }
    return { sent: true, id: data?.id || null, transport: 'resend' };
  } catch (err) {
    return { sent: false, reason: err.message, transport: 'resend' };
  }
}

export async function sendMail({ to, subject, text }) {
  if (!to) return { sent: false, reason: 'no-recipient' };

  if (smtpConfigured()) {
    return sendViaSmtp({ to, subject, text });
  }

  if (resendConfigured()) {
    return sendViaResend({ to, subject, text });
  }

  console.info(
    '[escrowpay] email skipped (set SMTP_HOST + MAIL_FROM, or RESEND_API_KEY + MAIL_FROM):',
    subject,
    '->',
    to
  );
  return { sent: false, reason: 'not-configured' };
}
