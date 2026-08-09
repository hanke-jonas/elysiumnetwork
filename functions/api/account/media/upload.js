import { requireAnyUser } from '../../../_lib/guard.js';
import { badRequest, json, randomId } from '../../../_lib/http.js';

// Any file type accepted — functions/uploads/[[path]].js forces anything
// outside a small known-safe set to download rather than render inline, so
// an uploaded HTML/SVG file can't execute script when someone opens its URL.
const MAX_BYTES = 15 * 1024 * 1024; // 15MB — generous for a personal photo/document, still well under Cloudflare's own ~100MB Worker request-body ceiling on this plan.
const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' };

// Same shape as the admin upload endpoint, but gated on a member's own
// public session rather than staff, and always written under that member's
// own `users/<id>/` prefix — a member can never write into another
// member's space or the org's admin-managed folders.
export async function onRequestPost({ request, env }) {
  const session = await requireAnyUser(request, env);
  if (session instanceof Response) return session;
  if (!env.UPLOADS) return json({ error: 'UPLOADS storage is not configured' }, { status: 500 });

  const form = await request.formData().catch(() => null);
  const file = form && form.get('file');
  if (!file || typeof file === 'string') return badRequest('No file provided');
  if (file.size > MAX_BYTES) return badRequest('File is too large — 15MB maximum');

  let folder = String(form.get('folder') || '').replace(/^\/+/, '').replace(/\.\./g, '');
  if (folder && !folder.endsWith('/')) folder += '/';

  const nameExt = (file.name || '').split('.').pop();
  const ext = EXT_BY_TYPE[file.type] || (nameExt && nameExt.length <= 8 ? nameExt.toLowerCase() : 'bin');
  const key = `users/${session.user.id}/${folder}${randomId()}.${ext}`;
  await env.UPLOADS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

  return json({ url: `/uploads/${key}`, filename: file.name || null }, { status: 201 });
}
