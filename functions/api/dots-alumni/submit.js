import { badRequest, json, randomId } from '../../_lib/http.js';
import { bumpUsage } from '../../_lib/usage.js';
import { sanitizeBlocks } from '../../_lib/dotsBlocks.js';

// Public, unauthenticated (but invite-gated) submission for the DOTS
// alumni gallery -- the first public upload endpoint in this codebase
// (every other one is staff- or account-gated). Gated by a one-time
// access code staff generate per real participant in /admin/dots-codes/
// -- this isn't a fully open form, just one that doesn't require a full
// account. Submissions land as 'pending' in dots_alumni and only appear
// on the public gallery (and get an individual portfolio page at
// /dots/alumni/<slug>/) once staff approve them via /admin/dots-alumni/,
// so an open code doesn't mean open publishing either.
//
// A plain honeypot field is kept as defense-in-depth even with the code
// gate -- this codebase has no rate-limiting or Turnstile anywhere yet
// (documented gap, see functions/api/shared/[slug].js).
const MAX_BYTES = 5 * 1024 * 1024; // 5MB -- a profile photo, not a document
const MAX_NAME_CHARS = 100;
const MAX_PRONOUNS_CHARS = 30;
const MAX_ROLE_CHARS = 120;
const MAX_LOCATION_CHARS = 80;
const MAX_QUOTE_CHARS = 300;
const MAX_BIO_CHARS = 600;
const MAX_STORY_CHARS = 4000;
const MAX_EXTRA_PHOTOS = 4;
const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const LINK_FIELDS = [
  ['instagram', 'Instagram'],
  ['linkedin', 'LinkedIn'],
  ['website', 'Website'],
];

function slugify(name) {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Forgiving on purpose: a public form shouldn't reject "instagram.com/x"
// just because someone didn't type the scheme.
function normalizeUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function uploadImage(env, file) {
  if (!file || typeof file === 'string') return null;
  if (file.size > MAX_BYTES) throw new Error(`Photo is too large — ${Math.round(MAX_BYTES / (1024 * 1024))}MB maximum`);
  if (!EXT_BY_TYPE[file.type]) throw new Error('Photos must be JPEG, PNG, or WebP images');
  const key = `dots-alumni/${randomId()}.${EXT_BY_TYPE[file.type]}`;
  await env.UPLOADS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  bumpUsage(env, 'upload');
  return `/uploads/${key}`;
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.UPLOADS) return json({ error: 'UPLOADS storage is not configured' }, { status: 500 });

    const form = await request.formData().catch(() => null);
    if (!form) return badRequest('Invalid form submission');

    // Honeypot: a real visitor never sees or fills this field (hidden via
    // CSS in the form); a filled value means a bot. Return a success-shaped
    // response without actually saving anything, so the bot has no signal
    // it was caught.
    if (form.get('website_hp')) return json({ ok: true }, { status: 201 });

    const code = String(form.get('code') || '').trim().toUpperCase();
    if (!code) return badRequest('An access code is required');
    const codeRow = await env.DB.prepare('SELECT edition, used_at FROM dots_access_codes WHERE code = ?').bind(code).first();
    if (!codeRow) return badRequest('That access code was not recognized.');
    if (codeRow.used_at) return badRequest('That access code has already been used.');

    const name = String(form.get('name') || '').trim().slice(0, MAX_NAME_CHARS);
    const pronouns = String(form.get('pronouns') || '').trim().slice(0, MAX_PRONOUNS_CHARS);
    const currentRole = String(form.get('current_role') || '').trim().slice(0, MAX_ROLE_CHARS);
    const location = String(form.get('location') || '').trim().slice(0, MAX_LOCATION_CHARS);
    const quote = String(form.get('quote') || '').trim().slice(0, MAX_QUOTE_CHARS);
    const bio = String(form.get('bio') || '').trim().slice(0, MAX_BIO_CHARS);
    const story = String(form.get('story') || '').trim().slice(0, MAX_STORY_CHARS);
    const file = form.get('photo');
    const extraFiles = form.getAll('photos').filter((f) => f && typeof f !== 'string').slice(0, MAX_EXTRA_PHOTOS);

    if (!name) return badRequest('Name is required');
    if (!bio) return badRequest('A short bio is required');
    if (!file || typeof file === 'string') return badRequest('A photo is required');

    let photoUrl;
    let extraPhotoUrls;
    try {
      photoUrl = await uploadImage(env, file);
      extraPhotoUrls = [];
      for (const extra of extraFiles) {
        const url = await uploadImage(env, extra);
        if (url) extraPhotoUrls.push(url);
      }
    } catch (err) {
      return badRequest(err.message);
    }

    const links = LINK_FIELDS
      .map(([field, label]) => ({ label, url: normalizeUrl(form.get(field)) }))
      .filter((l) => l.url);

    let blocks = null;
    const rawBlocks = form.get('blocks');
    if (rawBlocks) {
      try { blocks = sanitizeBlocks(JSON.parse(rawBlocks)); } catch { blocks = null; }
    }

    // Claimed last, right before the insert, and only if everything else
    // above already succeeded -- so a failed upload or validation error
    // never burns the participant's one-time code. The WHERE used_at IS
    // NULL makes this an atomic claim: if two requests raced on the same
    // code, only one can win.
    const claim = await env.DB.prepare(
      "UPDATE dots_access_codes SET used_at = datetime('now') WHERE code = ? AND used_at IS NULL",
    ).bind(code).run();
    if (!claim.meta || claim.meta.changes !== 1) return badRequest('That access code has already been used.');

    const id = randomId();
    const slug = `${slugify(name) || 'alumnus'}-${id.slice(0, 6)}`;

    await env.DB.prepare(
      `INSERT INTO dots_alumni (id, slug, edition, name, pronouns, current_role, location, quote, bio, story, photo_url, photos_json, links_json, blocks_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    ).bind(id, slug, codeRow.edition, name, pronouns || null, currentRole || null, location || null, quote || null, bio, story || null, photoUrl, JSON.stringify(extraPhotoUrls), JSON.stringify(links), blocks ? JSON.stringify(blocks) : null).run();

    await env.DB.prepare('UPDATE dots_access_codes SET dots_alumni_id = ? WHERE code = ?').bind(id, code).run();

    return json({ ok: true, id }, { status: 201 });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
