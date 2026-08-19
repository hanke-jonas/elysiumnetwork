import { requireStaff } from '../../../_lib/guard.js';
import { json } from '../../../_lib/http.js';

// Revoking a code just deletes it -- if it was already used, the
// submission it produced is untouched (dots_access_codes.dots_alumni_id
// only exists for staff's own traceability, dots_alumni doesn't reference
// it back).
export async function onRequestDelete({ request, env, params }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;
    await env.DB.prepare('DELETE FROM dots_access_codes WHERE id = ?').bind(params.id).run();
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
