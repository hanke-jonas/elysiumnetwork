import { hashPassword } from '../../_lib/password.js';
import { createSession, sessionCookieHeader } from '../../_lib/session.js';
import { json, badRequest, isValidEmail, randomId } from '../../_lib/http.js';
import { sendEmail } from '../../_lib/email.js';

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

  const verifyToken = randomId();
  const verifyExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO public_user_tokens (id, user_id, kind, expires_at) VALUES (?, ?, 'verify_email', ?)"
  ).bind(verifyToken, id, verifyExpires).run();

  // Never let a flaky/unconfigured email provider break account creation —
  // the account and session are already committed above regardless.
  try {
    const verifyUrl = new URL(`/api/auth/verify-email?token=${verifyToken}`, request.url).toString();
    await sendEmail(env, {
      to: email.toLowerCase(),
      subject: 'Welcome to Elysium+ Network',
      html: `<p>Welcome to Elysium+ Network, ${name.trim()}!</p>` +
        `<p>Your account has been created. You can now log in, express interest in Active Calls, and manage your newsletter preference from your profile.</p>` +
        `<p><a href="${verifyUrl}">Confirm your email address</a></p>`,
    });
  } catch (err) {
    console.warn(`Welcome/verification email failed for ${email}: ${err}`);
  }

  const session = await createSession(env.DB, 'public', id);
  return json(
    { user: { id, email: email.toLowerCase(), name: name.trim() } },
    { headers: { 'Set-Cookie': sessionCookieHeader(session.id, session.expires) } }
  );
}
