import { badRequest, json, randomId } from '../../_lib/http.js';
import { bumpUsage } from '../../_lib/usage.js';

// Public, unauthenticated submission for the DOTS alumni gallery -- the
// first public upload endpoint in this codebase (every other one is
// staff- or account-gated). Submissions land as 'pending' in dots_alumni
// and only appear on the public page once staff approve them via
// /admin/dots-alumni/, so an open form doesn't mean open publishing.
//
// This codebase has no rate-limiting or Turnstile on any public endpoint
// yet (documented gap, see functions/api/shared/[slug].js) -- since this
// is the first one that also accepts a file, it gets a plain honeypot
// field as a minimum bot deterrent beyond what newsletter signup has.
// Worth revisiting with Turnstile if spam becomes a real problem.
const MAX_BYTES = 5 * 1024 * 1024; // 5MB -- a profile photo, not a document
const MAX_NAME_CHARS = 100;
const MAX_BIO_CHARS = 600;
const MAX_EDITION_CHARS = 40;
const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function onRequestPost({ request, env }) {
  try {
    if (!env.UPLOADS) return json({ error: 'UPLOADS storage is not configured' }, { status: 500 });

    const form = await request.formData().catch(() => null);
    if (!form) return badRequest('Invalid form submission');

    // Honeypot: a real visitor never sees or fills this field (hidden via
    // CSS in the form); a filled value means a bot. Return a success-shaped
    // response without actually saving anything, so the bot has no signal
    // it was caught.
    if (form.get('website')) return json({ ok: true }, { status: 201 });

    const name = String(form.get('name') || '').trim().slice(0, MAX_NAME_CHARS);
    const bio = String(form.get('bio') || '').trim().slice(0, MAX_BIO_CHARS);
    const edition = String(form.get('edition') || '1').trim().slice(0, MAX_EDITION_CHARS) || '1';
    const file = form.get('photo');

    if (!name) return badRequest('Name is required');
    if (!bio) return badRequest('A short bio is required');
    if (!file || typeof file === 'string') return badRequest('A photo is required');
    if (file.size > MAX_BYTES) return badRequest(`Photo is too large — ${Math.round(MAX_BYTES / (1024 * 1024))}MB maximum`);
    if (!EXT_BY_TYPE[file.type]) return badRequest('Photo must be a JPEG, PNG, or WebP image');

    const key = `dots-alumni/${randomId()}.${EXT_BY_TYPE[file.type]}`;
    await env.UPLOADS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    bumpUsage(env, 'upload');

    const id = randomId();
    await env.DB.prepare(
      'INSERT INTO dots_alumni (id, edition, name, bio, photo_url, status) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(id, edition, name, bio, `/uploads/${key}`, 'pending').run();

    return json({ ok: true, id }, { status: 201 });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
