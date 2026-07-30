import { verifyPassword } from '../../_lib/password.js';
import { createSession, sessionCookieHeader } from '../../_lib/session.js';
import { json, badRequest, unauthorized, isValidEmail } from '../../_lib/http.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return badRequest('Invalid JSON body');
  const { email, password } = body;
  if (!isValidEmail(email) || typeof password !== 'string') return badRequest('Email and password are required');

  const user = await env.DB.prepare('SELECT * FROM staff_users WHERE email = ?').bind(email.toLowerCase()).first();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return unauthorized('Incorrect email or password');
  }

  await env.DB.prepare('UPDATE staff_users SET last_login_at = datetime(\'now\') WHERE id = ?').bind(user.id).run();
  const session = await createSession(env.DB, 'staff', user.id);
  return json(
    { user: { id: user.id, email: user.email, name: user.name, role: user.role } },
    { headers: { 'Set-Cookie': sessionCookieHeader(session.id, session.expires) } }
  );
}
