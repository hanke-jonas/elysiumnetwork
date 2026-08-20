import { badRequest, json, randomId } from '../../_lib/http.js';

// Public, unauthenticated (but invite-gated) submission for the DOTS
// alumni gallery -- the first public upload endpoint in this codebase
// (every other one is staff- or account-gated). Gated by a personal
// access code staff generate per real participant in /admin/dots-codes/
// -- this isn't a fully open form, just one that doesn't require a full
// account. The code is single-use for CREATING an entry (claimed
// atomically below), but once linked to that entry it becomes a
// permanent editing key -- see check-code.js's 'edit' mode and
// propose-edit.js, which the same code keeps unlocking indefinitely.
// Submissions land as 'pending' in dots_alumni and only appear
// on the public gallery (and get an individual portfolio page at
// /dots/alumni/<slug>/) once staff approve them via /admin/dots-alumni/,
// so an open code doesn't mean open publishing either.
//
// A simple fixed set of fields -- name, photo, bio, and a few optional
// extras -- rather than a drag-and-drop page builder; every image is
// uploaded ahead of time via upload-block-image.js as the participant
// fills out the form, so this endpoint only ever receives already-hosted
// URLs, never a raw file.
//
// A plain honeypot field is kept as defense-in-depth even with the code
// gate -- this codebase has no rate-limiting or Turnstile anywhere yet
// (documented gap, see functions/api/shared/[slug].js).
const MAX_NAME_CHARS = 100;
const MAX_PRONOUNS_CHARS = 30;
const MAX_ROLE_CHARS = 120;
const MAX_LOCATION_CHARS = 80;
const MAX_QUOTE_CHARS = 300;
const MAX_BIO_CHARS = 600;
const MAX_STORY_CHARS = 4000;
const MAX_EXTRA_PHOTOS = 6;
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

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData().catch(() => null);
    if (!form) return badRequest('Invalid form submission');

    // Honeypot: a real visitor never sees or fills this field (hidden via
    // CSS in the form); a filled value means a bot. Return a success-shaped
    // response without actually saving anything, so the bot has no signal
    // it was caught.
    if (form.get('website_hp')) return json({ ok: true }, { status: 201 });

    // The consent checkbox is `required` client-side, but that's only ever
    // a UX nicety a request can skip -- the actual record of "this person
    // agreed to have this published" has to be enforced here too.
    if (!form.get('consent')) return badRequest('Please confirm you agree to have your page published before submitting.');

    const code = String(form.get('code') || '').trim().toUpperCase();
    if (!code) return badRequest('An access code is required');
    const codeRow = await env.DB.prepare('SELECT edition, used_at FROM dots_access_codes WHERE code = ?').bind(code).first();
    if (!codeRow) return badRequest('That access code was not recognized.');
    if (codeRow.used_at) return badRequest('That access code has already been used to create an entry — enter it again on the submission page to edit that entry instead.');

    const name = String(form.get('name') || '').trim().slice(0, MAX_NAME_CHARS);
    const pronouns = String(form.get('pronouns') || '').trim().slice(0, MAX_PRONOUNS_CHARS);
    const currentRole = String(form.get('current_role') || '').trim().slice(0, MAX_ROLE_CHARS);
    const location = String(form.get('location') || '').trim().slice(0, MAX_LOCATION_CHARS);
    const quote = String(form.get('quote') || '').trim().slice(0, MAX_QUOTE_CHARS);
    const bio = String(form.get('bio') || '').trim().slice(0, MAX_BIO_CHARS);
    const story = String(form.get('story') || '').trim().slice(0, MAX_STORY_CHARS);
    const photoUrl = String(form.get('photo_url') || '').trim().slice(0, 500);

    let extraPhotos;
    try { extraPhotos = JSON.parse(form.get('photos') || '[]'); } catch { extraPhotos = []; }
    if (!Array.isArray(extraPhotos)) extraPhotos = [];
    extraPhotos = extraPhotos.filter((u) => typeof u === 'string' && u).slice(0, MAX_EXTRA_PHOTOS);

    if (!name) return badRequest('A name is required');
    if (!bio) return badRequest('A short bio is required');

    const links = LINK_FIELDS
      .map(([field, label]) => ({ label, url: normalizeUrl(form.get(field)) }))
      .filter((l) => l.url);

    // Claimed last, right before the insert, and only if everything else
    // above already succeeded -- so a validation error never burns the
    // participant's one-time code. The WHERE used_at IS NULL makes this an
    // atomic claim: if two requests raced on the same code, only one can
    // win.
    const claim = await env.DB.prepare(
      "UPDATE dots_access_codes SET used_at = datetime('now') WHERE code = ? AND used_at IS NULL",
    ).bind(code).run();
    if (!claim.meta || claim.meta.changes !== 1) return badRequest('That access code has already been used.');

    const id = randomId();
    const slug = `${slugify(name) || 'alumnus'}-${id.slice(0, 6)}`;

    await env.DB.prepare(
      `INSERT INTO dots_alumni (id, slug, edition, name, pronouns, current_role, location, quote, bio, story, photo_url, photos_json, links_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    ).bind(id, slug, codeRow.edition, name, pronouns || null, currentRole || null, location || null, quote || null, bio, story || null, photoUrl, JSON.stringify(extraPhotos), JSON.stringify(links)).run();

    await env.DB.prepare('UPDATE dots_access_codes SET dots_alumni_id = ? WHERE code = ?').bind(id, code).run();

    return json({ ok: true, id }, { status: 201 });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
