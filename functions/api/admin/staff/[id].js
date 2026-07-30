import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json } from '../../../_lib/http.js';

export async function onRequestPut({ request, env, params }) {
  const staff = await requireStaff(request, env, { requireOwner: true });
  if (staff instanceof Response) return staff;

  const body = await request.json().catch(() => null);
  if (!body || (body.role !== 'owner' && body.role !== 'editor')) return badRequest("role must be 'owner' or 'editor'");

  await env.DB.prepare('UPDATE staff_users SET role = ? WHERE id = ?').bind(body.role, params.id).run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const staff = await requireStaff(request, env, { requireOwner: true });
  if (staff instanceof Response) return staff;

  // An owner can't delete their own account — otherwise a lone owner could
  // lock every staff member out with no way back in short of a DB console.
  if (params.id === staff.user.id) return badRequest('You cannot delete your own account');

  await env.DB.prepare('DELETE FROM staff_users WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
