import { requireUgobongoAdmin } from '../../_lib/ugobongoAuth.js';
import { badRequest, json, randomId } from '../../_lib/http.js';

const MAX_BYTES = 20 * 1024 * 1024;
const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

export async function onRequestPost({ request, env }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;
  if (!env.UPLOADS) return json({ error: 'UPLOADS storage is not configured' }, { status: 500 });

  const form = await request.formData().catch(() => null);
  const file = form && form.get('file');
  if (!file || typeof file === 'string') return badRequest('No file provided');
  if (file.size > MAX_BYTES) return badRequest('File is too large — 20MB maximum');
  if (!EXT_BY_TYPE[file.type]) return badRequest('Only JPEG, PNG, WebP, or GIF images are accepted');

  const key = `ugobongo/${randomId()}.${EXT_BY_TYPE[file.type]}`;
  await env.UPLOADS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

  return json({ url: `/uploads/${key}` }, { status: 201 });
}
