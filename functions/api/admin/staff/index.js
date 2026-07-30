import { requireStaff } from '../../../_lib/guard.js';
import { hashPassword } from '../../../_lib/password.js';
import { badRequest, isValidEmail, json, randomId } from '../../../_lib/http.js';

export async function onRequestGet({ request, env }) {
  const staff = await requireStaff(request, env, { requireOwner: true });
  if (staff instanceof Response) return staff;

  const rows = await env.DB.prepare(
    'SELECT id, email, name, role, created_at, last_login_at FROM staff_users ORDER BY created_at ASC'
  ).all();
  return json({ items: rows.results });
}

// Owner-only — this is the normal path for adding staff accounts after the
// first owner exists via auth/bootstrap-staff.js.
export async function onRequestPost({ request, env }) {
  const staff = await requireStaff(request, env, { requireOwner: true });
  if (staff instanceof Response) return staff;

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('Invalid JSON body');
  const { email, password, name, role } = body;
  if (!isValidEmail(email)) return badRequest('A valid email is required');
  if (typeof password !== 'string' || password.length < 8) return badRequest('Password must be at least 8 characters');
  if (typeof name !== 'string' || !name.trim()) return badRequest('Name is required');
  if (role !== 'owner' && role !== 'editor') return badRequest("role must be 'owner' or 'editor'");

  const existing = await env.DB.prepare('SELECT id FROM staff_users WHERE email = ?').bind(email.toLowerCase()).first();
  if (existing) return badRequest('A staff account with this email already exists');

  const id = randomId();
  const passwordHash = await hashPassword(password);
  await env.DB.prepare(
    'INSERT INTO staff_users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, email.toLowerCase(), passwordHash, name.trim(), role).run();

  return json({ id }, { status: 201 });
}
