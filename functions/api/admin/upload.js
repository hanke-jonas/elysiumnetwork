import { requireStaff } from '../../_lib/guard.js';
import { badRequest, json, randomId } from '../../_lib/http.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB — generous for a photo.
const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25MB — a full annual report with images can be sizeable.
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
    if (!ALLOWED_TYPES.has(file.type)) return badRequest('Only JPEG, PNG, WebP, GIF, SVG or PDF files are allowed');
    const maxBytes = file.type === 'application/pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) return badRequest(`File is too large — ${Math.round(maxBytes / (1024 * 1024))}MB maximum`);

    const ext = EXT_BY_TYPE[file.type] || 'bin';
    // Optional folder prefix for the media library (functions/api/admin/media) —
    // every other caller (team photos, blog covers, resource files) omits
    // this and keeps uploading to the bucket root exactly as before.
    const rawFolder = form.get('folder');
    let folder = typeof rawFolder === 'string' ? rawFolder.replace(/^\/+/, '').replace(/\.\./g, '') : '';
    if (folder && !folder.endsWith('/')) folder += '/';
    const key = `${folder}${randomId()}.${ext}`;
    await env.UPLOADS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

    return json({ url: `/uploads/${key}`, filename: file.name || null }, { status: 201 });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
