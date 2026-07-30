import { badRequest, isValidEmail, json, randomId } from '../../_lib/http.js';

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

  return json({ ok: true, debug: 'after D1 insert/update', token });
}
