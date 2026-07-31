import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json } from '../../../_lib/http.js';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FIELD_MAP = {
  slug: 'slug',
  title: 'title',
  description: 'description',
  bodyHtml: 'body_html',
  coverImage: 'cover_image',
  location: 'location',
  branchSlug: 'branch_slug',
  startDate: 'start_date',
  endDate: 'end_date',
  capacity: 'capacity',
  status: 'status',
};

export async function onRequestGet({ request, env, params }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;
    const row = await env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(params.id).first();
    if (!row) return json({ error: 'Not found' }, { status: 404 });
    return json(row);
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}

export async function onRequestPut({ request, env, params }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;

    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Invalid JSON body');
    if (body.slug !== undefined && !SLUG_RE.test(body.slug)) {
      return badRequest('Slug must be lowercase letters, numbers, and single hyphens only');
    }
    if (body.status !== undefined && body.status !== 'draft' && body.status !== 'published') {
      return badRequest("status must be 'draft' or 'published'");
    }

    const sets = [];
    const values = [];
    for (const [key, col] of Object.entries(FIELD_MAP)) {
      if (!(key in body)) continue;
      sets.push(`${col} = ?`);
      values.push(body[key] === undefined ? null : body[key]);
    }
    if (!sets.length) return badRequest('Nothing to update');
    sets.push("updated_at = datetime('now')");
    values.push(params.id);

    try {
      await env.DB.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
    } catch (err) {
      if (String(err).includes('UNIQUE constraint failed')) return badRequest('An event with this slug already exists');
      throw err;
    }
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;
    // RSVPs reference this event_id but have no FK cascade in SQLite by
    // default — clean them up explicitly so deleting an event never leaves
    // orphaned rows behind.
    await env.DB.batch([
      env.DB.prepare('DELETE FROM event_rsvps WHERE event_id = ?').bind(params.id),
      env.DB.prepare('DELETE FROM events WHERE id = ?').bind(params.id),
    ]);
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
