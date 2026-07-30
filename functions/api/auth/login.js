import { verifyPassword } from '../../_lib/password.js';
import { createSession, sessionCookieHeader } from '../../_lib/session.js';
import { json, badRequest, unauthorized, isValidEmail } from '../../_lib/http.js';

// Public-user login only. Staff sign in through /api/auth/staff-login
// instead — kept as a separate endpoint (not a shared one with a "type"
// field) so this one physically cannot be used to probe whether an email
// exists in the staff table.
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return badRequest('Invalid JSON body');
  const { email, password } = body;
  if (!isValidEmail(email) || typeof password !== 'string') return badRequest('Email and password are required');

  const user = await env.DB.prepare('SELECT * FROM public_users WHERE email = ?').bind(email.toLowerCase()).first();
  // Same generic error whether the email doesn't exist or the password is
  // wrong — don't reveal which one it was.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return unauthorized('Incorrect email or password');
  }

  await env.DB.prepare('UPDATE public_users SET last_login_at = datetime(\'now\') WHERE id = ?').bind(user.id).run();
  const session = await createSession(env.DB, 'public', user.id);
  return json(
    { user: { id: user.id, email: user.email, name: user.name } },
    { headers: { 'Set-Cookie': sessionCookieHeader(session.id, session.expires) } }
  );
}
