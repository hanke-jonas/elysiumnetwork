import { badRequest, isValidEmail, json } from '../../_lib/http.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body || !isValidEmail(body.email)) return badRequest('A valid email is required');
  const email = body.email.toLowerCase();

  const existing = await env.DB.prepare('SELECT id, status, token FROM newsletter_subscribers WHERE email = ?').bind(email).first();

  return json({ ok: true, debug: 'after D1 select', existing: existing || null });
}
