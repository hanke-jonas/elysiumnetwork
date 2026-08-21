import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json } from '../../../_lib/http.js';
import { scheduleRebuild } from '../../../_lib/rebuild.js';

const FIELD_MAP = {
  edition: 'edition',
  name: 'name',
  pronouns: 'pronouns',
  current_role: 'current_role',
  location: 'location',
  quote: 'quote',
  bio: 'bio',
  story: 'story',
  photoUrl: 'photo_url',
  photos_json: 'photos_json',
  links_json: 'links_json',
  blocks_json: 'blocks_json',
  status: 'status',
};
const VALID_STATUSES = new Set(['pending', 'published', 'rejected']);
const MAX_SLUG_CHARS = 60;
function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX_SLUG_CHARS).replace(/-+$/, '');
}

export async function onRequestGet({ request, env, params }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;
    const row = await env.DB.prepare('SELECT * FROM dots_alumni WHERE id = ?').bind(params.id).first();
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
    if (body.status !== undefined && !VALID_STATUSES.has(body.status)) {
      return badRequest("status must be 'pending', 'published', or 'rejected'");
    }

    const current = await env.DB.prepare('SELECT published_at, slug FROM dots_alumni WHERE id = ?').bind(params.id).first();
    if (!current) return json({ error: 'Not found' }, { status: 404 });

    const sets = [];
    const values = [];
    if ('slug' in body) {
      const requestedSlug = slugify(body.slug) || current.slug;
      if (requestedSlug !== current.slug) {
        const collision = await env.DB.prepare('SELECT id FROM dots_alumni WHERE slug = ? AND id != ?').bind(requestedSlug, params.id).first();
        if (collision) return badRequest(`elysium.ngo/dots/alumni/${requestedSlug}/ is already taken by another entry.`);
      }
      sets.push('slug = ?');
      values.push(requestedSlug);
    }
    for (const [key, col] of Object.entries(FIELD_MAP)) {
      if (!(key in body)) continue;
      sets.push(`${col} = ?`);
      values.push(body[key] === undefined ? null : body[key]);
    }
    // Stamp published_at the first time an entry is approved; never move it
    // on later edits (e.g. a typo fix to the bio shouldn't bump the date).
    if (body.status === 'published' && !current.published_at) {
      sets.push('published_at = ?');
      values.push(new Date().toISOString());
    }
    if (!sets.length) return badRequest('Nothing to update');
    values.push(params.id);

    await env.DB.prepare(`UPDATE dots_alumni SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
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
    // Two other tables reference this row and must be cleared first or the
    // delete hits a FOREIGN KEY constraint: the access code that produced
    // this entry (dots_access_codes.dots_alumni_id, for staff's own
    // traceability -- detached, not deleted, so the code and the fact it's
    // used stay intact) and any edit proposals ever submitted against it
    // (dots_alumni_edits.alumni_id -- deleted outright, since a proposal
    // about a now-gone entry has nothing left to apply to).
    await env.DB.prepare("UPDATE dots_access_codes SET dots_alumni_id = NULL, entry_deleted_at = datetime('now') WHERE dots_alumni_id = ?").bind(params.id).run();
    await env.DB.prepare('DELETE FROM dots_alumni_edits WHERE alumni_id = ?').bind(params.id).run();
    await env.DB.prepare('DELETE FROM dots_alumni WHERE id = ?').bind(params.id).run();
    waitUntil(scheduleRebuild(env));
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
