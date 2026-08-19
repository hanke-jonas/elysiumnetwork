import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json } from '../../../_lib/http.js';
import { scheduleRebuild } from '../../../_lib/rebuild.js';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FIELD_MAP = {
  slug: 'slug',
  title: 'title',
  excerpt: 'excerpt',
  bodyHtml: 'body_html',
  coverImage: 'cover_image',
  authorName: 'author_name',
  category: 'category',
  status: 'status',
  seoTitle: 'seo_title',
  seoDescription: 'seo_description',
};

export async function onRequestGet({ request, env, params }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;
    const row = await env.DB.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(params.id).first();
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
    if (body.slug !== undefined && !SLUG_RE.test(body.slug)) {
      return badRequest('Slug must be lowercase letters, numbers, and single hyphens only (e.g. my-post-title)');
    }
    if (body.status !== undefined && body.status !== 'draft' && body.status !== 'published') {
      return badRequest("status must be 'draft' or 'published'");
    }

    const current = await env.DB.prepare('SELECT published_at FROM blog_posts WHERE id = ?').bind(params.id).first();
    if (!current) return json({ error: 'Not found' }, { status: 404 });

    const sets = [];
    const values = [];
    for (const [key, col] of Object.entries(FIELD_MAP)) {
      if (!(key in body)) continue;
      sets.push(`${col} = ?`);
      values.push(body[key] === undefined ? null : body[key]);
    }
    // Stamp published_at the first time a post goes live; never move it on
    // later edits, so it keeps reflecting the original publish date.
    if (body.status === 'published' && !current.published_at) {
      sets.push('published_at = ?');
      values.push(new Date().toISOString());
    }
    if (!sets.length) return badRequest('Nothing to update');
    sets.push("updated_at = datetime('now')");
    values.push(params.id);

    try {
      await env.DB.prepare(`UPDATE blog_posts SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
    } catch (err) {
      if (String(err).includes('UNIQUE constraint failed')) return badRequest('A post with this slug already exists');
      throw err;
    }
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
    await env.DB.prepare('DELETE FROM blog_posts WHERE id = ?').bind(params.id).run();
    waitUntil(scheduleRebuild(env));
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
