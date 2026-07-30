import { requirePublic } from '../../_lib/guard.js';
import { badRequest, json, randomId } from '../../_lib/http.js';

// Self-service profile update for the logged-in visitor — distinct from
// admin/* (staff-only, manages other people's data): this only ever touches
// the caller's own row, scoped by session.user.id, never an id from the body.
export async function onRequestPut({ request, env }) {
  const session = await requirePublic(request, env);
  if (session instanceof Response) return session;

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('Invalid JSON body');

  const name = typeof body.name === 'string' ? body.name.trim() : null;
  if (name !== null && !name) return badRequest('Name cannot be empty');
  const newsletterOptIn = typeof body.newsletterOptIn === 'boolean' ? body.newsletterOptIn : null;

  if (name === null && newsletterOptIn === null) return badRequest('Nothing to update');

  if (name !== null) {
    await env.DB.prepare('UPDATE public_users SET name = ? WHERE id = ?').bind(name, session.user.id).run();
  }

  if (newsletterOptIn !== null) {
    await env.DB.prepare('UPDATE public_users SET newsletter_opt_in = ? WHERE id = ?')
      .bind(newsletterOptIn ? 1 : 0, session.user.id).run();

    if (newsletterOptIn) {
      // Same insert-or-update as auth/signup.js — re-subscribing after having
      // unsubscribed should look identical to subscribing for the first time.
      await env.DB.prepare(
        "INSERT INTO newsletter_subscribers (id, email, status, token, public_user_id) VALUES (?, ?, 'pending', ?, ?) " +
        'ON CONFLICT(email) DO UPDATE SET status = CASE WHEN newsletter_subscribers.status = \'confirmed\' THEN \'confirmed\' ELSE \'pending\' END, public_user_id = excluded.public_user_id'
      ).bind(randomId(), session.user.email, randomId(), session.user.id).run();
    } else {
      await env.DB.prepare(
        "UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now') WHERE email = ?"
      ).bind(session.user.email).run();
    }
  }

  return json({ ok: true });
}
