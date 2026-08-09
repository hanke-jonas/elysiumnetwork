import { json, badRequest } from '../../_lib/http.js';
import { verifyPassword } from '../../_lib/password.js';

// Fully public, unauthenticated — this is the whole point (a link + a
// password, no account). GET only confirms the share exists and returns
// its label, never the file listing; only a POST with the correct password
// gets that. There's no rate limiting here (matching the rest of this
// codebase's auth endpoints, which don't have any either) — a real gap on
// a low-traffic NGO site, worth revisiting if this ever needs to resist
// serious brute-forcing.
export async function onRequestGet({ env, params }) {
  if (!env.DB) return json({ error: 'DB is not configured' }, { status: 500 });
  const row = await env.DB.prepare('SELECT label FROM protected_folders WHERE slug = ?').bind(params.slug).first();
  if (!row) return json({ error: 'Not found' }, { status: 404 });
  return json({ label: row.label || null });
}

export async function onRequestPost({ request, env, params }) {
  if (!env.DB || !env.UPLOADS) return json({ error: 'Storage is not configured' }, { status: 500 });
  const body = await request.json().catch(() => null);
  if (!body || !body.password) return badRequest('Password is required');

  const row = await env.DB.prepare('SELECT prefix, password_hash, label FROM protected_folders WHERE slug = ?').bind(params.slug).first();
  if (!row) return json({ error: 'Not found' }, { status: 404 });

  const valid = await verifyPassword(String(body.password), row.password_hash);
  if (!valid) return json({ error: 'Incorrect password' }, { status: 401 });

  const listed = await env.UPLOADS.list({ prefix: row.prefix });
  const files = listed.objects
    .filter((o) => !o.key.endsWith('/.keep'))
    .map((o) => ({ name: o.key.slice(row.prefix.length), url: `/uploads/${o.key}`, size: o.size }));

  return json({ label: row.label || null, files });
}
