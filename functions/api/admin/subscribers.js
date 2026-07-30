import { requireStaff } from '../../_lib/guard.js';
import { json } from '../../_lib/http.js';

export async function onRequestGet({ request, env }) {
  const staff = await requireStaff(request, env);
  if (staff instanceof Response) return staff;

  const rows = await env.DB.prepare(
    "SELECT id, email, status, created_at, confirmed_at FROM newsletter_subscribers ORDER BY created_at DESC"
  ).all();
  const confirmed = rows.results.filter((r) => r.status === 'confirmed').length;
  return json({ items: rows.results, total: rows.results.length, confirmed });
}
