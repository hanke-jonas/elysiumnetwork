import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json, randomId } from '../../../_lib/http.js';

// Same shape as functions/api/admin/blog/index.js and for the same reason:
// a public GET (?status=published) that never leaks drafts, vs. a
// staff-only unfiltered GET for the admin list — not a generic-crud fit.
export async function onRequestGet({ request, env }) {
  try {
    const status = new URL(request.url).searchParams.get('status');

    if (status === 'published') {
      const rows = await env.DB.prepare(
        "SELECT * FROM resources WHERE status = 'published' ORDER BY sort_order ASC, published_at DESC"
      ).all();
      return json({ items: rows.results });
    }

    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;
    const rows = await env.DB.prepare('SELECT * FROM resources ORDER BY sort_order ASC, created_at DESC').all();
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
    const { title, description, fileUrl, fileType, category, status, sortOrder } = body;

    if (typeof title !== 'string' || !title.trim()) return badRequest('Title is required');
    if (typeof fileUrl !== 'string' || !fileUrl.trim()) return badRequest('A file is required');
    if (status !== undefined && status !== 'draft' && status !== 'published') {
      return badRequest("status must be 'draft' or 'published'");
    }

    const id = randomId();
    const finalStatus = status || 'draft';
    const publishedAt = finalStatus === 'published' ? new Date().toISOString() : null;

    await env.DB.prepare(
      `INSERT INTO resources (id, sort_order, title, description, file_url, file_type, category, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, sortOrder || 0, title.trim(), description || null, fileUrl.trim(), fileType || null,
      category || null, finalStatus, publishedAt
    ).run();

    return json({ id }, { status: 201 });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
