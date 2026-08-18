// Thin wrapper around Resend's email API. RESEND_API_KEY is a Cloudflare
// Pages secret; NEWSLETTER_FROM_EMAIL is the sending address, in either
// "you@example.com" or "Display Name <you@example.com>" form -- Resend
// accepts both directly as the "from" field, no need to split them apart.
const RESEND_API = 'https://api.resend.com/emails';

function fromAddress(env) {
  return env.NEWSLETTER_FROM_EMAIL || 'Elysium+ Network <hanke@elysium.ngo>';
}

export async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(env),
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend send failed (${res.status}): ${detail}`);
  }
  return { ok: true };
}

// Resend's API takes one "to" list per call but not a per-recipient body,
// and here each recipient needs their own unsubscribe link baked into the
// HTML -- so this sends one request per recipient rather than true
// batching. Fine at this NGO's newsletter scale; worth revisiting (e.g. a
// queue) if the subscriber count ever approaches Cloudflare's per-request
// subrequest cap (50 on the free plan).
export async function sendBatch(env, emails) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  let sent = 0;
  for (const e of emails) {
    await sendEmail(env, e);
    sent += 1;
  }
  return { sent };
}
