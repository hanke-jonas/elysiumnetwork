import { requireUgobongoAdmin } from '../../_lib/ugobongoAuth.js';
import { badRequest, json, randomId } from '../../_lib/http.js';

const MAX_BYTES = 20 * 1024 * 1024;

// Any file type is accepted here (admin-only, behind requireUgobongoAdmin) —
// the extension is taken from the uploaded filename when present, since
// file.type is unreliable for formats the browser doesn't recognize (e.g.
// HEIC). Non-web-renderable formats will simply not preview as an <img>
// on the page; that's a content choice, not something this endpoint
// enforces.
function extFromFile(file) {
  const name = typeof file.name === 'string' ? file.name : '';
  const match = /\.([a-zA-Z0-9]{1,8})$/.exec(name);
  if (match) return match[1].toLowerCase();
  const typeMatch = /\/([a-zA-Z0-9.+-]+)$/.exec(file.type || '');
  return typeMatch ? typeMatch[1].toLowerCase() : 'bin';
}

export async function onRequestPost({ request, env }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;
  if (!env.UPLOADS) return json({ error: 'UPLOADS storage is not configured' }, { status: 500 });

  const form = await request.formData().catch(() => null);
  const file = form && form.get('file');
  if (!file || typeof file === 'string') return badRequest('No file provided');
  if (file.size > MAX_BYTES) return badRequest('File is too large — 20MB maximum');

  const key = `ugobongo/${randomId()}.${extFromFile(file)}`;
  await env.UPLOADS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } });

  return json({ url: `/uploads/${key}` }, { status: 201 });
}
