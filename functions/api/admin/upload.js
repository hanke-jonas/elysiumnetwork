import { requireStaff } from '../../_lib/guard.js';
import { badRequest, json, randomId } from '../../_lib/http.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);
const MAX_BYTES = 8 * 1024 * 1024; // 8MB — generous for a photo, small enough to not abuse R2/CPU time.
const EXT_BY_TYPE = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg',
};

// Staff-only image upload backing the drag-and-drop pickers in the team and
// blog editors — stores to R2 and hands back a URL under this same domain
// (served by functions/uploads/[[path]].js), so staff never need to know or
// paste a path themselves.
export async function onRequestPost({ request, env }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;

    if (!env.UPLOADS) return json({ error: 'UPLOADS storage is not configured' }, { status: 500 });

    const form = await request.formData().catch(() => null);
    const file = form && form.get('file');
    if (!file || typeof file === 'string') return badRequest('No file provided');
    if (!ALLOWED_TYPES.has(file.type)) return badRequest('Only JPEG, PNG, WebP, GIF or SVG images are allowed');
    if (file.size > MAX_BYTES) return badRequest('Image is too large — 8MB maximum');

    const ext = EXT_BY_TYPE[file.type] || 'bin';
    const key = `${randomId()}.${ext}`;
    await env.UPLOADS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

    return json({ url: `/uploads/${key}` }, { status: 201 });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
