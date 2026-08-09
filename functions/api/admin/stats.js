import { requireStaff } from '../../_lib/guard.js';
import { json } from '../../_lib/http.js';

// Cloudflare's own free tier for R2 (checked against Cloudflare's published
// pricing, not something this codebase can query live): 10GB storage,
// 1M Class A ops/month (writes — approximated here by our own upload
// counter), 10M Class B ops/month (reads — approximated by our own view
// counter). Real bandwidth/egress isn't exposed to a Worker binding at all,
// but R2 egress is free forever regardless of volume, so it's not a number
// that would ever cost anything — the UI says so rather than faking a
// number for it.
const FREE_STORAGE_BYTES = 10 * 1024 * 1024 * 1024;
const FREE_UPLOADS_PER_MONTH = 1_000_000;
const FREE_VIEWS_PER_MONTH = 10_000_000;

export async function onRequestGet({ request, env }) {
  const staff = await requireStaff(request, env);
  if (staff instanceof Response) return staff;
  if (!env.UPLOADS) return json({ error: 'UPLOADS storage is not configured' }, { status: 500 });

  let bytes = 0;
  let objectCount = 0;
  let cursor;
  do {
    const page = await env.UPLOADS.list({ cursor, limit: 1000 });
    for (const obj of page.objects) bytes += obj.size;
    objectCount += page.objects.length;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const period = new Date().toISOString().slice(0, 7);
  let uploads = 0;
  let views = 0;
  if (env.DB) {
    const rows = await env.DB.prepare('SELECT metric, count FROM usage_counters WHERE period = ?').bind(period).all();
    for (const row of rows.results || []) {
      if (row.metric === 'upload') uploads = row.count;
      if (row.metric === 'view') views = row.count;
    }
  }

  return json({
    storage: { bytes, objectCount, freeBytes: FREE_STORAGE_BYTES },
    month: { period, uploads, views, freeUploads: FREE_UPLOADS_PER_MONTH, freeViews: FREE_VIEWS_PER_MONTH },
  });
}
