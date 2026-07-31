// Thin wrapper around SendGrid's Mail Send API. SENDGRID_API_KEY is a
// Cloudflare Pages secret; NEWSLETTER_FROM_EMAIL must be the exact address
// verified as a Single Sender in SendGrid (Settings > Sender Authentication)
// — chosen specifically because it needs no DNS changes, unlike full domain
// authentication (SPF/DKIM), which would have meant touching elysium.ngo's
// DNS alongside its existing Google Workspace records.
const SENDGRID_API = 'https://api.sendgrid.com/v3/mail/send';

function fromAddress(env) {
  const raw = env.NEWSLETTER_FROM_EMAIL || 'Elysium+ Network <hanke@elysium.ngo>';
  const match = raw.match(/^(.*)<(.+)>$/);
  return match ? { name: match[1].trim(), email: match[2].trim() } : { email: raw };
}

export async function sendEmail(env, { to, subject, html }) {
  if (!env.SENDGRID_API_KEY) throw new Error('SENDGRID_API_KEY is not configured');
  const res = await fetch(SENDGRID_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: fromAddress(env),
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`SendGrid send failed (${res.status}): ${detail}`);
  }
  return { ok: true };
}

// SendGrid's personalizations array can vary the "to" per recipient in one
// call, but NOT the HTML body — and here each recipient needs their own
// unsubscribe link baked into the body. So this sends one request per
// recipient rather than true batching. Fine at this NGO's newsletter scale;
// worth revisiting (e.g. a queue) if the subscriber count ever approaches
// Cloudflare's per-request subrequest cap (50 on the free plan).
export async function sendBatch(env, emails) {
  if (!env.SENDGRID_API_KEY) throw new Error('SENDGRID_API_KEY is not configured');
  let sent = 0;
  for (const e of emails) {
    await sendEmail(env, e);
    sent += 1;
  }
  return { sent };
}
