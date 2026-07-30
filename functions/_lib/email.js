// Thin wrapper around Resend's API. RESEND_API_KEY is a Cloudflare Pages
// secret (never committed); NEWSLETTER_FROM_EMAIL is a plain env var since
// it's not sensitive, just needs to be an address on a domain verified in
// the Resend dashboard.
const RESEND_API = 'https://api.resend.com';

export async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const res = await fetch(`${RESEND_API}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.NEWSLETTER_FROM_EMAIL || 'Elysium+ Network <onboarding@resend.dev>',
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend send failed (${res.status}): ${detail}`);
  }
  return res.json();
}

// Resend's batch endpoint accepts up to 100 messages per call. Each
// recipient gets an individually-addressed email (not one email with 100
// people in `to`), so unsubscribe links stay per-recipient.
export async function sendBatch(env, emails) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const from = env.NEWSLETTER_FROM_EMAIL || 'Elysium+ Network <onboarding@resend.dev>';
  const chunks = [];
  for (let i = 0; i < emails.length; i += 100) chunks.push(emails.slice(i, i + 100));

  let sent = 0;
  for (const chunk of chunks) {
    const res = await fetch(`${RESEND_API}/emails/batch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk.map((e) => ({ from, to: e.to, subject: e.subject, html: e.html }))),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend batch send failed after ${sent} sent (${res.status}): ${detail}`);
    }
    sent += chunk.length;
  }
  return { sent };
}
