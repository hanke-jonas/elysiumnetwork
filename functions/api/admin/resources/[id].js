import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json } from '../../../_lib/http.js';
import { scheduleRebuild } from '../../../_lib/rebuild.js';

const FIELD_MAP = {
  title: 'title',
  description: 'description',
  fileUrl: 'file_url',
  fileType: 'file_type',
  category: 'category',
  status: 'status',
  sortOrder: 'sort_order',
};

export async function onRequestGet({ request, env, params }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;
    const row = await env.DB.prepare('SELECT * FROM resources WHERE id = ?').bind(params.id).first();
    if (!row) return json({ error: 'Not found' }, { status: 404 });
    return json(row);
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}

export async function onRequestPut({ request, env, params, waitUntil }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;

    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Invalid JSON body');
    if (body.status !== undefined && body.status !== 'draft' && body.status !== 'published') {
      return badRequest("status must be 'draft' or 'published'");
    }

    const current = await env.DB.prepare('SELECT published_at FROM resources WHERE id = ?').bind(params.id).first();
    if (!current) return json({ error: 'Not found' }, { status: 404 });

    const sets = [];
    const values = [];
    for (const [key, col] of Object.entries(FIELD_MAP)) {
      if (!(key in body)) continue;
      sets.push(`${col} = ?`);
      values.push(body[key] === undefined ? null : body[key]);
    }
    if (body.status === 'published' && !current.published_at) {
      sets.push('published_at = ?');
      values.push(new Date().toISOString());
    }
    if (!sets.length) return badRequest('Nothing to update');
    sets.push("updated_at = datetime('now')");
    values.push(params.id);

    await env.DB.prepare(`UPDATE resources SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
    waitUntil(scheduleRebuild(env));
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}

export async function onRequestDelete({ request, env, params, waitUntil }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;
    await env.DB.prepare('DELETE FROM resources WHERE id = ?').bind(params.id).run();
    waitUntil(scheduleRebuild(env));
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
