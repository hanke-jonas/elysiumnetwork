import { requireStaff } from '../../_lib/guard.js';
import { badRequest, json, randomId } from '../../_lib/http.js';
import { bumpUsage } from '../../_lib/usage.js';

// Any file type is accepted now — the risk that used to matter (an
// uploaded HTML/SVG file executing script when someone opens its URL
// directly) is handled at serve time instead (functions/uploads/[[path]].js
// forces anything outside a small known-safe set to download rather than
// render inline), so it doesn't need to be a gate here too.
const MAX_BYTES = 90 * 1024 * 1024; // 90MB — Cloudflare's own Workers request-body ceiling on this plan is ~100MB; this leaves headroom for multipart overhead.
const EXT_BY_TYPE = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
};

// Staff-only file upload backing every drag-and-drop picker in the admin
// panel (team photos, blog cover images, resource PDFs) — stores to R2 and
// hands back a URL under this same domain (served by
// functions/uploads/[[path]].js), so staff never need to know or paste a
// path themselves.
export async function onRequestPost({ request, env }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;

    if (!env.UPLOADS) return json({ error: 'UPLOADS storage is not configured' }, { status: 500 });

    const form = await request.formData().catch(() => null);
    const file = form && form.get('file');
    if (!file || typeof file === 'string') return badRequest('No file provided');
    if (file.size > MAX_BYTES) return badRequest(`File is too large — ${Math.round(MAX_BYTES / (1024 * 1024))}MB maximum`);

    // Falls back to the original filename's own extension for types outside
    // the known-mapped set, rather than a meaningless ".bin" on everything
    // uploaded that isn't an image or PDF.
    const nameExt = (file.name || '').split('.').pop();
    const ext = EXT_BY_TYPE[file.type] || (nameExt && nameExt.length <= 8 ? nameExt.toLowerCase() : 'bin');
    // Optional folder prefix for the media library (functions/api/admin/media) —
    // every other caller (team photos, blog covers, resource files) omits
    // this and keeps uploading to the bucket root exactly as before.
    const rawFolder = form.get('folder');
    let folder = typeof rawFolder === 'string' ? rawFolder.replace(/^\/+/, '').replace(/\.\./g, '') : '';
    if (folder && !folder.endsWith('/')) folder += '/';
    const key = `${folder}${randomId()}.${ext}`;
    await env.UPLOADS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    bumpUsage(env, 'upload');

    return json({ url: `/uploads/${key}`, filename: file.name || null }, { status: 201 });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
