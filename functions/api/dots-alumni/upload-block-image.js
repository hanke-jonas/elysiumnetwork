import { badRequest, json, randomId } from '../../_lib/http.js';
import { bumpUsage } from '../../_lib/usage.js';

// Image upload for the participant-facing block builder (both the initial
// submission and edit-proposal flows) -- gated by a valid access code, but
// deliberately NOT requiring it to be unused, since a participant editing
// their already-approved page needs to upload new images too. The code
// itself is only ever claimed (marked used) by the actual submit/
// propose-edit endpoints, never by this one.
const MAX_BYTES = 5 * 1024 * 1024;
const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function onRequestPost({ request, env }) {
  try {
    if (!env.UPLOADS) return json({ error: 'UPLOADS storage is not configured' }, { status: 500 });

    const form = await request.formData().catch(() => null);
    if (!form) return badRequest('Invalid form submission');

    const code = String(form.get('code') || '').trim().toUpperCase();
    if (!code) return badRequest('An access code is required');
    const codeRow = await env.DB.prepare('SELECT code FROM dots_access_codes WHERE code = ?').bind(code).first();
    if (!codeRow) return badRequest('That access code was not recognized.');

    const file = form.get('file');
    if (!file || typeof file === 'string') return badRequest('No file provided');
    if (file.size > MAX_BYTES) return badRequest(`File is too large — ${Math.round(MAX_BYTES / (1024 * 1024))}MB maximum`);
    if (!EXT_BY_TYPE[file.type]) return badRequest('Only JPEG, PNG, or WebP images are accepted');

    const key = `dots-alumni/${randomId()}.${EXT_BY_TYPE[file.type]}`;
    await env.UPLOADS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    bumpUsage(env, 'upload');

    return json({ url: `/uploads/${key}` }, { status: 201 });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
