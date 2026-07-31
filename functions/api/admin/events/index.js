import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json, randomId } from '../../../_lib/http.js';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Same shape as blog/resources: a public GET (?status=published) that never
// leaks drafts, a staff-only unfiltered GET for the admin list.
export async function onRequestGet({ request, env }) {
  try {
    const status = new URL(request.url).searchParams.get('status');

    if (status === 'published') {
      const rows = await env.DB.prepare(
        "SELECT * FROM events WHERE status = 'published' ORDER BY start_date ASC"
      ).all();
      return json({ items: rows.results });
    }

    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;
    const rows = await env.DB.prepare('SELECT * FROM events ORDER BY start_date ASC').all();
    return json({ items: rows.results });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;

    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Invalid JSON body');
    const { slug, title, description, bodyHtml, coverImage, location, branchSlug, startDate, endDate, capacity, status } = body;

    if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
      return badRequest('Slug must be lowercase letters, numbers, and single hyphens only (e.g. my-event-title)');
    }
    if (typeof title !== 'string' || !title.trim()) return badRequest('Title is required');
    if (typeof startDate !== 'string' || !startDate.trim()) return badRequest('Start date is required');
    if (status !== undefined && status !== 'draft' && status !== 'published') {
      return badRequest("status must be 'draft' or 'published'");
    }

    const id = randomId();
    try {
      await env.DB.prepare(
        `INSERT INTO events (id, slug, title, description, body_html, cover_image, location, branch_slug, start_date, end_date, capacity, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, slug, title.trim(), description || null, bodyHtml || '', coverImage || null, location || null,
        branchSlug || null, startDate, endDate || null, capacity || null, status || 'draft'
      ).run();
    } catch (err) {
      if (String(err).includes('UNIQUE constraint failed')) return badRequest('An event with this slug already exists');
      throw err;
    }

    return json({ id }, { status: 201 });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
