import { requireUgobongoAdmin } from '../../_lib/ugobongoAuth.js';
import { badRequest, json, randomId } from '../../_lib/http.js';

// File upload for the Unfiltered Bot, gated by the same admin Basic Auth
// as the rest of /ugobongo/bot. Any file type is accepted (matching the
// admin panel's upload endpoint). Files still land in R2 (something has
// to hold them to give the browser a URL to display) even though the
// surrounding chat conversation itself is never persisted anywhere.
const MAX_BYTES = 10 * 1024 * 1024;

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
  if (file.size > MAX_BYTES) return badRequest('File is too large — 10MB maximum');

  const key = `ugobongo-bot/${randomId()}.${extFromFile(file)}`;
  await env.UPLOADS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } });

  return json({ url: `/uploads/${key}` }, { status: 201 });
}
