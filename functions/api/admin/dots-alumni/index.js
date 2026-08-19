import { requireStaff } from '../../../_lib/guard.js';
import { json } from '../../../_lib/http.js';

// Not built on the generic makeListCreate/makeUpdateDelete factory (same
// reasoning as blog_posts): a public GET must only ever expose
// 'published' rows -- pending submissions could contain anything, since
// this is the one open, unauthenticated public-submission form in the
// codebase -- vs. a staff-only GET for the moderation queue that needs
// every status. There's no admin-initiated POST here on purpose: every
// row starts life through the public submit endpoint
// (functions/api/dots-alumni/submit.js); staff only ever transition an
// existing row's status via [id].js.
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    if (status === 'published') {
      const edition = url.searchParams.get('edition');
      const rows = edition
        ? await env.DB.prepare("SELECT * FROM dots_alumni WHERE status = 'published' AND edition = ? ORDER BY published_at DESC").bind(edition).all()
        : await env.DB.prepare("SELECT * FROM dots_alumni WHERE status = 'published' ORDER BY edition DESC, published_at DESC").all();
      return json({ items: rows.results });
    }

    // Unfiltered listing (pending/rejected included) is staff-only.
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;
    const rows = await env.DB.prepare('SELECT * FROM dots_alumni ORDER BY submitted_at DESC').all();
    return json({ items: rows.results });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
