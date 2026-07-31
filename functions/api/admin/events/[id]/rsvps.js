import { requireStaff } from '../../../../_lib/guard.js';
import { json } from '../../../../_lib/http.js';

// Staff-only visibility into who's coming to a specific event.
export async function onRequestGet({ request, env, params }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;

    const rows = await env.DB.prepare(
      `SELECT u.name, u.email, r.created_at
       FROM event_rsvps r JOIN public_users u ON u.id = r.user_id
       WHERE r.event_id = ? ORDER BY r.created_at ASC`
    ).bind(params.id).all();

    return json({ items: rows.results, total: rows.results.length });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
