import { hashPassword } from '../../_lib/password.js';
import { createSession, sessionCookieHeader } from '../../_lib/session.js';
import { json, badRequest, isValidEmail, randomId } from '../../_lib/http.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return badRequest('Invalid JSON body');
  const { email, password, name, newsletterOptIn } = body;

  if (!isValidEmail(email)) return badRequest('A valid email is required');
  if (typeof password !== 'string' || password.length < 8) return badRequest('Password must be at least 8 characters');
  if (typeof name !== 'string' || !name.trim()) return badRequest('Name is required');

  const existing = await env.DB.prepare('SELECT id FROM public_users WHERE email = ?').bind(email.toLowerCase()).first();
  if (existing) return badRequest('An account with this email already exists');

  const id = randomId();
  const passwordHash = await hashPassword(password);
  await env.DB.prepare(
    'INSERT INTO public_users (id, email, password_hash, name, newsletter_opt_in) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, email.toLowerCase(), passwordHash, name.trim(), newsletterOptIn ? 1 : 0).run();

  if (newsletterOptIn) {
    // Insert-or-ignore: signing up doesn't require a separate newsletter
    // confirmation step since the account signup itself already verified
    // they control something (well, will, once verify_email lands) — kept
    // simple for now as 'pending' like any other subscribe path.
    await env.DB.prepare(
      'INSERT INTO newsletter_subscribers (id, email, status, token, public_user_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET public_user_id = excluded.public_user_id'
    ).bind(randomId(), email.toLowerCase(), 'pending', randomId(), id).run();
  }

  const session = await createSession(env.DB, 'public', id);
  return json(
    { user: { id, email: email.toLowerCase(), name: name.trim() } },
    { headers: { 'Set-Cookie': sessionCookieHeader(session.id, session.expires) } }
  );
}
