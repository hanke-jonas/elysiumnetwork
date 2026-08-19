import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json, randomId } from '../../../_lib/http.js';
import { scheduleRebuild } from '../../../_lib/rebuild.js';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Not built on the generic makeListCreate/makeUpdateDelete factory (unlike
// branches/team/calls/faqs) because blog posts need behavior those don't:
// a public GET that only ever exposes published rows (drafts could be
// embargoed announcements) vs. a staff-only GET for the admin list, and a
// published_at that gets stamped once on first publish and never moved
// again on later edits.
export async function onRequestGet({ request, env }) {
  try {
    const status = new URL(request.url).searchParams.get('status');

    if (status === 'published') {
      const rows = await env.DB.prepare(
        "SELECT * FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC"
      ).all();
      return json({ items: rows.results });
    }

    // Unfiltered listing (drafts included) is staff-only.
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;
    const rows = await env.DB.prepare('SELECT * FROM blog_posts ORDER BY created_at DESC').all();
    return json({ items: rows.results });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}

export async function onRequestPost({ request, env, waitUntil }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;

    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Invalid JSON body');
    const { slug, title, excerpt, bodyHtml, coverImage, authorName, category, status, seoTitle, seoDescription } = body;

    if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
      return badRequest('Slug must be lowercase letters, numbers, and single hyphens only (e.g. my-post-title)');
    }
    if (typeof title !== 'string' || !title.trim()) return badRequest('Title is required');
    if (status !== undefined && status !== 'draft' && status !== 'published') {
      return badRequest("status must be 'draft' or 'published'");
    }

    const id = randomId();
    const finalStatus = status || 'draft';
    const publishedAt = finalStatus === 'published' ? new Date().toISOString() : null;

    try {
      await env.DB.prepare(
        `INSERT INTO blog_posts
          (id, slug, title, excerpt, body_html, cover_image, author_name, category, status, seo_title, seo_description, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id, slug, title.trim(), excerpt || null, bodyHtml || '', coverImage || null,
        authorName || null, category || null, finalStatus, seoTitle || null, seoDescription || null, publishedAt
      ).run();
    } catch (err) {
      if (String(err).includes('UNIQUE constraint failed')) return badRequest('A post with this slug already exists');
      throw err;
    }

    waitUntil(scheduleRebuild(env));
    return json({ id }, { status: 201 });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
