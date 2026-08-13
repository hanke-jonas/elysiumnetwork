import { requireStaff } from '../../_lib/guard.js';
import { badRequest, json } from '../../_lib/http.js';

export async function onRequestGet({ request, env }) {
  const staff = await requireStaff(request, env);
  if (staff instanceof Response) return staff;

  const rows = await env.DB.prepare(
    "SELECT id, email, status, created_at, confirmed_at FROM newsletter_subscribers ORDER BY created_at DESC"
  ).all();
  const confirmed = rows.results.filter((r) => r.status === 'confirmed').length;
  return json({ items: rows.results, total: rows.results.length, confirmed });
}

// Every other admin "list" page supports at least delete (usually via
// crud.js); this was the one exception, with no way to remove a bad/spam
// subscriber short of touching the database directly. A query-string id
// (rather than a [id].js route) keeps this a single flat file matching
// how it already was, since nothing else here needs a dynamic segment.
export async function onRequestDelete({ request, env }) {
  const staff = await requireStaff(request, env);
  if (staff instanceof Response) return staff;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return badRequest('id is required');

  await env.DB.prepare('DELETE FROM newsletter_subscribers WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
