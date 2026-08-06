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
    // Newsletter signup is in beta while email sending is still being set
    // up — the subscriber row above is already saved (status 'pending'),
    // so a failed confirmation email shouldn't read as a failed signup to
    // the visitor. Logged, not surfaced, same as the welcome email in
    // api/auth/signup.js; confirmation emails go out once this is fixed.
    console.warn(`Newsletter confirmation email failed to send to ${email}: ${err}`);
  }

  return json({ ok: true, alreadySubscribed: false });
}
