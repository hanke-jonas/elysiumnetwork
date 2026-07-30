import { hashPassword } from '../../_lib/password.js';
import { badRequest, isValidEmail, json, randomId } from '../../_lib/http.js';

// Solves the chicken-and-egg problem of staff accounts: public signup is
// open, but staff accounts must never be self-service — so the very first
// owner account can't be created through the normal admin/staff endpoint
// (which requires an existing owner to call it). This endpoint only works
// once: it creates an 'owner' account IF AND ONLY IF staff_users is
// currently empty, then is permanently inert for the lifetime of the DB.
export async function onRequestPost({ request, env }) {
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM staff_users').first();
  if (count.n > 0) return badRequest('Staff already provisioned; use the admin panel to add more accounts');

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('Invalid JSON body');
  const { email, password, name } = body;
  if (!isValidEmail(email)) return badRequest('A valid email is required');
  if (typeof password !== 'string' || password.length < 8) return badRequest('Password must be at least 8 characters');
  if (typeof name !== 'string' || !name.trim()) return badRequest('Name is required');

  const id = randomId();
  const passwordHash = await hashPassword(password);
  await env.DB.prepare(
    "INSERT INTO staff_users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, 'owner')"
  ).bind(id, email.toLowerCase(), passwordHash, name.trim()).run();

  return json({ ok: true, id }, { status: 201 });
}
