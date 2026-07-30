import { badRequest, isValidEmail, json, randomId } from '../../_lib/http.js';
import { sendEmail } from '../../_lib/email.js';

// Public, no login required — this is the newsletter-only signup path
// (footer form etc.), distinct from creating a full account in
// api/auth/signup.js. Double opt-in: status stays 'pending' until the
// recipient clicks the link in the confirmation email.
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body || !isValidEmail(body.email)) return badRequest('A valid email is required');
  const email = body.email.toLowerCase();

  const existing = await env.DB.prepare('SELECT id, status, token FROM newsletter_subscribers WHERE email = ?').bind(email).first();
  if (existing && existing.status === 'confirmed') {
    return json({ ok: true, alreadySubscribed: true });
  }

  const token = randomId();
  if (existing) {
    await env.DB.prepare(
      "UPDATE newsletter_subscribers SET status = 'pending', token = ?, unsubscribed_at = NULL WHERE id = ?"
    ).bind(token, existing.id).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO newsletter_subscribers (id, email, status, token) VALUES (?, ?, 'pending', ?)"
    ).bind(randomId(), email, token).run();
  }

  const confirmUrl = new URL(`/api/newsletter/confirm?token=${token}`, request.url).toString();
  try {
    await sendEmail(env, {
      to: email,
      subject: 'Confirm your Elysium+ Network newsletter subscription',
      html: `<p>Please confirm your subscription to the Elysium+ Network newsletter.</p><p><a href="${confirmUrl}">Confirm subscription</a></p>`,
    });
  } catch (err) {
    // 500, not 502 — Cloudflare's edge reserves 502 (and 521-530) for real
    // origin-connectivity failures and appears to replace the response body
    // with its own generic error page for those specific codes, even when a
    // Worker returns one deliberately.
    return json({ error: 'Could not send confirmation email', detail: String(err) }, { status: 500 });
  }

  return json({ ok: true, alreadySubscribed: false });
}
